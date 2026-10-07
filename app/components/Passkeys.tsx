'use client';
import {useCallback,useEffect,useState} from 'react';
import {browserSupportsWebAuthn,startAuthentication,startRegistration,WebAuthnError} from '@simplewebauthn/browser';
import {ChevronRight,Download,Fingerprint,X} from 'lucide-react';
async function api(path:string,body?:unknown){const r=await fetch('/api/auth/'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw new Error(j.error??'Request failed');return j;}
const when=(s?:string|null)=>s?new Date(s).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—';
const message=(e:unknown)=>e instanceof WebAuthnError||(e instanceof Error&&e.name==='NotAllowedError')?'The passkey prompt was cancelled, timed out, or no matching passkey was found.':e instanceof Error?e.message:'Something went wrong.';
const deviceName=()=>{if(typeof navigator==='undefined')return 'Passkey';const ua=navigator.userAgent;return /iPhone/.test(ua)?'iPhone':/iPad/.test(ua)?'iPad':/Android/.test(ua)?'Android phone':/Mac/.test(ua)?'Mac':/Windows/.test(ua)?'Windows PC':'Passkey';};
/** One user-verified assertion on a fresh server challenge; returns the response for the caller to submit. */
export const passkeyAssertion=async(optionsPath:string)=>startAuthentication({optionsJSON:await api(optionsPath,{})});
const stepUp=async()=>api('passkey/step/verify',{response:await passkeyAssertion('passkey/step/options')});

function RecoveryCodes({codes,onDone,done='I saved them — continue'}:{codes:string[];onDone:()=>void;done?:string}){
 const [saved,setSaved]=useState(false);const text=codes.join('\n');
 return <div className="recovery-codes" role="region" aria-label="Recovery codes">
  <p><strong>Save these recovery codes now.</strong> They are shown once. Each code works once and, together with the owner password, lets you register a new passkey if you lose every device.</p>
  <ol>{codes.map(c=><li key={c}><code>{c}</code></li>)}</ol>
  <div className="writer-buttons"><button type="button" className="secondary" onClick={()=>void navigator.clipboard?.writeText(text)}>Copy</button><a className="secondary" download="x-rex-recovery-codes.txt" href={'data:text/plain;charset=utf-8,'+encodeURIComponent(text+'\n')}><Download size={14}/> Download</a></div>
  <label className="passkey-check"><input type="checkbox" checked={saved} onChange={e=>setSaved(e.target.checked)}/> I stored these somewhere safe, away from my devices</label>
  <button type="button" className="primary" disabled={!saved} onClick={onDone}>{done}</button>
 </div>;
}

type Step='password'|'passkey'|'enroll'|'recover'|'codes';
/** Owner password first, then a passkey; or, before any passkey exists, the one-time setup token to enroll the first one. */
export function SignIn({onSignedIn}:{onSignedIn:()=>Promise<void>}){
 const [step,setStep]=useState<Step>('password'),[password,setPassword]=useState(''),[token,setToken]=useState(''),[code,setCode]=useState(''),[name,setName]=useState(''),[codes,setCodes]=useState<string[]>([]);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[supported,setSupported]=useState(true);
 useEffect(()=>{setName(deviceName());setSupported(browserSupportsWebAuthn());},[]);
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn();}catch(e){const m=message(e);setError(m);if(/expired/i.test(m)){setStep('password');}}finally{setBusy(false);}};
 const finish=async(r:{recoveryCodes?:string[]|null})=>{if(r.recoveryCodes?.length){setCodes(r.recoveryCodes);setStep('codes');}else await onSignedIn();};
 if(!supported)return <p className="alert error" role="alert">This browser does not support passkeys. Use a current version of Safari, Chrome, Edge, or Firefox.</p>;
 if(step==='codes')return <RecoveryCodes codes={codes} onDone={()=>void onSignedIn()}/>;
 return <div className="passkey-signin">
  {step==='password'&&<form onSubmit={e=>{e.preventDefault();void run(async()=>{const r=await api('login',{password});setPassword('');setNotice('');setStep(r.next==='enroll'?'enroll':'passkey');});}}>
   <label className="field">Owner password<input autoComplete="current-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>
   <button type="submit" className="primary" disabled={busy}>Continue <ChevronRight size={17}/></button>
  </form>}
  {step==='passkey'&&<div>
   <p className="hint">Confirm it’s you with a passkey on a registered device.</p>
   <button type="button" className="primary" disabled={busy} autoFocus onClick={()=>void run(async()=>{await api('passkey/login/verify',{response:await passkeyAssertion('passkey/login/options')});await onSignedIn();})}><Fingerprint size={18}/> {busy?'Waiting for passkey…':'Sign in with passkey'}</button>
   <div className="writer-buttons"><button type="button" className="text-button" onClick={()=>{setError('');setStep('recover');}}>Lost your device? Use a recovery code</button><button type="button" className="text-button" onClick={()=>setStep('password')}>Start over</button></div>
  </div>}
  {step==='recover'&&<form onSubmit={e=>{e.preventDefault();void run(async()=>{
    const options=await api('recovery',{code});setCode('');
    const r=await api('passkey/register/verify',{response:await startRegistration({optionsJSON:options}),name});
    setNotice('');await finish(r);
   });}}>
   <p className="hint">Using a recovery code signs out every other session. Afterwards, remove the lost device under Manage passkeys.</p>
   <label className="field">Recovery code<input autoComplete="one-time-code" spellCheck={false} value={code} onChange={e=>setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" required/></label>
   <label className="field">Name for the new passkey<input value={name} maxLength={60} onChange={e=>setName(e.target.value)}/></label>
   <button type="submit" className="primary" disabled={busy}><Fingerprint size={18}/> Redeem code and create passkey</button>
   <button type="button" className="text-button" onClick={()=>setStep('passkey')}>Back</button>
  </form>}
  {step==='enroll'&&<form onSubmit={e=>{e.preventDefault();void run(async()=>{
    const options=await api('passkey/register/options',{setupToken:token});setToken('');
    await finish(await api('passkey/register/verify',{response:await startRegistration({optionsJSON:options}),name}));
   });}}>
   <p className="hint">No passkey is registered yet. Enter the one-time PASSKEY_SETUP_TOKEN from Vercel to enroll this device.</p>
   <label className="field">Setup token<input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} required/></label>
   <label className="field">Name this passkey<input value={name} maxLength={60} onChange={e=>setName(e.target.value)}/></label>
   <button type="submit" className="primary" disabled={busy}><Fingerprint size={18}/> Create passkey</button>
  </form>}
  {notice&&<p className="hint" role="status">{notice}</p>}
  {error&&<p className="alert error" role="alert">{error}</p>}
 </div>;
}

