import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const tests=['scripts/content.test.mjs','scripts/article-html.test.mjs','scripts/release.test.mjs','scripts/delivery-client.test.mjs','scripts/warm-release.test.mjs','scripts/publication-version.test.mjs','scripts/audit-no-send.test.mjs','src/subscriptions.test.mjs','src/monitor.test.mjs','src/feedback.test.mjs','../tools/newsletter-monitor/server.test.mjs','../tools/newsletter-monitor/audience.test.mjs','../tools/newsletter-monitor/refresh-policy.test.mjs','../tools/newsletter-monitor/refresh-queue.test.mjs','../tools/ci/workflow-result.test.mjs','deploy/ensure-pages-project.test.mjs','integrations/cloudflare-email.test.mjs'];
const result=spawnSync(process.execPath,['--test',...tests],{cwd:fileURLToPath(new URL('../',import.meta.url)),stdio:'inherit',env:process.env});
process.exit(result.status===null?1:result.status);
