import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {clientIp} from '../client-ip';
import {readPasskeys,relyingParty} from './passkeys';
import {incrementWindow,storageReady} from './store';

export const SESSION_COOKIE='xrex_session',PRE_COOKIE='xrex_pre',STEP_COOKIE='xrex_step';
export const SESSION_SECONDS=60*60*24*7,PRE_AUTH_SECONDS=300,STEP_UP_SECONDS=300,ATTEMPT_WINDOW_SECONDS=900;
type Kind='session'|'pre'|'step';
type Token={t:Kind;n:string;e?:string;x:number};

const secret=()=>process.env.SESSION_SECRET?.trim()||'';
const password=()=>process.env.OWNER_PASSWORD||'';
export const authReady=()=>password().length>=16&&secret().length>=32;
export function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export const checkPassword=(value:string)=>authReady()&&equal(value,password());
export const cookieOptions=(maxAge:number)=>({path:'/',maxAge,secure:true});

const mac=(body:string)=>createHmac('sha256',secret()).update(`xrex-auth.v1.${body}`).digest('base64url');
function issue(t:Kind,seconds:number,extra:{n?:string;e?:string}={}){
 const token:Token={t,n:extra.n??randomBytes(16).toString('base64url'),...(extra.e!==undefined?{e:extra.e}:{}),x:Math.floor(Date.now()/1000)+seconds};
 const body=Buffer.from(JSON.stringify(token)).toString('base64url');
 return `${body}.${mac(body)}`;
}
function cookie(req:Request,name:string){
 for(const part of (req.headers.get('cookie')||'').split(';')){const i=part.indexOf('=');if(i>0&&part.slice(0,i).trim()===name)return part.slice(i+1).trim();}
 return '';
}
/** Signature, kind and expiry only. Each kind is signed into the payload, so a pre-auth token can never pass as a session. */
function read(req:Request,name:string,t:Kind):Token|null{
 if(!authReady())return null;
 const [body,sig,...rest]=cookie(req,name).split('.');
 if(!body||!sig||rest.length||!equal(sig,mac(body)))return null;
 try{const token=JSON.parse(Buffer.from(body,'base64url').toString()) as Token;return token.t===t&&typeof token.n==='string'&&token.x>Date.now()/1000?token:null;}catch{return null;}
}

export const issuePreAuth=()=>issue('pre',PRE_AUTH_SECONDS);
export const preAuth=(req:Request)=>{const t=read(req,PRE_COOKIE,'pre');return t?{nonce:t.n}:null;};
export const issueSession=(epoch:string)=>issue('session',SESSION_SECONDS,{e:epoch});
export const session=(req:Request)=>{const t=read(req,SESSION_COOKIE,'session');return t&&t.e?{nonce:t.n,epoch:t.e}:null;};
/** A valid signature is not enough: the session's epoch must match the passkey store, so recovery or removal revokes it. */
export async function signedIn(req:Request){
 const s=session(req);if(!s||!storageReady())return false;
 const {epoch,credentials}=await readPasskeys();
 return credentials.length>0&&epoch!==''&&equal(s.epoch,epoch);
}
export const issueStepUp=()=>issue('step',STEP_UP_SECONDS);
export const steppedUp=(req:Request)=>Boolean(session(req)&&read(req,STEP_COOKIE,'step'));

export async function tooManyAttempts(req:Request,bucket:string,limit=10){
 return await incrementWindow(`xrex:auth:attempts:${bucket}:${clientIp(req)}`,ATTEMPT_WINDOW_SECONDS)>limit;
}
export function sameOrigin(req:Request){
 const origin=req.headers.get('origin');
 return Boolean(origin)&&(origin===new URL(req.url).origin||relyingParty(req).origins.includes(origin!));
}
