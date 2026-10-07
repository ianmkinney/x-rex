import {z} from 'zod';
import type {AuthenticationResponseJSON,RegistrationResponseJSON} from '@simplewebauthn/server';
import {PRE_COOKIE,PRE_AUTH_SECONDS,SESSION_COOKIE,SESSION_SECONDS,STEP_COOKIE,STEP_UP_SECONDS,authReady,checkPassword,cookieOptions,equal,issuePreAuth,issueSession,issueStepUp,preAuth,session,signedIn,steppedUp,tooManyAttempts} from './auth';
import {AuthError,assertionOptions,listPasskeys,readPasskeys,relyingPartyConfigError,recoveryGranted,redeemRecoveryCode,regenerateRecoveryCodes,registrationOptions,removePasskey,renamePasskey,verifyAssertion,verifyRegistration} from './passkeys';
import {storageReady} from './store';

const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function set(r:Response,name:string,value:string,maxAge:number){const o=cookieOptions(maxAge);r.headers.append('Set-Cookie',`${name}=${value}; Path=${o.path}; Max-Age=${o.maxAge}; HttpOnly; SameSite=Strict${o.secure?'; Secure':''}`);return r;}
const clear=(r:Response,...names:string[])=>{for(const n of names)set(r,n,'',0);return r;};
const withSession=(r:Response,epoch:string)=>clear(set(r,SESSION_COOKIE,issueSession(epoch),SESSION_SECONDS),PRE_COOKIE);
const credential=z.object({id:z.string().max(1024),rawId:z.string().max(1024),type:z.literal('public-key'),response:z.object({clientDataJSON:z.string().max(8192)}).loose(),clientExtensionResults:z.record(z.string(),z.unknown()).default({}),authenticatorAttachment:z.string().max(40).optional()}).loose();
const assertion=(body:unknown)=>z.object({response:credential}).parse(body).response as unknown as AuthenticationResponseJSON;
const id=z.string().max(1024),name=z.string().max(60);
const limited=()=>reply({error:'Too many attempts. Try again in 15 minutes.'},429);
const expired=()=>reply({error:'Your sign-in step expired. Enter your password again.'},401);
const SIGNED_IN=new Set(['passkeys','passkeys/rename','passkeys/remove','passkeys/recovery-codes','passkey/step/options','passkey/step/verify']);
export const AUTH_ACTIONS=['login','logout','recovery','passkey/login/options','passkey/login/verify','passkey/register/options','passkey/register/verify'];

