export type PostLength='standard'|'expanded';
export const postLimit=(length:PostLength)=>length==='standard'?280:1200;
export const lengthGuide=(length:PostLength)=>length==='standard'?'STANDARD: aim for 220–275 weighted characters, never more than 280. Make it a complete thought, not a slogan.':'ROOM TO TALK: aim for 450–900 weighted characters, never more than 1,200. Use 2–4 short paragraphs: a relatable opening, concrete detail or a small example, and a satisfying takeaway. Do not compress it into a one-line tip. Longer posts require an X account with long-post access.';
