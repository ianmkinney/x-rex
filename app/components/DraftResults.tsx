'use client';
import {useState} from 'react';
import {Copy,ArrowUpRight,Check} from 'lucide-react';
import {parsePost} from '@/lib/post-text';
import {LABELS,WEIGHTS} from '@/lib/engine';
import type {DraftPost,DraftResponse} from '@/lib/drafts';
function PostOption({post,index,limit}:{post:DraftPost;index:number;limit:number}){
 const [text,setText]=useState(post.text),[message,setMessage]=useState('');
 const parsed=parsePost(text,limit);
 async function copy(){try{await navigator.clipboard.writeText(text);setMessage('Copied post only.');}catch{setMessage('Select the post text and copy it manually.');}}
 return <article className="post-option"><div className="post-box"><div className="post-box-heading"><span className="mini-label">OPTION {index+1}</span><span className={parsed.valid?'post-count':'post-count negative'}>{parsed.weightedLength} / {limit}</span></div><textarea aria-label={`Post option ${index+1}`} value={text} onChange={e=>{setText(e.target.value);setMessage('');}} rows={5}/>{limit>280&&<p className="hint">Publishing this longer draft requires long-post access on X.</p>}<div className="post-actions"><button className="secondary" onClick={()=>void copy()} disabled={!text.trim()}>{message==='Copied post only.'?<Check size={16}/>:<Copy size={16}/>}Copy post</button>{parsed.valid?<a className="primary" href={`https://x.com/intent/post?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">Post on X<ArrowUpRight size={16}/></a>:<button className="primary" disabled>Post on X</button>}</div>{!parsed.valid&&<p className="hint">Edit the post to fit the selected length before opening X.</p>}{message&&<p className="hint" role="status">{message}</p>}</div><section className="reasoning-box" aria-label={`Reasoning for option ${index+1}`}><div className="mini-label">WHY THIS POST WORKS</div>{text!==post.text&&<p className="hint">This explanation describes the original draft, before your edits.</p>}<p>{post.audienceFit}</p><div className="marker-reasons">{post.markers.map((marker,i)=><div key={`${marker.head}-${i}`}><strong>{LABELS[marker.head]} <span>{WEIGHTS[marker.head]>0?'+':''}{WEIGHTS[marker.head]}</span></strong><code>{marker.head}</code><p>“{marker.evidence}” — {marker.rationale}</p></div>)}</div><p className="feedback-note">{post.negativeFeedback}</p><small>Writing hypotheses, not predicted reach.</small></section></article>;
}
export default function DraftResults({result}:{result:DraftResponse}){
 return <div className="draft-results"><div className="mini-label">YOUR POST OPTIONS</div><p className="hint">Edit, copy, or open a draft in X to review and publish.</p>{result.posts.map((post,index)=><PostOption key={`${index}-${post.text}`} post={post} index={index} limit={result.maxLength||280}/>)}<p className="hint model-credit">Generated with {result.model}</p></div>;
}
