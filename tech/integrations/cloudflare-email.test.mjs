import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { CloudflareClient, classifyDelivery, run, validateStateDir } from './cloudflare-email.mjs';

const ACCOUNT = 'a'.repeat(32);
const FIRST = 'reader-one@example.test';
const SECOND = 'reader-two@example.test';
const VERIFIED = '2026-11-01T00:00:00Z';
const ISSUE = { id: 'issue-001', title: '예측과 보정', url: 'https://example.test/issues/001/', summary: '클라이언트 예측을 살펴봅니다.' };
const response = (result, extra = {}) => new Response(JSON.stringify({ success: true, result, ...extra }), { status: 200 });

async function fixture(t, { verified = true, onSend } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'frame-one-email-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const issue = join(directory, 'issue.json');
  await writeFile(issue, JSON.stringify(ISSUE));
  const env = { CLOUDFLARE_ACCOUNT_ID: ACCOUNT, CLOUDFLARE_API_TOKEN: 'unit-test-placeholder', BOOTSTRAP_RECIPIENT: FIRST, SECOND_RECIPIENT: SECOND, NEWSLETTER_FROM: 'newsletter@example.test', NEWSLETTER_STATE_DIR: join(directory, 'private-state') };
  const destinations = [{ id: 'destination-one', email: FIRST, verified: verified ? VERIFIED : null }, { id: 'destination-two', email: SECOND, verified: VERIFIED }];
  const requests = [];
  const fetchImpl = async (url, request) => {
    const parsed = new URL(url);
    const body = request.body ? JSON.parse(request.body) : null;
    const call = { url: parsed, method: request.method, body };
    requests.push(call);
    assert.equal(parsed.origin, 'https://api.cloudflare.com');
    assert.equal(request.redirect, 'error');
    if (parsed.pathname.endsWith('/email/sending/send')) {
      assert.equal(request.method, 'POST');
      return onSend ? onSend(call) : response({ delivered: [], queued: [body.to], permanent_bounces: [] });
    }
    if (parsed.pathname.endsWith('/email/routing/addresses')) {
      if (request.method === 'GET') return response(destinations, { result_info: { total_pages: 1 } });
      const address = { id: `destination-${destinations.length + 1}`, email: body.email, verified: null };
      destinations.push(address);
      return response(address);
    }
    const address = destinations.find((item) => parsed.pathname.endsWith(`/${item.id}`));
    assert.ok(address, 'Only expected destination endpoints may be requested.');
    assert.equal(request.method, 'GET');
    return response(address);
  };
  const invoke = (command, options = {}) => run(command, options, { env, fetchImpl });
  const activate = async (emailEnv) => {
    await invoke('register', emailEnv ? { emailEnv } : {});
    await invoke('activate', emailEnv ? { emailEnv } : {});
  };
  return { directory, issue, env, requests, destinations, invoke, activate, sends: () => requests.filter((item) => item.url.pathname.endsWith('/email/sending/send')) };
}

test('dry run needs no credentials, performs no network calls, and writes no state', async (t) => {
  const f = await fixture(t);
  const before = await readdir(f.directory, { recursive: true });
  const result = await run('send', { issue: f.issue, dryRun: true }, { env: {}, fetchImpl: () => { throw new Error('A dry run must not call fetch.'); } });
  assert.equal(result.delivery, 'not_attempted');
  assert.equal(result.verification, 'not_checked');
  assert.equal(result.networkRequests, 0);
  assert.equal(result.stateWrites, 0);
  assert.deepEqual(await readdir(f.directory, { recursive: true }), before);
});

test('registration is inactive and activation fails until Cloudflare verifies the address', async (t) => {
  const f = await fixture(t, { verified: false });
  const registered = await f.invoke('register');
  assert.equal(registered.active, false);
  assert.equal(registered.cloudflareVerified, false);
  await assert.rejects(f.invoke('activate'), /finish Cloudflare email verification/);
  assert.equal((await f.invoke('send', { issue: f.issue })).reason, 'no_active_recipients');
  assert.equal(f.sends().length, 0);
  f.destinations[0].verified = VERIFIED;
  assert.equal((await f.invoke('activate')).active, true);
});

