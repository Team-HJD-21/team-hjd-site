export const FEEDBACK_CHOICES=['useful','curious','hard','easy'];
export const FEEDBACK_COOKIE='__Host-notes_feedback';
export const FEEDBACK_SCHEMA=`
CREATE TABLE IF NOT EXISTS article_feedback (
 issue_id TEXT NOT NULL, voter_hash TEXT NOT NULL,
 choice TEXT NOT NULL CHECK(choice IN ('useful','curious','hard','easy')),
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, creation_key TEXT NOT NULL,
 PRIMARY KEY(issue_id,voter_hash)
);
CREATE INDEX IF NOT EXISTS feedback_updated ON article_feedback(updated_at);
CREATE TABLE IF NOT EXISTS feedback_limits(bucket TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
`;
const year=365*86400,encoder=new TextEncoder(),initialized=new WeakMap();
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const random=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin',...headers}});
async function signature(secret,text){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64(await crypto.subtle.sign('HMAC',key,encoder.encode(text)));}
async function cookieIdentity(request,secret){
 const value=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(FEEDBACK_COOKIE+'='))?.slice(FEEDBACK_COOKIE.length+1);
 if(!value||!/^[-\w]{43}\.[-\w]{43}$/.test(value))return null;
 const [token,sig]=value.split('.'),key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const bytes=Uint8Array.from(atob(sig.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
 return await crypto.subtle.verify('HMAC',key,bytes,encoder.encode('feedback-cookie:'+token))?signature(secret,'feedback-voter:'+token):null;
}
async function init(db){if(!initialized.has(db))initialized.set(db,db.exec(FEEDBACK_SCHEMA.split(';').map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean).map(s=>s+';').join('\n')).catch(e=>{initialized.delete(db);throw e;}));await initialized.get(db);}
async function limited(db,bucket,max,expires){return (await db.prepare('INSERT INTO feedback_limits(bucket,count,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count<?').bind(bucket,expires,max).run()).meta.changes===1;}
async function bodyJson(request){
 if(!(request.headers.get('content-type')||'').startsWith('application/json')||!request.body)throw new Error('body');
 const reader=request.body.getReader();let body='',size=0;const decoder=new TextDecoder();
 for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1024){await reader.cancel();throw new Error('size');}body+=decoder.decode(value,{stream:true});}
 const data=JSON.parse(body+decoder.decode());if(!data||Array.isArray(data)||typeof data!=='object')throw new Error('body');return data;
}
async function publicIssues(assets,origin){const r=await assets.fetch(new URL('/publication.json',origin));if(!r.ok)throw new Error('manifest');const data=await r.json();if(data.version!==1||!Array.isArray(data.issues))throw new Error('manifest');return data.issues;}
export async function handleFeedback(request,env,{clock=()=>Date.now()}={}){
 const now=Math.floor(clock()/1000),url=new URL(request.url),method=request.method;
 if(!['GET','POST','DELETE'].includes(method))return json({error:'method_not_allowed'},405,{Allow:'GET, POST, DELETE'});
 if(method!=='GET'&&(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')&&request.headers.get('sec-fetch-site')!=='same-origin'))return json({error:'invalid_origin'},403);
 if(!env.DB||!env.ASSETS||typeof env.TOKEN_SECRET!=='string'||env.TOKEN_SECRET.length<32)return json({message:'반응 수집 연결을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.'},503);
 let data;try{data=method==='GET'?{issueId:url.searchParams.get('issueId')}:await bodyJson(request);}catch{return json({error:'invalid_body'},400);}
 if(typeof data.issueId!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.issueId)||data.issueId.length>80||method==='POST'&&!FEEDBACK_CHOICES.includes(data.choice))return json({error:'invalid_feedback'},400);
 try{
  if(!(await publicIssues(env.ASSETS,url.origin)).some(issue=>issue.id===data.issueId))return json({error:'not_published'},404);
  const voter=await cookieIdentity(request,env.TOKEN_SECRET),db=env.DB;
  // Merely reading a note sets no cookie or IP bucket.
  if(method==='GET'&&!voter)return json({choice:null});
  await init(db);
  if(method==='GET')return json({choice:(await db.prepare('SELECT choice FROM article_feedback WHERE issue_id=? AND voter_hash=? AND updated_at>=?').bind(data.issueId,voter,now-year).first())?.choice||null});
  const ip=request.headers.get('CF-Connecting-IP');if(!ip)return json({message:'접속 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'},503);
  const hour=Math.floor(now/3600),day=Math.floor((now+9*3600)/86400),dayEnd=(day+1)*86400-9*3600,rate=await signature(env.TOKEN_SECRET,`feedback-rate:${ip}:${hour}`);
  await db.batch([db.prepare('DELETE FROM feedback_limits WHERE expires<?').bind(now),db.prepare('DELETE FROM article_feedback WHERE updated_at<?').bind(now-year)]);
  if(!await limited(db,rate,60,(hour+1)*3600))return json({message:'요청이 많습니다. 잠시 후 다시 시도해 주세요.'},429,{'Retry-After':String((hour+1)*3600-now)});
  if(!voter){
   if(method==='DELETE')return json({choice:null});
   const token=random(),sig=await signature(env.TOKEN_SECRET,'feedback-cookie:'+token);
   return json({needsCookie:true},202,{'Set-Cookie':`${FEEDBACK_COOKIE}=${token}.${sig}; Path=/; Max-Age=${year}; Secure; HttpOnly; SameSite=Strict`});
  }
  if(method==='DELETE'){await db.prepare('DELETE FROM article_feedback WHERE issue_id=? AND voter_hash=?').bind(data.issueId,voter).run();return json({choice:null,message:'반응을 취소했습니다.'});}
  const bucket=await signature(env.TOKEN_SECRET,`feedback-new:${ip}:${data.issueId}:${day}`),nonce=random();
  // One atomic D1 batch admits at most five NEW browsers/IP/article/day.
  // A duplicate or changed selection updates one row and consumes no new admission.
  const result=await db.batch([
   db.prepare(`INSERT INTO article_feedback(issue_id,voter_hash,choice,created_at,updated_at,creation_key)
    SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM article_feedback WHERE issue_id=? AND voter_hash=?) OR COALESCE((SELECT count FROM feedback_limits WHERE bucket=?),0)<5
    ON CONFLICT(issue_id,voter_hash) DO UPDATE SET choice=excluded.choice,updated_at=excluded.updated_at`).bind(data.issueId,voter,data.choice,now,now,nonce,data.issueId,voter,bucket),
   db.prepare(`INSERT INTO feedback_limits(bucket,count,expires) SELECT ?,1,? WHERE EXISTS(SELECT 1 FROM article_feedback WHERE issue_id=? AND voter_hash=? AND creation_key=?)
    ON CONFLICT(bucket) DO UPDATE SET count=count+1`).bind(bucket,dayEnd,data.issueId,voter,nonce)
  ]);
  if(result[0].meta.changes!==1)return json({message:'이 네트워크에서 새로 참여할 수 있는 횟수를 오늘 모두 사용했습니다. 기존 반응은 바꾸실 수 있습니다.'},429,{'Retry-After':String(dayEnd-now)});
  return json({choice:data.choice,message:'의견을 남겨 주셔서 감사합니다. 다음 노트에 참고하겠습니다.'});
 }catch{return json({message:'반응을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'},503);}
}
export async function feedbackSnapshot(db,{now,assets}={}){
 const {results}=await db.prepare('SELECT issue_id,choice,COUNT(*) AS count,MAX(updated_at) AS last_at FROM article_feedback WHERE updated_at>=? GROUP BY issue_id,choice ORDER BY issue_id DESC').bind(now-year).all();
 let published=[];if(assets)try{published=await publicIssues(assets,'https://tech.teamhjd.com');}catch{}
 const issues=new Map();for(const row of results){if(!issues.has(row.issue_id)){const meta=published.find(s=>s.id===row.issue_id);issues.set(row.issue_id,{id:row.issue_id,title:meta?.title||row.issue_id,url:meta?.url||null,total:0,counts:Object.fromEntries(FEEDBACK_CHOICES.map(c=>[c,0])),lastAt:null});}const issue=issues.get(row.issue_id);issue.total+=row.count;issue.counts[row.choice]=row.count;const date=new Date(row.last_at*1000).toISOString();if(!issue.lastAt||date>issue.lastAt)issue.lastAt=date;}
 return {retentionDays:365,total:[...issues.values()].reduce((n,s)=>n+s.total,0),issues:[...issues.values()]};
}
