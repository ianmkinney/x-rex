import {isIP} from 'node:net';

export const UNKNOWN_IP='unknown';
function bucket(candidate:string){
 const version=isIP(candidate);
 if(version===4)return candidate;
 if(version!==6)return null;
 const mapped=candidate.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
 if(mapped)return mapped[1];
 const [head,tail]=candidate.toLowerCase().split('::');
 const h=head?head.split(':'):[],t=tail?tail.split(':'):[];
 const groups=tail===undefined?h:[...h,...Array(Math.max(0,8-h.length-t.length)).fill('0'),...t];
 return `${groups.slice(0,4).map(g=>parseInt(g,16).toString(16)).join(':')}::/64`;
}
// Vercel sets x-vercel-forwarded-for and x-real-ip itself and overwrites X-Forwarded-For, whose left-most entries
// are client-controlled anywhere else. Off Vercel, run behind a proxy that overwrites these headers.
// IPv6 is bucketed by /64 so one host cannot rotate addresses.
export function clientIp(request:Request){
 const h=request.headers;
 const candidates=[h.get('x-vercel-forwarded-for')?.split(',')[0],h.get('x-real-ip'),h.get('x-forwarded-for')?.split(',').map(s=>s.trim()).filter(Boolean).at(-1)];
 for(const candidate of candidates){const ip=candidate?bucket(candidate.trim()):null;if(ip)return ip;}
 return UNKNOWN_IP;
}
