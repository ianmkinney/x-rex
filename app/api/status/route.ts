import {NextRequest,NextResponse} from 'next/server';
import {hasValidInvite,paidFeaturesEnabled} from '@/lib/paid-guard';
import {signedIn} from '@/lib/server/auth';
export async function GET(request:NextRequest){
 const owner=await signedIn(request).catch(()=>false);
 return NextResponse.json({paidFeaturesEnabled:paidFeaturesEnabled(),unlocked:owner||hasValidInvite(request),owner},{headers:{'Cache-Control':'no-store'}});
}
