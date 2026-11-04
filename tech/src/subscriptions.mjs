import {emailTemplate} from './email-template.mjs';
import {monitorSnapshot,encryptMonitorReport,redactMailTokens} from './monitor.mjs';
// Cloudflare Pages + private D1. No subscriber data belongs in the static build.
export const CONSENT_VERSION = '2026-11-03';
export const SITE = 'https://tech.teamhjd.com';
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS subscribers (
 id TEXT PRIMARY KEY, email_hash TEXT NOT NULL UNIQUE, email TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','active')),
 consent_version TEXT NOT NULL, consent_at INTEGER NOT NULL,
 privacy_consent INTEGER NOT NULL, email_consent INTEGER NOT NULL, overseas_consent INTEGER NOT NULL,
 confirm_hash TEXT UNIQUE, confirm_expires INTEGER, last_request INTEGER NOT NULL,
 confirmed_at INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS deliveries (
 receipt TEXT PRIMARY KEY, subscriber_id TEXT NOT NULL, purpose TEXT NOT NULL,
 state TEXT NOT NULL, provider_id TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS delivery_time ON deliveries(created_at);
CREATE TABLE IF NOT EXISTS subscription_sessions(token_hash TEXT PRIMARY KEY, subscriber_id TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS mail_messages(receipt TEXT PRIMARY KEY,subject TEXT NOT NULL,html TEXT NOT NULL,text TEXT NOT NULL,created_at INTEGER NOT NULL);
`;
const encoder = new TextEncoder();
const initialized = new WeakMap();
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/, '');
const unb64 = s => Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')), c => c.charCodeAt(0));
const random = () => b64(crypto.getRandomValues(new Uint8Array(32)));
async function digest(s) { return b64(await crypto.subtle.digest('SHA-256', encoder.encode(s))); }
async function sign(secret, s) {
 const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
 return b64(await crypto.subtle.sign('HMAC', key, encoder.encode(s)));
}
async function validSignature(secret, s, signature) {
 try {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['verify']);
  return await crypto.subtle.verify('HMAC', key, unb64(signature), encoder.encode(s));
 } catch { return false; }
}
async function init(db, now) {
 if (!initialized.has(db)) initialized.set(db, db.exec(SCHEMA.split(';').map(sql=>sql.trim().replace(/\s+/g,' ')).filter(Boolean).map(sql=>sql+';').join('\n')).catch(e => { initialized.delete(db); throw e; }));
 await initialized.get(db);
 await db.batch([
  db.prepare("DELETE FROM subscribers WHERE status='pending' AND created_at < ?").bind(now - 7*86400),
  db.prepare('DELETE FROM deliveries WHERE created_at < ?').bind(now - 30*86400),
  db.prepare('DELETE FROM limits WHERE expires < ?').bind(now)
  ,db.prepare('DELETE FROM subscription_sessions WHERE expires < ?').bind(now)
  ,db.prepare('DELETE FROM mail_messages WHERE created_at < ?').bind(now-30*86400)
 ]);
}
async function limited(db, bucket, maximum, expires) {
 const result = await db.prepare('INSERT INTO limits(bucket,count,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count < ?').bind(bucket, expires, maximum).run();
 return result.meta.changes === 1;
}
async function waitingSession(db, subscriberId, now) {
 const token=random();
 await db.prepare('INSERT INTO subscription_sessions(token_hash,subscriber_id,expires) VALUES(?,?,?)').bind(await digest(token),subscriberId,now+86400).run();
 return json({message:'인증 메일을 보냈습니다. 메일에서 확인 버튼을 눌러 주세요. 이 창에서 완료 상태를 확인하실 수 있습니다.',waiting:true,watchToken:token,expiresAt:(now+86400)*1000});
}
async function readJson(request) {
 const contentType=request.headers.get('content-type') || '';
 if (!contentType.startsWith('application/json') && !contentType.startsWith('application/x-www-form-urlencoded')) throw new Error('invalid_body');
 const reader = request.body?.getReader();
 if (!reader) throw new Error('invalid_body');
 let size = 0, chunks = [];
 for (;;) {
  const {value,done} = await reader.read(); if (done) break;
  size += value.length; if (size > 4096) { await reader.cancel(); throw new Error('invalid_body'); }
  chunks.push(value);
 }
 const bytes = new Uint8Array(size); let offset=0; for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 const text=new TextDecoder().decode(bytes);
 if(contentType.startsWith('application/x-www-form-urlencoded')) {
  const fields=new URLSearchParams(text);
  return {email:fields.get('email'),website:fields.get('website'),consentVersion:fields.get('consentVersion'),privacyConsent:fields.get('privacyConsent')==='on',emailConsent:fields.get('emailConsent')==='on',overseasConsent:fields.get('overseasConsent')==='on',token:fields.get('token')};
 }
 return JSON.parse(text);
}
function sameOrigin(request) {
 const origin = request.headers.get('origin');
 return origin === SITE || origin === 'https://gambungi-notes.pages.dev';
}
function normalizeEmail(value) {
 if (typeof value !== 'string') return null;
 const email = value.trim().toLowerCase();
 return email.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(email) && !email.includes('..') ? email : null;
}
async function send(env, fetcher, db, {receipt, subscriber, purpose, now, subject, text, url, unsubscribe}) {
 // An uncertain provider response is never retried automatically with a new receipt.
 const reserved = await db.prepare('INSERT OR IGNORE INTO deliveries(receipt,subscriber_id,purpose,state,created_at) VALUES(?,?,?,\'pending\',?)').bind(receipt,subscriber.id,purpose,now).run();
 if (!reserved.meta.changes) return 'duplicate';
 const day = new Date(now*1000).toISOString().slice(0,10);
 if (!await limited(db, `mail:${day}`, 90, now+2*86400)) {
  await db.prepare("UPDATE deliveries SET state='quota' WHERE receipt=?").bind(receipt).run(); return 'quota';
 }
 const current = await db.prepare('SELECT status FROM subscribers WHERE id=?').bind(subscriber.id).first();
 if (!current || (purpose === 'issue' && current.status !== 'active')) {
  await db.prepare("UPDATE deliveries SET state='cancelled' WHERE receipt=?").bind(receipt).run(); return 'cancelled';
 }
 const payload = {from: '겜붕이의 노트 <notes@news.teamhjd.com>', reply_to:'support@teamhjd.com', to: [subscriber.email], subject, text: `${text}\n\n${url}${unsubscribe ? `\n\n구독 해지: ${unsubscribe}` : ''}\n\n구독 관리·해지: ${SITE}/subscription/manage/\nby TeamHJD`, html:emailTemplate({purpose,subject,text,url,unsubscribe})};
 if (unsubscribe && purpose==='issue') payload.headers = {'List-Unsubscribe': `<${unsubscribe.replace('/subscription/unsubscribe/', '/api/unsubscribe')}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'};
 await db.prepare('INSERT OR IGNORE INTO mail_messages(receipt,subject,html,text,created_at) VALUES(?,?,?,?,?)').bind(receipt,subject,redactMailTokens(payload.html),redactMailTokens(payload.text),now).run();
 try {
  const response = await fetcher('https://api.resend.com/emails', {method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':receipt},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
  if (!response.ok) {
   await db.prepare("UPDATE deliveries SET state='rejected' WHERE receipt=?").bind(receipt).run(); return 'rejected';
  }
  const result = await response.json();
  if (typeof result.id !== 'string') throw new Error('missing_id');
  await db.prepare("UPDATE deliveries SET state='queued',provider_id=? WHERE receipt=?").bind(result.id,receipt).run(); return 'queued';
 } catch {
  await db.prepare("UPDATE deliveries SET state='uncertain' WHERE receipt=?").bind(receipt).run(); return 'uncertain';
 }
}
export async function verifyActionsToken(token, fetcher = fetch, now = Date.now()/1000, workflow = 'publish-newsletter.yml') {
 try {
  const parts = token.split('.'); if(parts.length!==3 || token.length>20000) return false;
  const header = JSON.parse(new TextDecoder().decode(unb64(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(unb64(parts[1])));
  if(!['publish-newsletter.yml','monitor-newsletter.yml'].includes(workflow)||workflow==='monitor-newsletter.yml'&&claims.event_name!=='workflow_dispatch')return false;
  if(header.alg!=='RS256' || claims.iss!=='https://token.actions.githubusercontent.com' || claims.aud!==SITE || claims.sub!=='repo:Team-HJD-21@183283930/team-hjd-site@1403035183:ref:refs/heads/main' || claims.repository!=='Team-HJD-21/team-hjd-site' || claims.repository_id!=='1403035183' || claims.repository_owner_id!=='183283930' || claims.workflow_ref!==`Team-HJD-21/team-hjd-site/.github/workflows/${workflow}@refs/heads/main` || claims.ref!=='refs/heads/main' || !Number.isFinite(claims.exp) || claims.exp<=now || !Number.isFinite(claims.nbf) || claims.nbf>now+30 || !Number.isFinite(claims.iat) || claims.iat>now+30 || claims.iat<now-900 || claims.exp-claims.iat>900) return false;
  const response = await fetcher('https://token.actions.githubusercontent.com/.well-known/jwks', {signal:AbortSignal.timeout(10000)});
  if(!response.ok) return false;
  const {keys} = await response.json();
  const jwk = keys.find(k=>k.kid===header.kid && k.kty==='RSA'); if(!jwk) return false;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,unb64(parts[2]),encoder.encode(`${parts[0]}.${parts[1]}`));
 } catch {return false;}
}
export async function handleSubscription(request, env, {fetcher=fetch, clock=()=>Date.now(), pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))} = {}) {
 const now = Math.floor(clock()/1000), path = new URL(request.url).pathname;
 if(path==='/api/status' && request.method==='GET') return json({configured:Boolean(env.DB && env.RESEND_API_KEY && env.TOKEN_SECRET?.length>=32)});
 if(!env.DB || !env.RESEND_API_KEY || typeof env.TOKEN_SECRET!=='string' || env.TOKEN_SECRET.length<32) return json({error:'integration_not_configured',message:'구독 연결을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.'},503);
 if(request.method!=='POST') return json({error:'method_not_allowed'},405);
 const internal = path==='/api/internal/deliver' || path==='/api/internal/check' || path==='/api/internal/monitor';
 const oneClick = path==='/api/unsubscribe' && new URL(request.url).searchParams.has('token');
 if(!internal && !oneClick && !sameOrigin(request)) return json({error:'invalid_origin'},403);
 if(internal && !await verifyActionsToken((request.headers.get('authorization') || '').replace(/^Bearer /,''),fetcher,now,path==='/api/internal/monitor'?'monitor-newsletter.yml':'publish-newsletter.yml')) return json({error:'unauthorized'},401);
 let data;
 try {data=oneClick ? {token:new URL(request.url).searchParams.get('token')} : await readJson(request);} catch {return json({error:'invalid_body'},400);}
 const db=env.DB;
 try {
  await init(db,now);
  if(path==='/api/internal/monitor'){
   try{return json(await encryptMonitorReport(await monitorSnapshot(db,{date:data.date,now}),data.publicKey,data.requestId));}
   catch{return json({error:'invalid_monitor_request'},400);}
  }
  if(path==='/api/internal/check') return json({authenticated:true,databaseReady:true,mailConfigured:true});
  if(path==='/api/subscription-status') {
   if(typeof data.token!=='string' || !/^[\w-]{43}$/.test(data.token)) return json({error:'invalid_token'},400);
   const session=await db.prepare('SELECT s.expires,u.status FROM subscription_sessions s LEFT JOIN subscribers u ON u.id=s.subscriber_id WHERE s.token_hash=?').bind(await digest(data.token)).first();
   return json({state:!session || session.expires<now || !session.status ? 'expired' : session.status==='active' ? 'confirmed' : 'waiting'});
  }
  if(path==='/api/manage') {
   const email=normalizeEmail(data.email);
   if(!email)return json({error:'invalid_email',message:'이메일 주소를 확인해 주세요.'},400);
   const bucket=await sign(env.TOKEN_SECRET,`rate:${request.headers.get('CF-Connecting-IP') || 'unknown'}:${Math.floor(now/3600)}`);
   if(!await limited(db,bucket,5,now+86400))return json({error:'rate_limited',message:'요청이 많습니다. 한 시간 후 다시 시도해 주세요.'},429);
   const subscriber=await db.prepare('SELECT id,email FROM subscribers WHERE email_hash=?').bind(await sign(env.TOKEN_SECRET,`email:${email}`)).first();
   const message='등록된 주소라면 구독 관리·해지 링크를 보내드립니다. 메일에서 해지 버튼을 눌러 주세요.';
   if(!subscriber)return json({message});
   const unsubscribe=`${SITE}/subscription/unsubscribe/?token=${subscriber.id}.${await sign(env.TOKEN_SECRET,`unsubscribe:${subscriber.id}`)}`;
   const receipt=`manage:${subscriber.id}:${Math.floor(now/600)}`;
   const state=await send(env,fetcher,db,{receipt,subscriber,purpose:'manage',now,subject:'겜붕이의 노트 구독 관리·해지 안내',text:'구독을 해지하시려면 아래 버튼을 눌러 주세요. 해지 페이지에서 한 번 더 확인하시면 이메일 주소가 삭제됩니다.',url:unsubscribe,unsubscribe});
   const accepted=state==='queued' || state==='duplicate' && (await db.prepare('SELECT state FROM deliveries WHERE receipt=?').bind(receipt).first())?.state==='queued';
   return accepted ? json({message}) : json({error:'mail_unavailable',message:'관리 메일 발송을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'},503);
  }
  if(path==='/api/subscribe') {
   if(data.website) return json({message:'요청을 확인했습니다.'});
   const email=normalizeEmail(data.email);
   if(!email || data.privacyConsent!==true || data.emailConsent!==true || data.overseasConsent!==true || data.consentVersion!==CONSENT_VERSION) return json({error:'consent_required',message:'이메일 주소와 필수 동의 항목을 확인해 주세요.'},400);
   const bucket=await sign(env.TOKEN_SECRET,`rate:${request.headers.get('CF-Connecting-IP') || 'unknown'}:${Math.floor(now/3600)}`);
   if(!await limited(db,bucket,5,now+86400)) return json({error:'rate_limited',message:'요청이 많습니다. 한 시간 뒤 다시 시도해 주세요.'},429);
   const hash=await sign(env.TOKEN_SECRET,`email:${email}`);
   let subscriber=await db.prepare('SELECT * FROM subscribers WHERE email_hash=?').bind(hash).first();
   const generic='구독 요청을 확인했습니다. 이미 구독 중인 주소에는 인증 메일을 다시 보내지 않습니다.';
   if(subscriber?.status==='active') return json({message:generic,waiting:false});
   if(subscriber && now-subscriber.last_request<600) {
    const previous=await db.prepare("SELECT state FROM deliveries WHERE subscriber_id=? AND purpose='confirm' ORDER BY created_at DESC LIMIT 1").bind(subscriber.id).first();
    return previous?.state==='queued' ? waitingSession(db,subscriber.id,now) : json({error:'mail_unavailable',message:'이전 발송을 확인하지 못했습니다. 10분 후 다시 신청해 주세요.'},503);
   }
   const token=random(), tokenHash=await digest(token);
   if(subscriber) {
    const updated=await db.prepare("UPDATE subscribers SET confirm_hash=?,confirm_expires=?,last_request=?,consent_at=?,consent_version=?,privacy_consent=1,email_consent=1,overseas_consent=1 WHERE id=? AND status='pending' AND last_request<=?").bind(tokenHash,now+86400,now,now,CONSENT_VERSION,subscriber.id,now-600).run();
    if(!updated.meta.changes) return json({message:generic});
   } else {
    subscriber={id:crypto.randomUUID(),email};
    const inserted=await db.prepare("INSERT OR IGNORE INTO subscribers(id,email_hash,email,status,consent_version,consent_at,privacy_consent,email_consent,overseas_consent,confirm_hash,confirm_expires,last_request,created_at) VALUES(?,?,?,'pending',?,?,1,1,1,?,?,?,?)").bind(subscriber.id,hash,email,CONSENT_VERSION,now,tokenHash,now+86400,now,now).run();
    if(!inserted.meta.changes) return json({message:generic});
   }
   const unsubscribe=`${SITE}/subscription/unsubscribe/?token=${subscriber.id}.${await sign(env.TOKEN_SECRET,`unsubscribe:${subscriber.id}`)}`;
   const state=await send(env,fetcher,db,{receipt:`confirm:${subscriber.id}:${tokenHash}`,subscriber,purpose:'confirm',now,subject:'겜붕이의 노트 구독을 확인해 주세요',text:'반갑습니다! 아래 버튼을 눌러 이메일을 확인해 주세요. 확인이 끝나면 원래 신청 창에 완료 상태가 자동 반영됩니다. 링크는 24시간 동안 유효합니다.',url:`${SITE}/subscription/confirm/?token=${token}`,unsubscribe});
   if(state!=='queued') return json({error:'mail_unavailable',message:'인증 메일 발송을 확인하지 못했습니다. 10분 후 다시 시도해 주세요.'},503);
   return waitingSession(db,subscriber.id,now);
  }
  if(path==='/api/confirm') {
   if(typeof data.token!=='string' || !/^[\w-]{43}$/.test(data.token)) return json({error:'invalid_token'},400);
   const result=await db.prepare("UPDATE subscribers SET status='active',confirmed_at=?,confirm_hash=NULL,confirm_expires=NULL WHERE status='pending' AND confirm_hash=? AND confirm_expires>=?").bind(now,await digest(data.token),now).run();
   return result.meta.changes ? json({message:'구독이 완료됐습니다. 매일 새로운 게임 개발 이야기로 찾아뵙겠습니다.'}) : json({error:'expired_token',message:'이미 사용했거나 만료된 링크입니다. 구독 중이 아니라면 첫 화면에서 다시 신청해 주세요.'},400);
  }
  if(path==='/api/unsubscribe') {
   if(typeof data.token!=='string' || data.token.length>150) return json({error:'invalid_token'},400);
   const [id,signature]=data.token.split('.');
   if(!await validSignature(env.TOKEN_SECRET,`unsubscribe:${id}`,signature || '')) return json({error:'invalid_token'},400);
   await db.prepare('DELETE FROM subscribers WHERE id=?').bind(id).run();
   return json({message:'구독이 해지됐으며 이메일 주소를 삭제했습니다. 언제든 다시 찾아와 주세요.'});
  }
  if(internal) {
   if(typeof data.issueId!=='string' || !/^[a-z0-9-]{1,80}$/.test(data.issueId)) return json({error:'invalid_issue'},400);
   const response=await fetcher(`${SITE}/publication.json`,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(10000)});
   if(!response.ok) return json({error:'publication_unavailable'},503);
   const manifest=await response.json();
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now*1000));
   const issue=manifest.issues?.find(i=>i.id===data.issueId && i.date===today);
   if(data.contentVersion!==undefined&&(!/^[a-f0-9]{64}$/.test(data.contentVersion)||issue?.contentVersion!==data.contentVersion))return json({error:'publication_version_mismatch'},409);
   if(!issue || typeof issue.title!=='string' || typeof issue.summary!=='string' || typeof issue.url!=='string' || !issue.url.startsWith(`${SITE}/${today}/`) || !/^\/[0-9]{4}-[0-9]{2}-[0-9]{2}\/[a-z0-9-]+\/$/.test(new URL(issue.url).pathname) || new URL(issue.url).origin!==SITE) return json({error:'issue_not_live'},409);
   const releaseClock=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now*1000)).map(({type,value})=>[type,value]));
   if(Number(releaseClock.hour)*60+Number(releaseClock.minute)<11*60+57) return json({error:'before_release_time'},409);
   const {results}=await db.prepare("SELECT id,email FROM subscribers WHERE status='active' AND confirmed_at IS NOT NULL AND privacy_consent=1 AND email_consent=1 AND overseas_consent=1 AND NOT EXISTS(SELECT 1 FROM deliveries WHERE receipt=? || subscribers.id) ORDER BY created_at LIMIT 6").bind(`issue:${issue.id}:`).all();
   const counts={queued:0,duplicate:0,quota:0,rejected:0,uncertain:0,cancelled:0};
   // Bounded batches respect Workers' subrequest limit and Resend's sending rate.
   for(const subscriber of results) {
    const unsubscribe=`${SITE}/subscription/unsubscribe/?token=${subscriber.id}.${await sign(env.TOKEN_SECRET,`unsubscribe:${subscriber.id}`)}`;
    const state=await send(env,fetcher,db,{receipt:`issue:${issue.id}:${subscriber.id}`,subscriber,purpose:'issue',now,subject:issue.title.slice(0,180),text:issue.summary.slice(0,4000),url:issue.url,unsubscribe}); counts[state]++;
    if(state==='queued') await pause(1000);
   }
   const pending=await db.prepare("SELECT COUNT(*) AS count FROM subscribers WHERE status='active' AND NOT EXISTS(SELECT 1 FROM deliveries WHERE receipt=? || subscribers.id)").bind(`issue:${issue.id}:`).first();
   const failures=await db.prepare("SELECT COUNT(*) AS count FROM deliveries WHERE purpose='issue' AND receipt LIKE ? AND state IN ('quota','rejected','uncertain','pending')").bind(`issue:${issue.id}:%`).first();
   return json({issueId:issue.id,...counts,remaining:pending.count,unresolved:failures.count},failures.count ? 503 : 200);
  }
  return json({error:'not_found'},404);
 } catch {return json({error:'service_unavailable',message:'잠시 후 다시 시도해 주세요.'},503);}
}
