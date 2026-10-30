import {createHash,generateKeyPairSync,randomBytes,sign} from 'node:crypto';
import {isoBase64URL,isoCBOR} from '@simplewebauthn/server/helpers';
import type {AuthenticationResponseJSON,RegistrationResponseJSON} from '@simplewebauthn/server';

/** In-memory stand-in for the Upstash REST API, covering the commands the app's auth code and daily caps issue. */
export function fakeRedis(){
 const data=new Map<string,{v:string;exp:number}>();
 const get=(k:string)=>{const e=data.get(k);if(e&&e.exp&&e.exp<=Date.now()){data.delete(k);return undefined;}return e;};
 const run=(cmd:(string|number)[]):unknown=>{
  const [op,...a]=cmd;
  if(op==='GET')return get(String(a[0]))?.v??null;
  if(op==='GETDEL'){const e=get(String(a[0]));data.delete(String(a[0]));return e?.v??null;}
  if(op==='SET'){const [k,v,...o]=a.map(String);if(o.includes('NX')&&get(k))return null;const ex=o.indexOf('EX');data.set(k,{v,exp:ex>=0?Date.now()+Number(o[ex+1])*1000:0});return 'OK';}
  if(op==='INCR'){const k=String(a[0]);const n=Number(get(k)?.v??0)+1;data.set(k,{v:String(n),exp:get(k)?.exp||0});return n;}
  if(op==='EXPIRE'){const e=get(String(a[0]));if(!e)return 0;e.exp=Date.now()+Number(a[1])*1000;return 1;}
  if(op==='EVAL'&&String(a[0]).includes("redis.call('INCR'")){const k=String(a[2]);const n=Number(get(k)?.v??0)+1;data.set(k,{v:String(n),exp:get(k)?.exp||Date.now()+900000});return n;}
  if(op==='EVAL'&&String(a[0]).includes("redis.call('GET',KEYS[1])")){const [k,old,next]=[String(a[2]),String(a[3]),String(a[4])];const cur=get(k)?.v;if((cur===undefined&&old==='')||cur===old){data.set(k,{v:next,exp:0});return 1;}return 0;}
  throw new Error('Unexpected command '+op);
 };
 const fetch=async(input:unknown,init?:RequestInit)=>{
  const body=JSON.parse(String(init!.body));
  const result=String(input).endsWith('/pipeline')?(body as (string|number)[][]).map(c=>({result:run(c)})):{result:run(body)};
  return new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}});
 };
 return {data,fetch:fetch as typeof globalThis.fetch,expire:(prefix:string)=>{for(const k of data.keys())if(k.startsWith(prefix))data.delete(k);}};
}

/** A software ES256 authenticator that produces real WebAuthn responses ('none' attestation). */
export function softAuthenticator(rpID:string,origin:string){
 const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'P-256'});
 const jwk=publicKey.export({format:'jwk'});
 const id=randomBytes(16);let counter=0;
 const rpHash=createHash('sha256').update(rpID).digest();
 const flags=(uv:boolean,at=false)=>0x01|(uv?0x04:0)|(at?0x40:0);
 const u32=(n:number)=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;};
 const client=(type:string,challenge:string,o=origin)=>Buffer.from(JSON.stringify({type,challenge,origin:o,crossOrigin:false}));
 return {
  id:isoBase64URL.fromBuffer(id),
  setCounter:(n:number)=>{counter=n;},
  create(challenge:string,{uv=true,origin:o=origin}:{uv?:boolean;origin?:string}={}):RegistrationResponseJSON{
   const cose=isoCBOR.encode(new Map<number,number|Uint8Array>([[1,2],[3,-7],[-1,1],[-2,Buffer.from(jwk.x!,'base64url')],[-3,Buffer.from(jwk.y!,'base64url')]]));
   const authData=Buffer.concat([rpHash,Buffer.from([flags(uv,true)]),u32(counter),Buffer.alloc(16),Buffer.from([0,id.length]),id,Buffer.from(cose)]);
   const attestationObject=isoCBOR.encode(new Map<string,string|Map<string,string>|Uint8Array>([['fmt','none'],['attStmt',new Map<string,string>()],['authData',authData]]));
   return {id:isoBase64URL.fromBuffer(id),rawId:isoBase64URL.fromBuffer(id),type:'public-key',clientExtensionResults:{},
    response:{clientDataJSON:isoBase64URL.fromBuffer(client('webauthn.create',challenge,o)),attestationObject:isoBase64URL.fromBuffer(attestationObject),transports:['internal']}};
  },
  get(challenge:string,{uv=true,origin:o=origin,bump=true}:{uv?:boolean;origin?:string;bump?:boolean}={}):AuthenticationResponseJSON{
   if(bump)counter++;
   const authData=Buffer.concat([rpHash,Buffer.from([flags(uv)]),u32(counter)]);
   const clientDataJSON=client('webauthn.get',challenge,o);
   const signature=sign('sha256',Buffer.concat([authData,createHash('sha256').update(clientDataJSON).digest()]),privateKey);
   return {id:isoBase64URL.fromBuffer(id),rawId:isoBase64URL.fromBuffer(id),type:'public-key',clientExtensionResults:{},
    response:{clientDataJSON:isoBase64URL.fromBuffer(clientDataJSON),authenticatorData:isoBase64URL.fromBuffer(authData),signature:isoBase64URL.fromBuffer(signature)}};
  },
 };
}
