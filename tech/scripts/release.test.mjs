import assert from 'node:assert/strict';
import test from 'node:test';
import { planRelease } from './release.mjs';
const scheduled = { id: 'note-2026-11-03-example', date: '2026-11-03', status: 'scheduled', publishAt: '2026-11-03T12:00:00+09:00' };
test('Seoul noon gate never publishes early and selects only a ready issue', () => {
  assert.equal(planRelease([scheduled], new Date('2026-11-03T02:59:59Z')).state, 'before_noon');
  assert.deepEqual(planRelease([scheduled], new Date('2026-11-03T03:00:00Z')).ids, [scheduled.id]);
});
test('drafts, samples, previous days and future issues never become today’s issue', () => {
  const items = [{ ...scheduled, status: 'draft' }, { ...scheduled, status: 'sample' }, { ...scheduled, date: '2026-11-02' }, { ...scheduled, date: '2026-11-04' }];
  assert.equal(planRelease(items, new Date('2026-11-03T03:05:00Z')).state, 'not_ready');
});
test('published issue suppresses repeat publication and ambiguous schedules fail', () => {
  assert.equal(planRelease([{ ...scheduled, status: 'published' }, scheduled], new Date('2026-11-03T03:10:00Z')).state, 'already_published');
  assert.throws(() => planRelease([scheduled, { ...scheduled, id: 'other' }], new Date('2026-11-03T03:00:00Z')), /Multiple/);
});
test('delayed jobs have a bounded window; stale releases never silently catch up', () => {
  assert.equal(planRelease([scheduled], new Date('2026-11-03T03:30:00Z')).state, 'ready');
  assert.throws(() => planRelease([scheduled], new Date('2026-11-03T03:31:00Z')), /window ended/);
});