/** Owner sign-in = owner password, then a user-verified passkey assertion. Returns null for actions it does not own. */
export async function authRoute(action:string,req:Request):Promise<Response|null>{
 const post=req.method==='POST';
 if(!(post&&AUTH_ACTIONS.includes(action))&&!(SIGNED_IN.has(action)&&(post||action==='passkeys')))return null;
 if(action==='logout')return clear(reply({ok:true}),SESSION_COOKIE,STEP_COOKIE,PRE_COOKIE);
 if(!authReady()||!storageReady())return reply({error:'Passkey sign-in is not configured. Set OWNER_PASSWORD, SESSION_SECRET and Redis in Vercel first.'},503);
 const rpError=relyingPartyConfigError();if(rpError)return reply({error:rpError},503);
 try{
  const me=await signedIn(req),s=session(req);
  if(SIGNED_IN.has(action)&&(!me||!s))return reply({error:'Sign in with your passkey first.'},401);
  if(action==='login'){
   if(await tooManyAttempts(req,'login'))return limited();
   const {password}=z.object({password:z.string().max(1000)}).parse(await req.json());
   if(!checkPassword(password))return reply({error:'Sign-in failed.'},401);
   const enrolled=(await readPasskeys()).credentials.length>0;
   return clear(set(reply({next:enrolled?'passkey':'enroll',seconds:PRE_AUTH_SECONDS}),PRE_COOKIE,issuePreAuth(),PRE_AUTH_SECONDS),SESSION_COOKIE,STEP_COOKIE);
  }
  if(action==='passkey/login/options'){const pre=preAuth(req);if(!pre)return expired();return reply(await assertionOptions(req,'login',pre.nonce));}
  if(action==='passkey/login/verify'){
   if(await tooManyAttempts(req,'passkey'))return limited();
   const pre=preAuth(req);if(!pre)return expired();
   const {epoch}=await verifyAssertion(assertion(await req.json()),'login',pre.nonce);
   return withSession(reply({ok:true}),epoch);
  }
  if(action==='recovery'){
   if(await tooManyAttempts(req,'recovery',5))return limited();
   const pre=preAuth(req);if(!pre)return expired();
   const {code}=z.object({code:z.string().max(64)}).strict().parse(await req.json());
   await redeemRecoveryCode(code,pre.nonce);
   return reply(await registrationOptions(req,'recover',pre.nonce));
  }
  if(action==='passkey/register/options'){
   const body=z.object({setupToken:z.string().max(1000).optional()}).strict().parse(await req.json().catch(()=>({})));
   if(me&&s){if(!steppedUp(req))return reply({error:'Confirm with an existing passkey first.'},403);return reply(await registrationOptions(req,'add',s.nonce));}
   const pre=preAuth(req);if(!pre)return expired();
   if(await recoveryGranted(pre.nonce))return reply(await registrationOptions(req,'recover',pre.nonce));
   if(await tooManyAttempts(req,'setup',5))return limited();
   const token=process.env.PASSKEY_SETUP_TOKEN??'';
   if(token.length<32||!body.setupToken||!equal(body.setupToken,token))return reply({error:'Passkey setup is not available.'},403);
   return reply(await registrationOptions(req,'bootstrap',pre.nonce));
  }
  if(action==='passkey/register/verify'){
   if(await tooManyAttempts(req,'passkey'))return limited();
   const body=z.object({response:credential,name:name.default('')}).parse(await req.json());
   const response=body.response as unknown as RegistrationResponseJSON;
   if(me&&s){await verifyRegistration(response,['add'],s.nonce,body.name);return reply({ok:true});}
   const pre=preAuth(req);if(!pre)return expired();
   const result=await verifyRegistration(response,['bootstrap','recover'],pre.nonce,body.name);
   return withSession(reply({ok:true,recoveryCodes:result.recoveryCodes}),result.epoch);
  }
  if(action==='passkeys'){const d=await readPasskeys();return reply({passkeys:listPasskeys(d),recoveryRemaining:d.recovery.length,steppedUp:steppedUp(req)});}
  if(action==='passkey/step/options')return reply(await assertionOptions(req,'step',s!.nonce));
  if(action==='passkey/step/verify'){
   if(await tooManyAttempts(req,'passkey'))return limited();
   await verifyAssertion(assertion(await req.json()),'step',s!.nonce);
   return set(reply({ok:true,seconds:STEP_UP_SECONDS}),STEP_COOKIE,issueStepUp(s!),STEP_UP_SECONDS);
  }
  if(action==='passkeys/rename'){const b=z.object({id,name}).strict().parse(await req.json());await renamePasskey(b.id,b.name);return reply({ok:true});}
  if(action==='passkeys/remove'||action==='passkeys/recovery-codes'){
   if(!steppedUp(req))return reply({error:'Confirm with a passkey first.'},403);
   if(action==='passkeys/recovery-codes')return reply({recoveryCodes:await regenerateRecoveryCodes()});
   const b=z.object({id}).strict().parse(await req.json());
   // Removal revokes every other session (e.g. one opened from the lost device) and re-issues this one.
   return set(reply({ok:true}),SESSION_COOKIE,issueSession(await removePasskey(b.id)),SESSION_SECONDS);
  }
  return null;
 }catch(e){
  if(e instanceof AuthError)return reply({error:e.message},e.status);
  if(e instanceof z.ZodError||e instanceof SyntaxError)return reply({error:'Invalid request fields.'},400);
  console.error('Auth request failed.');return reply({error:'Sign-in is temporarily unavailable.'},503);
 }
}