test('new recipient registration calls the real documented create shape once', async (t) => {
  const f = await fixture(t);
  f.destinations.splice(0, 1);
  const registered = await f.invoke('register');
  assert.equal(registered.cloudflareVerified, false);
  await f.invoke('register');
  const creates = f.requests.filter((item) => item.method === 'POST');
  assert.equal(creates.length, 1);
  assert.equal(creates[0].url.pathname, `/client/v4/accounts/${ACCOUNT}/email/routing/addresses`);
  assert.deepEqual(creates[0].body, { email: FIRST });
});

test('only newsletter-active recipients are selected; Cloudflare verification is checked again before sending', async (t) => {
  const f = await fixture(t);
  await f.activate();
  f.destinations[0].verified = null;
  const blocked = await f.invoke('send', { issue: f.issue });
  assert.equal(blocked.recipients[0].reason, 'not_verified_by_cloudflare');
  assert.equal(f.sends().length, 0);
  f.destinations[0].verified = VERIFIED;
  const result = await f.invoke('send', { issue: f.issue });
  assert.equal(result.recipients[0].status, 'queued');
  assert.equal(f.sends().length, 1);
  assert.equal(f.sends()[0].body.to, FIRST);
  assert.equal(f.sends()[0].body.cc, undefined);
  assert.equal(f.sends()[0].body.bcc, undefined);
});

test('a queued receipt prevents repeat POSTs without claiming inbox arrival', async (t) => {
  const f = await fixture(t);
  await f.activate();
  const first = await f.invoke('send', { issue: f.issue });
  const second = await f.invoke('send', { issue: f.issue });
  assert.equal(first.recipients[0].apiAccepted, true);
  assert.equal(first.recipients[0].inboxConfirmed, false);
  assert.equal(second.recipients[0].previousStatus, 'queued');
  assert.equal(f.sends().length, 1);
});

test('issue and recipient identities are independent and edited content conflicts', async (t) => {
  const f = await fixture(t);
  await f.activate();
  await f.invoke('send', { issue: f.issue });
  await f.activate('SECOND_RECIPIENT');
  const anotherRecipient = await f.invoke('send', { issue: f.issue });
  assert.deepEqual(anotherRecipient.recipients.map((item) => item.status), ['skipped', 'queued']);
  assert.equal(f.sends().length, 2);
  await writeFile(f.issue, JSON.stringify({ ...ISSUE, summary: '수정된 내용' }));
  const changed = await f.invoke('send', { issue: f.issue });
  assert.equal(changed.reason, 'issue_identity_or_content_conflict');
  assert.equal(f.sends().length, 2);
  await writeFile(f.issue, JSON.stringify({ ...ISSUE, id: 'issue-002' }));
  await f.invoke('send', { issue: f.issue });
  assert.equal(f.sends().length, 4);
});

test('a lost POST response leaves an uncertain receipt and does not retry', async (t) => {
  const f = await fixture(t, { onSend: () => { throw new TypeError('Simulated network loss after possible acceptance.'); } });
  await f.activate();
  const first = await f.invoke('send', { issue: f.issue });
  assert.equal(first.recipients[0].status, 'uncertain');
  assert.equal(first.recipients[0].apiAccepted, null);
  await f.invoke('send', { issue: f.issue });
  const { receipt } = await f.invoke('receipt', { issueId: ISSUE.id });
  assert.equal(receipt.status, 'uncertain');
  assert.equal(f.sends().length, 1);
});

test('explicit API rejection is recorded and never presented as sending success', async (t) => {
  const f = await fixture(t, { onSend: () => new Response(JSON.stringify({ success: false, errors: [{ code: 10105, message: 'not entitled' }], result: null }), { status: 403 }) });
  await f.activate();
  const result = await f.invoke('send', { issue: f.issue });
  assert.equal(result.recipients[0].status, 'rejected');
  assert.equal(result.recipients[0].apiAccepted, false);
  await f.invoke('send', { issue: f.issue });
  assert.equal(f.sends().length, 1);
});

