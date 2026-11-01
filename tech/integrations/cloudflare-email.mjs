#!/usr/bin/env node
// Node 20.11+; no dependencies. All live requests use Cloudflare's documented API.
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, realpath, rename, rm, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API_ROOT = 'https://api.cloudflare.com/client/v4';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();

export function normalizeEmail(value) {
  if (typeof value !== 'string') throw new Error('A recipient email environment variable is required.');
  const email = value.trim().toLowerCase();
  // Deliberately accept only plain mailbox addresses, not display names or headers.
  if (email.length > 90 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/i.test(email)) {
    throw new Error('Use a plain ASCII email address (maximum 90 characters).');
  }
  return email;
}

export const recipientId = (email) => hash(normalizeEmail(email));

export function validateIssue(input) {
  if (!input || !/^[a-z0-9][a-z0-9._-]{0,79}$/.test(input.id ?? '')) {
    throw new Error('Issue id must be a stable lowercase identifier, up to 80 characters.');
  }
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 180 || /[\r\n]/.test(input.title)) {
    throw new Error('Issue title must be one line, from 1 to 180 characters.');
  }
  if (typeof input.summary !== 'string' || !input.summary.trim() || input.summary.length > 4000) {
    throw new Error('Issue summary must contain 1 to 4000 characters.');
  }
  let url;
  try { url = new URL(input.url); } catch { throw new Error('Issue url must be an absolute HTTPS URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Issue url must be an absolute HTTPS URL without credentials.');
  return { id: input.id, title: input.title.trim(), url: url.href, summary: input.summary.trim() };
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function messageFor(issue, from) {
  return {
    from: normalizeEmail(from),
    subject: `[겜붕이의 노트] ${issue.title}`,
    text: `${issue.title}\n\n${issue.summary}\n\n전체 읽기: ${issue.url}\n\nFRAME/ONE · ${issue.id}`,
    html: `<main><p>FRAME/ONE · ${escapeHtml(issue.id)}</p><h1>${escapeHtml(issue.title)}</h1><p>${escapeHtml(issue.summary).replace(/\n/g, '<br>')}</p><p><a href="${escapeHtml(issue.url)}">전체 읽기</a></p></main>`,
  };
}

export class CloudflareError extends Error {
  constructor(message, { status = null, codes = [], uncertain = true } = {}) {
    super(message);
    this.status = status;
    this.codes = codes;
    this.uncertain = uncertain;
  }
}

export class CloudflareClient {
  constructor({ accountId, token, fetchImpl = globalThis.fetch }) {
    if (!/^[a-f0-9]{32}$/i.test(accountId ?? '')) throw new Error('CLOUDFLARE_ACCOUNT_ID must be a 32-character account identifier.');
    if (!token?.trim()) throw new Error('CLOUDFLARE_API_TOKEN is required for live API access.');
    this.accountId = accountId;
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  async request(method, suffix, body) {
    let response;
    try {
      response = await this.fetchImpl(`${API_ROOT}/accounts/${this.accountId}${suffix}`, {
        method,
        redirect: 'error',
        headers: { Authorization: `Bearer ${this.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new CloudflareError('Cloudflare transport failed; a POST may have been accepted. No automatic retry.');
    }
    let data;
    try { data = await response.json(); } catch {
      throw new CloudflareError('Cloudflare returned an unreadable response; delivery is unknown.', { status: response.status });
    }
    if (!response.ok || data?.success !== true) {
      // API error text can contain addresses. Store only HTTP status and numeric codes.
      const codes = Array.isArray(data?.errors) ? data.errors.map((error) => error.code).filter(Number.isFinite) : [];
      const uncertain = ![400, 401, 403, 404, 429].includes(response.status);
      throw new CloudflareError(`Cloudflare rejected or could not confirm the request (HTTP ${response.status}; codes ${codes.join(',') || 'none'}).`, { status: response.status, codes, uncertain });
    }
    return data;
  }

  async findDestination(email) {
    for (let page = 1; page <= 100; page++) {
      const data = await this.request('GET', `/email/routing/addresses?page=${page}&per_page=50`);
      if (!Array.isArray(data.result)) throw new Error('Cloudflare destination list has an unexpected format.');
      const found = data.result.find((address) => typeof address.email === 'string' && address.email.toLowerCase() === email);
      if (found) return found;
      const pages = data.result_info?.total_pages;
      if (Number.isInteger(pages) ? page >= pages : data.result.length < 50) return null;
    }
    throw new Error('Destination pagination limit reached; no recipient was selected.');
  }

  async createDestination(email) {
    return (await this.request('POST', '/email/routing/addresses', { email })).result;
  }

  async getDestination(id) {
    if (!/^[a-z0-9_-]{1,64}$/i.test(id ?? '')) throw new Error('Invalid destination identifier in local state.');
    return (await this.request('GET', `/email/routing/addresses/${encodeURIComponent(id)}`)).result;
  }

  async send(message) {
    return (await this.request('POST', '/email/sending/send', message)).result;
  }
}

function verifiedDestination(address, email) {
  if (!address || normalizeEmail(address.email) !== email || !/^[a-z0-9_-]{1,64}$/i.test(address.id ?? '')) {
    throw new Error('Cloudflare destination identity does not match the selected recipient.');
  }
  return typeof address.verified === 'string' && Number.isFinite(Date.parse(address.verified));
}

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error('Private newsletter state is unreadable; no send will be attempted.');
  }
}

async function writeExclusive(path, value) {
  const handle = await open(path, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    await handle.sync();
  } finally { await handle.close(); }
  await syncDirectory(dirname(path));
}

async function syncDirectory(path) {
  const handle = await open(path, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

async function writeAtomic(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeExclusive(temporary, value);
    await rename(temporary, path);
    await syncDirectory(dirname(path));
  } finally { await rm(temporary, { force: true }); }
}

// Resolve existing ancestors too, so a symlink cannot quietly put private state in Git.
async function canonicalPath(path) {
  try { return await realpath(path); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const parent = dirname(path);
    if (parent === path) throw error;
    return join(await canonicalPath(parent), path.slice(parent.length + (parent.endsWith(sep) ? 0 : 1)));
  }
}

export async function validateStateDir(value) {
  if (typeof value !== 'string' || !isAbsolute(value)) throw new Error('NEWSLETTER_STATE_DIR must be an absolute private directory outside the project.');
  const path = await canonicalPath(resolve(value));
  let project = await canonicalPath(PROJECT_ROOT);
  // The integration may be mirrored under a subdirectory of a larger Git repository.
  for (let ancestor = project; ; ancestor = dirname(ancestor)) {
    try { await stat(join(ancestor, '.git')); project = ancestor; break; } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (dirname(ancestor) === ancestor) break;
  }
  const relation = relative(project, path);
  if (!relation || (!relation.startsWith(`..${sep}`) && relation !== '..' && !isAbsolute(relation))) {
    throw new Error('NEWSLETTER_STATE_DIR cannot be inside the public project.');
  }
  return path;
}

async function withLock(stateDir, action) {
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  const lock = join(stateDir, 'newsletter.lock');
  try { await writeExclusive(lock, { pid: process.pid, createdAt: now() }); } catch (error) {
    if (error.code === 'EEXIST') throw new Error('Another operation or an interrupted operation holds newsletter.lock. Review state before clearing a stale lock.');
    throw error;
  }
  try { return await action(); } finally { await rm(lock); }
}

async function readRecipients(config) {
  const state = await readJson(join(config.stateDir, 'recipients.json'), { version: 1, accountId: config.accountId, recipients: {} });
  if (state.version !== 1 || state.accountId !== config.accountId || !state.recipients || typeof state.recipients !== 'object' || Array.isArray(state.recipients)) {
    throw new Error('Recipient state belongs to another account or has an invalid schema.');
  }
  for (const [id, record] of Object.entries(state.recipients)) {
    if (!record || id !== recipientId(record.email) || typeof record.active !== 'boolean' || typeof record.destinationId !== 'string') {
      throw new Error('Recipient state has an invalid entry.');
    }
  }
  return state;
}

function selectedEmail(env, options) {
  const name = options.emailEnv ?? 'BOOTSTRAP_RECIPIENT';
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) throw new Error('--email-env must name an uppercase environment variable.');
  return normalizeEmail(env[name]);
}

function receiptPath(config, issueId, email) {
  return join(config.stateDir, 'receipts', `${hash(`${config.accountId}\0${issueId}\0${email}`)}.json`);
}

export function classifyDelivery(result, email) {
  const names = ['delivered', 'queued', 'permanent_bounces'];
  if (!result || names.some((name) => !Array.isArray(result[name]))) throw new Error('Unexpected delivery response.');
  const matches = names.filter((name) => result[name].some((value) => typeof value === 'string' && value.toLowerCase() === email));
  const other = names.some((name) => result[name].some((value) => typeof value !== 'string' || value.toLowerCase() !== email));
  if (matches.length !== 1 || other) throw new Error('Delivery response does not uniquely identify the selected recipient.');
  return { delivered: 'provider_delivered', queued: 'queued', permanent_bounces: 'permanent_bounce' }[matches[0]];
}

async function sendIssue(config, client, issue) {
  const state = await readRecipients(config);
  const active = Object.entries(state.recipients).filter(([, record]) => record.active === true);
  if (!active.length) return { issueId: issue.id, status: 'blocked', reason: 'no_active_recipients', recipients: [] };
  const message = messageFor(issue, config.from);
  const contentHash = hash(JSON.stringify(message));
  await mkdir(join(config.stateDir, 'issues'), { recursive: true, mode: 0o700 });
  const issuePath = join(config.stateDir, 'issues', `${hash(`${config.accountId}\0${issue.id}`)}.json`);
  const published = await readJson(issuePath, null);
  if (published && (published.accountId !== config.accountId || published.issueId !== issue.id || published.contentHash !== contentHash)) {
    return { issueId: issue.id, status: 'blocked', reason: 'issue_identity_or_content_conflict', recipients: [] };
  }
  if (!published) await writeExclusive(issuePath, { version: 1, accountId: config.accountId, issueId: issue.id, contentHash, recordedAt: now() });
  await mkdir(join(config.stateDir, 'receipts'), { recursive: true, mode: 0o700 });
  await syncDirectory(config.stateDir);
  const recipients = [];
  for (const [id, record] of active) {
    const path = receiptPath(config, issue.id, record.email);
    const previous = await readJson(path, null);
    if (previous) {
      if (previous.accountId !== config.accountId || previous.issueId !== issue.id || previous.recipientId !== id || previous.contentHash !== contentHash) {
        recipients.push({ recipientId: id, status: 'blocked', reason: 'receipt_identity_or_content_conflict' });
      } else {
        recipients.push({ recipientId: id, status: 'skipped', reason: 'existing_receipt', previousStatus: previous.status });
      }
      continue;
    }
    try {
      const destination = await client.getDestination(record.destinationId);
      if (!verifiedDestination(destination, record.email)) {
        recipients.push({ recipientId: id, status: 'blocked', reason: 'not_verified_by_cloudflare' });
        continue;
      }
    } catch (error) {
      recipients.push({ recipientId: id, status: 'blocked', reason: 'verification_failed', detail: error.message });
      continue;
    }
    const receipt = { version: 1, accountId: config.accountId, issueId: issue.id, recipientId: id, contentHash, destinationId: record.destinationId, status: 'pending', startedAt: now(), apiAccepted: null, inboxConfirmed: false };
    // Persist intent before POST. A lost response or crash must never trigger a blind resend.
    await writeExclusive(path, receipt);
    try {
      const result = await client.send({ ...message, to: record.email });
      receipt.status = classifyDelivery(result, record.email);
      receipt.apiAccepted = true;
    } catch (error) {
      receipt.status = error instanceof CloudflareError && !error.uncertain ? 'rejected' : 'uncertain';
      receipt.apiAccepted = receipt.status === 'rejected' ? false : null;
      receipt.httpStatus = error instanceof CloudflareError ? error.status : null;
      receipt.errorCodes = error instanceof CloudflareError ? error.codes : [];
    }
    receipt.updatedAt = now();
    await writeAtomic(path, receipt);
    recipients.push({ recipientId: id, status: receipt.status, apiAccepted: receipt.apiAccepted, inboxConfirmed: false });
  }
  return { issueId: issue.id, recipients };
}

export async function run(command, options = {}, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const allowed = ['register', 'check', 'activate', 'deactivate', 'send', 'receipt'];
  if (!allowed.includes(command)) throw new Error('Unknown command. Run with --help.');
  const issue = command === 'send' ? validateIssue(JSON.parse(await readFile(options.issue, 'utf8'))) : null;
  const email = command === 'send' ? null : selectedEmail(env, options);
  if (options.dryRun) {
    // No network, filesystem writes, verification claim, or delivery claim in this branch.
    return { mode: 'dry-run', command, issue, ...(email ? { recipientId: recipientId(email) } : {}), networkRequests: 0, stateWrites: 0, verification: 'not_checked', delivery: 'not_attempted', configured: Object.fromEntries(['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN', 'NEWSLETTER_FROM', 'NEWSLETTER_STATE_DIR'].map((key) => [key, Boolean(env[key])])) };
  }
  const config = { accountId: env.CLOUDFLARE_ACCOUNT_ID, token: env.CLOUDFLARE_API_TOKEN, from: env.NEWSLETTER_FROM, stateDir: await validateStateDir(env.NEWSLETTER_STATE_DIR) };
  if (!/^[a-f0-9]{32}$/i.test(config.accountId ?? '')) throw new Error('CLOUDFLARE_ACCOUNT_ID must be a 32-character account identifier.');
  if (command === 'receipt') {
    if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(options.issueId ?? '')) throw new Error('receipt requires --issue-id.');
    const receipt = await readJson(receiptPath(config, options.issueId, email), null);
    return { receipt };
  }
  const client = command === 'deactivate' ? null : new CloudflareClient({ ...config, fetchImpl });
  if (command === 'check') {
    const state = await readRecipients(config);
    const record = state.recipients[recipientId(email)];
    const address = record ? await client.getDestination(record.destinationId) : await client.findDestination(email);
    return { recipientId: recipientId(email), registeredForNewsletter: Boolean(record), active: record?.active ?? false, cloudflareVerified: address ? verifiedDestination(address, email) : false };
  }
  return withLock(config.stateDir, async () => {
    if (command === 'send') return sendIssue(config, client, issue);
    const state = await readRecipients(config);
    const id = recipientId(email);
    let record = state.recipients[id];
    let verified = null;
    if (command === 'register') {
      const address = record ? await client.getDestination(record.destinationId) : (await client.findDestination(email) ?? await client.createDestination(email));
      verified = verifiedDestination(address, email);
      record = { email, destinationId: address.id, active: record?.active ?? false, registeredAt: record?.registeredAt ?? now() };
      state.recipients[id] = record;
    } else {
      if (!record) throw new Error('Register this recipient for the newsletter first.');
      if (command === 'activate') {
        verified = verifiedDestination(await client.getDestination(record.destinationId), email);
        if (!verified) throw new Error('The recipient must finish Cloudflare email verification before activation.');
        record.active = true;
      } else record.active = false;
    }
    await writeAtomic(join(config.stateDir, 'recipients.json'), state);
    return { recipientId: id, active: record.active, cloudflareVerified: verified, ...(command === 'register' ? { next: verified ? 'activate' : 'complete_cloudflare_verification_then_activate' } : {}) };
  });
}

const HELP = `FRAME/ONE Cloudflare email integration (Node 20.11+)\n\nCommands:\n  register [--email-env BOOTSTRAP_RECIPIENT] [--dry-run]\n  check [--email-env BOOTSTRAP_RECIPIENT]\n  activate [--email-env BOOTSTRAP_RECIPIENT] [--dry-run]\n  deactivate [--email-env BOOTSTRAP_RECIPIENT] [--dry-run]\n  send --issue /absolute/path/issue.json [--dry-run]\n  receipt --issue-id stable-issue-id [--email-env BOOTSTRAP_RECIPIENT]\n\nLive commands require private runtime configuration; see integrations/README.md.\nDry run never calls Cloudflare, writes state, verifies an address, or sends mail.\n`;

export function parseArgs(args) {
  const [command, ...rest] = args;
  const options = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--dry-run') options.dryRun = true;
    else if (['--issue', '--email-env', '--issue-id'].includes(rest[i]) && rest[i + 1] && !rest[i + 1].startsWith('--')) {
      const name = { '--issue': 'issue', '--email-env': 'emailEnv', '--issue-id': 'issueId' }[rest[i]];
      options[name] = rest[++i];
    } else throw new Error('Unknown or incomplete option. Run with --help.');
  }
  if (command === 'send' && !options.issue) throw new Error('send requires --issue with a JSON file path.');
  return { command, options };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (!process.argv[2] || ['--help', '-h', 'help'].includes(process.argv[2])) process.stdout.write(HELP);
    else {
      const { command, options } = parseArgs(process.argv.slice(2));
      const result = await run(command, options);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      if (result.status === 'blocked' || result.recipients?.some((item) => !['provider_delivered', 'queued'].includes(item.status) && !(item.status === 'skipped' && ['provider_delivered', 'queued'].includes(item.previousStatus)))) process.exitCode = 2;
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
