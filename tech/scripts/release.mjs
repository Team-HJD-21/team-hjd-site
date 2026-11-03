import { appendFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { loadContent } from './content.mjs';

export function planRelease(issues, now = new Date()) {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid release clock.');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(({ type, value }) => [type, value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const alreadyPublished = issues.filter((issue) => issue.date === today && issue.status === 'published');
  if (minutes < 11 * 60 + 57) return { state: 'before_release_time', today, ids: [] };
  if (alreadyPublished.length > 1) throw new Error(`Multiple published issues for ${today}.`);
  if (alreadyPublished.length) return { state: 'already_published', today, ids: alreadyPublished.map(issue=>issue.id) };
  if (minutes > 750) throw new Error(`Release window ended for ${today}; no previous issue is republished.`);
  const ready = issues.filter((issue) => issue.status === 'scheduled' && issue.date === today && Date.parse(issue.publishAt) <= now.getTime());
  if (ready.length > 1) throw new Error(`Multiple scheduled issues for ${today}; select one issue containing the day's articles.`);
  return { state: ready.length ? 'ready' : 'not_ready', today, ids: ready.map((issue) => issue.id) };
}

export async function release({ project, write = false, now = new Date() }) {
  const { allIssues } = await loadContent(project);
  const plan = planRelease(allIssues, now);
  if (write && plan.state === 'not_ready') throw new Error(`No scheduled issue is ready for ${plan.today}.`);
  const changed = write && plan.state === 'ready';
  if (changed) {
    for (const issue of allIssues) if (plan.ids.includes(issue.id)) { issue.status = 'published'; issue.publishedAt = now.toISOString(); }
    await writeFile(join(project, 'content/issues.json'), `${JSON.stringify(allIssues, null, 2)}\n`);
  }
  return { ...plan, changed, dryRun: !write };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--write', '--check'].includes(arg)) || args.includes('--write') && args.includes('--check')) throw new Error('Use --check or --write.');
  const result = await release({ project: fileURLToPath(new URL('../', import.meta.url)), write: args.includes('--write') });
  console.log(JSON.stringify(result));
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${result.changed}\nissue_ids=${result.ids.join(',')}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `## 뉴스레터 웹 발행\n\n${JSON.stringify(result)}\n\n이 결과는 메일 발송 결과가 아닙니다.\n`);
}
