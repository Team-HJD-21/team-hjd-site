import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

export const REQUEST_PATH = 'tech/operations/release-request.json';
const REPOSITORY = 'Team-HJD-21/team-hjd-site';
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA = /^[a-f0-9]{40}$/;
const fail = message => { throw new Error(message); };
const seoulParts = now => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
}).formatToParts(now).map(({ type, value }) => [type, value]));
const seoulDate = now => { const p = seoulParts(now); return `${p.year}-${p.month}-${p.day}`; };

// An approval is short-lived, names one existing issue, and never carries recipients or secrets.
export function validateRecovery(request, now = new Date()) {
  if (!Number.isFinite(now.getTime())) fail('Invalid release clock.');
  if (!request || typeof request !== 'object' || Array.isArray(request)) fail('Missing recovery approval.');
  const allowed = new Set(['version', 'requestId', 'date', 'issueId', 'reason', 'requestedAt', 'expiresAt', 'allowLate', 'dryRun', 'confirm', 'expectedBaseSha']);
  if (Object.keys(request).some(key => !allowed.has(key))) fail('Unexpected recovery field; recipients and mail content are not accepted.');
  if (request.version !== 1 || typeof request.requestId !== 'string' || !/^[a-z0-9][a-z0-9-]{7,79}$/.test(request.requestId)) fail('Invalid recovery request ID.');
  if (request.date !== seoulDate(now)) fail('Recovery is limited to the current Seoul date.');
  if (typeof request.issueId !== 'string' || request.issueId.length > 80 || !ID.test(request.issueId)) fail('Invalid recovery issue ID.');
  if (typeof request.reason !== 'string' || request.reason.trim().length < 10 || request.reason.length > 300 || /[\x00-\x1f\x7f]/.test(request.reason)) fail('A single-line recovery reason (10-300 characters) is required.');
  if (typeof request.allowLate !== 'boolean' || typeof request.dryRun !== 'boolean') fail('allowLate and dryRun must be explicit booleans.');
  if (request.confirm !== 'publish-and-send-once') fail('Explicit publish-and-send-once confirmation is required.');
  const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
  const start = timestamp(request.requestedAt), end = timestamp(request.expiresAt), current = now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 3600000 || start > current + 60000 || end <= current) fail('Recovery approval expired or exceeds its one-hour lifetime.');
  if (request.expectedBaseSha !== undefined && !SHA.test(request.expectedBaseSha)) fail('Invalid expected base SHA.');
  return { ...request, reason: request.reason.trim() };
}

// A commit-based request is an explicit operator action, not a cron bypass or a PR hook.
// It is accepted only as the sole change on a non-forced main push, against the approved base.
export function validateRecoveryPush({ env, event, request, head, changedPaths }, now = new Date()) {
  if (env.GITHUB_EVENT_NAME !== 'push' || env.GITHUB_REPOSITORY !== REPOSITORY || env.GITHUB_REF !== 'refs/heads/main') fail('Recovery push must be on this repository main branch.');
  if (event.ref !== 'refs/heads/main' || event.deleted || event.forced || event.created || !SHA.test(event.before || '') || !SHA.test(event.after || '') || /^0+$/.test(event.before)) fail('Invalid recovery push event.');
  if (event.after !== env.GITHUB_SHA || head !== event.after) fail('Stale recovery request: main has moved; create a fresh approval.');
  const approved = validateRecovery(request, now);
  if (approved.expectedBaseSha !== event.before) fail('Recovery approval base does not match the push.');
  if (!Array.isArray(changedPaths) || changedPaths.length !== 1 || changedPaths[0] !== REQUEST_PATH) fail('A recovery request must be committed separately from code or content changes.');
  return approved;
}

export function planRelease(issues, now = new Date(), { recovery = null } = {}) {
  if (!Number.isFinite(now.getTime())) fail('Invalid release clock.');
  const parts = seoulParts(now), today = `${parts.year}-${parts.month}-${parts.day}`;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const approval = recovery ? validateRecovery(recovery, now) : null;
  const published = issues.filter(issue => issue.date === today && issue.status === 'published');
  if (published.length > 1) fail(`Multiple published issues for ${today}.`);
  if (approval) {
    const target = issues.find(issue => issue.id === approval.issueId && issue.date === today);
    if (!target || !['scheduled', 'published'].includes(target.status)) fail('Recovery target must be an existing scheduled or published issue for today.');
    if (published.length && published[0].id !== approval.issueId) fail('A different issue is already published today; recovery cannot create a second issue.');
  }
  if (minutes < 11 * 60 + 57) return { state: 'before_release_time', today, ids: [] };
  // Repeating delivery uses exactly the original issue ID and existing server-side receipts.
  if (published.length) return { state: 'already_published', today, ids: published.map(issue => issue.id) };
  if (minutes > 750 && !approval?.allowLate) fail(`Release window ended for ${today}; explicit same-day manual recovery is required. No previous issue is republished.`);
  const ready = issues.filter(issue => issue.status === 'scheduled' && issue.date === today && Date.parse(issue.publishAt) <= now.getTime());
  if (ready.length > 1) fail(`Multiple scheduled issues for ${today}; select one issue containing the day's articles.`);
  if (approval && ready.length && ready[0].id !== approval.issueId) fail('Prepared issue does not match the recovery approval.');
  return { state: ready.length ? 'ready' : 'not_ready', today, ids: ready.map(issue => issue.id) };
}

