import {mkdir,writeFile,appendFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const outcomes=new Set(['success','failure','cancelled','skipped']);
const safeId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value);
// Never serialize action outputs, environment variables, error bodies or credentials.
export function summarize(steps,required=[],context={},now=new Date()){
 if(!steps||Array.isArray(steps)||typeof steps!=='object'||!required.every(safeId))throw new Error('Invalid workflow result contract');
 const stages=Object.entries(steps).filter(([id])=>safeId(id)).map(([id,s])=>({id,outcome:outcomes.has(s?.outcome)?s.outcome:'unknown',conclusion:outcomes.has(s?.conclusion)?s.conclusion:'unknown'}));
 const failed=stages.filter(s=>s.outcome==='failure').map(s=>s.id),cancelled=stages.filter(s=>s.outcome==='cancelled').map(s=>s.id);
 const incomplete=required.filter(id=>stages.find(s=>s.id===id)?.outcome!=='success');
 const verdict=failed.length?'failure':cancelled.length?'cancelled':incomplete.length?'incomplete':'success';
 const text=(v,pattern)=>typeof v==='string'&&pattern.test(v)?v:null;
 const repo=text(context.repository,/^[\w.-]+\/[\w.-]+$/),runId=text(context.runId,/^\d+$/);
 return {version:1,kind:text(context.kind,/^[a-z-]{1,40}$/),phase:text(context.phase,/^[a-z-]{1,20}$/),runId,attempt:text(context.attempt,/^\d+$/),event:text(context.event,/^[a-z_]{1,40}$/),sha:text(context.sha,/^[a-f0-9]{40}$/),
  runUrl:repo&&runId?`https://github.com/${repo}/actions/runs/${runId}`:null,
  recordedAt:now.toISOString(),verdict,failed,cancelled,incomplete,steps:stages,
  meaning:'Step outcomes only. Publication, provider acceptance and inbox delivery require separate evidence.'};
}
export async function recordResult(env=process.env){
 const path=resolve('.workflow-results/workflow-result.json');await mkdir(dirname(path),{recursive:true});
 let result;
 try{
  result=summarize(JSON.parse(env.STEP_RESULTS||'{}'),(env.REQUIRED_STEPS||'').split(',').map(s=>s.trim()).filter(Boolean),{kind:env.RESULT_KIND,phase:env.RESULT_PHASE,repository:env.GITHUB_REPOSITORY,runId:env.GITHUB_RUN_ID,attempt:env.GITHUB_RUN_ATTEMPT,event:env.GITHUB_EVENT_NAME,sha:env.GITHUB_SHA});
 }catch{
  result={version:1,verdict:'report_unavailable',recordedAt:new Date().toISOString()};
 }
 await writeFile(path,JSON.stringify(result,null,2)+'\n');
 if(env.GITHUB_STEP_SUMMARY&&env.RESULT_PHASE!=='artifact'){
  const rows=(result.steps||[]).map(s=>`| ${s.id} | ${s.outcome} |`).join('\n');
  await appendFile(env.GITHUB_STEP_SUMMARY,`## 실행 결과\n\n결과: **${result.verdict}**\n\n| 단계 | 결과 |\n|---|---|\n${rows}\n\n실패를 성공으로 바꾸지 않습니다. 공개·발송·실제 수신은 별도 근거로 확인합니다.\n`);
 }
 if(env.RESULT_PHASE!=='artifact')console.log(JSON.stringify(result));
 // Existing failed steps already fail the job; unexpected skipped required work must fail too.
 if(['incomplete','report_unavailable'].includes(result.verdict))process.exitCode=1;
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await recordResult();
