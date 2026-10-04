import type {PostLength} from '@/lib/writing';
export default function LengthPicker({value,onChange}:{value:PostLength;onChange:(value:PostLength)=>void}){
 return <label className="field">Post length<select value={value} onChange={e=>onChange(e.target.value as PostLength)}><option value="expanded">Room to talk · 450–900 characters</option><option value="standard">Standard X post · up to 280</option></select><span className="hint">{value==='expanded'?'More room for personality and useful detail. Requires long-post access on X.':'A complete, conversational thought within the standard limit.'}</span></label>;
}
