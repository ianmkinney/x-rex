import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {POST as ai} from '../app/api/ai/route';
import {POST as profile} from '../app/api/profile/route';
import {draftFixture} from './e2e/draft-fixture';
const posts=draftFixture.posts;
test('placeholder credentials do not call providers and client credentials cannot override them',async()=>{
 const oldAi=process.env.OPENROUTER_API_KEY,oldX=process.env.X_BEARER_TOKEN,oldFetch=globalThis.fetch;
 process.env.OPENROUTER_API_KEY='REPLACE_ME_OPENROUTER_API_KEY';process.env.X_BEARER_TOKEN='REPLACE_ME_X_BEARER_TOKEN';
 globalThis.fetch=async()=>{throw new Error('Provider should not be called');};
 try{
 const a=await ai(new NextRequest('http://localhost/api/ai',{method:'POST',headers:{'Content-Type':'application/json','x-openrouter-key':'sk-or-client-should-be-ignored'},body:JSON.stringify({action:'draft',prompt:'Write a useful post about AI.'})}));assert.equal(a.status,503);
 const x=await profile(new NextRequest('http://localhost/api/profile',{method:'POST',headers:{'Content-Type':'application/json','x-api-bearer-token':'client-token-should-be-ignored'},body:JSON.stringify({profile:'examplechef'})}));assert.equal(x.status,503);
 process.env.OPENROUTER_API_KEY='sk-or-server-test-not-real';
 globalThis.fetch=async(_input,init)=>{assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer sk-or-server-test-not-real');const body=JSON.parse(String(init?.body));assert.equal(body.model,'example/readable-model');assert.match(body.messages[0].content,/Return ONLY valid JSON/);return Response.json({choices:[{message:{content:JSON.stringify({posts})}}],model:'example/readable-model'});};
 const draft=await ai(new NextRequest('http://localhost/api/ai',{method:'POST',body:JSON.stringify({action:'draft',prompt:'Write a useful post about AI.',model:'example/readable-model'})}));assert.equal(draft.status,200);const result=await draft.json();assert.deepEqual(result.posts,posts);assert.equal(result.model,'example/readable-model');assert.equal(result.text,undefined);
 globalThis.fetch=async()=>Response.json({choices:[{message:{content:'Post: mixed prose and reasoning'}}]});
 const malformed=await ai(new NextRequest('http://localhost/api/ai',{method:'POST',body:JSON.stringify({action:'draft',prompt:'Write a useful post about AI.'})}));assert.equal(malformed.status,502);
 const invalidModel=await ai(new NextRequest('http://localhost/api/ai',{method:'POST',body:JSON.stringify({action:'draft',prompt:'Write a useful post about AI.',model:'https://evil.test/model'})}));assert.equal(invalidModel.status,400);
 }finally{globalThis.fetch=oldFetch;if(oldAi===undefined)delete process.env.OPENROUTER_API_KEY;else process.env.OPENROUTER_API_KEY=oldAi;if(oldX===undefined)delete process.env.X_BEARER_TOKEN;else process.env.X_BEARER_TOKEN=oldX;}
});
