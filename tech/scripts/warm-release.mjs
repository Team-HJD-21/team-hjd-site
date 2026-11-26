import { appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Use an already-running worker clock, not a second cron event, to reach 11:57.
// This helper has no mail client, publication write or network request.
export function warmPlan(request, now = new Date()) {
  if (!request || request.dryRun === true || request.allowLate === true) return { waitMs: 0, state: 'no_wait' };
  if (request.dryRun !== false || request.allowLate !== false) throw new Error('Explicit request booleans required.');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  if (request.date !== today) throw new Error('Armed release cannot cross a Seoul date.');
  const target = Date.parse(`${today}T11:57:00+09:00`), expires = Date.parse(request.expiresAt);
  if (!Number.isFinite(expires) || expires <= now.getTime()) throw new Error('Arming request has expired.');
  const waitMs = Math.max(0, target - now.getTime());
  if (waitMs > 3600000 || expires <= target + 60000) throw new Error('Arming approval must remain valid through 11:58; create it after 11:00.');
  return { state: waitMs ? 'armed' : 'ready', waitMs, target: new Date(target).toISOString(), issueId: request.issueId };
}

export function contentWarmRequest(issues, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  if (issues.some(issue => issue.date === today && issue.status === 'published')) return null;
  const ready = issues.filter(issue => issue.date === today && issue.status === 'scheduled');
  if (ready.length > 1) throw new Error('Multiple scheduled issues for the current Seoul date.');
  if (!ready.length || Date.parse(ready[0].publishAt) - now.getTime() > 3600000) return null;
  return { date: today, issueId: ready[0].id, dryRun: false, allowLate: false, expiresAt: `${today}T23:59:59.999+09:00` };
}

export async function waitForRelease(request, { clock = () => Date.now(), pause = ms => new Promise(r => setTimeout(r, ms)), report = () => {} } = {}) {
  let lastReport = -Infinity;
  for (;;) {
    const current = clock(), plan = warmPlan(request, new Date(current));
    if (current - lastReport >= 300000 || plan.waitMs === 0) { report(plan); lastReport = current; }
    if (!plan.waitMs) return plan;
    await pause(Math.min(plan.waitMs, 15000));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const project = fileURLToPath(new URL('../', import.meta.url));
  const { contextFromEvent, planRelease } = await import('./release.mjs');
  const context = await contextFromEvent(project);
  let request = context.recovery;
  if (context.validatedRun) {
    const { loadContent } = await import('./content.mjs');
    const { allIssues } = await loadContent(project);
    planRelease(allIssues);
    request = contentWarmRequest(allIssues);
  }
  if (context.recovery && context.write && !context.recovery.allowLate) {
    const { loadContent } = await import('./content.mjs');
    const { allIssues } = await loadContent(project);
    planRelease(allIssues, new Date(), { recovery: context.recovery });
  }
  const initial = warmPlan(request);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `## 사전 기동\n\n${JSON.stringify(initial)}\n\n대기 자체는 공개·메일 발송이 아닙니다.\n`);
  await waitForRelease(request, { report: plan => console.log(JSON.stringify({ warmRelease: plan, actualUtc: new Date().toISOString() })) });
}
