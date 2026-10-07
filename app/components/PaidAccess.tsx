'use client';
import {createContext,useCallback,useContext,useEffect,useState} from 'react';
import {Fingerprint,KeyRound,LoaderCircle,LogOut,PauseCircle} from 'lucide-react';
import {PasskeyPanel,SignIn} from './Passkeys';
export type PaidStatus={paidFeaturesEnabled:boolean;unlocked:boolean;owner?:boolean};
const PausedContext=createContext(false);
export const PaidPausedProvider=PausedContext.Provider;
export const usePaidPaused=()=>useContext(PausedContext);
export function usePaidStatus(){
 const [status,setStatus]=useState<PaidStatus|null>(null);
 const refresh=useCallback(async()=>{try{const response=await fetch('/api/status',{cache:'no-store'});if(response.ok)setStatus(await response.json());}catch{}},[]);
 useEffect(()=>{void refresh();},[refresh]);
 return {status,refresh};
}
export default function PaidAccess({status,onUnlocked}:{status:PaidStatus|null;onUnlocked:(notice:string)=>Promise<void>}){
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!status)return null;
 const paused=!status.paidFeaturesEnabled&&<div className="alert error paid-paused" role="status"><PauseCircle size={18}/><span>AI drafting, screenshot reading, profile import, creator discovery, and X-Rex chat are paused by the site owner. Free post scoring still works.</span></div>;
 async function signOut(){await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).catch(()=>{});await onUnlocked('Signed out of the owner passkey session.');}
 if(status.owner)return <>{paused}<div className="card invite-card owner-bar"><div className="section-title"><Fingerprint size={18}/><h2>Signed in with your passkey</h2><button type="button" className="text-button" onClick={()=>void signOut()}><LogOut size={15}/>Sign out</button></div><details><summary>Manage passkeys</summary><PasskeyPanel/></details></div></>;
 if(paused||status.unlocked)return paused||null;
 async function unlock(){setBusy(true);setError('');try{const response=await fetch('/api/invite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});const data=await response.json();if(!response.ok)throw new Error(data.error||'That invite code isn’t valid.');setCode('');await onUnlocked('Invite accepted. AI and X features are unlocked on this browser.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <div className="card invite-card"><form onSubmit={e=>{e.preventDefault();if(code.trim()&&!busy)void unlock();}}><div className="section-title"><KeyRound size={18}/><h2>Have an invite code?</h2></div><p className="hint">AI drafting, profile import, creator discovery, and X-Rex chat need an invite. Post scoring is free for everyone.</p><div className="writer-import"><label className="field">Invite code<input value={code} maxLength={200} autoComplete="off" onChange={e=>setCode(e.target.value)} placeholder="Enter your invite code" disabled={busy}/></label><button className="primary" type="submit" disabled={!code.trim()||busy}>{busy?<LoaderCircle size={16} className="spin"/>:<KeyRound size={16}/>}Unlock</button></div>{error&&<p className="alert error" role="alert">{error}</p>}</form><details className="owner-signin"><summary><Fingerprint size={15}/>Site owner? Sign in with a passkey</summary><SignIn onSignedIn={()=>onUnlocked('Signed in with your passkey. AI and X features are unlocked.')}/></details></div>;
}
