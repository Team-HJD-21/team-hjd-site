import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {handleFeedback,feedbackSnapshot,FEEDBACK_COOKIE,FEEDBACK_SCHEMA} from './feedback.mjs';
import {onRequest} from '../functions/api/[[path]].js';
import {SCHEMA} from './subscriptions.mjs';
import {monitorSnapshot} from './monitor.mjs';
function fixture(){
 const raw=new DatabaseSync(':memory:');let queue=Promise.resolve(),fail=false,time=Date.parse('2026-11-05T14:59:30Z');
 const db={raw,async exec(sql){raw.exec(sql);},prepare(sql){let args=[];return {bind(...values){args=values;return this;},async run(){if(fail&&sql.includes('creation_key=?')){fail=false;throw new Error('Injected second statement failure');}return {meta:{changes:Number(raw.prepare(sql).run(...args).changes)}};},async first(){return raw.prepare(sql).get(...args)||null;},async all(){return {results:raw.prepare(sql).all(...args)};}};},batch(statements){const task=queue.then(async()=>{raw.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());raw.exec('COMMIT');return results;}catch(error){raw.exec('ROLLBACK');throw error;}});queue=task.catch(()=>{});return task;}};
 const issues=[{id:'note-one',title:'첫 번째 노트',url:'https://tech.teamhjd.com/2026-11-05/one/'},{id:'note-two',title:'두 번째 노트',url:'https://tech.teamhjd.com/2026-11-04/two/'}];
 const env={DB:db,TOKEN_SECRET:'test-only-secret-'.repeat(3),ASSETS:{async fetch(url){assert.equal(new URL(url).pathname,'/publication.json');return Response.json({version:1,issues});}}};
 const request=({method='POST',issue='note-one',choice='useful',cookie,ip='192.0.2.1',origin='https://tech.teamhjd.com',headers={},body}={})=>new Request('https://tech.teamhjd.com/api/feedback'+(method==='GET'?'?issueId='+issue:''),{method,headers:{'Content-Type':'application/json',Origin:origin,...(ip?{'CF-Connecting-IP':ip}:{}),...(cookie?{Cookie:cookie}:{}),...headers},...(method==='GET'?{}:{body:body??JSON.stringify({issueId:issue,choice})})});
 const call=args=>handleFeedback(request(args),env,{clock:()=>time});
 const mint=async(ip='192.0.2.1')=>{const r=await call({ip});assert.equal(r.status,202);return r.headers.get('set-cookie').split(';')[0];};
 return {raw,db,env,request,call,mint,advance:s=>time+=s*1000,now:()=>Math.floor(time/1000),failNextBatch:()=>{fail=true;}};
}
test('reading sets no identity cookie; functions route works without a mail key',async()=>{
 const f=fixture(),r=await onRequest({request:f.request({method:'GET'}),env:f.env});assert.equal(r.status,200);assert.deepEqual(await r.json(),{choice:null});assert.equal(r.headers.get('set-cookie'),null);assert.equal(f.raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='article_feedback'").get().n,0);assert.match(r.headers.get('cache-control'),/no-store/);
});
test('first action requires a signed secure cookie before counting a reaction',async()=>{
 const f=fixture(),r=await f.call();assert.equal(r.status,202);assert.deepEqual(await r.json(),{needsCookie:true});assert.match(r.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Strict/);assert.ok(r.headers.get('set-cookie').startsWith(FEEDBACK_COOKIE+'='));assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM article_feedback').get().n,0);
});
test('repeats and changed selections update one row; cancellation removes it',async()=>{
 const f=fixture(),cookie=await f.mint();
 for(let i=0;i<3;i++)assert.equal((await f.call({cookie})).status,200);
 assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM article_feedback').get().n,1);
 f.advance(1);assert.equal((await f.call({cookie,choice:'hard'})).status,200);
 assert.deepEqual(await (await f.call({cookie,method:'GET'})).json(),{choice:'hard'});
 const summary=await feedbackSnapshot(f.db,{now:f.now(),assets:f.env.ASSETS});assert.equal(summary.total,1);assert.equal(summary.issues[0].counts.hard,1);assert.equal(summary.issues[0].counts.useful,0);assert.equal(summary.issues[0].title,'첫 번째 노트');
 assert.equal((await f.call({cookie,method:'DELETE'})).status,200);assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM article_feedback').get().n,0);assert.deepEqual(await (await f.call({cookie,method:'GET'})).json(),{choice:null});
});
test('one browser can respond to different articles without merging their choices',async()=>{
 const f=fixture(),cookie=await f.mint();await f.call({cookie});await f.call({cookie,issue:'note-two',choice:'curious'});assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM article_feedback').get().n,2);
});
test('shared IP admits five browsers; the sixth is blocked but existing votes can change',async()=>{
 const f=fixture();let first;
 for(let i=0;i<5;i++){const cookie=await f.mint();first||=cookie;assert.equal((await f.call({cookie,headers:{'X-Forwarded-For':'198.51.100.'+i}})).status,200);}
 const rejected=await f.call({cookie:await f.mint()});assert.equal(rejected.status,429);assert.ok(Number(rejected.headers.get('retry-after'))>0);
 assert.equal((await f.call({cookie:first,choice:'easy'})).status,200);assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM article_feedback').get().n,5);
 f.advance(31);assert.equal((await f.call({cookie:await f.mint()})).status,200,'KST midnight resets new-browser admissions');
});
test('concurrent new browsers cannot exceed the atomic per-IP admission budget',async()=>{
 const f=fixture(),cookies=[];for(let i=0;i<10;i++)cookies.push(await f.mint());
 const replies=await Promise.all(cookies.map(cookie=>f.call({cookie})));
 assert.equal(replies.filter(r=>r.status===200).length,5);assert.equal(replies.filter(r=>r.status===429).length,5);assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM article_feedback').get().n,5);
});
test('hourly write throttling is independent of vote changes and stores no raw IP',async()=>{
 const f=fixture(),cookie=await f.mint();for(let i=0;i<59;i++)assert.equal((await f.call({cookie})).status,200);
 assert.equal((await f.call({cookie})).status,429);assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM article_feedback').get().n,1);
 const stored=JSON.stringify({votes:f.raw.prepare('SELECT * FROM article_feedback').all(),limits:f.raw.prepare('SELECT * FROM feedback_limits').all()});assert.ok(!stored.includes('192.0.2.1'));assert.ok(!stored.includes(cookie.split('=')[1]));
 const report=JSON.stringify(await feedbackSnapshot(f.db,{now:f.now()}));assert.ok(!report.includes('voter_hash'));assert.ok(!report.includes('creation_key'));assert.ok(!report.includes('bucket'));
});
test('draft IDs, malformed choices, CSRF, missing IP and oversized bodies fail closed',async()=>{
 const f=fixture();
 for(const args of [{issue:'draft'},{choice:'<script>'},{origin:'https://evil.example'},{headers:{'Sec-Fetch-Site':'cross-site'}},{body:'{broken'},{body:' '.repeat(1100)},{headers:{'Content-Type':'text/plain'}}])assert.ok((await f.call(args)).status>=400);
 assert.equal((await f.call({ip:null})).status,503);assert.equal((await f.call({method:'PUT'})).status,405);
});
test('tampered cookies cannot choose a voter identity and cookie-blocked clients count nothing',async()=>{
 const f=fixture(),cookie=await f.mint(),[name,value]=cookie.split('='),[token,signature]=value.split('.');
 // The final base64url character has unused bits; changing it can preserve bytes.
 const changed=(signature[0]==='A'?'B':'A')+signature.slice(1),bad=`${name}=${token}.${changed}`;
 assert.notDeepEqual(Buffer.from(changed,'base64url'),Buffer.from(signature,'base64url'));
 assert.equal((await f.call({cookie:bad})).status,202);assert.equal((await f.call()).status,202);assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM article_feedback').get().n,0);
});
test('equivalent base64url signature encodings keep the same voter and one reaction',async()=>{
 const f=fixture(),cookie=await f.mint(),[name,value]=cookie.split('='),[token,signature]=value.split('.');
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
 const alias=signature.slice(0,-1)+alphabet[alphabet.indexOf(signature.at(-1))^1];
 assert.notEqual(alias,signature);assert.deepEqual(Buffer.from(alias,'base64url'),Buffer.from(signature,'base64url'));
 await f.call({cookie});assert.equal((await f.call({cookie:`${name}=${token}.${alias}`,choice:'curious'})).status,200);
 assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM article_feedback').get().n,1);
 assert.equal((await feedbackSnapshot(f.db,{now:f.now()})).issues[0].counts.curious,1);
});
test('failed atomic admission rolls back the vote and an idempotent retry succeeds',async()=>{
 const f=fixture(),cookie=await f.mint();f.failNextBatch();assert.equal((await f.call({cookie})).status,503);assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM article_feedback').get().n,0);assert.equal((await f.call({cookie})).status,200);assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM article_feedback').get().n,1);
});
test('old feedback is excluded from summaries and removed on the next write',async()=>{
 const f=fixture(),cookie=await f.mint();await f.call({cookie});f.advance(366*86400);assert.deepEqual(await (await f.call({cookie,method:'GET'})).json(),{choice:null});assert.equal((await feedbackSnapshot(f.db,{now:f.now()})).total,0);await f.call({cookie,issue:'note-two'});assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM article_feedback').get().n,1);
});
test('schema is additive and summary never returns per-reader identifiers',async()=>{
 const f=fixture();f.raw.exec(FEEDBACK_SCHEMA);f.raw.exec(FEEDBACK_SCHEMA);assert.equal((await feedbackSnapshot(f.db,{now:f.now()})).total,0);
});
test('the private monitor includes aggregate feedback and no voter or IP fields',async()=>{
 const f=fixture();f.raw.exec(SCHEMA);const cookie=await f.mint();await f.call({cookie,choice:'curious'});
 const report=await monitorSnapshot(f.db,{date:'2026-11-05',now:f.now(),assets:f.env.ASSETS});
 assert.equal(report.feedback.total,1);assert.equal(report.feedback.issues[0].counts.curious,1);assert.equal(report.feedback.issues[0].title,'첫 번째 노트');
 const text=JSON.stringify(report);for(const forbidden of ['voter_hash','creation_key','192.0.2.1',cookie.split('=')[1]])assert.ok(!text.includes(forbidden));
});
