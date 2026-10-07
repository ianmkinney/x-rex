/** Upstash Redis / Vercel KV over REST. Passkeys need durable storage, so there is no in-memory fallback here. */
export function redisConfig(){
 const pairs=[[process.env.UPSTASH_REDIS_REST_URL,process.env.UPSTASH_REDIS_REST_TOKEN],[process.env.KV_REST_API_URL,process.env.KV_REST_API_TOKEN]];
 const pair=pairs.find(([url,token])=>url?.trim()&&token?.trim());
 return pair?{url:pair[0]!.trim().replace(/\/+$/,''),token:pair[1]!.trim()}:null;
}
export const storageReady=()=>redisConfig()!==null;
export async function redis(command:(string|number)[]):Promise<string|null>{
 const config=redisConfig();if(!config)throw new Error('Redis is not configured');
 const response=await fetch(config.url,{method:'POST',headers:{Authorization:`Bearer ${config.token}`,'Content-Type':'application/json'},body:JSON.stringify(command),cache:'no-store',signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw new Error(`Redis returned ${response.status}`);
 const {result,error}=await response.json() as {result?:unknown;error?:string};
 if(error)throw new Error('Redis command failed');
 return result===null||result===undefined?null:String(result);
}
const CAS="local cur=redis.call('GET',KEYS[1]) if (cur==false and ARGV[1]=='') or cur==ARGV[1] then redis.call('SET',KEYS[1],ARGV[2]) return 1 end return 0";
/** Optimistic read-modify-write: `fn` mutates a copy, and the write only lands if nobody else changed the key meanwhile. */
export async function mutateKey<D,T>(key:string,fresh:()=>D,fn:(doc:D)=>T):Promise<T>{
 for(let attempt=0;attempt<5;attempt++){
  const raw=await redis(['GET',key]);
  const doc=raw?JSON.parse(raw) as D:fresh();
  const result=fn(doc);
  if(await redis(['EVAL',CAS,1,key,raw??'',JSON.stringify(doc)])==='1')return result;
 }
 throw new Error('Concurrent update; retry.');
}
const RATE="local n=redis.call('INCR',KEYS[1]) if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end return n";
export async function incrementWindow(key:string,seconds:number){return Number(await redis(['EVAL',RATE,1,key,seconds]));}
