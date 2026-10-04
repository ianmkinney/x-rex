import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHandle,profileInterests,profilePrompt,type PublicProfile} from '../lib/profile';
const profile:PublicProfile={username:'examplechef',name:'Example chef',bio:'Restaurant owner and chef',posts:[{id:'1',text:'Better menus and kitchen inventory reduce food waste.'}],source:'pasted'};
test('handles accept public profile URLs and reject other hosts, post URLs, and reserved paths',()=>{
 assert.equal(parseHandle('https://x.com/ExampleChef?s=21'),'examplechef');
 assert.equal(parseHandle('@ExampleChef'),'examplechef');
 assert.equal(parseHandle('twitter.com/examplechef/'),'examplechef');
 for(const bad of ['https://evil.test/chef','https://x.com/chef/status/123','https://x.com@evil.test/chef','https://x.com/i','https://x.com:8888/chef','https://x.com/a/b','a b'])assert.throws(()=>parseHandle(bad));
});
test('profile prompts are grounded, reproducible, and distinguish pasted evidence',()=>{
 const interests=profileInterests(profile);assert.ok(interests.includes('restaurant'));
 const a=profilePrompt(profile,interests,'Kitchen inventory','Practical');
 assert.equal(a,profilePrompt(profile,interests,'Kitchen inventory','Practical'));
 assert.match(a,/not independently verified/);assert.match(a,/does not expose the viewer/);assert.match(a,/Better menus/);
 assert.match(a,/CONTENT MARKERS → WRITING DECISIONS/);
 assert.match(a,/topic_clarity/);
 assert.match(a,/Content markers used: identify 2–4/);
 assert.equal(profileInterests({...profile,bio:'',posts:[]}).length,0);
 assert.throws(()=>profilePrompt(profile,[],'Topic','Practical'));
 assert.ok(!a.includes('/status/1')); // Never fabricate source links for pasted excerpts.
});
