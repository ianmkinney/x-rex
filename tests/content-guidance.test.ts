import {test} from 'node:test';
import assert from 'node:assert/strict';
import {draftsSchema} from '../lib/drafts';
import {draftFixture} from './e2e/draft-fixture';
test('draft validation rejects fabricated evidence, duplicate markers, and legacy weight explanations',()=>{
 assert.ok(draftsSchema.safeParse(draftFixture).success);
 for(const change of [(p:any)=>p.markers[0].evidence='not present in the post',(p:any)=>p.markers[1].id='audience_relevance',(p:any)=>p.markers[0]={head:'reply',evidence:'Kitchen chaos?',rationale:'More replies'}]){
 const invalid=structuredClone(draftFixture);change(invalid.posts[0]);assert.equal(draftsSchema.safeParse(invalid).success,false);
 }
});
