import test from 'node:test';
import assert from 'node:assert/strict';
import {createRefreshQueue} from './refresh-queue.mjs';
test('in-flight and queued duplicate reads coalesce without cancelling the first request',async()=>{
 let finish;const held=new Promise(r=>finish=r),calls=[];
 const q=createRefreshQueue({run:async date=>{calls.push(date);if(calls.length===1)await held;}});
 q.request('2026-11-05');assert.equal(q.request('2026-11-05').deduplicated,true);
 q.request('2026-11-04');assert.equal(q.request('2026-11-04').deduplicated,true);
 assert.deepEqual(calls,['2026-11-05']);finish();await q.idle();assert.deepEqual(calls,['2026-11-05','2026-11-04']);
});
test('a failed read is reported and the next distinct request still runs to completion',async()=>{
 const calls=[],errors=[],states=[];
 const q=createRefreshQueue({run:async date=>{calls.push(date);if(date==='first')throw new Error('mock failure');},onError:(_e,date)=>errors.push(date),onChange:s=>states.push(s)});
 q.request('first');q.request('second');await q.idle();
 assert.deepEqual(calls,['first','second']);assert.deepEqual(errors,['first']);assert.equal(states.at(-1).busy,false);assert.deepEqual(states.at(-1).pending,[]);
});
