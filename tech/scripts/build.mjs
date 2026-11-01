import { mkdir, mkdtemp, readFile, writeFile, readdir, cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { SITE_URL, SITE_NAME, page, indexContent, searchContent, articleContent } from '../src/templates.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(project, 'dist');
const require = createRequire(import.meta.url);
const katexPath = join(project, 'assets/vendor/katex/katex.min.cjs');
if (!existsSync(katexPath)) throw new Error('Vendored KaTeX is missing from assets/vendor/katex.');
const katex = require(katexPath);

const tags = JSON.parse(await readFile(join(project, 'content/tags.json'), 'utf8'));
const allIssues = JSON.parse(await readFile(join(project, 'content/issues.json'), 'utf8'));
const issues = allIssues.filter((issue) => ['sample', 'published'].includes(issue.status)).sort((a, b) => b.date.localeCompare(a.date));
const knownTags = new Set(tags.map((tag) => tag.id));
if (knownTags.size !== tags.length) throw new Error('Tag IDs must be unique.');
if (new Set(issues.map((issue) => issue.slug)).size !== issues.length) throw new Error('Issue slugs must be unique.');
for (const issue of issues) {
  if (!/^[a-z0-9-]+$/.test(issue.slug) || !/^[a-z0-9-]+$/.test(issue.id)) throw new Error(`Invalid issue path: ${issue.id}`);
  for (const id of issue.tags) if (!knownTags.has(id)) throw new Error(`Unknown tag ${id} in ${issue.id}`);
}

// Rebuild only the generated directory. Source, hosting metadata and credentials stay untouched.
await mkdir(dist, { recursive: true });
// Keep the output directory itself stable for an already running static preview.
for (const name of await readdir(dist)) await rm(join(dist, name), { recursive: true, force: true });
await mkdir(join(dist, 'assets'), { recursive: true });
await cp(join(project, 'assets'), join(dist, 'assets'), { recursive: true });
await rm(join(dist, 'assets/vendor/katex/katex.min.cjs'), { force: true });
await cp(join(project, 'src/styles.css'), join(dist, 'assets/styles.css'));
await cp(join(project, 'src/app.js'), join(dist, 'assets/app.js'));
await writeFile(join(dist, 'assets/favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="#41652d"/><path d="M11 16v-5h5m8 0h5v5m0 8v5h-5m-8 0h-5v-5" fill="none" stroke="#f3f0e8" stroke-width="2.5"/></svg>');

async function writePage(path, html) {
  const target = join(dist, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}

const publicIssues = issues.map(({ id, slug, title, description, date, status, tags }) => ({ id, slug, title, description, date, status, tags }));
await writePage('index.html', page({ title: SITE_NAME, description: '게임 클라이언트 개발을 위한 기술 이야기. 렌더링, 엔진, 네트워킹의 원리부터 구현까지 읽습니다.', active: 'index', content: indexContent(issues, tags) }));
await writePage('tags/index.html', page({ title: '태그로 찾기', description: '한글과 영어 태그로 게임 개발 기술 글을 찾아보세요.', path: '/tags/', active: 'tags', content: searchContent(issues, tags), data: { tags, issues: publicIssues } }));

// A small deterministic ZIP writer keeps the downloadable source and figures in sync.
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const raw = Buffer.from(entry.data);
    const compressed = deflateRawSync(raw);
    const crc = crc32(raw);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(33, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(name.length, 26);
    local.push(header, name, compressed);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(0x0800, 8);
    record.writeUInt16LE(8, 10);
    record.writeUInt16LE(33, 14);
    record.writeUInt32LE(crc, 16);
    record.writeUInt32LE(compressed.length, 20);
    record.writeUInt32LE(raw.length, 24);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE(offset, 42);
    central.push(record, name);
    offset += header.length + name.length + compressed.length;
  }
  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBuffer, end]);
}

