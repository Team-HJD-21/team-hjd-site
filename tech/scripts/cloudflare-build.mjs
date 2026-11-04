import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = '3.13';
const sha256 = '38aa33b325a2bc96a4c39409631212db55702f564250bcdbead180b3bf646389';
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: process.env, ...options });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.error?.message || ''}`);
};
let directory;
try {
  const installed = spawnSync(process.env.PANDOC_PATH || 'pandoc', ['--version'], { stdio: 'ignore' });
  if (installed.status !== 0) {
    if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('Install Pandoc or set PANDOC_PATH on this platform.');
    directory = await mkdtemp(join(tmpdir(), 'gambungi-pandoc-'));
    const response = await fetch(`https://github.com/jgm/pandoc/releases/download/${version}/pandoc-${version}-linux-amd64.tar.gz`, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`Official Pandoc download failed: HTTP ${response.status}`);
    const archive = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(archive).digest('hex') !== sha256) throw new Error('Pandoc SHA256 mismatch.');
    const archivePath = join(directory, 'pandoc.tar.gz');
    await writeFile(archivePath, archive);
    run('tar', ['-xzf', archivePath, '--strip-components=2', '-C', directory, `pandoc-${version}/bin/pandoc`]);
    process.env.PANDOC_PATH = join(directory, 'pandoc');
  }
  run(process.execPath, ['--test', 'scripts/content.test.mjs', 'scripts/release.test.mjs', 'scripts/delivery-client.test.mjs', 'scripts/warm-release.test.mjs', 'src/subscriptions.test.mjs', 'src/monitor.test.mjs', '../tools/newsletter-monitor/server.test.mjs', '../tools/newsletter-monitor/audience.test.mjs', 'deploy/ensure-pages-project.test.mjs', 'integrations/cloudflare-email.test.mjs']);
  run(process.execPath, ['--test', 'scripts/publication-version.test.mjs', 'scripts/audit-no-send.test.mjs']);
  run(process.execPath, ['scripts/build.mjs']);
} finally {
  if (directory) await rm(directory, { recursive: true, force: true });
}
