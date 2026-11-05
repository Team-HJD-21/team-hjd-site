import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateMetadata, validateMarkdown, articleBody, loadContent, containedPath } from './content.mjs';

const tags = [{ id: 'rendering', group: '분야', ko: '렌더링', en: 'Rendering', aliases: ['graphics'] }];
const issue = { id: 'note-2026-11-03', slug: 'example-technique', title: '예제', description: '소개', question: '왜?', summary: '핵심', date: '2026-11-03', status: 'published', source: 'content/issues/note-2026-11-03.md', assetDirectory: 'assets/issues/note-2026-11-03', tags: ['rendering'], coverImage: 'figure.webp' };
const markdown = '# 예제\n\n<!-- article -->\n\n## 질문에서 시작하기\n\n![도식](assets/figure.webp)\n\n*직접 만든 개념도. 출처: [공식 문서](https://example.test/).*\n\n## 오늘 얻어갈 것\n\n구현에서 확인한다.\n\n## 출처\n\n[공식 문서](https://example.test/)\n';
const metadata = (changed) => validateMetadata(tags, [{ ...issue, ...changed }], { today: '2026-11-03' });

test('valid dates, explicit tags and cover metadata are accepted', () => metadata({}));
test('duplicate IDs/slugs, unknown tags, missing fields and invalid dates fail', () => {
  assert.throws(() => validateMetadata(tags, [issue, issue]));
  for (const changed of [{ id: '../secret' }, { date: '2026-02-30' }, { date: '2026-13-01' }, { tags: ['unknown'] }, { tags: ['rendering', 'rendering'] }, { title: null }, { source: '../private.md' }, { assetDirectory: 'assets/issues/different' }, { coverImage: '../private.png' }, { status: 'live' }]) assert.throws(() => metadata(changed));
});
test('future published issues are blocked while future drafts are valid', () => {
  assert.throws(() => metadata({ date: '2026-11-04' }));
  metadata({ date: '2026-11-04', status: 'draft' });
});
test('scheduled content requires an explicit 11:57 Seoul timestamp', () => {
  metadata({ status: 'scheduled', date: '2026-11-04', publishAt: '2026-11-04T11:57:00+09:00' });
  assert.throws(() => metadata({ status: 'scheduled' }), /publishAt/);
  for (const publishAt of ['2026-11-03T11:56:59+09:00', '2026-11-03T12:00:00+09:00', '2026-11-04T11:57:00+09:00']) assert.throws(() => metadata({ status: 'scheduled', publishAt }), /publishAt/);
});
test('body marker permits flexible headings and preserves the old sample contract', () => {
  assert.match(articleBody(markdown), /^## 질문/);
  assert.match(articleBody('# old\n## 01. 배경\n내용'), /^## 01/);
  assert.throws(() => articleBody('# no body'));
  assert.doesNotThrow(() => validateMarkdown(markdown, issue.id));
});
test('takeaway, linked sources, image alt and caption are required', () => {
  for (const bad of [markdown.replace('## 오늘 얻어갈 것', '## 끝'), markdown.replace('![도식]', '![]'), markdown.replace(/\*직접[^\n]+\*/, ''), markdown.replaceAll('https://', 'local-')]) assert.throws(() => validateMarkdown(bad, issue.id));
});
test('active HTML and unsafe image URLs are rejected while code examples are preserved', () => {
  for (const html of ['<script>alert(1)</script>', '<iframe src="https://example.test/"></iframe>', '[링크](javascript:alert)', '<details onclick="alert(1)">']) assert.throws(() => validateMarkdown(markdown + html, issue.id));
  assert.throws(() => validateMarkdown(markdown.replace('assets/figure.webp', '../secret.png'), issue.id));
  assert.doesNotThrow(() => validateMarkdown(markdown + '\n```cpp\nif (a < b) { onEvent = 1; }\n```', issue.id));
});

test('C++ headers and templates in complete inline code are literals, not active HTML',()=>{
 for(const literal of ['`<new>`','`std::vector<int>`','``<vector> ` <new>``'])assert.doesNotThrow(()=>validateMarkdown(markdown+'\n'+literal,issue.id));
});
test('unclosed, escaped and mixed inline code cannot conceal active HTML',()=>{
 for(const bad of ['`<script>alert(1)</script>','\\`<script>alert(1)</script>\\`','`<new>`<script>alert(1)</script>','``<new>`<script>alert(1)</script>'])assert.throws(()=>validateMarkdown(markdown+'\n'+bad,issue.id),/Unsafe HTML/);
});

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'notes-content-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'content/issues'), { recursive: true });
  await mkdir(join(root, issue.assetDirectory), { recursive: true });
  await writeFile(join(root, 'content/tags.json'), JSON.stringify(tags));
  await writeFile(join(root, 'content/issues.json'), JSON.stringify([issue]));
  await writeFile(join(root, issue.source), markdown);
  await writeFile(join(root, issue.assetDirectory, 'figure.webp'), 'test fixture');
  return root;
}
test('WebP assets load and missing cover/figure references stop publication', async (t) => {
  const root = await fixture(t);
  const result = await loadContent(root, { today: issue.date });
  assert.deepEqual(result.documents.get(issue.id).assets, ['figure.webp']);
  await rm(join(root, issue.assetDirectory, 'figure.webp'));
  await assert.rejects(loadContent(root, { today: issue.date }), /Missing figure/);
});

test('CRLF manuscript checkouts produce the same canonical download text as LF',async t=>{
 const root=await fixture(t);
 await writeFile(join(root,issue.source),markdown.replaceAll('\n','\r\n'));
 assert.equal((await loadContent(root,{today:issue.date})).documents.get(issue.id).markdown,markdown);
});
test('draft and scheduled metadata remain out of public issues and SVG scripts are rejected', async (t) => {
  const root = await fixture(t);
  for (const status of ['draft', 'scheduled']) {
    await writeFile(join(root, 'content/issues.json'), JSON.stringify([{ ...issue, status, publishAt: `${issue.date}T11:57:00+09:00` }]));
    assert.equal((await loadContent(root)).issues.length, 0);
  }
  await writeFile(join(root, issue.assetDirectory, 'active.svg'), '<svg><script>alert(1)</script></svg>');
  await assert.rejects(loadContent(root), /Active or external SVG/);
});
test('an image-free issue does not require an untracked empty asset directory', async (t) => {
  const root = await fixture(t);
  const withoutCover = { ...issue };
  delete withoutCover.coverImage;
  await writeFile(join(root, 'content/issues.json'), JSON.stringify([withoutCover]));
  await writeFile(join(root, issue.source), markdown.replace(/!\[도식\]\(assets\/figure.webp\)/, '그림 없이 설명한다.'));
  await rm(join(root, issue.assetDirectory), { recursive: true });
  assert.deepEqual((await loadContent(root)).documents.get(issue.id).assets, []);
});
test('paths outside project and unsupported asset files are rejected', async (t) => {
  const root = await fixture(t);
  await assert.rejects(containedPath(root, '..'), /escapes/);
  await writeFile(join(root, issue.assetDirectory, 'private.json'), '{}');
  await assert.rejects(loadContent(root), /Unsupported issue asset/);
  assert.ok((await readdir(root)).includes('content'));
});
