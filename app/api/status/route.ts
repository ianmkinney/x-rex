import {NextRequest,NextResponse} from 'next/server';
import {hasValidInvite,paidFeaturesEnabled} from '@/lib/paid-guard';
export async function GET(request:NextRequest){
 return NextResponse.json({paidFeaturesEnabled:paidFeaturesEnabled(),unlocked:hasValidInvite(request)},{headers:{'Cache-Control':'no-store'}});
}
