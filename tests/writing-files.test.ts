import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writingFileText,appendWritingSamples} from '../lib/writing-files';
const bytes=(s:string)=>new TextEncoder().encode(s);
test('writing uploads extract text and JSON posts without importing metadata',()=>{
 assert.equal(writingFileText('sample.md',bytes('Hello\r\nworld')),'Hello\nworld');
 assert.equal(writingFileText('posts.json',bytes(JSON.stringify({data:[{text:'First',username:'ignored'},{full_text:'Second'}]}))),'First\n\nSecond');
 assert.throws(()=>writingFileText('empty.json',bytes('{"username":"ignored"}')),/no writing samples/);
 assert.throws(()=>writingFileText('sample.pdf',bytes('text')),/TXT/);
 assert.throws(()=>writingFileText('bad.txt',new Uint8Array([255])),/UTF-8/);
 assert.throws(()=>writingFileText('bad.json',bytes('{')),/valid JSON/);
 const joined=appendWritingSamples('Existing',['New']);assert.equal(joined.examples,'Existing\n\nNew');assert.equal(joined.truncated,false);
 const capped=appendWritingSamples('x'.repeat(5999),['😀']);assert.ok(capped.examples.length<=6000);assert.equal(capped.truncated,true);
});
