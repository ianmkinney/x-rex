import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ARCHETYPES,DEFAULT_CONTEXT,WEIGHTS,analyze,buildPrompt,customArchetype,estimate,filterReasons,weightedScore,type Predictions} from '../lib/engine';
const zero=Object.fromEntries(Object.keys(WEIGHTS).map(k=>[k,0])) as Predictions;
test('weighted score matches a hand-computed published-weight fixture',()=>{
 const predictions={...zero,favorite:.2,reply:.03,share_via_copy_link:.01,not_interested:.002,dwell_time:10};
 const result=weightedScore(predictions,DEFAULT_CONTEXT);
 const expected=.2*.5+.03*5+.01*20-.002*47.52+10*.004;
 assert.ok(Math.abs(result.raw-expected)<1e-12);
 assert.ok(Math.abs(result.offset-(expected+.001))<1e-12);
});
test('negative score offset matches source arithmetic',()=>{
 const result=weightedScore({...zero,not_interested:.1},DEFAULT_CONTEXT);
 const negativeSum=47.52+31.2+58.8+234+.02;
 const positiveSum=Object.entries(WEIGHTS).filter(([k,w])=>w>0&&!k.endsWith('_time')).reduce((s,[,w])=>s+w,0);
 assert.ok(Math.abs(result.offset-((-4.752+negativeSum)/(positiveSum+negativeSum)*.001))<1e-12);
});
test('mutual-follow boost only affects original posts; unexplored is in-network only',()=>{
 const p={...zero,reply:.1,post_unexplored:.2};
 assert.equal(weightedScore(p,DEFAULT_CONTEXT).raw,.5);
 assert.equal(weightedScore(p,{...DEFAULT_CONTEXT,relationship:'mutual'}).raw,2.004);
 assert.equal(weightedScore(p,{...DEFAULT_CONTEXT,relationship:'mutual',postType:'reply'}).raw,.504);
});
test('filter boundaries match the modeled published rules',()=>{
 assert.equal(filterReasons('A test',{...DEFAULT_CONTEXT,ageHours:48}).length,0);
 assert.match(filterReasons('A test',{...DEFAULT_CONTEXT,ageHours:48.01})[0],/AgeFilter/);
 assert.match(filterReasons('A test',{...DEFAULT_CONTEXT,postType:'reply'})[0],/OONRetweetReplyFilter/);
 assert.equal(filterReasons('A test',{...DEFAULT_CONTEXT,relationship:'following',postType:'reply'}).length,0);
 assert.match(filterReasons('A test',{...DEFAULT_CONTEXT,relationship:'following',postType:'reply',missingParent:true})[0],/ancestors/);
 assert.match(filterReasons('AI workflow',{...DEFAULT_CONTEXT,mutedKeywords:'AI'})[0],/MutedKeyword/);
});
test('analysis is reproducible, respects overrides, and avoids token substring matches',()=>{
 const text='AI agent automation workflow API';
 assert.deepEqual(analyze(text,ARCHETYPES,DEFAULT_CONTEXT),analyze(text,ARCHETYPES,DEFAULT_CONTEXT));
 assert.equal(analyze(text,ARCHETYPES,DEFAULT_CONTEXT)[0].archetype.id,'ai-builders');
 assert.equal(estimate('chair daily rainfall',ARCHETYPES.find(a=>a.id==='ai-builders')!,DEFAULT_CONTEXT).matches.includes('ai'),false);
 const result=analyze(text,ARCHETYPES,DEFAULT_CONTEXT,{'ai-builders':{report:1}}).find(r=>r.archetype.id==='ai-builders')!;
 assert.ok(result.raw<0);assert.equal(result.predictions.report,1);
});
test('custom descriptions yield reproducible profiles and reverse briefs',()=>{
 const a=customArchetype('Gardeners who enjoy composting and native plants');
 assert.deepEqual(a,customArchetype('Gardeners who enjoy composting and native plants'));
 assert.ok(a.terms.includes('composting'));
 const prompt=buildPrompt([a],'Composting basics','Educational');
 assert.match(prompt,/Composting basics/);assert.match(prompt,/not official X audience/);
 assert.throws(()=>customArchetype('the and of'));
});

test('generation briefs expose actionable source markers and require a per-post audit',()=>{
 const prompt=buildPrompt([ARCHETYPES[0]],'Reduce food waste','Practical');
 for(const head of ['share_via_copy_link','share_via_dm','reply','follow_author','not_interested','mute_author','report'] as const){
  assert.ok(prompt.includes(`${head} (${WEIGHTS[head]>0?'+':''}${WEIGHTS[head]})`));
 }
 assert.match(prompt,/dwell_time \(\+0.004 per predicted second\)/);
 assert.match(prompt,/Markers used: identify 2–4/);
 assert.match(prompt,/editorial hypotheses, not rules published by X/);
 assert.match(prompt,/X-REX ASSUMPTIONS, NOT X MARKERS/);
 assert.match(prompt,/do not invent probabilities, contributions, or an optimal score/);
 assert.match(prompt,/OONRetweetReplyFilter/);
 assert.match(prompt,/Restaurant owners/);
 assert.match(prompt,/Make the post enjoyable and effortless to read/);
 assert.match(prompt,/Do not force jokes/);
});
