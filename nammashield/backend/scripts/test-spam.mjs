import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { MongoRateLimitStore } from '../dist/services/rateLimitStore.js';
import { persistentRateLimit, consumeBudget } from '../dist/middleware/rateLimit.js';
import { RateLimitCounter } from '../dist/models/RateLimitCounter.js';
import { connectToDatabase, disconnectFromDatabase } from '../dist/config/database.js';
import { errorHandler } from '../dist/middleware/errorHandler.js';
import { hash } from '../dist/services/security.js';

await connectToDatabase();
await RateLimitCounter.init();
const scope='test-spam-'+randomUUID();
const ids=[];
let server;
function store(suffix,window=3600000){const name=scope+suffix;ids.push(hash(name+':contact'));return new MongoRateLimitStore(name,window);}
try {
  const a=store('-shared'),b=store('-shared');
  const hits=await Promise.all(Array.from({length:40},(_,i)=>(i%2?a:b).increment('contact')));
  assert.deepEqual(hits.map(x=>x.totalHits).sort((x,y)=>x-y),Array.from({length:40},(_,i)=>i+1));
  assert.equal((await store('-shared').increment('contact')).totalHits,41);
  await RateLimitCounter.updateOne({_id:ids[0]},{$set:{resetAt:new Date(0)}});
  assert.equal((await a.increment('contact')).totalHits,1);
  const fakeResponse={setHeader(name,value){this[name]=value;}};
  const quota=scope+'-hour';ids.push(hash(quota+':contact'));
  for(let i=0;i<5;i++)await consumeBudget(quota,'contact',5,3600000,fakeResponse);
  await assert.rejects(()=>consumeBudget(quota,'contact',5,3600000,fakeResponse),e=>e.statusCode===429);
  assert.ok(fakeResponse['Retry-After']>0);
  const original=RateLimitCounter.collection.findOneAndUpdate;
  RateLimitCounter.collection.findOneAndUpdate=async()=>{throw Error('Unavailable');};
  try{await assert.rejects(()=>a.increment('contact'),e=>e.statusCode===503);}finally{RateLimitCounter.collection.findOneAndUpdate=original;}
  const app=express();app.set('trust proxy',false);
  const routeScope=scope+'-proxy';
  // Express's default IPv6 normalization leaves this IPv4 address unchanged.
  ids.push(hash(routeScope+':127.0.0.1'));
  app.get('/check',persistentRateLimit(routeScope,2,60000),(_req,res)=>res.json({ok:true}));app.use(errorHandler);
  server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const url='http://127.0.0.1:'+server.address().port+'/check';
  for(let i=1;i<=3;i++){const r=await fetch(url,{headers:{'X-Forwarded-For':'198.51.100.'+i}});assert.equal(r.status,i===3?429:200);if(i===3)assert.ok(Number(r.headers.get('Retry-After'))>0);}
  // Only a specifically trusted proxy can supply a client address.
  await new Promise(r=>server.close(r));server=undefined;
  const proxyApp=express();proxyApp.set('trust proxy',['127.0.0.1/32']);
  const trustedScope=scope+'-trusted';
  ids.push(hash(trustedScope+':198.51.100.1'),hash(trustedScope+':198.51.100.2'));
  proxyApp.get('/check',persistentRateLimit(trustedScope,1,60000),(_req,res)=>res.json({ok:true}));proxyApp.use(errorHandler);
  server=proxyApp.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const trustedUrl='http://127.0.0.1:'+server.address().port+'/check';
  for(const [ip,status] of [['198.51.100.1',200],['198.51.100.2',200],['198.51.100.1',429]])assert.equal((await fetch(trustedUrl,{headers:{'X-Forwarded-For':ip}})).status,status);
  console.log('PASS: live MongoDB concurrent/shared counters, new-store persistence, expired-window reset, independent hourly OTP quota, fail-closed storage errors, forged forwarding headers and Retry-After. No OTP messages sent.');
}finally{
  if(server)await new Promise(r=>server.close(r));
  await RateLimitCounter.deleteMany({_id:{$in:ids}});
  await disconnectFromDatabase();
}
