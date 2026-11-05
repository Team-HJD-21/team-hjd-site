import {feedbackSnapshot} from './feedback.mjs';
const encoder=new TextEncoder();
const b64=b=>{const bytes=new Uint8Array(b);let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(text).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');};
export function maskEmail(email){if(!email)return '해지·삭제된 주소';const [name,domain]=email.split('@');return `${name.slice(0,1)}${'*'.repeat(Math.min(Math.max(name.length-1,3),8))}@${domain}`;}
export function redactMailTokens(value=''){return value.replace(/([?&](?:amp;)?token=)[^"'<>\s]+/gi,'$1[removed]');}
export function reportingWindow(date,now){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date).toISOString().slice(0,10)!==date)throw new Error('Invalid report date');
 const start=Date.parse(`${date}T00:00:00+09:00`)/1000;
 if(start>now||start<now-31*86400)throw new Error('Report date outside retained history');
 return {start,end:start+86400};
}
export async function monitorSnapshot(db,{date,now=Math.floor(Date.now()/1000),assets}){
 const {start,end}=reportingWindow(date,now);
 const utcDay=new Date(now*1000).toISOString().slice(0,10),quotaStart=Date.parse(`${utcDay}T00:00:00Z`)/1000;
 const [subscribers,quota,grouped,rows,trend]=await Promise.all([
  db.prepare("SELECT COUNT(*) AS total,COALESCE(SUM(status='active'),0) AS active,COALESCE(SUM(status='pending'),0) AS pending FROM subscribers").first(),
  db.prepare('SELECT count FROM limits WHERE bucket=?').bind(`mail:${utcDay}`).first(),
  db.prepare('SELECT purpose,state,COUNT(*) AS count FROM deliveries WHERE created_at>=? AND created_at<? GROUP BY purpose,state').bind(start,end).all(),
  db.prepare('SELECT d.receipt,d.purpose,d.state,d.provider_id,d.created_at,s.email,m.subject,m.html,m.text FROM deliveries d LEFT JOIN subscribers s ON s.id=d.subscriber_id LEFT JOIN mail_messages m ON m.receipt=d.receipt WHERE d.created_at>=? AND d.created_at<? ORDER BY d.created_at DESC LIMIT 500').bind(start,end).all(),
  db.prepare("SELECT date(created_at,'unixepoch','+9 hours') AS date,state,COUNT(*) AS count FROM deliveries WHERE created_at>=? GROUP BY date,state ORDER BY date").bind(now-30*86400).all()
 ]);
 const [acceptedQuota,audience]=await Promise.all([
  db.prepare("SELECT COUNT(*) AS count FROM deliveries WHERE state='queued' AND created_at>=? AND created_at<?").bind(quotaStart,quotaStart+86400).first(),
  audienceSnapshot(db,{now,date})
 ]);
 return {version:1,generatedAt:new Date(now*1000).toISOString(),date,window:{start:new Date(start*1000).toISOString(),end:new Date(end*1000).toISOString()},subscribers,
  quota:{scope:'이 서비스의 기록 · Resend 계정 전체 실측과 다릅니다',providerDailyLimit:100,appDailyLimit:90,appUsed:quota?.count||0,appRemaining:Math.max(0,90-(quota?.count||0)),accepted:acceptedQuota.count,startsAt:new Date(quotaStart*1000).toISOString(),resetsAt:new Date((quotaStart+86400)*1000).toISOString()},
  feedback:await feedbackSnapshot(db,{now,assets}),audience,summary:grouped.results,trend:trend.results,deliveries:rows.results.map(row=>({id:row.receipt,purpose:row.purpose,state:row.state,providerId:row.provider_id,createdAt:new Date(row.created_at*1000).toISOString(),recipient:maskEmail(row.email),subject:row.subject||null,html:row.html||null,text:row.text||null,issueId:row.purpose==='issue'?row.receipt.split(':')[1]:null}))};
}
const iso=seconds=>seconds==null?null:new Date(seconds*1000).toISOString();
// This object is only returned inside the encrypted, owner-authenticated report.
export async function audienceSnapshot(db,{now,date}){
 const today=new Date((now+9*3600)*1000).toISOString().slice(0,10),todayStart=Date.parse(`${today}T00:00:00+09:00`)/1000,since=todayStart-29*86400;
 const [people,joined,confirmed,domains,timing,deliveryTotals,recent]=await Promise.all([
  db.prepare('SELECT id,email,status,created_at,confirmed_at,last_request,confirm_expires,consent_at,consent_version,privacy_consent,email_consent,overseas_consent FROM subscribers ORDER BY created_at DESC,id LIMIT 5000').all(),
  db.prepare("SELECT date(created_at,'unixepoch','+9 hours') AS date,COUNT(*) AS count FROM subscribers WHERE created_at>=? AND created_at<=? GROUP BY date ORDER BY date").bind(since,now).all(),
  db.prepare("SELECT date(confirmed_at,'unixepoch','+9 hours') AS date,COUNT(*) AS count FROM subscribers WHERE status='active' AND confirmed_at>=? AND confirmed_at<=? GROUP BY date ORDER BY date").bind(since,now).all(),
  db.prepare("SELECT lower(substr(email,instr(email,'@')+1)) AS domain,COUNT(*) AS total,SUM(status='active') AS active,SUM(status='pending') AS pending FROM subscribers GROUP BY domain ORDER BY total DESC,domain LIMIT 8").all(),
  db.prepare("SELECT COUNT(*) AS total,COALESCE(SUM(status='active'),0) AS active,COALESCE(SUM(status='pending' AND created_at<=?),0) AS waitingOver24h,COALESCE(SUM(status='pending' AND (confirm_expires IS NULL OR confirm_expires<?)),0) AS expiredLinks,AVG(CASE WHEN status='active' AND confirmed_at>=created_at AND confirmed_at<=? THEN confirmed_at-created_at END) AS averageConfirmationSeconds,COUNT(CASE WHEN status='active' AND confirmed_at>=created_at AND confirmed_at<=? THEN 1 END) AS confirmationSample FROM subscribers").bind(now-86400,now,now,now).first(),
  db.prepare("SELECT subscriber_id,COUNT(*) AS attempts,SUM(state='queued') AS accepted,SUM(purpose='issue' AND state='queued') AS issuesAccepted FROM deliveries WHERE created_at>=? AND created_at<=? GROUP BY subscriber_id").bind(now-30*86400,now).all(),
  db.prepare('SELECT subscriber_id,purpose,state,created_at FROM deliveries WHERE created_at>=? AND created_at<=? ORDER BY created_at DESC,receipt DESC LIMIT 5000').bind(now-30*86400,now).all()
 ]);
 const totals=new Map(deliveryTotals.results.map(row=>[row.subscriber_id,row])),history=new Map();
 for(const row of recent.results){const list=history.get(row.subscriber_id)||[];if(list.length<10)list.push({purpose:row.purpose,state:row.state,createdAt:iso(row.created_at)});history.set(row.subscriber_id,list);}
 const daily=Array.from({length:30},(_,i)=>{const day=new Date((since+i*86400+9*3600)*1000).toISOString().slice(0,10);return {date:day,joined:joined.results.find(row=>row.date===day)?.count||0,confirmed:confirmed.results.find(row=>row.date===day)?.count||0};});
 const sum=(rows,key)=>rows.reduce((total,row)=>total+row[key],0),last7=daily.slice(-7),previous7=daily.slice(-14,-7);
 return {scope:'현재 보관 중인 명단 기준입니다. 해지·만료 후 삭제된 사람은 과거 통계에서도 제외됩니다.',
  metrics:{...timing,completionRate:timing.total?Math.round(timing.active/timing.total*1000)/10:0,joined7:sum(last7,'joined'),joinedPrevious7:sum(previous7,'joined'),confirmed7:sum(last7,'confirmed'),joined30:sum(daily,'joined'),confirmed30:sum(daily,'confirmed'),selectedDay:daily.find(row=>row.date===date)||{date,joined:0,confirmed:0}},
  daily,domains:domains.results,truncated:timing.total>people.results.length,limit:5000,historyLimited:recent.results.length===5000,
  people:people.results.map(row=>{const total=totals.get(row.id);return {id:row.id,email:row.email,maskedEmail:maskEmail(row.email),status:row.status,createdAt:iso(row.created_at),confirmedAt:iso(row.confirmed_at),lastRequestedAt:iso(row.last_request),confirmationExpiresAt:iso(row.confirm_expires),waitingSeconds:row.status==='pending'?Math.max(0,now-row.created_at):null,consent:{version:row.consent_version,at:iso(row.consent_at),privacy:!!row.privacy_consent,email:!!row.email_consent,overseas:!!row.overseas_consent},mail:{attempts:total?.attempts||0,accepted:total?.accepted||0,issuesAccepted:total?.issuesAccepted||0,recent:history.get(row.id)||[]}};})};
}
export async function encryptMonitorReport(report,publicKey,requestId){
 if(!/^[a-f0-9-]{36}$/.test(requestId)||publicKey?.kty!=='RSA'||publicKey.e!=='AQAB'||typeof publicKey.n!=='string'||publicKey.n.length<342||publicKey.n.length>344||publicKey.d)throw new Error('Invalid monitor encryption key');
 const rsa=await crypto.subtle.importKey('jwk',publicKey,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
 const raw=crypto.getRandomValues(new Uint8Array(32)),iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt']);
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(requestId)},key,encoder.encode(JSON.stringify(report)));
 const wrapped=await crypto.subtle.encrypt('RSA-OAEP',rsa,raw);
 return {version:1,requestId,key:b64(wrapped),iv:b64(iv),ciphertext:b64(ciphertext)};
}
