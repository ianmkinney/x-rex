import {NextRequest,NextResponse} from 'next/server';
import {INVITE_ATTEMPTS_PER_IP,countInviteAttempt,isValidInviteCode,setInviteCookie,tooManyRequests} from '@/lib/paid-guard';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:NextRequest){
 const raw=await request.text();if(raw.length>500)return reply({error:'Invite code is too long.'},413);
 let code:unknown;try{code=(JSON.parse(raw) as {code?:unknown})?.code;}catch{return reply({error:'Invalid invite request.'},400);}
 if(typeof code!=='string'||!code.trim()||code.length>200)return reply({error:'Enter your invite code.'},400);
 try{if(await countInviteAttempt(request)>INVITE_ATTEMPTS_PER_IP)return tooManyRequests('Too many invite attempts today. Please try again after midnight UTC.');}
 catch{return reply({error:'Invite codes can’t be checked right now. Please try again shortly.'},503);}
 if(!isValidInviteCode(code))return reply({error:'That invite code isn’t valid. Check it and try again.',code:'invite_invalid'},401);
 return setInviteCookie(reply({unlocked:true}),code);
}
