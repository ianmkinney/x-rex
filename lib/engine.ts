/**
 * X-Rex v1. The public arithmetic is distinct from the HAI lexical surrogate.
 * No trained Phoenix checkpoint, private viewer data, or retrieval pool is used.
 * See SOURCES.md for scope, derivation, and upstream Apache-2.0 attribution.
 */
export const SOURCE_SHA = 'b412112d03f27acbfd668e0cc040abcafa1080c1';
export const SOURCE_URL = `https://github.com/xai-org/x-algorithm/tree/${SOURCE_SHA}`;
export const ENGINE_VERSION = 'x-rex-lexical-v1';
export const WEIGHTS = {
  favorite: .5, reply: 5, retweet: 1, photo_expand: .05, video_open: .07,
  click: .3, open_link: .2, profile_click: 0, vqv: 0, share: 2, share_via_dm: 5,
  share_via_copy_link: 20, dwell: .05, quote: 5, quoted_click: .05, quoted_vqv: 0,
  follow_author: 4, post_unexplored: .02, dwell_time: .004, click_dwell_time: .4,
  not_interested: -47.52, block_author: -31.2, mute_author: -58.8, report: -234, not_dwelled: -.02,
} as const;
export type Head = keyof typeof WEIGHTS;
export type Predictions = Record<Head, number>;
export const LABELS: Record<Head, string> = {favorite:'Like',reply:'Reply',retweet:'Repost',photo_expand:'Expand photo',video_open:'Open video',click:'Open post',open_link:'Open link',profile_click:'Visit profile',vqv:'Quality video view',share:'Share',share_via_dm:'Share via DM',share_via_copy_link:'Copy link',dwell:'Dwell',quote:'Quote',quoted_click:'Open quoted post',quoted_vqv:'Quoted video view',follow_author:'Follow author',post_unexplored:'Post unexplored',dwell_time:'Dwell seconds',click_dwell_time:'Click dwell seconds',not_interested:'Not interested',block_author:'Block author',mute_author:'Mute author',report:'Report',not_dwelled:'Not dwelled'};
export type Archetype = { id:string; name:string; description:string; terms:string[]; interests:string[]; behavior:'builder'|'reader'|'conversational'|'curator'; color:string };
export const ARCHETYPES: Archetype[] = [
 {id:'restaurant-owners',name:'Restaurant owners',description:'Restaurant operators focused on attracting guests, running efficient teams, and growing a profitable business.',terms:['restaurant','restaurants','restaurateur','restaurateurs','hospitality','dining','diner','diners','menu','menus','chef','chefs','kitchen','food','foodservice','catering','takeout','delivery','reservations','guests','staffing','inventory','suppliers','margins','labor','pos','loyalty','table','tables'],interests:['Restaurant operations','Guest experience','Restaurant growth'],behavior:'builder',color:'#b1834e'},
 {id:'ai-builders',name:'AI builders',description:'Hands-on developers turning AI tools into useful products.',terms:['ai','llm','agent','agents','automation','automate','prompt','prompts','api','model','models','claude','gpt','openai','code','coding','python','workflow','workflows','developer','developers'],interests:['AI & agents','Practical tutorials','Developer tools'],behavior:'builder',color:'#508c70'},
 {id:'founders',name:'Indie founders',description:'Small teams building, shipping, and growing a business.',terms:['startup','founder','founders','saas','business','customers','revenue','product','launch','growth','build','shipping','bootstrapped','sales','pricing','entrepreneur','mrr','profit'],interests:['Building in public','SaaS','Growth'],behavior:'conversational',color:'#6388ae'},
 {id:'creators',name:'Content creators',description:'Creators exploring storytelling, distribution, and audience growth.',terms:['creator','creators','content','audience','video','social','marketing','brand','storytelling','posts','newsletter','youtube','tiktok','engagement','writing','copywriting','viral'],interests:['Content strategy','Storytelling','Audience growth'],behavior:'curator',color:'#ad7d65'},
 {id:'tech-curious',name:'Tech explorers',description:'Curious readers keeping up with useful technology.',terms:['tech','technology','ai','tools','app','apps','new','future','innovation','digital','software','device','robot','launch','openai','apple','google','research'],interests:['New technology','AI tools','What’s next'],behavior:'reader',color:'#8d7dac'},
 {id:'markets',name:'Market watchers',description:'Analytical readers following markets, economics, and crypto.',terms:['market','markets','stock','stocks','trading','crypto','bitcoin','ethereum','economy','inflation','finance','investing','investment','fed','earnings','portfolio','btc','eth'],interests:['Markets','Crypto','Economic trends'],behavior:'reader',color:'#a48c43'},
 {id:'designers',name:'Design thinkers',description:'People who care about thoughtful interfaces and product experiences.',terms:['design','designer','designers','ux','ui','interface','interfaces','figma','typography','accessibility','creative','visual','prototype','user','experience','product'],interests:['Product design','UX','Creative process'],behavior:'curator',color:'#b17389'},
 {id:'sports',name:'Sports fans',description:'Fans discussing the game, the players, and the moments.',terms:['sport','sports','tennis','soccer','football','basketball','nba','nfl','match','game','team','player','players','season','goal','score','league'],interests:['Live games','Athletes','Fan conversations'],behavior:'conversational',color:'#6e9393'},
 {id:'everyday',name:'Everyday optimizers',description:'Readers looking for better habits and practical improvements.',terms:['productivity','habit','habits','time','routine','learn','learning','health','fitness','work','life','tips','focus','save','simple','daily','better'],interests:['Productivity','Learning','Daily routines'],behavior:'reader',color:'#8b9260'},
];
export type Context = {ageHours:number; relationship:'outside'|'following'|'mutual'; postType:'original'|'reply'|'repost'; media:'text'|'image'|'video'; seen:boolean; blocked:boolean; missingParent:boolean; mutedKeywords:string};
export const DEFAULT_CONTEXT: Context = {ageHours:0,relationship:'outside',postType:'original',media:'text',seen:false,blocked:false,missingParent:false,mutedKeywords:''};
export const tokenize = (text:string) => text.toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+/gu) || [];
const clamp = (n:number, min=0, max=1) => Math.min(max,Math.max(min,n));
const stops = new Set('a an the and or for to of in on at with from who that their they are is i my want interested likes people users user create archetype about enjoys someone this these into me more most very will would should can'.split(' '));
export function fingerprint(value:unknown):string {
 const s = JSON.stringify(value); let h=2166136261;
 for(let i=0;i<s.length;i++) { h ^= s.charCodeAt(i); h = Math.imul(h,16777619); }
 return (h>>>0).toString(16).padStart(8,'0');
}
export function customArchetype(prompt:string):Archetype {
 const terms = [...new Set(tokenize(prompt).filter(t=>t.length>2&&!stops.has(t)))].slice(0,35);
 if(!terms.length) throw new Error('Describe a few concrete interests, such as robotics, gardening, or startups.');
 const name = prompt.trim().split(/[.!?\n]/)[0].slice(0,42);
 return {id:`custom-${fingerprint(prompt.trim())}`,name,description:prompt.trim().slice(0,600),terms,interests:terms.slice(0,3),behavior:'reader',color:'#628e7a'};
}
export function estimate(text:string, archetype:Archetype, context:Context) {
 const tokens=new Set(tokenize(text));
 const matches=archetype.terms.filter(term=> { const words=tokenize(term); return words.length>0&&words.every(t=>tokens.has(t)); });
 const affinity=1-Math.exp(-matches.length/3);
 const question=text.includes('?')?1:0;
 const useful=/\b(how|steps|guide|tutorial|tip|tips|learn|workflow|checklist)\b/i.test(text)?1:0;
 const hasLink=/https?:\/\//i.test(text)?1:0;
 const conversational=archetype.behavior==='conversational'?1.3:1;
 const curator=archetype.behavior==='curator'?1.3:1;
 // Explicit HAI assumptions, not Phoenix inference. Bounded and reproducible.
 const predictions:Predictions = {
 favorite:.015+.20*affinity, reply:(.001+.027*affinity*(1+.5*question))*conversational,
 retweet:(.001+.035*affinity)*curator, photo_expand:context.media==='image'?.04+.3*affinity:0,
 video_open:context.media==='video'?.03+.25*affinity:0, click:.01+.12*affinity,
 open_link:hasLink*(.004+.09*affinity), profile_click:.002+.025*affinity,vqv:0,
 share:(.0008+.012*affinity)*curator,share_via_dm:.0005+.008*affinity,
 share_via_copy_link:.0005+.012*affinity*(1+.4*useful),dwell:.1+.65*affinity,
 quote:.0004+.006*affinity*conversational,quoted_click:0,quoted_vqv:0,
 follow_author:.0005+.01*affinity,post_unexplored:.03,
 dwell_time:Math.min(40,2+text.length/50)*(0.2+.8*affinity),
 click_dwell_time:hasLink*(.03+.35*affinity),not_interested:.001+.012*(1-affinity),
 block_author:.00002,mute_author:.00004,report:.000005,not_dwelled:.8-.65*affinity,
 };
 for(const head of Object.keys(predictions) as Head[]) if(!head.endsWith('_time')) predictions[head]=clamp(predictions[head]);
 return {predictions,matches,affinity};
}
export function filterReasons(text:string,context:Context):string[] {
 const reasons:string[]=[];
 if(context.ageHours>48) reasons.push('AgeFilter: post is older than 48 hours.');
 if(context.relationship==='outside'&&context.postType!=='original') reasons.push('OONRetweetReplyFilter: out-of-network replies and reposts are excluded with the published default.');
 if(context.postType==='reply'&&context.missingParent) reasons.push('OONRetweetReplyFilter: reply ancestors are missing.');
 if(context.seen) reasons.push('PreviouslySeenPostsFilter: this viewer has already seen the post.');
 if(context.blocked) reasons.push('AuthorSocialgraphFilter: this viewer blocks or mutes the author.');
 const lower=text.toLowerCase();
 if(context.mutedKeywords.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean).some(s=>lower.includes(s))) reasons.push('MutedKeywordFilter approximation: the text contains a supplied muted phrase.');
 return reasons;
}
export function weightedScore(predictions:Predictions,context:Context) {
 const contributions=(Object.keys(WEIGHTS) as Head[]).map(head=>{
  let weight:number=WEIGHTS[head];
  if(head==='reply'&&context.relationship==='mutual'&&context.postType==='original') weight+=15;
  if(head==='post_unexplored'&&context.relationship==='outside') weight=0;
  return {head,label:LABELS[head],value:predictions[head],weight,contribution:predictions[head]*weight};
 });
 const raw=contributions.reduce((sum,c)=>sum+c.contribution,0);
 // Upstream offset uses base configured weights, excluding continuous heads from total_sum.
 const negativeSum=Object.values(WEIGHTS).filter(n=>n<0).reduce<number>((s,n)=>s-n,0);
 const positiveSum=(Object.entries(WEIGHTS) as [Head,number][]).filter(([h,n])=>n>0&&!h.endsWith('_time')).reduce((s,[,n])=>s+n,0);
 const offset=raw<0?(raw+negativeSum)/(positiveSum+negativeSum)*.001:raw+.001;
 return {raw,offset,contributions};
}
export function analyze(text:string, archetypes:Archetype[],context:Context,overrides:Record<string,Partial<Predictions>>={}) {
 const reasons=filterReasons(text,context);
 return archetypes.map(archetype=>{
  const estimated=estimate(text,archetype,context);
  const predictions={...estimated.predictions,...overrides[archetype.id]};
  const score=weightedScore(predictions,context);
  return {archetype,...estimated,predictions,...score,reasons,eligible:!reasons.length,overridden:!!overrides[archetype.id]};
 }).sort((a,b)=>b.offset-a.offset||a.archetype.id.localeCompare(b.archetype.id,'en'));
}
export type Result=ReturnType<typeof analyze>[number];
export function buildPrompt(archetypes:Archetype[],topic:string,tone:string):string {
 return `Write 3 distinct original X posts, each no more than 280 characters, about: ${topic.trim()||'[your topic]'}.

AUDIENCE BRIEF
${archetypes.map(a=>`- ${a.name}: ${a.description}\n  Interests: ${a.interests.join(', ')}. Vocabulary where relevant: ${a.terms.join(', ')}.`).join('\n')}

VOICE
${tone}. Give a concrete, useful idea. Do not invent personal experiences, metrics, claims, or sources. Avoid keyword stuffing, engagement bait, and forced questions. Invite a substantive reply only when it fits naturally.

RANKING CONTEXT — NOT A REACH GUARANTEE
The published X value model weights viewer-specific predicted actions, not raw engagement counts. Examples: reply 5, quote 5, share via DM 5, copy link 20, like 0.5; negative feedback also contributes. These weights are not instructions to repeat keywords or a way to guarantee distribution. Write for genuine audience value. Out-of-network replies and reposts are filtered under the pinned default, so produce original posts.

OUTPUT
Return just 3 numbered post options and a brief audience rationale for each. Keep any caveats outside the post text. No promises about impressions, ranking, or virality.

PROVENANCE
Brief generated deterministically by ${ENGINE_VERSION}. X source: ${SOURCE_SHA}. Archetypes are HAI user-defined scenarios, not official X audience segments. LLM wording is a separate, non-deterministic step.`;
}
