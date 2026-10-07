'use client';
import {createContext,useCallback,useContext,useEffect,useState} from 'react';
import {KeyRound,LoaderCircle,PauseCircle} from 'lucide-react';
export type PaidStatus={paidFeaturesEnabled:boolean;unlocked:boolean};
const PausedContext=createContext(false);
export const PaidPausedProvider=PausedContext.Provider;
export const usePaidPaused=()=>useContext(PausedContext);
export function usePaidStatus(){
 const [status,setStatus]=useState<PaidStatus|null>(null);
 const refresh=useCallback(async()=>{try{const response=await fetch('/api/status',{cache:'no-store'});if(response.ok)setStatus(await response.json());}catch{}},[]);
 useEffect(()=>{void refresh();},[refresh]);
 return {status,refresh};
}
export default function PaidAccess({status,onUnlocked}:{status:PaidStatus|null;onUnlocked:()=>Promise<void>}){
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!status)return null;
 if(!status.paidFeaturesEnabled)return <div className="alert error paid-paused" role="status"><PauseCircle size={18}/><span>AI drafting, screenshot reading, profile import, creator discovery, and X-Rex chat are paused by the site owner. Free post scoring still works.</span></div>;
 if(status.unlocked)return null;
 async function unlock(){setBusy(true);setError('');try{const response=await fetch('/api/invite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});const data=await response.json();if(!response.ok)throw new Error(data.error||'That invite code isn’t valid.');setCode('');await onUnlocked();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <form className="card invite-card" onSubmit={e=>{e.preventDefault();if(code.trim()&&!busy)void unlock();}}><div className="section-title"><KeyRound size={18}/><h2>Have an invite code?</h2></div><p className="hint">AI drafting, profile import, creator discovery, and X-Rex chat need an invite. Post scoring is free for everyone.</p><div className="writer-import"><label className="field">Invite code<input value={code} maxLength={200} autoComplete="off" onChange={e=>setCode(e.target.value)} placeholder="Enter your invite code" disabled={busy}/></label><button className="primary" type="submit" disabled={!code.trim()||busy}>{busy?<LoaderCircle size={16} className="spin"/>:<KeyRound size={16}/>}Unlock</button></div>{error&&<p className="alert error" role="alert">{error}</p>}</form>;
}
