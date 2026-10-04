import {z} from 'zod';
import {CONTENT_MARKERS,type ContentMarker} from './content-guidance';
export const DEFAULT_MODEL='~anthropic/claude-sonnet-latest';
export const modelIdSchema=z.string().min(3).max(160).regex(/^~?[a-zA-Z0-9._-]+\/[a-zA-Z0-9._:+-]+$/);
export const draftsSchema=z.object({posts:z.array(z.object({
 text:z.string().trim().min(1).max(4000),
 audienceFit:z.string().trim().min(1).max(1200),
 markers:z.array(z.object({id:z.enum(Object.keys(CONTENT_MARKERS) as [ContentMarker,...ContentMarker[]]),evidence:z.string().min(1).max(600),rationale:z.string().min(1).max(800)})).min(2).max(4),
 writingQuality:z.string().trim().min(1).max(1200),
 negativeFeedback:z.string().trim().min(1).max(1200),
})).length(3)}).superRefine(({posts},ctx)=>{posts.forEach((post,index)=>{const ids=post.markers.map(m=>m.id);if(new Set(ids).size!==ids.length||!ids.includes('audience_relevance')||!ids.includes('topic_clarity'))ctx.addIssue({code:'custom',path:['posts',index,'markers'],message:'Include unique audience and topic markers.'});for(const marker of post.markers)if(!post.text.includes(marker.evidence))ctx.addIssue({code:'custom',path:['posts',index,'markers'],message:'Marker evidence must quote the draft.'});});});
export type DraftPost=z.infer<typeof draftsSchema>['posts'][number];
export type DraftResponse={posts:DraftPost[];model:string;maxLength?:number};
export const DRAFT_OUTPUT_INSTRUCTIONS=`Return ONLY valid JSON, without markdown fences or introductory text, with this shape:
{"posts":[{"text":"ready-to-publish post only","audienceFit":"short audience rationale","markers":[{"id":"audience_relevance|topic_clarity|distinct_contribution|media_context|spam_risk","evidence":"phrase or structure from this post","rationale":"specific editorial application, explicitly a hypothesis, not a score boost"}],"writingQuality":"readability and voice choices, editorial rather than algorithmic","negativeFeedback":"concrete spam or unsupported-claim risk avoided or remaining; not an X classifier verdict"}]}
Return exactly 3 posts, each with 2–4 distinct content markers, including audience_relevance and topic_clarity. Evidence must be a verbatim substring of that post. Do not use engagement head names or weights. Use media_context only if context was actually supplied. Make all three options substantively different, not synonyms of the same hook. Follow the brief’s selected LENGTH. Expanded posts should be 450–900 weighted characters, max 1,200; standard posts max 280. Emoji/CJK can count more; URLs count as 23. Add natural conversational detail and relevant emoji where appropriate; avoid terse slogans. All reasoning belongs in the separate fields, never in text. Do not include labels, quotation wrappers, or character counts in text. Do not output private chain-of-thought; provide only concise editorial explanations. Prefer natural, easy-to-read language over a formulaic optimization checklist.`;
