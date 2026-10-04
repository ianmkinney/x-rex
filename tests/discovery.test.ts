import {parsePost} from '../lib/post-text';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {discoveryQuery,rankCreators,inspirationPrompt} from '../lib/discovery';
import {POST} from '../app/api/discover/route';
import {buildPrompt,ARCHETYPES} from '../lib/engine';
const payload={data:[{id:'11',author_id:'1',text:'A restaurant AI checklist 🧑‍🍳',created_at:'2026-10-03T12:00:00Z',public_metrics:{like_count:20,retweet_count:5,reply_count:3,quote_count:2}},{id:'12',author_id:'1',text:'A quieter post',public_metrics:{like_count:1,retweet_count:0,reply_count:0,quote_count:0}},{id:'13',author_id:'2',text:'Missing public metrics'},{id:'14',author_id:'3',text:'Protected'}],includes:{users:[{id:'1',name:'Kitchen Tech',username:'kitchentech',public_metrics:{followers_count:500}},{id:'2',name:'Other',username:'other'},{id:'3',name:'Private',username:'private',protected:true}]}};
test('discovery ranks observed engagement, selects standout, and does not invent metrics',()=>{
 const creators=rankCreators(payload);assert.equal(creators.length,2);assert.equal(creators[0].standout.id,'11');assert.equal(creators[0].standout.engagement,30);assert.equal(creators[1].followers,null);assert.equal(creators[1].standout.engagement,null);
 const query=discoveryQuery('restaurants','AI services from:bad OR is:retweet');assert.ok(query.includes('"ai" "services"'));assert.ok(!query.includes('from:bad'));assert.ok(query.endsWith('-is:retweet -is:reply lang:en'));
});
test('discovery calls only official search and surfaces denied access',async()=>{
 const oldKey=process.env.X_BEARER_TOKEN,oldFetch=globalThis.fetch;process.env.X_BEARER_TOKEN='server-test-token';
 try{globalThis.fetch=async(input,init)=>{const url=new URL(String(input));assert.equal(url.origin,'https://api.x.com');assert.equal(url.pathname,'/2/tweets/search/recent');assert.equal(url.searchParams.get('max_results'),'100');assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer server-test-token');return Response.json(payload);};
 const request=()=>new NextRequest('http://localhost/api/discover',{method:'POST',body:JSON.stringify({vertical:'restaurants',topic:'AI services'})});
 let r=await POST(request());assert.equal(r.status,200);assert.equal((await r.json()).creators[0].username,'kitchentech');
 globalThis.fetch=async()=>new Response('',{status:402});r=await POST(request());assert.equal(r.status,402);assert.match((await r.json()).error,/credits/);
 }finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.X_BEARER_TOKEN;else process.env.X_BEARER_TOKEN=oldKey;}
});
test('expanded prompts invite detail and emoji while standard prompts preserve their limit',()=>{
 const expanded=buildPrompt([ARCHETYPES[0]],'Restaurant AI','Warm');assert.match(expanded,/450–900/);assert.match(expanded,/Add 1–3 relevant emoji/);assert.match(expanded,/Do not compress it into a one-line tip/);
 const standard=buildPrompt([ARCHETYPES[0]],'Restaurant AI','Warm',undefined,'standard');assert.match(standard,/never more than 280/);assert.ok(!standard.includes('450–900'));
 const reference={username:'kitchentech',examples:['Keep the kitchen calm.'],source:'X search',topic:'AI',audience:'restaurant-owners'};
 assert.match(inspirationPrompt(reference,true),/your own voice takes priority/);assert.match(inspirationPrompt(reference,false),/no saved personal style is included/);assert.match(inspirationPrompt(reference,false),/Do not copy distinctive phrases/);
});

test('post length modes preserve weighted character parsing',()=>{
 assert.equal(parsePost('Hello 🦖',280).valid,true);
 assert.equal(parsePost('字'.repeat(141),280).valid,false);
 assert.equal(parsePost('字'.repeat(141),1200).valid,true);
 assert.equal(parsePost('A'.repeat(1201),1200).valid,false);
 assert.equal(parsePost('https://example.com/a/long/url',1200).weightedLength,23);
});
