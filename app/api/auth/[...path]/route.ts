import {sameOrigin} from '@/lib/server/auth';
import {authRoute} from '@/lib/server/auth-routes';
export const runtime='nodejs';export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function handler(req:Request,{params}:{params:Promise<{path:string[]}>}){
 const action=(await params).path.join('/');
 if(req.method==='POST'&&!sameOrigin(req))return reply({error:'Cross-origin request rejected'},403);
 return await authRoute(action,req)??reply({error:'Not found'},404);
}
export const GET=handler;export const POST=handler;
