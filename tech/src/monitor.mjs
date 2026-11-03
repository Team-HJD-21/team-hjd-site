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
export async function monitorSnapshot(db,{date,now=Math.floor(Date.now()/1000)}){
 const {start,end}=reportingWindow(date,now);
 const utcDay=new Date(now*1000).toISOString().slice(0,10),quotaStart=Date.parse(`${utcDay}T00:00:00Z`)/1000;
 const [subscribers,quota,grouped,rows,trend]=await Promise.all([
  db.prepare("SELECT COUNT(*) AS total,COALESCE(SUM(status='active'),0) AS active,COALESCE(SUM(status='pending'),0) AS pending FROM subscribers").first(),
  db.prepare('SELECT count FROM limits WHERE bucket=?').bind(`mail:${utcDay}`).first(),
  db.prepare('SELECT purpose,state,COUNT(*) AS count FROM deliveries WHERE created_at>=? AND created_at<? GROUP BY purpose,state').bind(start,end).all(),
  db.prepare('SELECT d.receipt,d.purpose,d.state,d.provider_id,d.created_at,s.email,m.subject,m.html,m.text FROM deliveries d LEFT JOIN subscribers s ON s.id=d.subscriber_id LEFT JOIN mail_messages m ON m.receipt=d.receipt WHERE d.created_at>=? AND d.created_at<? ORDER BY d.created_at DESC LIMIT 500').bind(start,end).all(),
  db.prepare("SELECT date(created_at,'unixepoch','+9 hours') AS date,state,COUNT(*) AS count FROM deliveries WHERE created_at>=? GROUP BY date,state ORDER BY date").bind(now-30*86400).all()
 ]);
 const acceptedQuota=await db.prepare("SELECT COUNT(*) AS count FROM deliveries WHERE state='queued' AND created_at>=? AND created_at<?").bind(quotaStart,quotaStart+86400).first();
 return {version:1,generatedAt:new Date(now*1000).toISOString(),date,window:{start:new Date(start*1000).toISOString(),end:new Date(end*1000).toISOString()},subscribers,
  quota:{scope:'이 서비스의 기록 · Resend 계정 전체 실측과 다릅니다',providerDailyLimit:100,appDailyLimit:90,appUsed:quota?.count||0,appRemaining:Math.max(0,90-(quota?.count||0)),accepted:acceptedQuota.count,startsAt:new Date(quotaStart*1000).toISOString(),resetsAt:new Date((quotaStart+86400)*1000).toISOString()},
  summary:grouped.results,trend:trend.results,deliveries:rows.results.map(row=>({id:row.receipt,purpose:row.purpose,state:row.state,providerId:row.provider_id,createdAt:new Date(row.created_at*1000).toISOString(),recipient:maskEmail(row.email),subject:row.subject||null,html:row.html||null,text:row.text||null,issueId:row.purpose==='issue'?row.receipt.split(':')[1]:null}))};
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
