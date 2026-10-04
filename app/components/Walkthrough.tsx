'use client';
import {useEffect,useState} from 'react';
import Image from 'next/image';
import AppDialog from './AppDialog';
const steps=[
 ['Meet your writing sidekick.','X-Rex helps you turn a good idea into a post worth reading. Explore audience fit, draft for specific interests, and keep your own voice. Scores are simulations—not a promise of For You placement.','START HERE'],
 ['Make it sound like you.','Open Your writing style at the top. Import your own public X profile or paste a few posts, review the examples, then save. Choose your OpenRouter writing model below.','01 / YOUR VOICE'],
 ['Find the right people.','Analyze a post to explore which archetypes it fits. Or use Build for an audience: pick your people, add a topic, and generate three readable options. Restaurant owners are first in the list.','02 / YOUR AUDIENCE'],
 ['Write for someone’s interests.','Target a profile uses a public reader’s bio and posts to suggest interests. This is different from your own writing profile. You can paste public examples if import is unavailable.','03 / A SPECIFIC READER'],
 ['Copy the post. Keep the why.','Each draft has an editable post box, Copy post, and Post on X. The reasoning and algorithm markers sit underneath. Ask X-Rex for help anytime; replay this tour from the header.','04 / READY TO SHARE'],
];
export default function Walkthrough({request,onVoice}:{request:number;onVoice:()=>void}){
 const [open,setOpen]=useState(false),[step,setStep]=useState(0);
 useEffect(()=>{if(!document.cookie.split('; ').some(c=>c==='xrex_tour_v1=done'))setOpen(true);},[]);
 useEffect(()=>{if(request){setStep(0);setOpen(true);}},[request]);
 function finish(){document.cookie=`xrex_tour_v1=done; Max-Age=31536000; Path=/; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;setOpen(false);}
 return <AppDialog open={open} onClose={finish} label="Welcome to X-Rex" className="tour-dialog"><div className="tour-top"><Image src="/x-rex.webp" alt="X-Rex" width={84} height={84}/><button className="text-button" onClick={finish}>Skip tour</button></div><div className="eyebrow">{steps[step][2]}</div><h2>{steps[step][0]}</h2><p>{steps[step][1]}</p><div className="tour-dots" aria-label="Tour steps">{steps.map((s,i)=><button key={s[0]} aria-label={`Go to tour step ${i+1}`} aria-current={i===step?'step':undefined} className={i===step?'active':''} onClick={()=>setStep(i)}/>)}</div><div className="tour-actions"><button className="secondary" disabled={step===0} onClick={()=>setStep(n=>n-1)}>Back</button><button className="primary" onClick={()=>step===steps.length-1?finish():setStep(n=>n+1)}>{step===steps.length-1?'Let’s get started':'Next'}</button></div>{step===steps.length-1&&<button className="text-button tour-voice" onClick={()=>{finish();onVoice();}}>Set up my writing voice</button>}<small>{step+1} of {steps.length} · You can replay this anytime</small></AppDialog>;
}
