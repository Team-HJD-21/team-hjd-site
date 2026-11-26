import test from 'node:test';
import assert from 'node:assert/strict';
import { warmPlan, waitForRelease, contentWarmRequest } from './warm-release.mjs';
const request = { date: '2026-11-05', issueId: 'note-2026-11-05-example', dryRun: false, allowLate: false, expiresAt: '2026-11-05T12:15:00+09:00' };
test('an early push arms the original issue until exactly 11:57', () => {
  const plan = warmPlan(request, new Date('2026-11-05T11:15:00+09:00'));
  assert.equal(plan.waitMs, 42*60000); assert.equal(plan.state, 'armed');
  assert.equal(warmPlan(request, new Date('2026-11-05T11:57:00+09:00')).waitMs, 0);
});
test('dry runs, cron and explicit late recovery never wait or send', async () => {
  for (const r of [null, { ...request, dryRun: true }, { ...request, allowLate: true }]) {
    const result = await waitForRelease(r, { pause: () => { throw new Error('Should not wait'); } });
    assert.equal(result.state, 'no_wait');
  }
});
test('bounded simulated clock reaches the release time without any network or mail', async () => {
  let now = Date.parse('2026-11-05T11:56:20+09:00'); const pauses=[];
  const result = await waitForRelease(request, { clock: () => now, pause: async ms => { pauses.push(ms); now+=ms; } });
  assert.deepEqual(pauses, [15000,15000,10000]); assert.equal(result.state, 'ready');
  assert.equal(now, Date.parse('2026-11-05T11:57:00+09:00'));
});
test('past date, expired approval, insufficient lifetime and invalid requests fail closed', () => {
  for (const [r,time] of [
    [{...request,date:'2026-11-04'},'2026-11-05T11:30:00+09:00'],
    [{...request,expiresAt:'2026-11-05T11:56:00+09:00'},'2026-11-05T11:30:00+09:00'],
    [request,'2026-11-05T10:30:00+09:00'],
    [request,'2026-11-05T12:31:00+09:00'],
    [{...request,dryRun:'false'},'2026-11-05T11:30:00+09:00']
  ]) assert.throws(() => warmPlan(r,new Date(time)));
});

test('successful main validation arms the current scheduled issue without a GPT approval file',()=>{
  const issue={id:request.issueId,date:request.date,status:'scheduled',publishAt:'2026-11-05T11:57:00+09:00'};
  const now=new Date('2026-11-05T11:05:00+09:00');
  const automatic=contentWarmRequest([issue],now);
  assert.equal(automatic.issueId,issue.id);
  assert.equal(warmPlan(automatic,now).waitMs,52*60000);
  for(const time of ['2026-11-05T12:31:00+09:00','2026-11-05T23:59:59+09:00']){
    const late=new Date(time);assert.equal(warmPlan(contentWarmRequest([issue],late),late).state,'ready');
  }
  assert.equal(contentWarmRequest([issue],new Date('2026-11-06T11:05:00+09:00')),null);
  assert.equal(contentWarmRequest([{...issue,status:'published'}],now),null);
  assert.equal(contentWarmRequest([{...issue,status:'draft'}],now),null);
  assert.equal(contentWarmRequest([issue],new Date('2026-11-05T10:00:00+09:00')),null);
  assert.throws(()=>contentWarmRequest([issue,{...issue,id:'other'}],now),/Multiple/);
});

test('a fresh legacy request can release after 12:30 but cannot cross midnight',()=>{
  const late={...request,expiresAt:'2026-11-05T23:59:59.999+09:00'};
  assert.equal(warmPlan(late,new Date('2026-11-05T23:30:00+09:00')).state,'ready');
  assert.throws(()=>warmPlan(late,new Date('2026-11-06T00:00:00+09:00')),/Seoul date/);
});
test('clock jump beyond expiry during wait is reported rather than publishing late', async () => {
  let now=Date.parse('2026-11-05T11:56:30+09:00');
  await assert.rejects(waitForRelease(request,{clock:()=>now,pause:async()=>{now=Date.parse('2026-11-05T12:40:00+09:00');}}));
});
