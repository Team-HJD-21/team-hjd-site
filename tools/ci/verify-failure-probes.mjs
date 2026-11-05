import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
const root=process.argv[2],folders=await readdir(root);
for(const scenario of ['success','check-failure','build-failure']){
 const names=folders.filter(name=>name.startsWith(`workflow-failure-probe-${scenario}-`));assert.equal(names.length,1,'Missing or ambiguous fault artifact');
 const directory=join(root,names[0]),r=JSON.parse(await readFile(join(directory,'workflow-result.json'),'utf8'));
 const outcome=id=>r.steps.find(s=>s.id===id)?.outcome;
 assert.equal(outcome('tests'),'success','Independent check must finish after a failed validation');
 assert.ok(await stat(join(directory,'independent-check.txt')));
 assert.equal(r.verdict,scenario==='success'?'success':'failure');
 if(scenario==='success')assert.ok(await stat(join(directory,'release-permitted.txt')));
 else{
  assert.equal(outcome('release_stub'),'skipped');
  assert.ok(!await stat(join(directory,'release-permitted.txt')).catch(()=>false));
  assert.ok(r.failed.includes(scenario==='check-failure'?'validate':'build'));
 }
 console.log(JSON.stringify({scenario,independentCheckComplete:true,diagnosticsSaved:true,failurePreserved:scenario!=='success',realPublishOrMail:false}));
}