type Listed={id:string;name:string;createdAt:string;lastUsedAt:string|null;deviceType:string;backedUp:boolean};
export function PasskeyPanel(){
 const [data,setData]=useState<{passkeys:Listed[];recoveryRemaining:number}|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState('');
 const [name,setName]=useState(''),[editing,setEditing]=useState<{id:string;name:string}|null>(null),[codes,setCodes]=useState<string[]|null>(null);
 const load=useCallback(async()=>{try{setData(await api('passkeys'));}catch(e){setError(message(e));}},[]);
 useEffect(()=>{void load();setName(deviceName());},[load]);
 const run=async(key:string,fn:()=>Promise<void>,done:string)=>{setBusy(key);setError('');setNotice('');try{await fn();await load();setNotice(done);}catch(e){setError(message(e));}finally{setBusy('');}};
 // Sensitive changes always ask the authenticator again, even within an existing step-up window.
 const add=()=>run('add',async()=>{await stepUp();const options=await api('passkey/register/options',{});await api('passkey/register/verify',{response:await startRegistration({optionsJSON:options}),name});},'Passkey added.');
 const remove=(p:Listed)=>{if(!confirm(`Remove “${p.name}”? Every other signed-in session will be signed out.`))return;void run(p.id,async()=>{await stepUp();await api('passkeys/remove',{id:p.id});},`Removed ${p.name}.`);};
 const regenerate=()=>{if(!confirm('Replace all recovery codes? The old codes stop working immediately.'))return;void run('codes',async()=>{await stepUp();setCodes((await api('passkeys/recovery-codes',{})).recoveryCodes);},'New recovery codes generated. Save them now.');};
 const only=(data?.passkeys.length??0)<=1;
 return <section className="passkey-panel">
  <p className="hint">Owner sign-in needs the owner password and one of these passkeys. Register at least two devices (for example, phone and laptop).</p>
  {data?.passkeys.map(p=><div className="passkey-row" key={p.id}>
   {editing?.id===p.id?<form className="writer-buttons" onSubmit={e=>{e.preventDefault();void run(p.id,async()=>{await api('passkeys/rename',editing);setEditing(null);},'Passkey renamed.');}}><input aria-label="Passkey name" value={editing.name} maxLength={60} onChange={e=>setEditing({id:p.id,name:e.target.value})} autoFocus/><button type="submit" className="secondary">Save</button><button type="button" className="text-button" onClick={()=>setEditing(null)}>Cancel</button></form>
   :<span><strong>{p.name}</strong><small className="hint"> · added {when(p.createdAt)} · last used {when(p.lastUsedAt)}{p.backedUp?' · synced':''}</small></span>}
   {editing?.id!==p.id&&<span className="writer-buttons"><button type="button" className="text-button" onClick={()=>setEditing({id:p.id,name:p.name})}>Rename</button><button type="button" className="text-button" disabled={Boolean(busy)||only} title={only?'Add another passkey before removing this one':undefined} onClick={()=>remove(p)}><X size={14}/> {busy===p.id?'Removing…':'Remove'}</button></span>}
  </div>)}
  {only&&data&&<p className="hint">You can’t remove your only passkey. Add another device first, or use a recovery code if this one is lost.</p>}
  <form onSubmit={e=>{e.preventDefault();void add();}}><div className="writer-import"><label className="field">Add another passkey<input value={name} maxLength={60} onChange={e=>setName(e.target.value)} placeholder="Device name"/></label><button type="submit" className="secondary" disabled={Boolean(busy)}><Fingerprint size={15}/> {busy==='add'?'Waiting for passkey…':'Add passkey'}</button></div><p className="hint">You’ll confirm with an existing passkey first, then create the new one (choose “use another device” to enroll a phone by QR code).</p></form>
  <div className="passkey-row"><span>Unused recovery codes: <strong>{data?.recoveryRemaining??'—'}</strong></span><button type="button" className="text-button" disabled={Boolean(busy)} onClick={regenerate}>{busy==='codes'?'Waiting for passkey…':'Regenerate'}</button></div>
  {codes&&<RecoveryCodes codes={codes} done="Done" onDone={()=>{setCodes(null);setNotice('');}}/>}
  {notice&&<p className="hint" role="status">{notice}</p>}
  {error&&<p className="alert error" role="alert">{error}</p>}
 </section>;
}
