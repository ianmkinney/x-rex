import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {NextResponse,type NextRequest} from 'next/server';
import {UNKNOWN_IP,clientIp} from './client-ip';
export {clientIp};

export const INVITE_COOKIE='xrex_invite';
export const INVITE_MAX_AGE=60*60*24*30;
export const INVITE_ATTEMPTS_PER_IP=20;
type Handler=(request:NextRequest)=>Promise<Response>;
const guarded=new WeakSet<Handler>();
const json=(body:Record<string,unknown>,status:number,headers:Record<string,string>={})=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});

export const isProduction=()=>process.env.NODE_ENV==='production'||process.env.VERCEL_ENV==='production';
export function paidFeaturesEnabled(){return process.env.PAID_FEATURES_ENABLED?.trim().toLowerCase()!=='false';}
function inviteCodes(){return (process.env.INVITE_CODES||'').split(',').map(c=>c.trim()).filter(Boolean);}
function digest(value:string){return createHash('sha256').update(value).digest();}
function safeEqual(a:string,b:string){return timingSafeEqual(digest(a),digest(b));}

export const MIN_INVITE_SECRET_LENGTH=32;
// Dev/test only: a per-process key, so local invite cookies stop working on restart. Production never uses it.
const devInviteSecret=randomBytes(32).toString('base64url');
export function inviteSecret(){
 const secret=process.env.INVITE_COOKIE_SECRET?.trim()||'';
 if(isProduction())return secret.length>=MIN_INVITE_SECRET_LENGTH?secret:null;
 return secret||devInviteSecret;
}
// The cookie holds an HMAC of the code, never the code itself. Removing a code from INVITE_CODES revokes its cookies.
export function inviteToken(code:string){const secret=inviteSecret();return secret?createHmac('sha256',secret).update(`invite:v1:${code}`).digest('base64url'):null;}
export function isValidInviteCode(code:string){const input=code.trim();let match=false;for(const c of inviteCodes())if(safeEqual(c,input))match=true;return input.length>0&&match;}
export function hasValidInvite(request:NextRequest){
 const value=request.cookies.get(INVITE_COOKIE)?.value;
 if(!value)return false;
 let match=false;for(const c of inviteCodes()){const token=inviteToken(c);if(token&&safeEqual(token,value))match=true;}
 return match;
}
export function setInviteCookie(response:NextResponse,code:string){
 const token=inviteToken(code.trim());if(!token)throw new Error('Invite cookies cannot be signed');
 response.cookies.set(INVITE_COOKIE,token,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:INVITE_MAX_AGE});
 return response;
}

export type CounterStore={incr(key:string,ttlSeconds:number):Promise<number>};
let memoryDay='';
const memory=new Map<string,number>();
export const memoryStore:CounterStore={async incr(key){
 const day=utcDay();
 if(day!==memoryDay){memory.clear();memoryDay=day;}
 const count=(memory.get(key)||0)+1;memory.set(key,count);return count;
}};
export function resetMemoryStore(){memory.clear();memoryDay='';}
function redisConfig(){
 const pairs=[[process.env.UPSTASH_REDIS_REST_URL,process.env.UPSTASH_REDIS_REST_TOKEN],[process.env.KV_REST_API_URL,process.env.KV_REST_API_TOKEN]];
 const pair=pairs.find(([url,token])=>url?.trim()&&token?.trim());
 return pair?{url:pair[0]!.trim().replace(/\/+$/,''),token:pair[1]!.trim()}:null;
}
function redisStore(url:string,token:string):CounterStore{return {async incr(key,ttlSeconds){
 const response=await fetch(`${url}/pipeline`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify([['INCR',key],['EXPIRE',key,String(ttlSeconds)]]),cache:'no-store',signal:AbortSignal.timeout(3000)});
 if(!response.ok)throw new Error(`Counter store returned ${response.status}`);
 const result=(await response.json() as {result?:unknown}[])?.[0]?.result;
 if(typeof result!=='number')throw new Error('Counter store returned no count');
 return result;
}};}
// In-memory counters are per instance and reset on cold start, so production must use shared Redis/KV.
export function counterStore():CounterStore{
 const config=redisConfig();
 if(config)return redisStore(config.url,config.token);
 if(isProduction())throw new Error('Redis/KV is required for usage limits in production');
 return memoryStore;
}
export function counterBackend(){return redisConfig()?'redis':'memory';}

