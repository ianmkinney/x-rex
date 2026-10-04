import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {POST} from '../app/api/profile/route';
test('official API adapter rejects protected accounts and reports partial timeline failure',async()=>{
 const original=globalThis.fetch;const urls:string[]=[];let protectedAccount=true;
 globalThis.fetch=async(input)=>{const url=String(input);urls.push(url);if(url.includes('/users/by/username/'))return Response.json({data:{id:'1234',name:'Chef',description:'Restaurant owner',protected:protectedAccount}});return Response.json({error:'rate limit'},{status:429});};
 const request=()=>new NextRequest('http://localhost/api/profile',{method:'POST',headers:{'Content-Type':'application/json','x-api-bearer-token':'test-token-not-a-real-token'},body:JSON.stringify({profile:'examplechef'})});
 try{
  const protectedResult=await POST(request());assert.equal(protectedResult.status,403);assert.equal(urls.length,1);
  protectedAccount=false;const result=await POST(request());assert.equal(result.status,200);
  const data=await result.json();assert.equal(data.profile.source,'x-api');assert.deepEqual(data.profile.posts,[]);assert.match(data.profile.warning,/rate limiting/);
  assert.ok(urls.every(url=>url.startsWith('https://api.x.com/2/')));
 }finally{globalThis.fetch=original;}
});
