import {generateAuthenticationOptions,generateRegistrationOptions,verifyAuthenticationResponse,verifyRegistrationResponse,type AuthenticationResponseJSON,type RegistrationResponseJSON} from '@simplewebauthn/server';
import {isoBase64URL} from '@simplewebauthn/server/helpers';
import {createHash,randomBytes,randomInt,timingSafeEqual} from 'node:crypto';
import {mutateKey,redis} from './store';

const KEY='xrex:passkeys:v1';
export const CHALLENGE_SECONDS=300,RECOVERY_GRANT_SECONDS=600,RECOVERY_CODE_COUNT=10,MAX_PASSKEYS=10;
export type Passkey={id:string;publicKey:string;counter:number;transports?:string[];name:string;createdAt:string;lastUsedAt:string|null;deviceType:string;backedUp:boolean};
/** Single-owner credential set. `epoch` is embedded in session cookies; rotating it revokes every outstanding session. */
export type PasskeyDoc={userId:string;epoch:string;credentials:Passkey[];recovery:string[]};
type Purpose='login'|'step'|'bootstrap'|'recover'|'add';
type Challenge={purpose:Purpose;bind:string;rpID:string;origins:string[];userId?:string};

/** Deliberately vague: callers must not learn which check failed. */
export class AuthError extends Error{status:number;constructor(message='Verification failed. Start again.',status=401){super(message);this.status=status;}}
const fail=()=>new AuthError();
const same=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
const newEpoch=()=>randomBytes(12).toString('hex');
const fresh=():PasskeyDoc=>({userId:isoBase64URL.fromBuffer(randomBytes(32)),epoch:'',credentials:[],recovery:[]});
export async function readPasskeys():Promise<PasskeyDoc>{const raw=await redis(['GET',KEY]);return raw?JSON.parse(raw):fresh();}
const update=<T>(fn:(d:PasskeyDoc)=>T)=>mutateKey(KEY,fresh,fn);
export const listPasskeys=(d:PasskeyDoc)=>d.credentials.map(({id,name,createdAt,lastUsedAt,deviceType,backedUp})=>({id,name,createdAt,lastUsedAt,deviceType,backedUp}));

/**
 * RP ID and allowed origins. Production should pin WEBAUTHN_RP_ID / WEBAUTHN_ORIGINS; otherwise the request host is used,
 * which suits local dev and per-URL Vercel previews (passkeys are bound to the exact host, so each preview enrolls separately).
 */
export function relyingParty(req:Request,env:Record<string,string|undefined>=process.env){
 const url=new URL(req.url),pinned=env.WEBAUTHN_RP_ID?.trim();
 const origins=(env.WEBAUTHN_ORIGINS??'').split(',').map(s=>s.trim().replace(/\/$/,'')).filter(Boolean);
 return {rpID:pinned||url.hostname,rpName:env.WEBAUTHN_RP_NAME?.trim()||'X-Rex',origins:origins.length?origins:[pinned?`https://${pinned}`:url.origin]};
}

const challengeKey=(c:string)=>`xrex:webauthn:challenge:${createHash('sha256').update(c).digest('hex')}`;
const grantKey=(bind:string)=>`xrex:webauthn:recover:${createHash('sha256').update(bind).digest('hex')}`;
const save=(challenge:string,c:Challenge)=>redis(['SET',challengeKey(challenge),JSON.stringify(c),'EX',CHALLENGE_SECONDS]);
/** Challenges are looked up by the value the authenticator signed and deleted on first read, whether or not verification then succeeds. */
async function take(response:{response:{clientDataJSON:string}},purposes:Purpose[],bind:string){
 let challenge='';try{challenge=String(JSON.parse(isoBase64URL.toUTF8String(response.response.clientDataJSON)).challenge??'');}catch{throw fail();}
 if(!/^[A-Za-z0-9_-]{16,256}$/.test(challenge))throw fail();
 const raw=await redis(['GETDEL',challengeKey(challenge)]);if(!raw)throw fail();
 const record=JSON.parse(raw) as Challenge;
 if(!purposes.includes(record.purpose)||!same(record.bind,bind))throw fail();
 return {challenge,record};
}

export async function assertionOptions(req:Request,purpose:'login'|'step',bind:string){
 const doc=await readPasskeys();if(!doc.credentials.length)throw fail();
 const rp=relyingParty(req);
 const options=await generateAuthenticationOptions({rpID:rp.rpID,userVerification:'required',timeout:CHALLENGE_SECONDS*1000,allowCredentials:doc.credentials.map(c=>({id:c.id,transports:c.transports}))});
 await save(options.challenge,{purpose,bind,rpID:rp.rpID,origins:rp.origins});
 return options;
}
export async function verifyAssertion(response:AuthenticationResponseJSON,purpose:'login'|'step',bind:string){
 const {challenge,record}=await take(response,[purpose],bind);
 const stored=(await readPasskeys()).credentials.find(c=>c.id===response.id);if(!stored)throw fail();
 let info;
 try{
  const v=await verifyAuthenticationResponse({response,expectedChallenge:challenge,expectedOrigin:record.origins,expectedRPID:record.rpID,requireUserVerification:true,credential:{id:stored.id,publicKey:isoBase64URL.toBuffer(stored.publicKey),counter:stored.counter,transports:stored.transports}});
  if(!v.verified||!v.authenticationInfo.userVerified)throw fail();info=v.authenticationInfo;
 }catch{throw fail();}
 // Re-check the counter inside the atomic write so two racing assertions cannot both advance from the same value.
 return update(d=>{
  const c=d.credentials.find(x=>x.id===stored.id);if(!c)throw fail();
  if((info.newCounter>0||c.counter>0)&&info.newCounter<=c.counter)throw fail();
  c.counter=info.newCounter;c.lastUsedAt=new Date().toISOString();c.backedUp=info.credentialBackedUp;
  return {id:c.id,epoch:d.epoch};
 });
}

