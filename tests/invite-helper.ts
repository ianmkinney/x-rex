import {NextRequest} from 'next/server';
import {INVITE_COOKIE,inviteToken} from '../lib/paid-guard';
export const TEST_INVITE='test-invite-not-real';
process.env.INVITE_CODES=TEST_INVITE;
export function invitedRequest(url:string,init:ConstructorParameters<typeof NextRequest>[1]={}){
 const headers=new Headers(init.headers);headers.set('cookie',`${INVITE_COOKIE}=${inviteToken(TEST_INVITE)}`);
 return new NextRequest(url,{...init,headers});
}
