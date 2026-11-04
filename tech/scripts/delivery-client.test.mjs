import assert from 'node:assert/strict';
import test from 'node:test';
import {waitForLiveIssue,deliverBatches,SITE} from './delivery-client.mjs';
const scheduled={id:'note-2026-11-03-example',date:'2026-11-03'};
const late=new Date('2026-11-03T12:35:00Z');
test('manifest title and original dated URL must match the validated manuscript',async()=>{
 for(const changed of [{title:'different title'},{url:`${SITE}/${scheduled.date}/another-slug/`}]){
  const timer=pollClock();let articles=0;
  await assert.rejects(waitForLiveIssue(scheduled.id,{expectedDate:scheduled.date,expectedArticleUrl:liveIssue.url,expectedTitle:liveIssue.title,...timer,maxWaitMs:3,pollMs:1,
   fetcher:async url=>{if(!url.includes('/publication.json'))articles++;return Response.json({issues:[{...liveIssue,...changed}]});}}),/deadline/);
  assert.equal(articles,0);
 }
});
test('deployment polling caps the combined manifest and article GET count at sixty',async()=>{
 const timer=pollClock();let gets=0;
 await assert.rejects(waitForLiveIssue(scheduled.id,{expectedDate:scheduled.date,...timer,maxWaitMs:1000,pollMs:1,
  fetcher:async(url,options)=>{gets++;assert.equal(options.method,undefined);return url.includes('/publication.json')?Response.json({issues:[liveIssue]}):new Response('',{status:404});}}),/deadline/);
 assert.equal(gets,60);
});
const liveIssue = { id: scheduled.id, date: scheduled.date, title: '오늘의 글', url: `${SITE}/${scheduled.date}/recovery-test/` };
const html = () => new Response('<!doctype html><title>오늘의 글</title>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
test('same ID with stale manuscript or stale article HTML cannot pass the version gate',async()=>{
 const expectedVersion='a'.repeat(64);
 for(const staleManifest of [true,false]){
  const timer=pollClock();let articles=0;
  await assert.rejects(waitForLiveIssue(scheduled.id,{expectedDate:scheduled.date,expectedVersion,...timer,maxWaitMs:3,pollMs:1,
   fetcher:async url=>url.includes('/publication.json')?Response.json({issues:[{...liveIssue,contentVersion:staleManifest?'b'.repeat(64):expectedVersion}]}):(articles++,html())}),/deadline/);
  assert.equal(articles,staleManifest?0:3);
 }
 const timer=pollClock();
 const result=await waitForLiveIssue(scheduled.id,{expectedDate:scheduled.date,expectedVersion,...timer,maxWaitMs:3,pollMs:1,
 fetcher:async url=>url.includes('/publication.json')?Response.json({issues:[{...liveIssue,contentVersion:expectedVersion}]}):new Response(`<meta name="note-content-version" content="${expectedVersion}">`,{headers:{'content-type':'text/html'}})});
 assert.equal(result.contentVersion,expectedVersion);
});
function pollClock() {
  let time = +late;
  return { clock: () => time, pause: async ms => { time += ms; }, advance: ms => { time += ms; } };
}
test('deployment polling retries a network error, stale manifest and missing article', async () => {
  const timer = pollClock(); let manifests = 0, articles = 0;
  const fetcher = async url => {
    if (url.includes('/publication.json')) {
      manifests++;
      if (manifests === 1) throw new Error('simulated network fault');
      return Response.json({ issues: manifests === 2 ? [] : [liveIssue] });
    }
    assert.equal(url, liveIssue.url); articles++;
    return articles === 1 ? new Response('', { status: 404 }) : html();
  };
  assert.deepEqual(await waitForLiveIssue(scheduled.id, { expectedDate: scheduled.date, fetcher, ...timer, maxWaitMs: 100, pollMs: 1 }), liveIssue);
  assert.equal(manifests, 4); assert.equal(articles, 2);
});
test('deployment polling never sends email and stops at its deadline', async () => {
  const timer = pollClock(); let calls = 0;
  await assert.rejects(waitForLiveIssue(scheduled.id, {
    expectedDate: scheduled.date, ...timer, maxWaitMs: 4, pollMs: 1,
    fetcher: async (url, options) => { calls++; assert.ok(url.startsWith(SITE + '/publication.json')); assert.equal(options.method, undefined); return new Response('', { status: 503 }); }
  }), /deadline/);
  assert.equal(calls, 4);
});
test('manifest cannot redirect checks to an external article URL', async () => {
  const timer = pollClock();
  await assert.rejects(waitForLiveIssue(scheduled.id, {
    expectedDate: scheduled.date, ...timer, maxWaitMs: 3, pollMs: 1,
    fetcher: async url => {
      assert.ok(url.startsWith(SITE));
      return Response.json({ issues: [{ ...liveIssue, url: 'https://evil.example/article/' }] });
    }
  }), /deadline/);
});
test('duplicate or stale manifest entries do not satisfy the live-publication gate', async () => {
  for (const issues of [[liveIssue, liveIssue], [{ ...liveIssue, date: '2026-11-02' }]]) {
    const timer = pollClock();
    await assert.rejects(waitForLiveIssue(scheduled.id, {
      expectedDate: scheduled.date, ...timer, maxWaitMs: 2, pollMs: 1,
      fetcher: async () => Response.json({ issues })
    }), /deadline/);
  }
});
test('a wrong release date is rejected before any network request', async () => {
  let calls = 0;
  await assert.rejects(waitForLiveIssue(scheduled.id, {
    expectedDate: '2026-11-04', clock: () => +late, fetcher: async () => { calls++; }
  }), /not today/);
  assert.equal(calls, 0);
});
test('invalid ID or polling bounds cannot initiate requests', async () => {
  await assert.rejects(waitForLiveIssue('../bad', { expectedDate: scheduled.date, clock: () => +late }), /Invalid issue/);
  await assert.rejects(waitForLiveIssue(scheduled.id, { expectedDate: scheduled.date, clock: () => +late, maxWaitMs: 700000 }), /wait limits/);
});

const counts = changed => ({ issueId: scheduled.id, queued: 1, duplicate: 0, quota: 0, rejected: 0, uncertain: 0, cancelled: 0, remaining: 0, unresolved: 0, ...changed });
const deliveryOptions = { expectedDate: scheduled.date, clock: () => +late, tokenProvider: async () => 'test-oidc' };
test('delivery client accepts only allowlisted counts and never supplies recipients or mail content', async () => {
  const logged = [];
  const result = await deliverBatches(scheduled.id, {
    ...deliveryOptions, onResult: value => logged.push(value),
    fetcher: async (url, options) => {
      assert.equal(url, SITE + '/api/internal/deliver');
      assert.deepEqual(JSON.parse(options.body), { issueId: scheduled.id });
      return Response.json({ ...counts(), privateData: 'must not be logged' });
    }
  });
  assert.equal(result.acceptedThisRun, 1);
  assert.equal(logged[0].privateData, undefined);
});
test('an uncertain POST response is not retried', async () => {
  let calls = 0;
  await assert.rejects(deliverBatches(scheduled.id, {
    ...deliveryOptions, fetcher: async () => { calls++; throw new Error('simulated lost response'); }
  }), /uncertain/);
  assert.equal(calls, 1);
});
test('provider failures remain operator-review states, even with HTTP 200', async () => {
  for (const state of ['quota', 'rejected', 'uncertain', 'unresolved']) {
    let calls = 0;
    await assert.rejects(deliverBatches(scheduled.id, {
      ...deliveryOptions, fetcher: async () => { calls++; return Response.json(counts({ [state]: 1 })); }
    }), /operator review/);
    assert.equal(calls, 1);
  }
});
test('HTTP failure with aggregate counts never reports complete', async () => {
  await assert.rejects(deliverBatches(scheduled.id, {
    ...deliveryOptions, fetcher: async () => Response.json(counts({ queued: 0 }), { status: 503 })
  }), /operator review/);
});
test('invalid JSON/counts/issue IDs cannot be mistaken for success or retried', async () => {
  for (const response of [
    () => new Response('bad-json'),
    () => Response.json({ queued: 1 }),
    () => Response.json(counts({ issueId: 'other-issue' })),
    () => Response.json(counts({ remaining: -1 }))
  ]) {
    let calls = 0;
    await assert.rejects(deliverBatches(scheduled.id, {
      ...deliveryOptions, fetcher: async () => { calls++; return response(); }
    }));
    assert.equal(calls, 1);
  }
});
test('existing receipts represented by zero new acceptance remain a normal no-resend result', async () => {
  const result = await deliverBatches(scheduled.id, {
    ...deliveryOptions, fetcher: async () => Response.json(counts({ queued: 0 }))
  });
  assert.equal(result.acceptedThisRun, 0); assert.equal(result.remaining, 0);
  // D1 receipt enforcement itself is covered by the existing subscriptions.test.mjs suite.
});
test('only the remaining unattempted batch is requested, with bounded capacity', async () => {
  let calls = 0;
  const result = await deliverBatches(scheduled.id, {
    ...deliveryOptions, fetcher: async () => { calls++; return Response.json(counts({ remaining: calls === 1 ? 1 : 0 })); }
  });
  assert.equal(calls, 2); assert.equal(result.acceptedThisRun, 2);
  calls = 0;
  await assert.rejects(deliverBatches(scheduled.id, {
    ...deliveryOptions, maxBatches: 2,
    fetcher: async () => { calls++; return Response.json(counts({ remaining: 1 })); }
  }), /bounded batch limit/);
  assert.equal(calls, 2);
});
test('missing token or a changed date prevents a delivery POST', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; };
  await assert.rejects(deliverBatches(scheduled.id, { ...deliveryOptions, fetcher, tokenProvider: async () => '' }), /Missing OIDC/);
  await assert.rejects(deliverBatches(scheduled.id, { ...deliveryOptions, fetcher, expectedDate: '2026-11-04' }), /date changed/);
  assert.equal(calls, 0);
});
