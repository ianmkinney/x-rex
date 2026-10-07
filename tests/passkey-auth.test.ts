import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {authRoute} from '../lib/server/auth-routes';
import {SESSION_COOKIE,PRE_COOKIE,STEP_COOKIE,signedIn} from '../lib/server/auth';
import {readPasskeys,relyingParty,relyingPartyConfigError} from '../lib/server/passkeys';
import {withPaidGuard} from '../lib/paid-guard';
import {POST as discover} from '../app/api/discover/route';
import {GET as status} from '../app/api/status/route';
import {GET as authGet,POST as authPost} from '../app/api/auth/[...path]/route';
import {fakeRedis,softAuthenticator} from './webauthn-fixtures';

const ORIGIN='https://xrex.test';
const ENV={OWNER_PASSWORD:'test-password-not-for-deployment',SESSION_SECRET:'test-only-signing-key-not-a-real-secret',PASSKEY_SETUP_TOKEN:'test-only-setup-token-not-a-real-secret',UPSTASH_REDIS_REST_URL:'https://storage.example.test',UPSTASH_REDIS_REST_TOKEN:'test-only'};
const RESET=[...Object.keys(ENV),'NODE_ENV','VERCEL_ENV','WEBAUTHN_RP_NAME','INVITE_CODES','PAID_FEATURES_ENABLED','PAID_DAILY_CAP_PER_IP','PAID_DAILY_CAP_GLOBAL','KV_REST_API_URL','KV_REST_API_TOKEN','WEBAUTHN_RP_ID','WEBAUTHN_ORIGINS','X_BEARER_TOKEN'];

