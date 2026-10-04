import {NextResponse} from 'next/server';
import {DEFAULT_MODEL,modelIdSchema} from '@/lib/drafts';
export async function GET(){
 try{
  const response=await fetch('https://openrouter.ai/api/v1/models',{signal:AbortSignal.timeout(10000),next:{revalidate:3600}});
  if(!response.ok)throw new Error('Catalog unavailable');
  const body=await response.json();
  if(!Array.isArray(body.data))throw new Error('Invalid catalog');
  const models=body.data.filter((m: {id?:unknown;architecture?:{input_modalities?:string[];output_modalities?:string[]}})=>modelIdSchema.safeParse(m.id).success&&m.architecture?.input_modalities?.includes('text')&&m.architecture?.output_modalities?.includes('text'))
   .map((m:{id:string;name?:string})=>({id:m.id,name:typeof m.name==='string'?m.name:m.id})).sort((a:{name:string},b:{name:string})=>a.name.localeCompare(b.name));
  return NextResponse.json({models,defaultModel:DEFAULT_MODEL},{headers:{'Cache-Control':'public, max-age=300'}});
 }catch{return NextResponse.json({models:[],defaultModel:DEFAULT_MODEL,error:'The model catalog is temporarily unavailable. Retry, or use the default Sonnet model.'},{status:503});}
}