test('response groups distinguish provider delivery, queues and bounces and reject ambiguity', () => {
  assert.equal(classifyDelivery({ delivered: [FIRST], queued: [], permanent_bounces: [] }, FIRST), 'provider_delivered');
  assert.equal(classifyDelivery({ delivered: [], queued: [], permanent_bounces: [FIRST] }, FIRST), 'permanent_bounce');
  assert.throws(() => classifyDelivery({ delivered: [FIRST], queued: [FIRST], permanent_bounces: [] }, FIRST));
  assert.throws(() => classifyDelivery({ delivered: [SECOND], queued: [], permanent_bounces: [] }, FIRST));
  assert.throws(() => classifyDelivery({ delivered: [], queued: [], permanent_bounces: [] }, FIRST));
});

test('Cloudflare pagination finds the requested mailbox beyond the first 50 results', async () => {
  const pages = [];
  const client = new CloudflareClient({ accountId: ACCOUNT, token: 'unit-test-placeholder', fetchImpl: async (url) => {
    const parsed = new URL(url);
    pages.push(parsed.searchParams.get('page'));
    assert.equal(parsed.searchParams.get('per_page'), '50');
    return response(pages.length === 1 ? Array.from({ length: 50 }, (_, i) => ({ id: `id-${i}`, email: `other${i}@example.test`, verified: VERIFIED })) : [{ id: 'target', email: FIRST, verified: VERIFIED }], { result_info: { total_pages: 2 } });
  } });
  assert.equal((await client.findDestination(FIRST)).id, 'target');
  assert.deepEqual(pages, ['1', '2']);
});

test('state cannot be placed in the public project, including through a symlink', async (t) => {
  const f = await fixture(t);
  const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  await assert.rejects(validateStateDir(join(project, 'private-state')), /public project/);
  const alias = join(f.directory, 'project-link');
  await symlink(project, alias, 'dir');
  await assert.rejects(validateStateDir(join(alias, 'private-state')), /public project/);
});

test('a second process cannot race an in-flight send', async (t) => {
  let notifyStarted;
  let release;
  const started = new Promise((done) => { notifyStarted = done; });
  const gate = new Promise((done) => { release = done; });
  const f = await fixture(t, { onSend: async ({ body }) => {
    notifyStarted();
    await gate;
    return response({ delivered: [body.to], queued: [], permanent_bounces: [] });
  } });
  await f.activate();
  const first = f.invoke('send', { issue: f.issue });
  await started;
  try { await assert.rejects(f.invoke('send', { issue: f.issue }), /newsletter.lock/); }
  finally { release(); }
  assert.equal((await first).recipients[0].status, 'provider_delivered');
  assert.equal(f.sends().length, 1);
});

test('deactivation removes a recipient from sending without deleting shared Cloudflare destinations', async (t) => {
  const f = await fixture(t);
  await f.activate();
  const requestsBefore = f.requests.length;
  await f.invoke('deactivate');
  assert.equal(f.requests.length, requestsBefore);
  assert.equal((await f.invoke('send', { issue: f.issue })).reason, 'no_active_recipients');
  const state = JSON.parse(await readFile(join(f.env.NEWSLETTER_STATE_DIR, 'recipients.json'), 'utf8'));
  assert.equal(Object.values(state.recipients)[0].active, false);
});

test('an account switch or destination identity mismatch fails closed', async (t) => {
  const f = await fixture(t);
  await f.activate();
  f.env.CLOUDFLARE_ACCOUNT_ID = 'b'.repeat(32);
  await assert.rejects(f.invoke('send', { issue: f.issue }), /another account/);
  f.env.CLOUDFLARE_ACCOUNT_ID = ACCOUNT;
  f.destinations[0].email = SECOND;
  const result = await f.invoke('send', { issue: f.issue });
  assert.equal(result.recipients[0].reason, 'verification_failed');
  assert.equal(f.sends().length, 0);
});