function browser(ip='203.0.113.1'){
 const jar=new Map<string,string>();
 const cookie=()=>[...jar].map(([k,v])=>`${k}=${v}`).join('; ');
 const request=(action:string,body?:unknown)=>new Request(`${ORIGIN}/api/auth/${action}`,{method:body===undefined?'GET':'POST',body:body===undefined?undefined:JSON.stringify(body),
  headers:{origin:ORIGIN,'content-type':'application/json','x-forwarded-for':ip,cookie:cookie()}});
 return {jar,request,
  async call(action:string,body?:unknown){
   const r=(await authRoute(action,request(action,body)))!;assert.ok(r,`unhandled ${action}`);
   const cookies=r.headers.getSetCookie();
   for(const c of cookies){const [pair]=c.split(';');const i=pair.indexOf('=');const [k,v]=[pair.slice(0,i),pair.slice(i+1)];if(!v||/max-age=0/i.test(c))jar.delete(k);else jar.set(k,v);}
   return {status:r.status,body:await r.json(),cookies};
  },
  signedIn:()=>signedIn(request('state')),
  paid:(path='ai',body:unknown={})=>new NextRequest(`${ORIGIN}/api/${path}`,{method:'POST',body:JSON.stringify(body),headers:{'content-type':'application/json','x-forwarded-for':ip,cookie:cookie()}}),
 };
}
async function withLab(fn:(redis:ReturnType<typeof fakeRedis>)=>Promise<void>){
 const old=Object.fromEntries(RESET.map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch,redis=fakeRedis();
 for(const k of RESET)delete process.env[k];
 Object.assign(process.env,ENV);globalThis.fetch=redis.fetch;
 try{await fn(redis);}finally{for(const k of RESET){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}globalThis.fetch=originalFetch;}
}
async function enroll(b=browser(),key=softAuthenticator('xrex.test',ORIGIN)){
 assert.equal((await b.call('login',{password:ENV.OWNER_PASSWORD})).body.next,'enroll');
 const options=await b.call('passkey/register/options',{setupToken:ENV.PASSKEY_SETUP_TOKEN});assert.equal(options.status,200);
 assert.equal(options.body.authenticatorSelection.userVerification,'required');
 const done=await b.call('passkey/register/verify',{response:key.create(options.body.challenge),name:'Laptop'});assert.equal(done.status,200);
 return {b,key,codes:done.body.recoveryCodes as string[],cookies:done.cookies};
}
async function signIn(key:ReturnType<typeof softAuthenticator>,b=browser()){
 assert.equal((await b.call('login',{password:ENV.OWNER_PASSWORD})).body.next,'passkey');
 const options=await b.call('passkey/login/options',{});assert.equal(options.body.userVerification,'required');
 return {b,options:options.body,verify:(response=key.get(options.body.challenge))=>b.call('passkey/login/verify',{response})};
}

test('first passkey needs the password and the setup token, and closes once a passkey exists',()=>withLab(async()=>{
 const stranger=browser();
 assert.equal((await stranger.call('passkey/register/options',{setupToken:ENV.PASSKEY_SETUP_TOKEN})).status,401,'no password step');
 assert.equal((await stranger.call('login',{password:'wrong-password-wrong-password'})).status,401);
 assert.equal(stranger.jar.has(PRE_COOKIE),false);
 const b=browser();await b.call('login',{password:ENV.OWNER_PASSWORD});
 assert.equal(b.jar.has(SESSION_COOKIE),false,'password alone never issues a session');
 assert.equal(await b.signedIn(),false);
 assert.equal((await b.call('passkey/register/options',{})).status,403);
 assert.equal((await b.call('passkey/register/options',{setupToken:'not-the-token-not-the-token-not-it'})).status,403);
 process.env.PASSKEY_SETUP_TOKEN='too-short';
 assert.equal((await b.call('passkey/register/options',{setupToken:'too-short'})).status,403,'weak setup tokens are refused');
 process.env.PASSKEY_SETUP_TOKEN=ENV.PASSKEY_SETUP_TOKEN;
 const {b:owner,codes}=await enroll();
 assert.equal(codes.length,10);assert.ok(codes.every(c=>/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/.test(c)));
 assert.equal(await owner.signedIn(),true);
 const doc=await readPasskeys();
 assert.ok(doc.recovery.every(h=>/^[0-9a-f]{64}$/.test(h))&&!JSON.stringify(doc).includes(codes[0]),'codes are stored hashed only');
 const late=browser();assert.equal((await late.call('login',{password:ENV.OWNER_PASSWORD})).body.next,'passkey');
 assert.equal((await late.call('passkey/register/options',{setupToken:ENV.PASSKEY_SETUP_TOKEN})).status,401,'setup token is useless after enrollment');
}));

test('sign-in requires a user-verified assertion on a single-use, short-lived, browser-bound challenge',()=>withLab(async redis=>{
 const {key}=await enroll();
 const first=await signIn(key);const response=key.get(first.options.challenge);
 assert.equal((await first.verify(response)).status,200);assert.equal(await first.b.signedIn(),true);
 const replay=await signIn(key);assert.equal((await replay.verify(response)).status,401,'a used challenge cannot be replayed');

 const noUv=await signIn(key);assert.equal((await noUv.verify(key.get(noUv.options.challenge,{uv:false}))).status,401);
 const phished=await signIn(key);assert.equal((await phished.verify(key.get(phished.options.challenge,{origin:'https://xrex.test.evil.example'}))).status,401);
 const otherRp=softAuthenticator('evil.example',ORIGIN);
 const wrongRp=await signIn(key);assert.equal((await wrongRp.verify(otherRp.get(wrongRp.options.challenge))).status,401,'an assertion for another RP ID is rejected');

 const a=await signIn(key),other=await signIn(key);
 assert.equal((await other.verify(key.get(a.options.challenge))).status,401,"another browser's challenge is rejected");
 assert.equal((await a.verify(key.get(a.options.challenge))).status,401,'a failed attempt still burns the challenge');

 const slow=await signIn(key);redis.expire('xrex:webauthn:challenge:');
 assert.equal((await slow.verify()).status,401,'expired challenge');
 const ttl=[...redis.data].filter(([k])=>k.startsWith('xrex:webauthn:challenge:'));assert.equal(ttl.length,0);
 const fresh=await signIn(key);const stored=[...redis.data].find(([k])=>k.startsWith('xrex:webauthn:challenge:'))![1];
 assert.ok(stored.exp-Date.now()<=300000&&stored.exp>Date.now());
 assert.equal((await fresh.verify()).status,200);
}));

test('signature counter regressions are rejected as possible cloned authenticators',()=>withLab(async()=>{
 const {key}=await enroll();
 const ok=await signIn(key);key.setCounter(10);assert.equal((await ok.verify()).status,200);
 assert.equal((await readPasskeys()).credentials[0].counter,11);
 const cloned=await signIn(key);key.setCounter(5);assert.equal((await cloned.verify()).status,401);
 const same=await signIn(key);key.setCounter(11);assert.equal((await same.verify(key.get(same.options.challenge,{bump:false}))).status,401,'an equal counter is a regression too');
 assert.equal((await readPasskeys()).credentials[0].counter,11);
}));

test('a recovery code (with the password) registers a replacement passkey and revokes old sessions',()=>withLab(async()=>{
 const {b:oldSession,codes,key}=await enroll();
 const b=browser();await b.call('login',{password:ENV.OWNER_PASSWORD});
 assert.equal((await b.call('recovery',{code:'AAAA-BBBB-CCCC-DDDD'})).status,401);
 assert.equal((await browser().call('recovery',{code:codes[0]})).status,401,'recovery needs the password step');
 const options=await b.call('recovery',{code:codes[0].toLowerCase()});assert.equal(options.status,200);
 assert.equal(await oldSession.signedIn(),false,'redeeming a code signs out every existing session');
 const phone=softAuthenticator('xrex.test',ORIGIN);
 assert.equal((await b.call('passkey/register/verify',{response:phone.create(options.body.challenge),name:'New phone'})).status,200);
 assert.equal(await b.signedIn(),true);
 const doc=await readPasskeys();assert.equal(doc.credentials.length,2);assert.equal(doc.recovery.length,9);
 const again=browser();await again.call('login',{password:ENV.OWNER_PASSWORD});
 assert.equal((await again.call('recovery',{code:codes[0]})).status,401,'codes are single-use');
 assert.equal((await (await signIn(key)).verify()).status,200,'the old passkey keeps working until removed');
}));

test('managing passkeys needs a fresh assertion, never drops the last one, and revokes other sessions on removal',()=>withLab(async()=>{
 const {b,key}=await enroll();const elsewhere=(await signIn(key));await elsewhere.verify();
 assert.equal((await b.call('passkey/register/options',{})).status,403,'adding needs step-up');
 const list=await b.call('passkeys');assert.equal(list.body.passkeys.length,1);assert.equal(list.body.recoveryRemaining,10);
 const id=list.body.passkeys[0].id;
 assert.equal((await browser().call('passkeys/remove',{id})).status,401);
 const step=await b.call('passkey/step/options',{});
 assert.equal((await b.call('passkey/step/verify',{response:key.get(step.body.challenge)})).status,200);
 assert.equal((await b.call('passkeys/remove',{id})).status,400,'the last passkey cannot be removed');
 const options=await b.call('passkey/register/options',{});assert.equal(options.status,200);
 assert.deepEqual(options.body.excludeCredentials.map((c:{id:string})=>c.id),[id]);
 const phone=softAuthenticator('xrex.test',ORIGIN);
 assert.equal((await b.call('passkey/register/verify',{response:phone.create(options.body.challenge),name:'Phone'})).status,200);
 assert.equal(await b.signedIn(),true,'adding keeps the current session');
 assert.equal((await b.call('passkeys/rename',{id,name:'Work laptop'})).status,200);
 assert.equal((await b.call('passkeys/remove',{id})).status,200);
 assert.equal(await b.signedIn(),true,'the remover gets a re-issued session');
 assert.equal(await elsewhere.b.signedIn(),false,'other sessions are revoked');
 assert.deepEqual((await readPasskeys()).credentials.map(c=>c.name),['Phone']);
 assert.equal((await b.call('passkeys/recovery-codes',{})).status,403,'removal re-issued the session, so the old step-up no longer counts');
 const again=await b.call('passkey/step/options',{});
 assert.equal((await b.call('passkey/step/verify',{response:phone.get(again.body.challenge)})).status,200);
 const codes=await b.call('passkeys/recovery-codes',{});assert.equal(codes.body.recoveryCodes.length,10);
}));

test('auth endpoints are rate limited per client',()=>withLab(async()=>{
 const b=browser('198.51.100.7');
 for(let i=0;i<10;i++)assert.equal((await b.call('login',{password:'wrong-password-wrong-password'})).status,401);
 const blocked=await b.call('login',{password:ENV.OWNER_PASSWORD});assert.equal(blocked.status,429);assert.equal(b.jar.has(PRE_COOKIE),false);
 assert.equal((await browser('198.51.100.8').call('login',{password:ENV.OWNER_PASSWORD})).status,200);
}));

test('relying party is pinned by env in production and derived from the host otherwise',()=>{
 const req=new Request('https://x-rex-git-x.vercel.app/api/auth/login');
 assert.deepEqual(relyingParty(req,{}),{rpID:'x-rex-git-x.vercel.app',rpName:'X-Rex',origins:['https://x-rex-git-x.vercel.app']});
 assert.deepEqual(relyingParty(req,{WEBAUTHN_RP_ID:'x-rex.vercel.app'}).origins,['https://x-rex.vercel.app']);
 assert.deepEqual(relyingParty(req,{WEBAUTHN_RP_ID:'example.com',WEBAUTHN_ORIGINS:'https://example.com/, https://app.example.com'}).origins,['https://example.com','https://app.example.com']);
 assert.equal(relyingParty(new Request('http://localhost:3000/api/auth/login'),{}).rpID,'localhost');
 const bound=new Request('http://0.0.0.0:3000/api/auth/login',{headers:{host:'localhost:3000','x-forwarded-host':'localhost:3000','x-forwarded-proto':'http'}});
 assert.deepEqual(relyingParty(bound,{}),{rpID:'localhost',rpName:'X-Rex',origins:['http://localhost:3000']},'next start reports its bind address in req.url');
 assert.equal(relyingParty(new Request('http://0.0.0.0:3000/',{headers:{host:'evil.example/path'}}),{}).rpID,'0.0.0.0','malformed host headers are ignored');
});

test('session cookies are HttpOnly, Secure, SameSite=Strict and signed; forged or swapped tokens are rejected',()=>withLab(async()=>{
 const pre=await browser().call('login',{password:ENV.OWNER_PASSWORD});
 const preCookie=pre.cookies.find(c=>c.startsWith(`${PRE_COOKIE}=`))!;
 assert.match(preCookie,/HttpOnly/);assert.match(preCookie,/Secure/);assert.match(preCookie,/SameSite=Strict/);assert.match(preCookie,/Max-Age=300/);
 const {b,cookies}=await enroll();
 const sessionCookie=cookies.find(c=>c.startsWith(`${SESSION_COOKIE}=`))!;
 assert.match(sessionCookie,/; Path=\/; Max-Age=604800; HttpOnly; SameSite=Strict; Secure$/);
 const value=b.jar.get(SESSION_COOKIE)!;
 const forged=browser();forged.jar.set(SESSION_COOKIE,value.slice(0,-2)+(value.endsWith('A')?'BB':'AA'));
 assert.equal(await forged.signedIn(),false,'tampered signature');
 const [body]=value.split('.');const claims=JSON.parse(Buffer.from(body,'base64url').toString());
 const rewritten=browser();rewritten.jar.set(SESSION_COOKIE,`${Buffer.from(JSON.stringify({...claims,x:claims.x+9e6})).toString('base64url')}.${value.split('.')[1]}`);
 assert.equal(await rewritten.signedIn(),false,'payload edits break the signature');
 const swapped=browser();await swapped.call('login',{password:ENV.OWNER_PASSWORD});swapped.jar.set(SESSION_COOKIE,swapped.jar.get(PRE_COOKIE)!);
 assert.equal(await swapped.signedIn(),false,'a pre-auth token cannot be used as a session');
 process.env.SESSION_SECRET='a-different-signing-key-not-a-real-secret';
 assert.equal(await b.signedIn(),false,'rotating SESSION_SECRET revokes sessions');
 process.env.SESSION_SECRET=ENV.SESSION_SECRET;
 assert.equal(await b.signedIn(),true);
 assert.equal((await b.call('logout',{})).status,200);assert.equal(b.jar.has(SESSION_COOKIE),false);assert.equal(await b.signedIn(),false);
}));

test('a passkey session authorizes paid routes alongside invites; caps and the kill switch still apply',()=>withLab(async redis=>{
 const guarded=withPaidGuard(async()=>Response.json({ok:true}));
 const {b,key}=await enroll(browser('192.0.2.10'));
 assert.equal((await guarded(b.paid())).status,200,'passkey session, no invite cookie');
 assert.equal((await guarded(browser('192.0.2.11').paid())).status,401,'no session, no invite');
 assert.equal((await (await status(b.paid('status'))).json()).owner,true);
 assert.deepEqual(await (await status(browser().paid('status'))).json(),{paidFeaturesEnabled:true,unlocked:false,owner:false});

 const stale=await signIn(key,browser('192.0.2.12'));await stale.verify();
 assert.equal((await guarded(stale.b.paid())).status,200);
 const step=await b.call('passkey/step/options',{});await b.call('passkey/step/verify',{response:key.get(step.body.challenge)});
 const add=await b.call('passkey/register/options',{});await b.call('passkey/register/verify',{response:softAuthenticator('xrex.test',ORIGIN).create(add.body.challenge),name:'Phone'});
 await b.call('passkeys/remove',{id:key.id});
 assert.equal((await guarded(stale.b.paid())).status,401,'revoked sessions lose paid access');

 process.env.PAID_DAILY_CAP_PER_IP='2';
 const capped=browser('192.0.2.20');
 assert.equal((await (await signIn(key,capped)).verify()).status,401,'a removed passkey can no longer sign in');
 b.jar.forEach((v,k)=>capped.jar.set(k,v));
 assert.equal((await guarded(capped.paid())).status,200);assert.equal((await guarded(capped.paid())).status,200);
 const limited=await guarded(capped.paid());assert.equal(limited.status,429,'per-IP cap applies to passkey sessions');assert.ok(Number(limited.headers.get('retry-after'))>0);
 assert.ok([...redis.data.keys()].some(k=>k.includes(':ip:192.0.2.20')),'caps are counted in Redis');
 delete process.env.PAID_DAILY_CAP_PER_IP;process.env.PAID_DAILY_CAP_GLOBAL='0';
 assert.equal((await guarded(b.paid())).status,429,'global cap applies to passkey sessions');
 delete process.env.PAID_DAILY_CAP_GLOBAL;
 process.env.PAID_FEATURES_ENABLED='false';
 const paused=await guarded(b.paid());assert.equal(paused.status,503,'kill switch applies to passkey sessions');assert.equal((await paused.json()).code,'paid_disabled');
 delete process.env.PAID_FEATURES_ENABLED;

 process.env.X_BEARER_TOKEN='server-test-token-not-real';let xCalls=0;
 globalThis.fetch=async(input,init)=>{if(String(input).startsWith('https://api.x.com/')){xCalls++;return Response.json({data:[],includes:{users:[]}});}return redis.fetch(input,init);};
 assert.equal((await discover(b.paid('discover',{vertical:'restaurants',topic:'AI'}))).status,200,'real paid route accepts the passkey session');
 assert.equal((await discover(browser('192.0.2.30').paid('discover',{vertical:'restaurants',topic:'AI'}))).status,401);
 assert.equal(xCalls,1);
}));

test('auth route rejects cross-origin POSTs and fails closed without configuration',()=>withLab(async()=>{
 const ctx=(...path:string[])=>({params:Promise.resolve({path})});
 const post=(headers:Record<string,string>)=>new Request(`${ORIGIN}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify({password:ENV.OWNER_PASSWORD})});
 assert.equal((await authPost(post({}),ctx('login'))).status,403,'missing Origin');
 assert.equal((await authPost(post({origin:'https://evil.example'}),ctx('login'))).status,403,'foreign Origin');
 assert.equal((await authPost(post({origin:ORIGIN}),ctx('login'))).status,200);
 assert.equal((await authGet(new Request(`${ORIGIN}/api/auth/kalshi/arm`),ctx('kalshi','arm'))).status,404);
 delete process.env.UPSTASH_REDIS_REST_URL;
 assert.equal((await authPost(post({origin:ORIGIN}),ctx('login'))).status,503,'no Redis, no passkeys');
 process.env.UPSTASH_REDIS_REST_URL=ENV.UPSTASH_REDIS_REST_URL;process.env.SESSION_SECRET='short';
 assert.equal((await authPost(post({origin:ORIGIN}),ctx('login'))).status,503,'weak SESSION_SECRET refuses to sign');
}));

test('production requires pinned WEBAUTHN_RP_ID and WEBAUTHN_ORIGINS and never derives them from headers',()=>withLab(async()=>{
 const spoofed=new Request('https://xrex.test/api/auth/login',{headers:{host:'evil.example','x-forwarded-host':'evil.example','x-forwarded-proto':'https'}});
 for(const prod of [{NODE_ENV:'production'},{VERCEL_ENV:'production'}]){
  for(const partial of [{},{WEBAUTHN_RP_ID:'xrex.test'},{WEBAUTHN_ORIGINS:ORIGIN}]){
   const env={...prod,...partial};
   assert.match(relyingPartyConfigError(env)!,/set WEBAUTHN_RP_ID and WEBAUTHN_ORIGINS in production/);
   assert.throws(()=>relyingParty(spoofed,env),(e:Error&{status?:number})=>e.status===503&&/WEBAUTHN_RP_ID/.test(e.message));
  }
  for(const bad of ['https://evil.example','https://xrex.test/path','xrex.test','https://notxrex.test'])
   assert.match(relyingPartyConfigError({...prod,WEBAUTHN_RP_ID:'xrex.test',WEBAUTHN_ORIGINS:bad})!,/misconfigured/,bad);
  const pinned={...prod,WEBAUTHN_RP_ID:'xrex.test',WEBAUTHN_ORIGINS:`${ORIGIN}, https://app.xrex.test`};
  assert.equal(relyingPartyConfigError(pinned),null);
  assert.deepEqual(relyingParty(spoofed,pinned),{rpID:'xrex.test',rpName:'X-Rex',origins:[ORIGIN,'https://app.xrex.test']},'Host headers are ignored');
 }
 assert.equal(relyingParty(spoofed,{}).rpID,'evil.example','outside production the host header is still used');

 const ctx=(...path:string[])=>({params:Promise.resolve({path})});
 const login=(url:string,origin:string)=>authPost(new Request(url,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify({password:ENV.OWNER_PASSWORD})}),ctx('login'));
 process.env.VERCEL_ENV='production';
 const missing=await login(`${ORIGIN}/api/auth/login`,ORIGIN);
 assert.equal(missing.status,503);assert.match((await missing.json()).error,/WEBAUTHN_RP_ID and WEBAUTHN_ORIGINS/);
 assert.equal((await browser().call('login',{password:ENV.OWNER_PASSWORD})).status,503,'authRoute fails closed too');
 process.env.WEBAUTHN_RP_ID='xrex.test';process.env.WEBAUTHN_ORIGINS=ORIGIN;
 assert.equal((await login(`${ORIGIN}/api/auth/login`,ORIGIN)).status,200);
 assert.equal((await login('https://x-rex-git-preview.vercel.app/api/auth/login','https://x-rex-git-preview.vercel.app')).status,403,'a request whose Origin matches its own host is still rejected unless pinned');
 const {b,key}=await enroll();
 assert.equal(await b.signedIn(),true,'passkeys work end to end with the pinned relying party');
 const evilKey=softAuthenticator('xrex.test','https://evil.example');
 const attempt=await signIn(key);assert.equal((await attempt.verify(evilKey.get(attempt.options.challenge))).status,401);
 delete process.env.WEBAUTHN_ORIGINS;
 assert.equal(await b.signedIn(),false,'sessions stop authorizing if the pinned config is removed');
}));

