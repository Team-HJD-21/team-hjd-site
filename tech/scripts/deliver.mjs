// GitHub Actions OIDC only; never print the bearer token or recipient data.
import { appendFile } from 'node:fs/promises';
import { loadContent } from './content.mjs';
import { publicationVersion } from './publication-version.mjs';
import { fileURLToPath } from 'node:url';
import { waitForLiveIssue, deliverBatches } from './delivery-client.mjs';
const site='https://tech.teamhjd.com';
const ids=(process.env.ISSUE_IDS||'').split(',').filter(Boolean);
const expectedDate=process.env.ISSUE_DATE;
async function oidcToken(){
 const auth=await fetch(`${process.env.ACTIONS_ID_TOKEN_REQUEST_URL}&audience=${encodeURIComponent(site)}`,{headers:{Authorization:`Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`},signal:AbortSignal.timeout(15000)});
 if(!auth.ok)throw new Error('Actions OIDC unavailable.');
 const {value}=await auth.json();if(!value)throw new Error('Missing OIDC token.');
 console.log(`::add-mask::${value}`);return value;
}
if(process.argv.includes('--check')){
 const token=await oidcToken();
 const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
 const header=JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString());
 const {verifyActionsToken}=await import('../src/subscriptions.mjs');
 console.log(JSON.stringify({oidcDiagnostics:{algorithm:header.alg,audience:claims.aud,repository:claims.repository,subject:claims.sub,ref:claims.ref,workflow:claims.workflow_ref,lifetime:claims.exp-claims.iat,notBeforeDelta:claims.nbf-Date.now()/1000,expiresIn:claims.exp-Date.now()/1000,localVerification:await verifyActionsToken(token)}}));
 const response=await fetch(`${site}/api/internal/check`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(30000)});
 console.log(JSON.stringify(await response.json()));
 if(!response.ok)throw new Error(`Authenticated connection check failed (${response.status}).`);
 process.exit(0);
}
if(ids.length!==1) throw new Error('Exactly one released issue ID is required.');
const project=fileURLToPath(new URL('../',import.meta.url));
const {allIssues,documents}=await loadContent(project);
for(const issueId of ids){
 const source=allIssues.find(issue=>issue.id===issueId && issue.date===expectedDate && issue.status==='published');
 if(!source)throw new Error('The delivery target must be the validated published issue for the release date.');
 const contentVersion=await publicationVersion(project,source,documents.get(source.id));
 const issue=await waitForLiveIssue(issueId,{
  expectedDate,expectedArticleUrl:`${site}/${source.date}/${source.slug}/`,expectedTitle:source.title,expectedVersion:contentVersion,
  onProgress:result=>console.log(JSON.stringify(result))
 });
 console.log(JSON.stringify({stage:'web_publication_verified',issueId,url:issue.url}));
 const result=await deliverBatches(issueId,{
  expectedDate,contentVersion,tokenProvider:oidcToken,
  onResult:counts=>console.log(JSON.stringify(counts))
 });
 console.log(JSON.stringify({stage:'delivery_processing_complete',...result}));
 if(process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
  `## 메일 발송 처리\n\n호: ${issueId}\n\n이번 실행 API 수락: ${result.acceptedThisRun}건 / 미시도: 0건 / 미해결: 0건\n\nAPI 수락은 받은편지함 도착과 다릅니다. 0건이면 기존 실행 기록 또는 수신 대상 유무를 함께 확인하세요.\n`);
}
