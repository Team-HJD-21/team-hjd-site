import { mkdir, mkdtemp, readFile, writeFile, readdir, cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { SITE_URL, SITE_NAME, escapeHtml, page, indexContent, searchContent, articleContent } from '../src/templates.mjs';
import { loadContent } from './content.mjs';
import { buildBrand } from './brand.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(project, 'dist');
const require = createRequire(import.meta.url);
const katexPath = join(project, 'assets/vendor/katex/katex.min.cjs');
if (!existsSync(katexPath)) throw new Error('Vendored KaTeX is missing from assets/vendor/katex.');
const katex = require(katexPath);

const { tags, issues, documents } = await loadContent(project);

// Rebuild only the generated directory. Source, hosting metadata and credentials stay untouched.
await mkdir(dist, { recursive: true });
// Keep the output directory itself stable for an already running static preview.
for (const name of await readdir(dist)) await rm(join(dist, name), { recursive: true, force: true });
await mkdir(join(dist, 'assets'), { recursive: true });
// Only shared brand/vendor assets and each public issue are copied; drafts stay private.
for (const directory of ['brand', 'vendor']) await cp(join(project, 'assets', directory), join(dist, 'assets', directory), { recursive: true });
for (const issue of issues) if (documents.get(issue.id).assets.length) await cp(join(project, issue.assetDirectory), join(dist, issue.assetDirectory), { recursive: true });
await rm(join(dist, 'assets/vendor/katex/katex.min.cjs'), { force: true });
await buildBrand(project, join(dist, 'assets/brand'));
await cp(join(project, 'src/styles.css'), join(dist, 'assets/styles.css'));
await cp(join(project, 'src/app.js'), join(dist, 'assets/app.js'));
await cp(join(dist, 'assets/brand/favicon.svg'), join(dist, 'favicon.svg'));

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
  const { markdown, body: bodyMarkdown, assets } = documents.get(issue.id);
  const temporary = await mkdtemp(join(tmpdir(), 'frame-pandoc-'));
  const inputFile = join(temporary, 'article.md');
  const outputFile = join(temporary, 'article.html');
  await writeFile(inputFile, bodyMarkdown);
  const converted = spawnSync(process.env.PANDOC_PATH || 'pandoc', [inputFile, '--from=markdown-implicit_figures', '--to=html5', '--section-divs', '--katex', '--wrap=none', '--output', outputFile], { encoding: 'utf8', timeout: 30000 });
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
  const firstImage = issue.coverImage ? `/${issue.assetDirectory}/${issue.coverImage}` : '/assets/brand/teamhjd-original.png';
  await writePage(`articles/${issue.slug}/index.html`, page({ title: issue.title, description: issue.description, path: `/articles/${issue.slug}/`, active: 'article', math: true, articleImage: firstImage, content: articleContent(issue, tags, body, toc) }));
  const downloads = join(dist, 'downloads');
  await mkdir(downloads, { recursive: true });
  // Standalone Markdown works outside the ZIP; ZIP retains portable relative paths.
  await writeFile(join(downloads, `${issue.id}.md`), markdown.replace(/\]\(assets\//g, `](${SITE_URL}/${issue.assetDirectory}/`));
  const entries = [{ name: `${issue.id}/${issue.id}.md`, data: markdown }];
  const assetDir = join(project, issue.assetDirectory);
  for (const name of assets) entries.push({ name: `${issue.id}/assets/${name}`, data: await readFile(join(assetDir, name)) });
  await writeFile(join(downloads, `${issue.id}.zip`), zip(entries));
}

await writePage('404.html', page({ title: '글을 찾을 수 없습니다', description: '요청한 페이지를 찾을 수 없습니다.', path: '/404.html', content: '<div class="archive-shell not-found"><header class="archive-heading"><h1>글을 찾을 수 없습니다</h1><p>주소를 확인하거나 글 목록에서 찾아보세요.</p></header><a href="/">글 목록으로 돌아가기 →</a></div>' }));
await writeFile(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
await writeFile(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/tags/', ...issues.map((issue) => `/articles/${issue.slug}/`)].map((path) => `<url><loc>${SITE_URL}${path}</loc></url>`).join('')}</urlset>`);
const published = issues.filter((issue) => issue.status === 'published');
await writeFile(join(dist, 'publication.json'), JSON.stringify({ version: 1, issues: published.map((issue) => ({ id: issue.id, date: issue.date, title: issue.title, summary: issue.summary, url: `${SITE_URL}/articles/${issue.slug}/` })) }, null, 2));
await writeFile(join(dist, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${SITE_NAME}</title><link>${SITE_URL}/</link><description>게임 클라이언트 개발자를 위한 기술 노트</description><language>ko</language>${published.map((issue) => `<item><title>${escapeHtml(issue.title)}</title><link>${SITE_URL}/articles/${issue.slug}/</link><guid>${SITE_URL}/articles/${issue.slug}/</guid><pubDate>${new Date(`${issue.date}T12:00:00+09:00`).toUTCString()}</pubDate><description>${escapeHtml(issue.description)}</description></item>`).join('')}</channel></rss>`);
await writeFile(join(dist, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Content-Security-Policy: frame-ancestors \'self\'; object-src \'none\'; base-uri \'self\'\n');
console.log(`Built ${issues.length} article(s), archive, tag search and synchronized downloads in dist/.`);