test('sameOrigin compares against pinned origins whenever they are set',()=>withLab(async()=>{
 const ctx={params:Promise.resolve({path:['login']})};
 const post=(url:string,origin:string)=>authPost(new Request(url,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify({password:ENV.OWNER_PASSWORD})}),ctx);
 assert.equal((await post('https://other.test/api/auth/login','https://other.test')).status,200,'unpinned dev: own origin');
 process.env.WEBAUTHN_ORIGINS=ORIGIN;
 assert.equal((await post('https://other.test/api/auth/login','https://other.test')).status,403,'pinned: own origin is not enough');
 assert.equal((await post('https://other.test/api/auth/login',ORIGIN)).status,200);
}));

test('the step-up cookie is bound to the session nonce and epoch',()=>withLab(async()=>{
 const {b,key}=await enroll();
 const other=await signIn(key);await other.verify();
 const step=await b.call('passkey/step/options',{});
 assert.equal((await b.call('passkey/step/verify',{response:key.get(step.body.challenge)})).status,200);
 const stepCookie=b.jar.get(STEP_COOKIE)!;
 const [body]=stepCookie.split('.');const claims=JSON.parse(Buffer.from(body,'base64url').toString());
 const [sessionBody]=b.jar.get(SESSION_COOKIE)!.split('.');const sessionClaims=JSON.parse(Buffer.from(sessionBody,'base64url').toString());
 assert.equal(claims.n,sessionClaims.n);assert.equal(claims.e,sessionClaims.e);
 assert.equal((await b.call('passkeys')).body.steppedUp,true);
 other.b.jar.set(STEP_COOKIE,stepCookie);
 assert.equal((await other.b.call('passkeys')).body.steppedUp,false,"another session's step-up is rejected");
 assert.equal((await other.b.call('passkeys/recovery-codes',{})).status,403);
 assert.equal((await other.b.call('passkey/register/options',{})).status,403);
 const relogin=await signIn(key,b);assert.equal((await relogin.verify()).status,200);
 b.jar.set(STEP_COOKIE,stepCookie);
 assert.equal((await b.call('passkeys/recovery-codes',{})).status,403,'a step-up from a previous session in the same browser is rejected');
}));
