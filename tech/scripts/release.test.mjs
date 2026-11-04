import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { planRelease, validateRecovery, validateRecoveryPush, contextFromEvent, REQUEST_PATH } from './release.mjs';

const scheduled = { id: 'note-2026-11-03-example', date: '2026-11-03', status: 'scheduled', publishAt: '2026-11-03T11:57:00+09:00' };
const evening = new Date('2026-11-03T12:30:00Z'); // 21:30 KST, after the ordinary cutoff.
const approval = changes => ({ version: 1, requestId: 'recovery-20261103-001', date: scheduled.date, issueId: scheduled.id,
  reason: 'Owner approved recovery of the missed issue.', requestedAt: '2026-11-03T12:25:00Z', expiresAt: '2026-11-03T13:25:00Z',
  allowLate: true, dryRun: false, confirm: 'publish-and-send-once', expectedBaseSha: 'a'.repeat(40), ...changes });
const pushContext = request => ({ env: { GITHUB_EVENT_NAME: 'push', GITHUB_REPOSITORY: 'Team-HJD-21/team-hjd-site', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: 'b'.repeat(40) },
  event: { ref: 'refs/heads/main', before: 'a'.repeat(40), after: 'b'.repeat(40), deleted: false, forced: false, created: false },
  request, head: 'b'.repeat(40), changedPaths: [REQUEST_PATH] });