export async function registrationOptions(req:Request,purpose:'bootstrap'|'recover'|'add',bind:string){
 const doc=await readPasskeys(),rp=relyingParty(req);
 if(purpose==='bootstrap'&&doc.credentials.length)throw fail();
 if(purpose!=='bootstrap'&&!doc.credentials.length)throw fail();
 if(doc.credentials.length>=MAX_PASSKEYS)throw new AuthError(`Remove a passkey first; at most ${MAX_PASSKEYS} are allowed.`,400);
 const options=await generateRegistrationOptions({rpName:rp.rpName,rpID:rp.rpID,userName:'x-rex-owner',userDisplayName:rp.rpName,userID:isoBase64URL.toBuffer(doc.userId),attestationType:'none',timeout:CHALLENGE_SECONDS*1000,
  excludeCredentials:doc.credentials.map(c=>({id:c.id,transports:c.transports})),authenticatorSelection:{residentKey:'preferred',userVerification:'required'}});
 await save(options.challenge,{purpose,bind,rpID:rp.rpID,origins:rp.origins,userId:doc.userId});
 return options;
}
export async function verifyRegistration(response:RegistrationResponseJSON,purposes:('bootstrap'|'recover'|'add')[],bind:string,name:string){
 const {challenge,record}=await take(response,purposes,bind);
 let info;
 try{
  const v=await verifyRegistrationResponse({response,expectedChallenge:challenge,expectedOrigin:record.origins,expectedRPID:record.rpID,requireUserVerification:true});
  if(!v.verified||!v.registrationInfo.userVerified)throw fail();info=v.registrationInfo;
 }catch{throw fail();}
 if(record.purpose==='recover'&&!await redis(['GETDEL',grantKey(bind)]))throw fail();
 const now=new Date().toISOString();
 const passkey:Passkey={id:info.credential.id,publicKey:isoBase64URL.fromBuffer(info.credential.publicKey),counter:info.credential.counter,transports:info.credential.transports,name:name.trim().slice(0,60)||'Passkey',createdAt:now,lastUsedAt:now,deviceType:info.credentialDeviceType,backedUp:info.credentialBackedUp};
 const codes=record.purpose==='bootstrap'?recoveryCodes():null;
 return update(d=>{
  if(record.purpose==='bootstrap'){if(d.credentials.length)throw fail();d.userId=record.userId!;d.recovery=codes!.map(hashCode);}
  else if(!d.credentials.length)throw fail();
  if(d.credentials.length>=MAX_PASSKEYS||d.credentials.some(c=>c.id===passkey.id))throw fail();
  d.credentials.push(passkey);
  if(record.purpose!=='add'||!d.epoch)d.epoch=newEpoch();
  return {id:passkey.id,epoch:d.epoch,recoveryCodes:codes};
 });
}

const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const normalize=(code:string)=>code.toUpperCase().replace(/[^A-Z0-9]/g,'');
export const hashCode=(code:string)=>createHash('sha256').update('xrex-recovery.'+normalize(code)).digest('hex');
/** 16 symbols from a 32-character alphabet: 80 bits each, so an unsalted SHA-256 is not brute-forceable. */
export const recoveryCodes=()=>Array.from({length:RECOVERY_CODE_COUNT},()=>Array.from({length:16},()=>ALPHABET[randomInt(32)]).join('').match(/.{4}/g)!.join('-'));
/** Burns one code, revokes all sessions, and opens a short window in which this browser may register a replacement passkey. */
export async function redeemRecoveryCode(code:string,bind:string){
 const h=hashCode(code);
 await update(d=>{
  if(!d.credentials.length||normalize(code).length!==16)throw fail();
  const i=d.recovery.findIndex(x=>same(x,h));if(i<0)throw fail();
  d.recovery.splice(i,1);d.epoch=newEpoch();
 });
 await redis(['SET',grantKey(bind),'1','EX',RECOVERY_GRANT_SECONDS]);
}
export const recoveryGranted=async(bind:string)=>Boolean(await redis(['GET',grantKey(bind)]));
export async function regenerateRecoveryCodes(){const codes=recoveryCodes();await update(d=>{if(!d.credentials.length)throw fail();d.recovery=codes.map(hashCode);});return codes;}
/** Refuses to remove the last passkey; the safe path is to add a replacement first (or use a recovery code). */
export const removePasskey=(id:string)=>update(d=>{
 if(!d.credentials.some(c=>c.id===id))throw new AuthError('Passkey not found.',404);
 if(d.credentials.length<=1)throw new AuthError('Add another passkey before removing your last one.',400);
 d.credentials=d.credentials.filter(c=>c.id!==id);d.epoch=newEpoch();return d.epoch;
});
export const renamePasskey=(id:string,name:string)=>update(d=>{const c=d.credentials.find(x=>x.id===id);if(!c)throw new AuthError('Passkey not found.',404);c.name=name.trim().slice(0,60)||c.name;});