function utcDay(now=Date.now()){return new Date(now).toISOString().slice(0,10);}
export function secondsUntilUtcMidnight(now=Date.now()){const d=new Date(now);return Math.max(1,Math.ceil((Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)-now)/1000));}
function cap(name:string,fallback:number){const raw=process.env[name]?.trim();const value=raw?Number(raw):NaN;return Number.isInteger(value)&&value>=0?value:fallback;}
const COUNTER_TTL=60*60*48;
// Requests without any usable client IP share one bucket, so it gets a much smaller cap than a single known IP.
export const UNKNOWN_IP_DAILY_CAP=5;

export async function countInviteAttempt(request:NextRequest){return counterStore().incr(`xrex:invite:${utcDay()}:${clientIp(request)}`,COUNTER_TTL);}
export function tooManyRequests(error:string){const retry=secondsUntilUtcMidnight();return json({error,code:'rate_limited',retryAfterSeconds:retry},429,{'Retry-After':String(retry)});}

export async function paidAccessDenial(request:NextRequest):Promise<Response|null>{
 if(!paidFeaturesEnabled())return json({error:'AI and X features are paused by the site owner right now. Free post scoring still works.',code:'paid_disabled'},503);
 if(!hasValidInvite(request)){
  // A wrong cookie is an invite guess (cookies for a known code can be computed), so it shares the invite attempt limit.
  if(request.cookies.has(INVITE_COOKIE)&&await countInviteAttempt(request).catch(()=>0)>INVITE_ATTEMPTS_PER_IP)return tooManyRequests('Too many invite attempts today. Please try again after midnight UTC.');
  return json({error:'This feature needs an invite code. Enter yours at the top of the page to unlock AI and X features. Free post scoring works without one.',code:'invite_required'},401);
 }
 const perIp=cap('PAID_DAILY_CAP_PER_IP',20),global=cap('PAID_DAILY_CAP_GLOBAL',300),day=utcDay();
 try{
  const store=counterStore(),ip=clientIp(request);
  if(ip===UNKNOWN_IP){
   const limit=Math.min(perIp,UNKNOWN_IP_DAILY_CAP);
   if(await store.incr(`xrex:paid:${day}:unknown`,COUNTER_TTL)>limit)return tooManyRequests(`We couldn’t identify your network, so a smaller shared limit of ${limit} AI and X requests applies today. It resets at midnight UTC.`);
  }else if(await store.incr(`xrex:paid:${day}:ip:${ip}`,COUNTER_TTL)>perIp)return tooManyRequests(`You’ve used today’s ${perIp} AI and X requests. Your limit resets at midnight UTC.`);
  if(await store.incr(`xrex:paid:${day}:global`,COUNTER_TTL)>global)return tooManyRequests('X-Rex has reached today’s shared limit for AI and X requests. Please try again after midnight UTC.');
 }catch{
  return json({error:'Usage limits can’t be checked right now, so AI and X features are paused. Please try again shortly.',code:'limits_unavailable'},503);
 }
 return null;
}

// Every route that spends OpenRouter or X API credit must export its handler through this wrapper.
export function withPaidGuard(handler:Handler):Handler{
 const wrapped:Handler=async request=>(await paidAccessDenial(request))??handler(request);
 guarded.add(wrapped);
 return wrapped;
}
export function isPaidGuarded(handler:unknown){return typeof handler==='function'&&guarded.has(handler as Handler);}