test('Seoul 11:57 gate never publishes early and selects only a ready issue', () => {
  assert.equal(planRelease([scheduled], new Date('2026-11-03T02:56:59Z')).state, 'before_release_time');
  assert.deepEqual(planRelease([scheduled], new Date('2026-11-03T02:57:00Z')).ids, [scheduled.id]);
});
test('drafts, samples, previous days and future issues never become today’s issue', () => {
  const items = [{ ...scheduled, status: 'draft' }, { ...scheduled, status: 'sample' }, { ...scheduled, date: '2026-11-02' }, { ...scheduled, date: '2026-11-04' }];
  assert.equal(planRelease(items, new Date('2026-11-03T03:05:00Z')).state, 'not_ready');
});
test('published issue suppresses repeat publication and ambiguous schedules fail', () => {
  assert.equal(planRelease([{ ...scheduled, status: 'published' }, scheduled], new Date('2026-11-03T03:03:00Z')).state, 'already_published');
  assert.throws(() => planRelease([scheduled, { ...scheduled, id: 'other' }], new Date('2026-11-03T03:00:00Z')), /Multiple/);
});
test('delayed automatic jobs still have the original bounded window', () => {
  assert.equal(planRelease([scheduled], new Date('2026-11-03T03:30:00Z')).state, 'ready');
  assert.throws(() => planRelease([scheduled], new Date('2026-11-03T03:31:00Z')), /window ended/);
  assert.throws(() => planRelease([scheduled], evening), /explicit same-day manual recovery/);
});
test('explicit unexpired same-day recovery selects the original issue after cutoff without mutation', () => {
  const before = JSON.stringify(scheduled);
  assert.deepEqual(planRelease([scheduled], evening, { recovery: approval() }).ids, [scheduled.id]);
  assert.equal(JSON.stringify(scheduled), before);
});
test('a noon retry approval without allowLate cannot turn into an evening release', () => {
  assert.throws(() => planRelease([scheduled], evening, { recovery: approval({ allowLate: false }) }), /window ended/);
});
test('recovery never defeats the earliest publish time', () => {
  const early = new Date('2026-11-03T02:56:00Z');
  const recovery = approval({ requestedAt: '2026-11-03T02:50:00Z', expiresAt: '2026-11-03T03:20:00Z' });
  assert.equal(planRelease([scheduled], early, { recovery }).state, 'before_release_time');
});
test('recovery preserves already-published ID, original timestamp and repeat-send receipts', () => {
  const published = { ...scheduled, status: 'published', publishedAt: '2026-11-03T03:02:00Z' }, before = JSON.stringify(published);
  const plan = planRelease([published], evening, { recovery: approval() });
  assert.equal(plan.state, 'already_published');
  assert.deepEqual(plan.ids, [scheduled.id]);
  assert.equal(JSON.stringify(published), before);
});
test('recovery cannot select another day, draft, sample, nonexistent or different published issue', () => {
  for (const changes of [{ date: '2026-11-02' }, { date: '2026-11-04' }, { issueId: 'not-present' }]) assert.throws(() => planRelease([scheduled], evening, { recovery: approval(changes) }));
  for (const status of ['draft', 'sample']) assert.throws(() => planRelease([{ ...scheduled, status }], evening, { recovery: approval() }));
  assert.throws(() => planRelease([scheduled, { ...scheduled, id: 'another-published', status: 'published' }], evening, { recovery: approval() }), /different issue/);
  assert.throws(() => planRelease([scheduled, { ...scheduled, id: 'another-scheduled' }], evening, { recovery: approval() }), /Multiple/);
});
test('recovery refuses duplicate published candidates and invalid clocks', () => {
  assert.throws(() => planRelease([{ ...scheduled, status: 'published' }, { ...scheduled, id: 'another', status: 'published' }], evening, { recovery: approval() }), /Multiple/);
  assert.throws(() => planRelease([scheduled], new Date(NaN)), /clock/);
});
test('approval expires at its boundary and cannot last more than one hour', () => {
  assert.doesNotThrow(() => validateRecovery(approval(), evening));
  for (const changes of [
    { expiresAt: evening.toISOString() }, { expiresAt: '2026-11-03T13:25:01Z' },
    { requestedAt: '2026-11-03T12:31:01Z' }, { requestedAt: 'not-a-date' },
    { requestedAt: '2026-11-03' }, { expiresAt: '2026-11-03T12:24:59Z' }
  ]) assert.throws(() => validateRecovery(approval(changes), evening), /approval/);
});
test('approval requires exact explicit fields and never accepts recipients or arbitrary mail', () => {
  for (const changes of [
    { version: 2 }, { requestId: '../escape' }, { issueId: '../issue' }, { reason: 'short' },
    { reason: 'bad\nmultiline reason' }, { dryRun: 'false' }, { allowLate: 'true' },
    { confirm: false }, { expectedBaseSha: 'no' }, { recipient: 'somebody@example.test' }, { html: '<p>mail</p>' }
  ]) assert.throws(() => validateRecovery(approval(changes), evening));
});
test('recovery approval cannot cross the Seoul midnight boundary', () => {
  assert.throws(() => validateRecovery(approval(), new Date('2026-11-03T15:00:00Z')), /Seoul date/);
});
test('only an isolated, current, non-forced main request push is accepted', () => {
  assert.equal(validateRecoveryPush(pushContext(approval()), evening).issueId, scheduled.id);
  for (const key of ['forced', 'deleted', 'created']) {
    const context = pushContext(approval()); context.event[key] = true;
    assert.throws(() => validateRecoveryPush(context, evening), /push event/);
  }
  for (const changedPaths of [[], ['tech/content/issues.json'], [REQUEST_PATH, 'tech/src/subscriptions.mjs']]) {
    assert.throws(() => validateRecoveryPush({ ...pushContext(approval()), changedPaths }, evening), /separately/);
  }
});
test('stale HEAD, base mismatch, branch, repository and trigger mismatch fail closed', () => {
  for (const changes of [{ head: 'c'.repeat(40) }, { request: approval({ expectedBaseSha: 'c'.repeat(40) }) }]) assert.throws(() => validateRecoveryPush({ ...pushContext(approval()), ...changes }, evening));
  for (const changes of [{ GITHUB_EVENT_NAME: 'schedule' }, { GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_REF: 'refs/heads/other' }, { GITHUB_REPOSITORY: 'someone/else' }, { GITHUB_SHA: 'c'.repeat(40) }]) {
    const context = pushContext(approval()); context.env = { ...context.env, ...changes };
    assert.throws(() => validateRecoveryPush(context, evening));
  }
});
async function eventFixture(t, eventName, inputs = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'release-event-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const eventPath = join(directory, 'event.json'); await writeFile(eventPath, JSON.stringify({ inputs }));
  return { project: directory, env: { GITHUB_EVENT_NAME: eventName, GITHUB_EVENT_PATH: eventPath, GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: 'Team-HJD-21/team-hjd-site', GITHUB_RUN_ID: '123456789' } };
}
test('cron ignores manual recovery fields and never loads an approval file', async t => {
  const f = await eventFixture(t, 'schedule', { allow_late: 'true', recovery_issue_id: scheduled.id });
  assert.deepEqual(await contextFromEvent(f.project, f.env, evening), { write: true, recovery: null });
});
test('manual dispatch is dry-run by default and explicit false means write', async t => {
  let f = await eventFixture(t, 'workflow_dispatch');
  assert.deepEqual(await contextFromEvent(f.project, f.env, evening), { write: false, recovery: null });
  f = await eventFixture(t, 'workflow_dispatch', { dry_run: 'false' });
  assert.deepEqual(await contextFromEvent(f.project, f.env, evening), { write: true, recovery: null });
});
test('manual late recovery requires issue, date and reason; dispatch booleans are parsed safely', async t => {
  const inputs = { dry_run: false, allow_late: true, recovery_issue_id: scheduled.id, recovery_date: scheduled.date, recovery_reason: 'Explicit owner-approved missed-issue recovery.' };
  const f = await eventFixture(t, 'workflow_dispatch', inputs);
  const context = await contextFromEvent(f.project, f.env, evening);
  assert.equal(context.write, true); assert.equal(context.recovery.allowLate, true); assert.equal(context.recovery.issueId, scheduled.id);
  for (const key of ['recovery_issue_id', 'recovery_date', 'recovery_reason']) {
    const missing = { ...inputs }; delete missing[key]; const fixture = await eventFixture(t, 'workflow_dispatch', missing);
    await assert.rejects(contextFromEvent(fixture.project, fixture.env, evening));
  }
  const bad = await eventFixture(t, 'workflow_dispatch', { dry_run: 'surprise' });
  await assert.rejects(contextFromEvent(bad.project, bad.env, evening), /boolean/);
});
test('untrusted events cannot authorize a release', async t => {
  const f = await eventFixture(t, 'pull_request');
  await assert.rejects(contextFromEvent(f.project, f.env, evening), /Unsupported/);
});

