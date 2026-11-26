import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseSocial, parseCSV, importDate, reviewRows, createImportedMemories, safeUrl} from '../dist/social-import.js';
import {ranked, validateProfile} from '../dist/engine.js';
const birth='1990-06-15', end='2026-11-25';
const parse = data => parseSocial(JSON.stringify(data));
const review = (rows, existing=[]) => reviewRows(rows,existing,birth,end);
const event = {date:'2008-09-01',text:'去北京读大学',place:'北京 中国'};

test('JSON / CSV samples produce identical dates, texts and topic suggestions',()=>{
  const json=parseSocial(readFileSync('dist/samples/social-events.json','utf8'));
  const csv=parseSocial(readFileSync('dist/samples/social-events.csv','utf8'),'sample.csv');
  assert.deepEqual(json.map(r=>r.date),csv.map(r=>r.date));
  assert.equal(json[0].category,'升学');assert.equal(json[1].category,'工作');
  assert.equal(csv[1].note,'Started working from home, with a new desk.');
});
test('X archive assignment is stripped as data, never executed',()=>{
  const tweet={tweet:{id_str:'1234567890123456789',created_at:'Mon Sep 01 12:00:00 +0000 2008',full_text:'Starting university in Beijing'}};
  const rows=parseSocial('window.YTD.tweets.part0 = '+JSON.stringify([tweet])+';','tweets.js');
  assert.equal(rows[0].date,'2008-09-01');assert.equal(rows[0].origin.platform,'X');
  assert.equal(rows[0].origin.url,'https://x.com/i/web/status/1234567890123456789');
  assert.throws(()=>parseSocial('window.YTD.tweets.part0 = []; alert(1);','tweets.js'),/JSON/);
  assert.throws(()=>parseSocial('alert(1)','posts.js'),/JSON/);
});
test('Instagram and Facebook nested exports retain text and timestamps',()=>{
  const insta=parse([{media:[{creation_timestamp:1220263200,title:'大学第一天'}]}]);
  assert.equal(insta[0].origin.platform,'Instagram');assert.equal(insta[0].date,'2008-09-01');assert.equal(insta[0].note,'大学第一天');
  const fb=parse({posts:[{timestamp:1584351000,data:[{post:'Started a new job'}],title:'Someone updated their status'}]});
  assert.equal(fb[0].origin.platform,'Facebook');assert.equal(fb[0].category,'工作');assert.equal(fb[0].note,'Started a new job');
});
test('date conversion handles UTC rollover, leap dates, seconds and milliseconds',()=>{
  assert.equal(importDate('2020-03-16T00:30:00+08:00'),'2020-03-15');
  assert.equal(importDate('2020-03-16'),'2020-03-16');
  assert.equal(importDate(1584351000),importDate(1584351000000));
  assert.equal(importDate('2000-02-29'),'2000-02-29');
  for(const invalid of ['2001-02-29','2020-02-30T12:00:00Z','03/04/2020','yesterday','2020-03-16T09:00:00','2020-03-16T25:00:00Z','Tue Feb 30 12:00:00 +0000 2020'])assert.equal(importDate(invalid),'');
});
test('CSV quoting, escaped quotes, BOM, Chinese headers and CRLF',()=>{
  const data='\uFEFF日期,正文,地点\r\n2008-09-01,"去北京,读大学\n说了""你好""",北京';
  const rows=parseSocial(data,'posts.csv');assert.equal(rows[0].note,'去北京,读大学\n说了"你好"');
  assert.equal(rows[0].date,'2008-09-01');
  assert.throws(()=>parseCSV('date,text\n2008-09-01,"unclosed'),/未闭合/);
  assert.throws(()=>parseCSV('date,text\n2008-09-01,hi,extra'),/列数/);
  assert.throws(()=>parseCSV('date,date,text\n2008-09-01,2008-09-01,hi'),/不重复/);
});
test('review flags missing text, invalid, pre-birth, future, overlong and duplicate records',()=>{
  const rows=review(parse([event,event,{text:'missing date'},{date:'1980-01-01',text:'before birth'},{date:'2999-01-01',text:'future'},{date:'2000-01-01'},{date:'2000-01-01',text:'a'.repeat(2001)}]));
  assert.equal(rows.filter(r=>r.ready).length,1);assert.equal(rows[1].duplicate,true);
  assert.ok(rows.slice(2).every(r=>r.error));
  rows[2].date='2010-01-01';assert.equal(review(rows)[2].ready,true);
});
test('append, deselection, repeated import, edit and backup round-trip retain dedup and provenance',()=>{
  const rows=parse([event,event]);rows[0].selected=false;
  const ready=review(rows);assert.equal(ready[0].ready,false);assert.equal(ready[1].ready,true);
  const imported=createImportedMemories(ready,()=> 'test-id');
  const p=JSON.parse(JSON.stringify({birth,name:'Test',memories:imported}));
  assert.equal(validateProfile(p),true);p.memories[0].note='Edited by the user';
  assert.equal(review(parse([event]),p.memories)[0].duplicate,true);
  const withId=parse([{...event,id:'stable',platform:'X'}]);
  const existing=createImportedMemories(review(withId),()=> 'id');
  assert.equal(review(parse([{...event,id:'stable',platform:'X',text:'changed upstream'}]),existing)[0].duplicate,true);
});
test('unselected duplicate does not block a later selected row',()=>{
  const rows=parse([event,event]);rows[0].selected=false;
  assert.equal(review(rows)[1].ready,true);
});
test('imported event enriches history immediately while preserving existing memory',()=>{
  const old={id:'old',date:'1995-01-01',title:'old',note:'old',place:'',category:'生活'};
  const rows=review(parse([event]),[old]);
  const memories=[old,...createImportedMemories(rows,()=> 'new')];
  assert.equal(memories[0],old);
  const olympics=ranked(birth,memories).find(h=>h.date==='2008-08-08');
  assert.ok(olympics.links.some(l=>l.memory.id==='new'&&l.reasons.some(r=>r.includes('地点'))));
});
test('malformed, unsupported, empty and excessive inputs fail without a partial import',()=>{
  for(const s of ['', '{', '{}', '[]', '{"birth":"1990-01-01","memories":[]}'])assert.throws(()=>parseSocial(s));
  assert.throws(()=>parseSocial('a'.repeat(5_000_001)),/5 MB/);
  assert.throws(()=>parse(Array.from({length:5001},()=>event)),/5,000/);
  assert.equal(review(parse([null,42,{}])).filter(r=>r.ready).length,0);
});
test('unsafe URLs are removed and markup remains inert data',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,test','http://example.com','https://user:pass@example.com'])assert.equal(safeUrl(url),'');
  const rows=parse([{...event,text:'<img src=x onerror=alert(1)>',url:'javascript:alert(1)'}]);
  assert.equal(rows[0].origin.url,'');assert.equal(rows[0].note,'<img src=x onerror=alert(1)>');
  assert.equal(safeUrl('https://example.com/post/1'),'https://example.com/post/1');
});
test('Meta byte-escaped Unicode is decoded without corrupting valid text',()=>{
  const latinBytes=Buffer.from('北京大学','utf8').toString('latin1');
  const rows=parse([{media:[{creation_timestamp:1220263200,title:latinBytes}]}]);
  assert.equal(rows[0].note,'北京大学');assert.equal(rows[0].title,'北京大学');assert.equal(rows[0].category,'升学');
  assert.equal(parse([{media:[{creation_timestamp:1220263200,title:'Café 北京'}]}])[0].note,'Café 北京');
});
