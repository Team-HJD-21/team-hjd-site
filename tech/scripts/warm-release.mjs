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
  if (now.getTime() > Date.parse(`${today}T12:30:59+09:00`)) throw new Error('Automatic release window has ended.');
  const waitMs = Math.max(0, target - now.getTime());
  if (waitMs > 3600000 || expires <= target + 60000) throw new Error('Arming approval must remain valid through 11:58; create it after 11:00.');
  return { state: waitMs ? 'armed' : 'ready', waitMs, target: new Date(target).toISOString(), issueId: request.issueId };
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
  if (context.recovery && context.write && !context.recovery.allowLate) {
    const { loadContent } = await import('./content.mjs');
    const { allIssues } = await loadContent(project);
    planRelease(allIssues, new Date(), { recovery: context.recovery });
  }
  const initial = warmPlan(context.recovery);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `## 사전 기동\n\n${JSON.stringify(initial)}\n\n대기 자체는 공개·메일 발송이 아닙니다.\n`);
  await waitForRelease(context.recovery, { report: plan => console.log(JSON.stringify({ warmRelease: plan, actualUtc: new Date().toISOString() })) });
}
