import test from 'node:test';
import assert from 'node:assert/strict';
import {summarize} from './workflow-result.mjs';
const ok={outcome:'success',conclusion:'success'};
test('a failed check remains a failure after independent checks and final reporting succeed',()=>{
 const r=summarize({validation:{outcome:'failure',conclusion:'failure'},tests:ok,build:{outcome:'skipped'},report:ok},['validation','tests']);
 assert.equal(r.verdict,'failure');assert.deepEqual(r.failed,['validation']);assert.equal(r.steps.find(x=>x.id==='tests').outcome,'success');
});
test('continue-on-error cannot disguise a failed outcome',()=>{
 assert.equal(summarize({test:{outcome:'failure',conclusion:'success'}},['test']).verdict,'failure');
});
test('a missing or skipped required step cannot produce a green completion',()=>{
 for(const steps of [{},{build:{outcome:'skipped',conclusion:'skipped'}}])assert.equal(summarize(steps,['build']).verdict,'incomplete');
 assert.equal(summarize({build:ok},['build']).verdict,'success');
});
test('artifact omits all outputs, recipient fields, raw error text and unknown context',()=>{
 const r=summarize({check:{...ok,outputs:{secret:'MUST_NOT_APPEAR',email:'private@example.test'},error:'MUST_NOT_APPEAR'}},['check'],{token:'MUST_NOT_APPEAR',kind:'validation'});
 assert.ok(!JSON.stringify(r).includes('MUST_NOT_APPEAR'));assert.ok(!JSON.stringify(r).includes('private@example.test'));
 assert.equal(r.runUrl,null);
});
test('cancelled jobs and malformed results are not successful',()=>{
 assert.equal(summarize({test:{outcome:'cancelled',conclusion:'cancelled'}},['test']).verdict,'cancelled');
 assert.throws(()=>summarize([],[]));assert.throws(()=>summarize({},['bad\nlabel']));
});