for (const issue of issues) {
  const markdown = await readFile(join(project, issue.source), 'utf8');
  // The site's header replaces the document masthead; every numbered section and source stays intact.
  const firstSection = markdown.search(/^##\s+01\./m);
  if (firstSection < 0) throw new Error(`Missing first article section in ${issue.source}`);
  const bodyMarkdown = markdown.slice(firstSection);
  if (/<\s*(script|iframe|object)\b|\bon\w+\s*=|javascript:/i.test(bodyMarkdown)) throw new Error(`Unsafe raw HTML in ${issue.source}`);
  const temporary = await mkdtemp(join(tmpdir(), 'frame-pandoc-'));
  const inputFile = join(temporary, 'article.md');
  const outputFile = join(temporary, 'article.html');
  await writeFile(inputFile, bodyMarkdown);
  const converted = spawnSync('pandoc', [inputFile, '--from=markdown-implicit_figures', '--to=html5', '--section-divs', '--katex', '--wrap=none', '--output', outputFile], { encoding: 'utf8', timeout: 30000 });
  if (converted.status !== 0) throw new Error(`Pandoc failed: ${converted.error?.message || converted.stderr}`);
  let body = await readFile(outputFile, 'utf8');
  await rm(temporary, { recursive: true, force: true });
  const toc = [...body.matchAll(/<section id="([^"]+)" class="level2">\s*<h2>([\s\S]*?)<\/h2>/g)].map((match) => ({ id: match[1], title: match[2].replace(/^\d+\.\s*/, '') }));
  if (!toc.length) throw new Error(`No article headings converted for ${issue.id}`);
  body = body.replace(/<h2>(\d+)\.\s*([\s\S]*?)<\/h2>/g, '<h2><span class="section-number">$1</span>$2</h2>');
  body = body.replace(/src="assets\/([^"/]+)"/g, `src="/${issue.assetDirectory}/$1"`);
  body = body.replace(/<p>(<img\b[^>]+>)<\/p>\s*<p><em>([\s\S]*?)<\/em><\/p>/g, (_, image, caption) => {
    const src = image.match(/src="([^"]+)"/)[1];
    return `<figure class="article-figure"><a class="image-zoom" href="${src}" data-lightbox aria-label="그림 원본 크기로 보기">${image.replace('<img ', '<img loading="lazy" decoding="async" ')}</a><div class="figure-tools"><a href="${src}" target="_blank" rel="noopener noreferrer">원본 크기로 보기 ↗</a></div><figcaption>${caption}</figcaption></figure>`;
  });
  body = body.replace(/<table\b[\s\S]*?<\/table>/g, (table) => `<div class="table-scroll" tabindex="0" role="region" aria-label="가로로 이동할 수 있는 표">${table}</div>`);
  body = body.replace(/<pre([^>]*)>/g, '<pre$1 tabindex="0" aria-label="가로로 이동할 수 있는 코드">');
  body = body.replace(/<a href="(https?:[^"<>]+)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"');
  body = body.replace(/<span class="math (display|inline)">([\s\S]*?)<\/span>/g, (_, mode, tex) => {
    const decoded = tex.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').trim().replace(/^\\[([]/, '').replace(/\\[)\]]$/, '');
    return `<span class="math ${mode}">${katex.renderToString(decoded, { displayMode: mode === 'display', throwOnError: true, output: 'htmlAndMathml', strict: 'warn' })}</span>`;
  });
  const firstImage = `/${issue.assetDirectory}/01_prediction_timeline.png`;
  await writePage(`articles/${issue.slug}/index.html`, page({ title: issue.title, description: issue.description, path: `/articles/${issue.slug}/`, active: 'article', math: true, articleImage: firstImage, content: articleContent(issue, tags, body, toc) }));
  const downloads = join(dist, 'downloads');
  await mkdir(downloads, { recursive: true });
  await writeFile(join(downloads, `${issue.id}.md`), markdown);
  const entries = [{ name: `${issue.id}/${issue.id}.md`, data: markdown }];
  const assetDir = join(project, issue.assetDirectory);
  for (const name of (await readdir(assetDir)).sort()) {
    if (/\.(png|svg)$/i.test(name)) entries.push({ name: `${issue.id}/assets/${name}`, data: await readFile(join(assetDir, name)) });
  }
  await writeFile(join(downloads, `${issue.id}.zip`), zip(entries));
}

await writePage('404.html', page({ title: '글을 찾을 수 없습니다', description: '요청한 페이지를 찾을 수 없습니다.', path: '/404.html', content: '<div class="archive-shell not-found"><header class="archive-heading"><h1>글을 찾을 수 없습니다</h1><p>주소를 확인하거나 글 목록에서 찾아보세요.</p></header><a href="/">글 목록으로 돌아가기 →</a></div>' }));
await writeFile(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
await writeFile(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/tags/', ...issues.map((issue) => `/articles/${issue.slug}/`)].map((path) => `<url><loc>${SITE_URL}${path}</loc></url>`).join('')}</urlset>`);
console.log(`Built ${issues.length} article(s), archive, tag search and synchronized downloads in dist/.`);
