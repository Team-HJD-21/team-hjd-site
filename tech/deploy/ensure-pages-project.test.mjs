import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureProject, PROJECT } from './ensure-pages-project.mjs';

const credentials = { accountId: 'a'.repeat(32), apiToken: 'test-placeholder' };
const project = { name: PROJECT, production_branch: 'main', source: null };
const response = (status, result = project) => new Response(
  JSON.stringify({ success: status >= 200 && status < 300, result }), { status },
);

test('existing Direct Upload project is verified without mutation', async () => {
  const calls = [];
  const result = await ensureProject({ ...credentials, request: async (url, init) => {
    calls.push({ url, ...init }); return response(200);
  } });
  assert.equal(result.created, false);
  assert.deepEqual(calls.map(call => call.method), ['GET']);
  assert.ok(calls[0].url.endsWith(`/pages/projects/${PROJECT}`));
});

test('only a 404 creates the fixed Direct Upload project with main branch', async () => {
  const calls = [];
  const result = await ensureProject({ ...credentials, request: async (url, init) => {
    calls.push({ url, ...init }); return response(calls.length === 1 ? 404 : 200);
  } });
  assert.equal(result.created, true);
  assert.deepEqual(calls.map(call => call.method), ['GET', 'POST']);
  assert.deepEqual(JSON.parse(calls[1].body), { name: PROJECT, production_branch: 'main' });
});

test('authorization errors never create a project or retry', async () => {
  let calls = 0;
  await assert.rejects(ensureProject({ ...credentials, request: async () => {
    calls++; return response(403);
  } }), /HTTP 403/);
  assert.equal(calls, 1);
});

test('Git-integrated, mismatched branch, and mismatched name projects are rejected', async () => {
  for (const wrongProject of [
    { ...project, source: { type: 'github' } },
    { ...project, production_branch: 'other' },
    { ...project, name: 'company-site' },
  ]) {
    let calls = 0;
    await assert.rejects(ensureProject({ ...credentials, request: async () => {
      calls++; return response(200, wrongProject);
    } }));
    assert.equal(calls, 1);
  }
});

test('missing secrets make no API request; network errors do not reveal credentials', async () => {
  let calls = 0;
  await assert.rejects(ensureProject({ accountId: '', apiToken: '', request: async () => { calls++; } }));
  assert.equal(calls, 0);
  await assert.rejects(ensureProject({ ...credentials, request: async () => {
    throw new Error(`request failed with ${credentials.apiToken}`);
  } }), error => !error.message.includes(credentials.apiToken));
});