test('actual committed request is read from a real git tree and stale checkout is refused', async t => {
  const root = await mkdtemp(join(tmpdir(), 'release-push-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = join(root, 'tech'); await mkdir(join(project, 'operations'), { recursive: true });
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(['init', '-b', 'main']); git(['config', 'user.name', 'Recovery test']); git(['config', 'user.email', 'test@example.test']);
  await writeFile(join(root, 'README.md'), 'fixture\n'); git(['add', '.']); git(['commit', '-m', 'base']);
  const before = git(['rev-parse', 'HEAD']);
  const request = approval({ expectedBaseSha: before, dryRun: true });
  await writeFile(join(root, REQUEST_PATH), JSON.stringify(request)); git(['add', '.']); git(['commit', '-m', 'request']);
  const after = git(['rev-parse', 'HEAD']);
  const eventPath = join(root, 'event.json');
  await writeFile(eventPath, JSON.stringify({ ref: 'refs/heads/main', before, after, forced: false, deleted: false, created: false }));
  const env = { GITHUB_EVENT_NAME: 'push', GITHUB_REPOSITORY: 'Team-HJD-21/team-hjd-site', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: after, GITHUB_EVENT_PATH: eventPath };
  const context = await contextFromEvent(project, env, evening);
  assert.equal(context.write, false); assert.equal(context.recovery.issueId, scheduled.id);
  await writeFile(join(root, 'README.md'), 'changed\n'); git(['add', 'README.md']); git(['commit', '-m', 'unrelated']);
  await assert.rejects(contextFromEvent(project, env, evening), /Stale/);
});