export async function release({ project, write = false, now = new Date(), recovery = null }) {
  const { loadContent } = await import('./content.mjs');
  const { allIssues } = await loadContent(project);
  const plan = planRelease(allIssues, now, { recovery });
  if (write && recovery?.dryRun) fail('Dry-run recovery cannot write a publication.');
  if (write && plan.state === 'not_ready') fail(`No scheduled issue is ready for ${plan.today}.`);
  const changed = write && plan.state === 'ready';
  if (changed) {
    for (const issue of allIssues) if (plan.ids.includes(issue.id)) { issue.status = 'published'; issue.publishedAt = now.toISOString(); }
    await writeFile(join(project, 'content/issues.json'), `${JSON.stringify(allIssues, null, 2)}\n`);
  }
  return { ...plan, changed, dryRun: !write, recovery: recovery ? { requestId: recovery.requestId, issueId: recovery.issueId, allowLate: recovery.allowLate, reason: recovery.reason } : null };
}

export async function contextFromEvent(project, env = process.env, now = new Date()) {
  if (env.GITHUB_REPOSITORY !== REPOSITORY || env.GITHUB_REF !== 'refs/heads/main') fail('Publishing is limited to this repository main branch.');
  const event = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, 'utf8'));
  if (env.GITHUB_EVENT_NAME === 'schedule') return { write: true, recovery: null }; // Never load recovery approvals from cron.
  if (env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    const inputs = event.inputs || {};
    const bool = (value, fallback) => value === undefined ? fallback : value === true || value === 'true' ? true : value === false || value === 'false' ? false : fail('Invalid boolean workflow input.');
    const dryRun = bool(inputs.dry_run, true), allowLate = bool(inputs.allow_late, false);
    const hasTarget = [inputs.recovery_issue_id, inputs.recovery_date, inputs.recovery_reason].some(Boolean);
    if (!allowLate && !hasTarget) return { write: !dryRun, recovery: null };
    const recovery = validateRecovery({ version: 1, requestId: `dispatch-${env.GITHUB_RUN_ID}`, date: inputs.recovery_date, issueId: inputs.recovery_issue_id,
      reason: inputs.recovery_reason, requestedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 3600000).toISOString(), allowLate, dryRun, confirm: 'publish-and-send-once' }, now);
    return { write: !dryRun, recovery };
  }
  if (env.GITHUB_EVENT_NAME === 'push') {
    const raw = await readFile(join(project, 'operations/release-request.json'), 'utf8');
    if (Buffer.byteLength(raw, 'utf8') > 4096) fail('Recovery request exceeds 4 KiB.');
    const git = args => execFileSync('git', args, { cwd: resolve(project, '..'), encoding: 'utf8', maxBuffer: 1024 * 1024 }).trim();
    if (!SHA.test(event.before || '') || !SHA.test(event.after || '')) fail('Invalid push commit SHA.');
    const recovery = validateRecoveryPush({ env, event, request: JSON.parse(raw), head: git(['rev-parse', 'HEAD']),
      changedPaths: git(['diff', '--name-only', event.before, event.after, '--']).split('\n').filter(Boolean) }, now);
    return { write: !recovery.dryRun, recovery };
  }
  fail('Unsupported release event.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), project = fileURLToPath(new URL('../', import.meta.url));
    if (args.length > 1 || args.some(arg => !['--write', '--check', '--from-event'].includes(arg))) fail('Use --check, --write, or --from-event.');
    const options = args[0] === '--from-event' ? await contextFromEvent(project) : { write: args.includes('--write') };
    const result = await release({ project, ...options });
    console.log(JSON.stringify(result));
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${result.changed}\nissue_ids=${result.ids.join(',')}\ndry_run=${result.dryRun}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `## 뉴스레터 웹 발행\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n\n메일 수락과 실제 수신은 별도 확인합니다.\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown release failure';
    console.error(message);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `## 발행 중단\n\n${message}\n\n복구 절차: tech/docs/RECOVERY.md. 발송 기록을 삭제하거나 호 ID를 바꾸지 마세요.\n`);
    process.exitCode = 1;
  }
}
