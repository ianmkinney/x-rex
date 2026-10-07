import {NextRequest,NextResponse} from 'next/server';
import {withPaidGuard} from '@/lib/paid-guard';
import {discoveryInput,discoveryQuery,rankCreators} from '@/lib/discovery';
export const maxDuration=30;
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export const POST=withPaidGuard(async (request:NextRequest)=>{
 try{
 const raw=await request.text();if(raw.length>1000)return reply({error:'Search input is too long.'},413);
 let value:unknown;try{value=JSON.parse(raw);}catch{return reply({error:'Invalid search request.'},400);}
 const parsed=discoveryInput.safeParse(value);if(!parsed.success)return reply({error:'Choose a vertical and use a topic of up to 120 characters.'},400);
 const token=process.env.X_BEARER_TOKEN?.trim();if(!token||token.startsWith('REPLACE_ME'))return reply({error:'Live discovery needs the server’s X API connection. Ask the site owner to configure X API access.'},503);
 const query=discoveryQuery(parsed.data.vertical,parsed.data.topic);
 const params=new URLSearchParams({query,max_results:'100',sort_order:'recency',expansions:'author_id','tweet.fields':'created_at,public_metrics,author_id','user.fields':'name,username,description,public_metrics,protected'});
 const response=await fetch(`https://api.x.com/2/tweets/search/recent?${params}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000),cache:'no-store',redirect:'error'});
 if(!response.ok){const error=response.status===402?'X search requires API credits. The site owner needs to update the X API account.':response.status===403?'The server’s X API account does not have recent-search access.':response.status===401?'X rejected the server credential.':response.status===429?'X search is rate limited. Please try again later.':'X search is unavailable. Try another topic or return later.';return reply({error},response.status>=400&&response.status<500?response.status:502);}
 const body=await response.json();const creators=rankCreators(body);
 return reply({creators,query,searchedAt:new Date().toISOString(),sampleSize:Array.isArray(body.data)?body.data.length:0,scope:'Up to 100 recent matching English-language original posts from the last 7 days. Rankings cover this sample only.',warning:body.errors?.length?'X returned partial results; some matching accounts may be missing.':undefined});
 }catch{return reply({error:'Could not load X discovery results. Please retry.'},502);}
});
