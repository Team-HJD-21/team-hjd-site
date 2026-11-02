import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {handleSubscription,CONSENT_VERSION,SITE,verifyActionsToken} from './subscriptions.mjs';
function database() {
 const raw=new DatabaseSync(':memory:');
 const db={raw,async exec(sql){raw.exec(sql);},async batch(statements){raw.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());raw.exec('COMMIT');return results;}catch(e){raw.exec('ROLLBACK');throw e;}},prepare(sql){let args=[];const s=raw.prepare(sql);return {bind(...v){args=v;return this;},async run(){return {meta:{changes:Number(s.run(...args).changes)}};},async first(){return s.get(...args)||null;},async all(){return {results:s.all(...args)};}};}};
 return db;
}
const b64=b=>Buffer.from(b).toString('base64url');
async function signedToken(overrides={}) {
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey);jwk.kid='test';
 const now=Date.parse('2026-11-03T03:00:00Z')/1000;
 const claims={iss:'https://token.actions.githubusercontent.com',aud:SITE,sub:'repo:Team-HJD-21@183283930/team-hjd-site@1403035183:ref:refs/heads/main',repository:'Team-HJD-21/team-hjd-site',repository_id:'1403035183',repository_owner_id:'183283930',ref:'refs/heads/main',workflow_ref:'Team-HJD-21/team-hjd-site/.github/workflows/publish-newsletter.yml@refs/heads/main',iat:now,nbf:now-1,exp:now+300,...overrides};
 const head=b64(JSON.stringify({alg:'RS256',kid:'test'})),body=b64(JSON.stringify(claims));
 const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,Buffer.from(`${head}.${body}`));
 return {token:`${head}.${body}.${b64(signature)}`,jwk,now};
}
function fixture({provider='ok',auth}={}) {
 const db=database(), sent=[];let time=Date.parse('2026-11-03T03:00:00Z');
 const env={DB:db,TOKEN_SECRET:'a'.repeat(48),RESEND_API_KEY:'fake-test-only'};
 const fetcher=async(url,options)=>{
  if(url.includes('/.well-known/jwks'))return Response.json({keys:[auth.jwk]});
  if(url.endsWith('/publication.json'))return Response.json({issues:[{id:'note-2026-11-03',date:'2026-11-03',title:'오늘의 글입니다',summary:'게임 개발을 알아볼까요?',url:`${SITE}/2026-11-03/today/`}]});
  assert.equal(url,'https://api.resend.com/emails');sent.push(JSON.parse(options.body));
  if(provider==='lost')throw new Error('lost response');
  return provider==='rejected' ? Response.json({error:'no'}, {status:429}) : Response.json({id:`mock-${sent.length}`});
 };
 const call=(path,body={},headers={},method='POST')=>handleSubscription(new Request(`${SITE}${path}`,{method,headers:{'Content-Type':'application/json',origin:SITE,'CF-Connecting-IP':'192.0.2.1',...headers},...(method==='GET'?{}:{body:JSON.stringify(body)})}),env,{fetcher,clock:()=>time,pause:async()=>{}});
 const consent={email:'reader@example.com',privacyConsent:true,emailConsent:true,overseasConsent:true,consentVersion:CONSENT_VERSION};
 const token=()=>sent[0].text.match(/confirm\/\?token=([\w-]+)/)[1];
 return {db,env,sent,call,consent,token,advance:seconds=>time+=seconds*1000};
}
test('subscription requires each consent, trusted origin and complete configuration',async()=>{
 const f=fixture();
 for(const field of ['privacyConsent','emailConsent','overseasConsent'])assert.equal((await f.call('/api/subscribe',{...f.consent,[field]:false})).status,400);
 assert.equal((await f.call('/api/subscribe',f.consent,{origin:'https://evil.example'})).status,403);
 f.env.RESEND_API_KEY='';assert.equal((await f.call('/api/subscribe',f.consent)).status,503);assert.equal(f.sent.length,0);
});
test('accepted confirmation is pending; GET and link scanners cannot activate it',async()=>{
 const f=fixture();assert.equal((await f.call('/api/subscribe',f.consent)).status,200);
 let row=await f.db.prepare('SELECT * FROM subscribers').first();assert.equal(row.status,'pending');assert.equal(row.email_consent,1);assert.notEqual(row.confirm_hash,f.token());
 assert.equal((await f.call(`/api/confirm?token=${f.token()}`,{}, {},'GET')).status,405);
 assert.equal((await f.db.prepare('SELECT * FROM subscribers').first()).status,'pending');
 assert.equal((await f.call('/api/confirm',{token:f.token()})).status,200);
 row=await f.db.prepare('SELECT * FROM subscribers').first();assert.equal(row.status,'active');assert.equal(row.confirm_hash,null);
 assert.equal((await f.call('/api/confirm',{token:f.token()})).status,400);
});
test('native HTML form posts are accepted with the same explicit consents',async()=>{
 const f=fixture();
 const result=await handleSubscription(new Request(`${SITE}/api/subscribe`,{method:'POST',headers:{origin:SITE,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email:'native@example.com',privacyConsent:'on',emailConsent:'on',overseasConsent:'on',consentVersion:CONSENT_VERSION})}),f.env,{fetcher:async()=>Response.json({id:'native-test'})});
 assert.equal(result.status,200);assert.equal((await f.db.prepare('SELECT status FROM subscribers').first()).status,'pending');
});
test('active and recent pending subscriptions do not receive duplicate confirmation',async()=>{
 const f=fixture();await f.call('/api/subscribe',f.consent);await f.call('/api/subscribe',f.consent);assert.equal(f.sent.length,1);
 await f.call('/api/confirm',{token:f.token()});f.advance(700);await f.call('/api/subscribe',f.consent);assert.equal(f.sent.length,1);
});
test('original signup session observes confirmation without exposing email in status requests',async()=>{
 const f=fixture();const started=await (await f.call('/api/subscribe',f.consent)).json();assert.equal(started.waiting,true);assert.match(started.watchToken,/^[\w-]{43}$/);
 assert.equal((await (await f.call('/api/subscription-status',{token:started.watchToken})).json()).state,'waiting');
 await f.call('/api/confirm',{token:f.token()});
 assert.equal((await (await f.call('/api/subscription-status',{token:started.watchToken})).json()).state,'confirmed');
 assert.equal((await (await f.call('/api/subscription-status',{token:'x'.repeat(43)})).json()).state,'expired');
 f.advance(86401);assert.equal((await (await f.call('/api/subscription-status',{token:started.watchToken})).json()).state,'expired');
});
test('management email provides a real signed unsubscribe and deletes the registered address',async()=>{
 const f=fixture();await f.call('/api/subscribe',f.consent);await f.call('/api/confirm',{token:f.token()});
 assert.equal((await f.call('/api/manage',{email:f.consent.email})).status,200);assert.equal(f.sent.length,2);
 assert.ok(f.sent[1].html.includes('gambungi-email-logo.png'));assert.ok(f.sent[1].html.includes('구독 해지하기'));
 const token=new URL(f.sent[1].text.match(/구독 해지: (.+)/)[1]).searchParams.get('token');
 await f.call('/api/unsubscribe',{token});assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM subscribers').first()).n,0);
});
test('management requests for unknown email never send mail',async()=>{const f=fixture();assert.equal((await f.call('/api/manage',{email:'unknown@example.com'})).status,200);assert.equal(f.sent.length,0);});
test('expired confirmation cannot activate and a later request replaces its token',async()=>{
 const f=fixture();await f.call('/api/subscribe',f.consent);const old=f.token();f.advance(86401);
 assert.equal((await f.call('/api/confirm',{token:old})).status,400);await f.call('/api/subscribe',f.consent);assert.equal(f.sent.length,2);
 assert.equal((await f.call('/api/confirm',{token:old})).status,400);
});
test('provider rejection or lost response never claims a sent confirmation',async()=>{
 for(const provider of ['rejected','lost']){const f=fixture({provider});assert.equal((await f.call('/api/subscribe',f.consent)).status,503);assert.equal((await f.db.prepare('SELECT status FROM subscribers').first()).status,'pending');}
});
test('rate limits are bounded and contain no original IP',async()=>{
 const f=fixture();for(let i=0;i<5;i++)await f.call('/api/subscribe',{...f.consent,email:`reader${i}@example.com`});
 assert.equal((await f.call('/api/subscribe',{...f.consent,email:'last@example.com'})).status,429);
 const rows=await f.db.prepare('SELECT bucket FROM limits').all();assert.ok(rows.results.every(r=>!r.bucket.includes('192.0.2.1')));
});
test('Actions OIDC requires a valid signature, audience, main branch and exact workflow',async()=>{
 const valid=await signedToken();const fetcher=async()=>Response.json({keys:[valid.jwk]});assert.equal(await verifyActionsToken(valid.token,fetcher,valid.now),true);
 assert.equal(await verifyActionsToken(valid.token+'x',fetcher,valid.now),false);
 for(const override of [{aud:'wrong'},{sub:'repo:other:ref:refs/heads/main'},{ref:'refs/heads/other'},{exp:valid.now-1},{workflow_ref:'other.yml'}]){const item=await signedToken(override);assert.equal(await verifyActionsToken(item.token,async()=>Response.json({keys:[item.jwk]}),item.now),false);}
});
test('only confirmed readers receive an issue; receipts prevent duplicates and unsubscribe deletes email',async()=>{
 const auth=await signedToken(),f=fixture({auth}),headers={authorization:`Bearer ${auth.token}`};
 await f.call('/api/subscribe',f.consent);
 assert.equal((await f.call('/api/internal/deliver',{issueId:'note-2026-11-03'},headers)).status,200);assert.equal(f.sent.length,1);
 await f.call('/api/confirm',{token:f.token()});
 const first=await f.call('/api/internal/deliver',{issueId:'note-2026-11-03'},headers);assert.equal(first.status,200);assert.equal((await first.json()).queued,1);
 const second=await f.call('/api/internal/deliver',{issueId:'note-2026-11-03'},headers);assert.equal(second.status,200);assert.equal(f.sent.length,2);
 const token=new URL(f.sent[1].text.match(/구독 해지: (.+)/)[1]).searchParams.get('token');
 assert.equal((await f.call('/api/unsubscribe',{token:token+'wrong'})).status,400);
 assert.equal((await f.call('/api/unsubscribe',{token})).status,200);assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM subscribers').first()).n,0);
 assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM deliveries').first()).n,2);
});
test('untrusted delivery requests and unknown or stale issues are rejected',async()=>{
 const f=fixture();assert.equal((await f.call('/api/internal/deliver',{issueId:'note-2026-11-03'})).status,401);
 const auth=await signedToken(),g=fixture({auth});assert.equal((await g.call('/api/internal/deliver',{issueId:'unknown'},{authorization:`Bearer ${auth.token}`})).status,409);
});
