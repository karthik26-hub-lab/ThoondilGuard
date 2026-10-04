import {createHmac,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {AppError} from '../utils/AppError.js';
export function secret(){const value=process.env.APP_SECRET?.trim();if(!value||value.length<32)throw new AppError('Server security configuration is incomplete',503);return value;}
export function hash(value:string){return createHmac('sha256',secret()).update(value).digest('hex');}
export function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function sign(payload:Record<string,unknown>,seconds:number){const data=Buffer.from(JSON.stringify({...payload,exp:Date.now()+seconds*1000})).toString('base64url');return data+'.'+hash(data);}
export function verify(token:string,purpose:string):Record<string,unknown>{if(token.length>2000)throw new AppError('Verification expired',401);const [data,signature]=token.split('.');if(!data||!signature||!equal(hash(data),signature))throw new AppError('Verification expired',401);let payload:Record<string,unknown>;try{payload=JSON.parse(Buffer.from(data,'base64url').toString()) as Record<string,unknown>;}catch{throw new AppError('Verification expired',401);}if(payload.purpose!==purpose||typeof payload.exp!=='number'||payload.exp<Date.now())throw new AppError('Verification expired',401);return payload;}
export function passwordHash(password:string,salt=randomBytes(16).toString('hex')){return salt+':'+scryptSync(password,salt,64).toString('hex');}
export function passwordMatches(password:string,encoded:string){const [salt,digest]=encoded.split(':');return Boolean(salt&&digest)&&equal(passwordHash(password,salt),encoded);}
export function mask(text:string){return text.replace(/\b(?:\+?91[ -]?)?[6-9]\d{9}\b/g,'[PHONE REDACTED]').replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g,'[EMAIL REDACTED]').replace(/\b\d{4,}\b/g,'[NUMBER REDACTED]');}
