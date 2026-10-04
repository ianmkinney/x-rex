import {z} from 'zod';
import {WEIGHTS,type Head} from './engine';
export const DEFAULT_MODEL='~anthropic/claude-sonnet-latest';
export const modelIdSchema=z.string().min(3).max(160).regex(/^~?[a-zA-Z0-9._-]+\/[a-zA-Z0-9._:+-]+$/);
export const draftsSchema=z.object({posts:z.array(z.object({
 text:z.string().trim().min(1).max(4000),
 audienceFit:z.string().trim().min(1).max(1200),
 markers:z.array(z.object({head:z.enum(Object.keys(WEIGHTS) as [Head,...Head[]]),evidence:z.string().min(1).max(600),rationale:z.string().min(1).max(800)})).min(2).max(4),
 negativeFeedback:z.string().trim().min(1).max(1200),
})).length(3)});
export type DraftPost=z.infer<typeof draftsSchema>['posts'][number];
export type DraftResponse={posts:DraftPost[];model:string;maxLength?:number};
export const DRAFT_OUTPUT_INSTRUCTIONS=`Return ONLY valid JSON, without markdown fences or introductory text, with this shape:
{"posts":[{"text":"ready-to-publish post only","audienceFit":"short audience rationale","markers":[{"head":"exact published head name","evidence":"phrase or structure from this post","rationale":"intended viewer action, explicitly a writing hypothesis"}],"negativeFeedback":"specific risk avoided and relevant negative head"}]}
Return exactly 3 posts, each with 2–4 markers. Follow the brief’s selected LENGTH. Expanded posts should be 450–900 weighted characters, max 1,200; standard posts max 280. Emoji/CJK can count more; URLs count as 23. Add natural conversational detail and relevant emoji where appropriate; avoid terse slogans. All reasoning belongs in the separate fields, never in text. Do not include labels, quotation wrappers, or character counts in text. Do not output private chain-of-thought; provide only concise editorial explanations. Prefer natural, easy-to-read language over a formulaic optimization checklist.`;
