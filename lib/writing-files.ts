export const WRITING_FILE_ACCEPT='.txt,.md,.json,text/plain,text/markdown,application/json';
export const MAX_WRITING_FILE_BYTES=1_000_000;
export function writingFileText(name:string,bytes:Uint8Array):string {
 const ext=name.split('.').pop()?.toLowerCase();
 if(!ext||!['txt','md','json'].includes(ext))throw new Error(`${name}: use a TXT, Markdown, or JSON file.`);
 if(bytes.length>MAX_WRITING_FILE_BYTES)throw new Error(`${name}: files must be under 1 MB.`);
 let text:string;
 try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');}catch{throw new Error(`${name}: save the file as UTF-8 text and try again.`);}
 if(ext==='json'){
  let data:unknown;try{data=JSON.parse(text);}catch{throw new Error(`${name}: this is not valid JSON.`);}
  const samples:string[]=[];
  function extract(value:unknown,depth=0){
   if(depth>12)return;
   if(typeof value==='string'){samples.push(value);return;}
   if(Array.isArray(value)){for(const item of value)extract(item,depth+1);return;}
   if(value&&typeof value==='object'){
    const record=value as Record<string,unknown>;
    if(typeof record.full_text==='string'){samples.push(record.full_text);return;}
    if(typeof record.text==='string'){samples.push(record.text);return;}
    for(const key of ['posts','tweets','data','tweet'])if(key in record){extract(record[key],depth+1);return;}
   }
  }
  extract(data);text=samples.map(t=>t.trim()).filter(Boolean).join('\n\n');
 }
 if(text.includes('\0'))throw new Error(`${name}: this file contains binary content. Use a text file.`);
 text=text.replace(/\r\n?/g,'\n').trim();
 if(!text)throw new Error(`${name}: no writing samples found. JSON can contain text strings or posts with text/full_text fields.`);
 return text;
}
export function appendWritingSamples(existing:string,samples:string[]){
 const combined=[existing.trim(),...samples].filter(Boolean).join('\n\n');
 const examples=combined.slice(0,6000).replace(/[\uD800-\uDBFF]$/,'');
 return {examples,truncated:combined.length>6000};
}
