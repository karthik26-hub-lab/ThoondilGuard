import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {randomBytes,scryptSync} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
if(existsSync('.env')){console.error('Existing .env preserved. Edit it locally using .env.example.');process.exit(1);}
const rl=createInterface({input:process.stdin,output:process.stdout});
const username=(await rl.question('Administrator username: ')).trim();
const password=await rl.question('New administrator password (local terminal; input is visible): ');
rl.close();
if(!username||password.length<12)throw Error('Username and a password of at least 12 characters required');
const salt=randomBytes(16).toString('hex');
let config=readFileSync('.env.example','utf8');
const values={APP_SECRET:randomBytes(48).toString('hex'),ADMIN_USERNAME:username,ADMIN_PASSWORD_HASH:salt+':'+scryptSync(password,salt,64).toString('hex'),CLIENT_ORIGIN:'http://localhost:4180,http://localhost:4190,http://127.0.0.1:4190'};
for(const [key,value] of Object.entries(values)){const line=key+'='+JSON.stringify(value);const pattern=new RegExp('^'+key+'=.*$','m');config=pattern.test(config)?config.replace(pattern,line):config+'\n'+line;}
writeFileSync('.env',config,{flag:'wx',mode:0o600});console.log('Local .env created. Set MONGODB_URI and SMS/email provider credentials locally before starting. No provider secrets were requested.');
