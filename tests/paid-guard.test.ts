import {test,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {NextRequest} from 'next/server';
import {TEST_INVITE,invitedRequest} from './invite-helper';
import {INVITE_ATTEMPTS_PER_IP,INVITE_COOKIE,clientIp,inviteToken,isPaidGuarded,resetMemoryStore,withPaidGuard} from '../lib/paid-guard';
import {POST as ai} from '../app/api/ai/route';
import {POST as discover} from '../app/api/discover/route';
import {POST as profile} from '../app/api/profile/route';
import {POST as invite} from '../app/api/invite/route';
import {GET as status} from '../app/api/status/route';

const ENV_KEYS=['INVITE_CODES','INVITE_COOKIE_SECRET','PAID_FEATURES_ENABLED','PAID_DAILY_CAP_PER_IP','PAID_DAILY_CAP_GLOBAL','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN','OPENROUTER_API_KEY','X_BEARER_TOKEN'];
let savedEnv:Record<string,string|undefined>={};
const originalFetch=globalThis.fetch;
let providerCalls=0;
beforeEach(()=>{
 savedEnv=Object.fromEntries(ENV_KEYS.map(k=>[k,process.env[k]]));
 for(const k of ENV_KEYS)delete process.env[k];
 process.env.INVITE_CODES=`other-code, ${TEST_INVITE}`;
 process.env.OPENROUTER_API_KEY='sk-or-server-test-not-real';process.env.X_BEARER_TOKEN='server-test-token-not-real';
 providerCalls=0;globalThis.fetch=async()=>{providerCalls++;throw new Error('Provider should not be called');};
 resetMemoryStore();
});
afterEach(()=>{globalThis.fetch=originalFetch;for(const k of ENV_KEYS){if(savedEnv[k]===undefined)delete process.env[k];else process.env[k]=savedEnv[k];}});

const paidRoutes=[
 {name:'ai',handler:ai,url:'http://localhost/api/ai',body:{action:'draft',prompt:'Write a useful post about AI.'}},
 {name:'discover',handler:discover,url:'http://localhost/api/discover',body:{vertical:'restaurants',topic:'AI'}},
 {name:'profile',handler:profile,url:'http://localhost/api/profile',body:{profile:'examplechef'}},
];
const anonymous=(url:string,body:unknown,headers:Record<string,string>={})=>new NextRequest(url,{method:'POST',headers,body:JSON.stringify(body)});
const withCookie=(url:string,body:unknown,cookie:string)=>anonymous(url,body,{cookie:`${INVITE_COOKIE}=${cookie}`});
const ok=withPaidGuard(async()=>Response.json({ok:true}));
const fromIp=(xff:string)=>invitedRequest('http://localhost/api/ai',{method:'POST',headers:{'x-forwarded-for':xff},body:'{}'});

test('gate: missing, invalid, raw-code and revoked cookies get 401 JSON without provider calls',async()=>{
 for(const route of paidRoutes){
  for(const request of [anonymous(route.url,route.body),withCookie(route.url,route.body,'forged'),withCookie(route.url,route.body,TEST_INVITE),withCookie(route.url,route.body,inviteToken('not-a-listed-code'))]){
   const response=await route.handler(request);
   assert.equal(response.status,401,route.name);
   const data=await response.json();assert.equal(data.code,'invite_required');assert.match(data.error,/invite code/);
  }
 }
 process.env.INVITE_CODES='other-code';
 assert.equal((await ok(invitedRequest('http://localhost/api/ai',{method:'POST',body:'{}'}))).status,401,'removing a code revokes its cookie');
 assert.equal(providerCalls,0);
});

test('gate fails closed when INVITE_CODES is unset or empty',async()=>{
 for(const value of [undefined,'',' , ']){
  if(value===undefined)delete process.env.INVITE_CODES;else process.env.INVITE_CODES=value;
  assert.equal((await ok(invitedRequest('http://localhost/api/ai',{method:'POST',body:'{}'}))).status,401);
  assert.equal((await ok(withCookie('http://localhost/api/ai',{},inviteToken('')))).status,401);
  const r=await invite(anonymous('http://localhost/api/invite',{code:TEST_INVITE}));assert.equal(r.status,401);assert.equal(r.headers.get('set-cookie'),null);
 }
});

test('invite endpoint validates server-side and sets an httpOnly, secure, lax HMAC cookie',async()=>{
 assert.equal((await invite(anonymous('http://localhost/api/invite',{}))).status,400);
 assert.equal((await invite(new NextRequest('http://localhost/api/invite',{method:'POST',body:'not json'}))).status,400);
 const bad=await invite(anonymous('http://localhost/api/invite',{code:'wrong-code'}));
 assert.equal(bad.status,401);assert.equal((await bad.json()).code,'invite_invalid');assert.equal(bad.headers.get('set-cookie'),null);
 const good=await invite(anonymous('http://localhost/api/invite',{code:`  ${TEST_INVITE} `}));
 assert.equal(good.status,200);assert.deepEqual(await good.json(),{unlocked:true});
 const header=good.headers.get('set-cookie')||'';
 assert.match(header,/HttpOnly/i);assert.match(header,/Secure/i);assert.match(header,/SameSite=lax/i);assert.match(header,/Path=\//);
 const value=header.match(new RegExp(`${INVITE_COOKIE}=([^;]+)`))?.[1]||'';
 assert.ok(value&&!value.includes(TEST_INVITE),'cookie must not contain the raw invite code');
 assert.equal(value,inviteToken(TEST_INVITE));
 const before=await (await status(anonymous('http://localhost/api/status',{}))).json();assert.equal(before.unlocked,false);
 const after=await (await status(withCookie('http://localhost/api/status',{},value))).json();assert.deepEqual(after,{paidFeaturesEnabled:true,unlocked:true});
 assert.equal((await ok(withCookie('http://localhost/api/ai',{},value))).status,200);
});

test('cookie secret changes the HMAC, so cookies cannot be computed without it',()=>{
 const unsigned=inviteToken(TEST_INVITE);process.env.INVITE_COOKIE_SECRET='a-long-random-server-secret';
 assert.notEqual(inviteToken(TEST_INVITE),unsigned);
});

test('invite endpoint limits guessing per IP',async()=>{
 const attempt=()=>invite(anonymous('http://localhost/api/invite',{code:'guess'},{'x-forwarded-for':'203.0.113.9'}));
 for(let i=0;i<INVITE_ATTEMPTS_PER_IP;i++)assert.equal((await attempt()).status,401);
 const blocked=await attempt();assert.equal(blocked.status,429);assert.ok(Number(blocked.headers.get('retry-after'))>0);
});

test('caps: per-IP daily cap returns 429 with Retry-After, other IPs unaffected',async()=>{
 process.env.PAID_DAILY_CAP_PER_IP='2';
 assert.equal((await ok(fromIp('198.51.100.1'))).status,200);
 assert.equal((await ok(fromIp('198.51.100.1'))).status,200);
 const capped=await ok(fromIp('198.51.100.1'));
 assert.equal(capped.status,429);
 const retry=Number(capped.headers.get('retry-after'));assert.ok(Number.isInteger(retry)&&retry>0&&retry<=86400);
 const data=await capped.json();assert.equal(data.code,'rate_limited');assert.match(data.error,/today’s 2/);
 assert.equal((await ok(fromIp('198.51.100.2'))).status,200);
});

test('caps: spoofed left-most X-Forwarded-For entries do not create new buckets',async()=>{
 process.env.PAID_DAILY_CAP_PER_IP='1';
 assert.equal((await ok(fromIp('10.0.0.1, 198.51.100.7'))).status,200);
 assert.equal((await ok(fromIp('10.0.0.2, 198.51.100.7'))).status,429);
 assert.equal((await ok(fromIp('2001:db8:1:2::1'))).status,200);
 assert.equal((await ok(fromIp('2001:db8:1:2:ffff::9'))).status,429,'same IPv6 /64 shares a bucket');
});

test('caps: global daily cap returns 429 across IPs',async()=>{
 process.env.PAID_DAILY_CAP_GLOBAL='3';
 for(const ip of ['192.0.2.1','192.0.2.2','192.0.2.3'])assert.equal((await ok(fromIp(ip))).status,200);
 const capped=await ok(fromIp('192.0.2.4'));
 assert.equal(capped.status,429);assert.ok(Number(capped.headers.get('retry-after'))>0);assert.match((await capped.json()).error,/shared limit/);
});

test('caps: defaults are 20 per IP and invalid values fall back to defaults',async()=>{
 process.env.PAID_DAILY_CAP_PER_IP='not-a-number';
 for(let i=0;i<20;i++)assert.equal((await ok(fromIp('192.0.2.50'))).status,200);
 assert.equal((await ok(fromIp('192.0.2.50'))).status,429);
});

test('caps: real paid route is capped before any provider call',async()=>{
 process.env.PAID_DAILY_CAP_PER_IP='0';
 const r=await ai(invitedRequest('http://localhost/api/ai',{method:'POST',body:JSON.stringify(paidRoutes[0].body)}));
 assert.equal(r.status,429);assert.equal(providerCalls,0);
});

test('caps use Upstash/Vercel KV REST when configured and fail closed on errors',async()=>{
 process.env.KV_REST_API_URL='https://kv.example.test/';process.env.KV_REST_API_TOKEN='kv-test-token';
 const calls:{url:string;auth:string|null;body:unknown}[]=[];let count=0;
 globalThis.fetch=async(input,init)=>{calls.push({url:String(input),auth:new Headers(init?.headers).get('Authorization'),body:JSON.parse(String(init?.body))});count++;return Response.json([{result:count},{result:1}]);};
 assert.equal((await ok(fromIp('192.0.2.77'))).status,200);
 assert.equal(calls.length,2);assert.equal(calls[0].url,'https://kv.example.test/pipeline');assert.equal(calls[0].auth,'Bearer kv-test-token');
 assert.deepEqual((calls[0].body as string[][])[0].slice(0,1),['INCR']);assert.match((calls[0].body as string[][])[0][1],/:ip:192\.0\.2\.77$/);assert.match((calls[1].body as string[][])[0][1],/:global$/);
 count=500;assert.equal((await ok(fromIp('192.0.2.78'))).status,429);
 globalThis.fetch=async()=>new Response('down',{status:500});
 const failed=await ok(fromIp('192.0.2.79'));assert.equal(failed.status,503);assert.equal((await failed.json()).code,'limits_unavailable');
});

test('kill switch: PAID_FEATURES_ENABLED=false returns 503 on every paid route, even with a valid invite',async()=>{
 process.env.PAID_FEATURES_ENABLED='false';
 for(const route of paidRoutes){
  const response=await route.handler(invitedRequest(route.url,{method:'POST',body:JSON.stringify(route.body)}));
  assert.equal(response.status,503,route.name);const data=await response.json();assert.equal(data.code,'paid_disabled');assert.match(data.error,/paused/);
 }
 assert.equal(providerCalls,0);
 assert.deepEqual(await (await status(invitedRequest('http://localhost/api/status'))).json(),{paidFeaturesEnabled:false,unlocked:true});
 process.env.PAID_FEATURES_ENABLED='true';assert.equal((await ok(invitedRequest('http://localhost/api/ai',{method:'POST',body:'{}'}))).status,200);
});

test('clientIp trusts only the right-most forwarded entry and rejects junk',()=>{
 const ip=(xff?:string)=>clientIp(new Request('http://localhost',{headers:xff?{'x-forwarded-for':xff}:{}}));
 assert.equal(ip('1.1.1.1, 203.0.113.5'),'203.0.113.5');
 assert.equal(ip(),'unknown');assert.equal(ip('not-an-ip'),'unknown');assert.equal(ip('203.0.113.5, ../../etc'),'unknown');
 assert.equal(ip('::ffff:203.0.113.5'),'203.0.113.5');
 assert.equal(ip('2001:DB8:0001:0002:3:4:5:6'),'2001:db8:1:2::/64');
});

const PAID_MARKERS=/env(\.|\[['"`])(OPENROUTER_API_KEY|X_BEARER_TOKEN)|https:\/\/openrouter\.ai\/api\/v1\/(?!models)|https:\/\/api\.(x|twitter)\.com/;
function sourceFiles(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sourceFiles(join(dir,e.name)):/\.(ts|tsx)$/.test(e.name)?[join(dir,e.name)]:[]);}
test('every route that uses paid credentials exports only guarded handlers',async()=>{
 const root=join(import.meta.dirname,'..');
 const paid=[...sourceFiles(join(root,'app')),...sourceFiles(join(root,'lib'))].filter(f=>PAID_MARKERS.test(readFileSync(f,'utf8'))).map(f=>relative(root,f).split('\\').join('/')).sort();
 assert.deepEqual(paid,['app/api/ai/route.ts','app/api/discover/route.ts','app/api/profile/route.ts'],'new paid call sites must be added here and wrapped with withPaidGuard');
 for(const file of paid){
  const mod=await import(pathToFileURL(join(root,file)).href) as Record<string,unknown>;
  const handlers=['GET','POST','PUT','PATCH','DELETE'].filter(m=>m in mod);
  assert.ok(handlers.length>0,file);
  for(const m of handlers)assert.ok(isPaidGuarded(mod[m]),`${file} ${m} must be wrapped with withPaidGuard`);
 }
 assert.ok(!isPaidGuarded(status)&&!isPaidGuarded(invite));
});
