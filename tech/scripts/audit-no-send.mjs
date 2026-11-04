import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {release} from './release.mjs';
import {loadContent} from './content.mjs';
import {inspectLive} from './inspect-live.mjs';

// This diagnostic never imports the live delivery entry point, never has OIDC
// permission, and rejects every authenticated/non-GET/private network request.
export function readOnlyFetch(fetcher,record=[]){return async(input,options={})=>{
 const url=new URL(input),method=(options.method||'GET').toUpperCase();
 if(method!=='GET'||url.origin!=='https://tech.teamhjd.com'||url.pathname.startsWith('/api/')||new Headers(options.headers).has('authorization')||url.username||url.password)throw new Error('Audit network policy rejects this request');
 record.push({method,path:url.pathname});return fetcher(input,{...options,method:'GET'});
};}
export async function auditNoSend(project,{env=process.env,now=new Date(),fetcher=fetch}={}){
 if(env.ACTIONS_ID_TOKEN_REQUEST_TOKEN||env.RESEND_API_KEY)throw new Error('Mail credentials are forbidden in this diagnostic');
 const calls=[],get=readOnlyFetch(fetcher,calls),start=now.toISOString();
 const plan=await release({project,write:false,now});
 const {allIssues}=await loadContent(project),latest=allIssues.filter(i=>i.status==='published').sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
 const inspection=latest?await inspectLive(project,latest.id,get):{state:'no_published_issue',mailSent:false};
 let canary={present:false};
 try{
  const proof=JSON.parse(await readFile(join(project,'operations/audit-canary.json'),'utf8'));
  if(proof.nonce!=='audit-20261105-cloud-no-send'||proof.readOnly!==true||proof.message!=='겜붕이의 노트 UTF-8 연결 검수'||proof.source!=='ChatGPT cloud scheduled diagnostic')throw new Error('Invalid canary contract');
  const bytes=await readFile(join(project,'assets/audit-probe-20261105/probe.svg'));
  const svg=bytes.toString('utf8');
  if(!svg.includes('<svg')||!svg.includes('겜붕이')||/<script\b|https?:\/\//i.test(svg.replace('http://www.w3.org/2000/svg','')))throw new Error('Canary must be a static self-contained SVG');
  canary={present:true,nonce:proof.nonce,unicodeRoundTrip:true,imageSha256:createHash('sha256').update(bytes).digest('hex'),source:proof.source};
 }catch(error){if(error.code!=='ENOENT')throw error;}
 return {readOnly:true,mailSent:false,postRequests:0,startedAt:start,finishedAt:new Date().toISOString(),event:env.GITHUB_EVENT_NAME||'local',cron:env.PROBE_CRON||null,runId:env.GITHUB_RUN_ID||null,sha:env.GITHUB_SHA||null,expectedAt:env.PROBE_EXPECTED_AT||null,sharedReleaseGate:plan.state,releaseDate:plan.today,inspection,canary,network:calls};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const project=fileURLToPath(new URL('../',import.meta.url));
 const result=await auditNoSend(project);
 const output=join(project,'.local/audit-no-send.json');await mkdir(join(project,'.local'),{recursive:true});await writeFile(output,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}
