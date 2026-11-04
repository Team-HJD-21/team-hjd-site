import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import {publicationVersion} from './publication-version.mjs';
const site = 'https://tech.teamhjd.com';
const hash = value => createHash('sha256').update(value).digest('hex');
const escapeHtml = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

// Deliberately no authenticated API calls: this inspection can only GET public files.
export async function inspectLive(project, issueId, fetcher = fetch) {
  const { loadContent } = await import('./content.mjs');
  const { allIssues, documents } = await loadContent(project);
  const issue = allIssues.find(item => item.id === issueId);
  assert.ok(issue, 'Unknown inspection issue');
  if (issue.status !== 'published') return { issueId, readOnly: true, state: 'not_published', mailSent: false };
  async function get(path) {
    const url = new URL(path, site);
    assert.equal(url.origin, site, 'Inspection must stay on the public site');
    const response = await fetcher(url, { method: 'GET', redirect: 'error', headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(20000) });
    assert.equal(response.status, 200, `HTTP ${response.status}: ${url.pathname}`);
    return Buffer.from(await response.arrayBuffer());
  }
  const manifest = JSON.parse((await get(`/publication.json?inspection=${Date.now()}`)).toString('utf8'));
  const live = manifest.issues?.find(item => item.id === issueId);
  assert.ok(live, 'Published issue missing from production manifest');
  assert.equal(live.date, issue.date); assert.equal(live.title, issue.title);
  assert.equal(live.url, `${site}/${issue.date}/${issue.slug}/`);
  const contentVersion=await publicationVersion(project,issue,documents.get(issueId));
  assert.equal(live.contentVersion,contentVersion,'Live manifest content version differs from validated source');
  const html = (await get(live.url)).toString('utf8');
  assert.ok(html.includes(escapeHtml(issue.title)), 'Article title not present');
  assert.ok(html.includes('오늘 얻어갈 것'), 'Takeaway section not present');
  assert.ok(html.includes(`<meta name="note-content-version" content="${contentVersion}">`),'Article content version differs from validated source');
  const document = documents.get(issueId), versions = new Map();
  for (const name of document.assets) {
    const local = await readFile(join(project, issue.assetDirectory, name));
    const version = hash(local).slice(0,12); versions.set(name, version);
    const remote = await get(`/${issue.assetDirectory}/${name}?v=${version}`);
    assert.equal(hash(remote), hash(local), `Image content differs: ${name}`);
  }
  const md = (await get(`/downloads/${issueId}.md`)).toString('utf8');
  const expected = document.markdown.replace(/\]\(assets\/([^)]+)\)/g, (_,name) => `](${site}/${issue.assetDirectory}/${name}?v=${versions.get(name)})`);
  assert.equal(md, expected, 'Standalone Markdown differs from source');
  const zip = await get(`/downloads/${issueId}.zip`);
  assert.equal(zip.readUInt32LE(0), 0x04034b50, 'Invalid ZIP header');
  const builtZip = await readFile(join(project, 'dist/downloads', `${issueId}.zip`));
  assert.equal(hash(zip), hash(builtZip), 'ZIP differs from the rebuilt source');
  assert.ok((await get('/feed.xml')).toString('utf8').includes(live.url), 'RSS is missing the dated article URL');
  return { issueId, date: issue.date, url: live.url, readOnly: true, networkMethods: ['GET'], article: 'ok', markdown: 'ok', zip: 'ok', imagesVerified: document.assets.length, rss: 'ok', mailSent: false };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const project = fileURLToPath(new URL('../', import.meta.url));
  const ids = (process.env.ISSUE_IDS || '').split(',').filter(Boolean);
  if (!ids.length) throw new Error('No issue selected for read-only inspection.');
  for (const id of ids) console.log(JSON.stringify(await inspectLive(project, id)));
}
