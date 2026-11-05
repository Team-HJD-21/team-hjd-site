import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {fetchSnapshot,seoulDate} from './bridge.mjs';
import {createRefreshQueue} from './refresh-queue.mjs';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..');
const startupFile=process.argv[2];
if(!startupFile||!resolve(startupFile).startsWith(join(root,'.local','newsletter-monitor')+sep))throw new Error('Startup file must stay in the private monitor directory');
let oneTime=randomBytes(32).toString('base64url'),session=randomBytes(32).toString('base64url'),created=Date.now(),lastRequest=Date.now(),port;
const state={report:null,busy:false,phase:'아직 조회하지 않았습니다'};
const equal=(a,b)=>typeof a==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const respond=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
const refreshQueue=createRefreshQueue({
 async run(date){state.phase='조회 준비 중';state.error=null;state.requestedDate=date;state.report=await fetchSnapshot(date,update=>Object.assign(state,update));state.phase='조회 완료';},
 onChange({busy,pending}){state.busy=busy;state.queuedDates=pending;},
 onError(){state.error='조회하지 못했습니다. GitHub 로그인과 조회 실행 상태를 확인해 주세요. 이전 정상 정보는 유지합니다.';state.phase='조회 실패';}
});
const server=http.createServer(async(req,res)=>{
 try{
  const origin=`http://127.0.0.1:${port}`;
  if(req.headers.host!==`127.0.0.1:${port}`){respond(res,{error:'invalid_host'},403);return;}
  lastRequest=Date.now();const url=new URL(req.url,origin),cookieName=`notes_monitor_${port}`;
  res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  if(url.pathname==='/open'&&req.method==='GET'){
   if(!oneTime||Date.now()-created>120000||!equal(url.searchParams.get('token'),oneTime)){respond(res,{error:'expired_open_link'},403);return;}
   oneTime=null;res.writeHead(303,{'Location':'/','Set-Cookie':`${cookieName}=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`,'Cache-Control':'no-store'});res.end();return;
  }
  const cookies=Object.fromEntries((req.headers.cookie||'').split(';').map(p=>p.trim().split('=')));
  if(!equal(cookies[cookieName],session)){respond(res,{error:'로컬 관리 바로가기로 열어 주세요.'},403);return;}
  if(req.method==='GET'&&url.pathname==='/api/state'){respond(res,{...state,today:seoulDate()});return;}
  if(req.method==='GET'&&url.pathname==='/api/preview'){
   const index=Number(url.searchParams.get('index')),message=Number.isInteger(index)?state.report?.deliveries[index]:null;
   if(!message?.html){respond(res,{error:'저장된 본문이 없습니다. Resend에서 확인해 주세요.'},404);return;}
   res.setHeader('X-Frame-Options','SAMEORIGIN');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src https://tech.teamhjd.com; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"});
   res.end(message.html.replace(/\s+href="[^"]*"/gi,''));return;
  }
  if(req.method==='POST'&&url.pathname==='/api/refresh'){
   if(req.headers.origin!==origin||req.headers['content-type']!=='application/json'){respond(res,{error:'invalid_origin'},403);return;}
   let body='';for await(const chunk of req){body+=chunk;if(body.length>1024){respond(res,{error:'body_too_large'},413);return;}}
   const data=JSON.parse(body),date=data.date||seoulDate();
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))){respond(res,{error:'invalid_date'},400);return;}
   const queued=refreshQueue.request(date);respond(res,{busy:true,deduplicated:queued.deduplicated,queued:queued.pending.length},202);return;
  }
  const files={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/audience.mjs':['audience.mjs','text/javascript; charset=utf-8'],'/styles.css':['styles.css','text/css; charset=utf-8'],'/logo.png':['../../tech/assets/brand/gambungi-email-logo.png','image/png']};
  if(req.method==='GET'&&files[url.pathname]){
   const [file,type]=files[url.pathname];res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' https://tech.teamhjd.com; style-src 'self'; script-src 'self'; object-src 'none'; frame-src 'self' about:; base-uri 'none'; form-action 'self'"});res.end(await readFile(join(here,file)));return;
  }
  respond(res,{error:'not_found'},404);
 }catch{if(!res.headersSent)respond(res,{error:'요청을 처리하지 못했습니다.'},500);else res.end();}
});
server.listen(0,'127.0.0.1',async()=>{port=server.address().port;await mkdir(dirname(resolve(startupFile)),{recursive:true});await writeFile(startupFile,JSON.stringify({port,pid:process.pid,url:`http://127.0.0.1:${port}/open?token=${oneTime}`}),{mode:0o600});});
setInterval(()=>{if(Date.now()-lastRequest>30*60*1000){session='';server.close();process.exit(0);}},60000).unref();
