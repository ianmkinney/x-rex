import {NextRequest,NextResponse} from 'next/server';
import {parseHandle,type PublicProfile} from '@/lib/profile';
export const maxDuration=30;
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
function apiError(status:number){return status===401?'X rejected this bearer token.':status===403?'Your X API token does not have access to this endpoint.':status===404?'This public profile could not be found.':status===429?'X is rate limiting requests. Try again later.':status===402?'Your X API account needs credits or endpoint access.':'X could not return the public data. Try again or paste it manually.';}
export async function POST(request:NextRequest){
 try{
  const raw=await request.text();if(raw.length>1000)return reply({error:'Profile input is too long.'},413);
  let body:unknown;try{body=JSON.parse(raw);}catch{return reply({error:'Invalid profile request.'},400);}
  const value=(body as {profile?:unknown})?.profile;
  if(typeof value!=='string')return reply({error:'Enter a profile URL or handle.'},400);
  let username:string;try{username=parseHandle(value);}catch(e){return reply({error:(e as Error).message},400);}
  const token=request.headers.get('x-api-bearer-token')?.trim();
  if(!token||token.length<20||token.length>2048||/[\r\n]/.test(token))return reply({error:'Add an X API bearer token to import a profile, or paste the public bio and posts below.'},401);
  // Fixed official host and validated path components: never fetch arbitrary user URLs.
  const get=(path:string)=>fetch(`https://api.x.com/2/${path}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
  const response=await get(`users/by/username/${username}?user.fields=description,protected`);
  if(!response.ok)return reply({error:apiError(response.status)},response.status>=400&&response.status<500?response.status:502);
  const {data:user}=await response.json();
  if(!user||typeof user.id!=='string'||!/^\d+$/.test(user.id))return reply({error:'X returned no usable public profile.'},404);
  if(user.protected!==false)return reply({error:'This account is protected. Only public profiles can be imported.'},403);
  const profile:PublicProfile={username,name:String(user.name||username).slice(0,100),bio:String(user.description||'').slice(0,1000),posts:[],source:'x-api',fetchedAt:new Date().toISOString()};
  try{
   const timeline=await get(`users/${user.id}/tweets?max_results=10&exclude=retweets,replies&tweet.fields=created_at`);
   if(!timeline.ok)profile.warning=`Profile loaded, but recent posts were unavailable. ${apiError(timeline.status)} You can paste post excerpts below.`;
   else{
    const result=await timeline.json();
    profile.posts=(Array.isArray(result.data)?result.data:[]).filter((p:{id?:unknown;text?:unknown})=>typeof p.id==='string'&&/^\d+$/.test(p.id)&&typeof p.text==='string').slice(0,10).map((p:{id:string;text:string;created_at?:string})=>({id:p.id,text:p.text.slice(0,1200),createdAt:p.created_at}));
    if(!profile.posts.length)profile.warning='No recent original posts were returned. Add public excerpts if the bio does not provide enough evidence.';
   }
  }catch{profile.warning='Profile loaded, but fetching posts timed out. You can paste public post excerpts below.';}
  return reply({profile});
 }catch{return reply({error:'Could not reach X. Please retry or paste the public text manually.'},502);}
}
