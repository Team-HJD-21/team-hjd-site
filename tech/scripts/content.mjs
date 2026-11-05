import { readFile, readdir, realpath } from 'node:fs/promises';
import { resolve, relative, sep, extname, join } from 'node:path';

export const PUBLIC_STATES = new Set(['sample', 'published']);
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE = /\.(png|svg|jpe?g|webp|gif|avif)$/i;
const GROUPS = new Set(['분야', '기법·원리', '엔진·언어', '자료유형']);
export const todayInSeoul = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const fail = (message) => { throw new Error(message); };
const text = (value, name, max = 4000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) fail(`Invalid ${name}`);
};
const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function validateMetadata(tags, issues, { today = todayInSeoul() } = {}) {
  if (!Array.isArray(tags) || !Array.isArray(issues)) fail('Tags and issues must be arrays.');
  const tagIds = new Set();
  for (const tag of tags) {
    if (!tag || typeof tag.id !== 'string' || !ID.test(tag.id) || tagIds.has(tag.id)) fail('Tag IDs must be valid and unique.');
    tagIds.add(tag.id);
    if (!GROUPS.has(tag.group)) fail(`Invalid tag group: ${tag.id}`);
    for (const key of ['ko', 'en']) text(tag[key], `tag.${key}`, 150);
    if (!Array.isArray(tag.aliases)) fail(`Invalid aliases: ${tag.id}`);
    for (const alias of tag.aliases) text(alias, 'tag alias', 150);
  }
  const ids = new Set(), slugs = new Set();
  for (const issue of issues) {
    if (!issue || typeof issue.id !== 'string' || !ID.test(issue.id) || issue.id.length > 80 || ids.has(issue.id)) fail('Issue IDs must be valid and unique.');
    ids.add(issue.id);
    if (typeof issue.slug !== 'string' || !ID.test(issue.slug) || slugs.has(issue.slug)) fail('Issue slugs must be valid and unique, including drafts.');
    slugs.add(issue.slug);
    for (const key of ['title', 'description', 'question', 'summary']) text(issue[key], `${issue.id}.${key}`, key === 'title' ? 180 : 4000);
    if (/[\r\n]/.test(issue.title)) fail(`Title must be one line: ${issue.id}`);
    if (!validDate(issue.date)) fail(`Invalid calendar date: ${issue.id}`);
    if (!['draft', 'scheduled', 'sample', 'published'].includes(issue.status)) fail(`Invalid status: ${issue.id}`);
    if (issue.status === 'scheduled' && issue.publishAt !== `${issue.date}T11:57:00+09:00`) fail(`Scheduled issue requires publishAt at 11:57 Asia/Seoul: ${issue.id}`);
    if (issue.status === 'published' && issue.date > today) fail(`Future issue must remain draft: ${issue.id}`);
    if (issue.publishedAt !== undefined && (!Number.isFinite(Date.parse(issue.publishedAt)) || !/^\d{4}-\d{2}-\d{2}T/.test(issue.publishedAt) || new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(issue.publishedAt)) !== issue.date)) fail(`Invalid publishedAt: ${issue.id}`);
    if (issue.source !== `content/issues/${issue.id}.md` || issue.assetDirectory !== `assets/issues/${issue.id}`) fail(`Unexpected source/asset path: ${issue.id}`);
    if (!Array.isArray(issue.tags) || !issue.tags.length || new Set(issue.tags).size !== issue.tags.length || issue.tags.some((id) => !tagIds.has(id))) fail(`Invalid or unknown tags: ${issue.id}`);
    if (issue.coverImage !== undefined && (typeof issue.coverImage !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(issue.coverImage) || !IMAGE.test(issue.coverImage))) fail(`Invalid coverImage: ${issue.id}`);
    if (issue.format !== undefined) text(issue.format, 'format', 60);
  }
}

export function articleBody(markdown) {
  const marker = '<!-- article -->';
  if (markdown.includes(marker)) return markdown.slice(markdown.indexOf(marker) + marker.length).trim();
  // Backwards compatibility for the existing sample and its downloads.
  const legacy = markdown.search(/^##\s+01\./m);
  if (legacy >= 0) return markdown.slice(legacy);
  fail('Add <!-- article --> before the first body section.');
}

function proseOnly(body) {
  let fence = null;
  return body.split('\n').map((line) => {
    const match = line.match(/^\s*(`{3,}|~{3,})/);
    if (match) {
      if (!fence) fence = match[1];
      else if (match[1][0] === fence[0] && match[1].length >= fence.length) fence = null;
      return '';
    }
    return fence ? '' : line;
  }).join('\n');
}

// Inline code cannot cross a blank paragraph boundary in the deployed Pandoc mode.
function maskInlineCode(text) {
 return text.split(/(\r?\n[ \t\r]*\n)/).map(maskInlineParagraph).join('');
}
// Escaped/open-ended delimiters remain prose.
function maskInlineParagraph(text) {
 let cursor=0,result='';
 while(cursor<text.length){
  const start=text.indexOf('`',cursor);if(start<0)return result+text.slice(cursor);
  result+=text.slice(cursor,start);
  let end=start;while(text[end]==='`')end++;
  let slashes=0;for(let i=start-1;i>=0&&text[i]==='\\';i--)slashes++;
  if(slashes%2){result+=text.slice(start,end);cursor=end;continue;}
  const width=end-start;let search=end,close=-1,closeEnd;
  while(search<text.length){
   const next=text.indexOf('`',search);if(next<0)break;
   let runEnd=next;while(text[runEnd]==='`')runEnd++;
   if(runEnd-next===width){close=next;closeEnd=runEnd;break;}search=runEnd;
  }
  if(close<0){result+=text.slice(start,end);cursor=end;continue;}
  result+=text.slice(start,closeEnd).replace(/[^\n]/g,' ');cursor=closeEnd;
 }
 return result;
}

export function validateMarkdown(markdown, id) {
  const body = articleBody(markdown);
  const prose = proseOnly(body);
  // Raw HTML is limited to the existing disclosure component and comments.
  const raw = maskInlineCode(prose).replace(/<!--[\s\S]*?-->/g, '').replace(/<\/?(?:details|summary)>/g, '');
  if (/<\s*\/?[a-z][^>]*>/i.test(raw) || /(?:javascript|vbscript|data)\s*:/i.test(prose) || /chatgpt\.com\/c\/|\uE200|\uE201/.test(prose)) fail(`Unsafe HTML, URL or private citation in ${id}`);
  const headings = [...prose.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].replace(/^\d+\.\s*/, '').trim());
  const substantive = headings.filter((heading) => !/^(원문|출처|참고|더 읽|자료)/.test(heading));
  if (substantive.at(-1) !== '오늘 얻어갈 것') fail(`Last body section must be 오늘 얻어갈 것: ${id}`);
  if (!/https:\/\//.test(prose)) fail(`Missing linked sources: ${id}`);
  // Local figures use a flat assets/ namespace so standalone and ZIP paths agree.
  for (const match of prose.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
    if (!match[1].trim()) fail(`Missing image alt text: ${id}`);
    if (!/^assets\/[a-zA-Z0-9][a-zA-Z0-9_.-]*\.(png|svg|jpe?g|webp|gif|avif)$/i.test(match[2])) fail(`Image must use a local assets/file path: ${id}`);
    const tail = prose.slice(match.index + match[0].length);
    if (!/^\s*\n\s*\*[^*]+/.test(tail)) fail(`Missing image caption/source: ${id}`);
  }
  return body;
}

export async function containedPath(project, path) {
  const root = await realpath(project);
  const target = await realpath(resolve(root, path));
  const rel = relative(root, target);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || resolve(root, rel) !== target) fail(`Source escapes the project: ${path}`);
  return target;
}

export async function loadContent(project, options) {
  const tags = JSON.parse(await readFile(join(project, 'content/tags.json'), 'utf8'));
  const allIssues = JSON.parse(await readFile(join(project, 'content/issues.json'), 'utf8'));
  validateMetadata(tags, allIssues, options);
  const documents = new Map();
  for (const issue of allIssues) {
    const source = await containedPath(project, issue.source);
    // Canonical text keeps downloads/ZIP identical across Windows and Linux checkouts.
    const markdown = (await readFile(source, 'utf8')).replaceAll('\r\n', '\n');
    const body = validateMarkdown(markdown, issue.id);
    let entries = [];
    try {
      const assetDir = await containedPath(project, issue.assetDirectory);
      entries = await readdir(assetDir, { withFileTypes: true });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const assets = [];
    for (const entry of entries) {
      if (!entry.isFile() || !IMAGE.test(entry.name) || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(entry.name)) fail(`Unsupported issue asset: ${issue.id}/${entry.name}`);
      const file = await containedPath(project, `${issue.assetDirectory}/${entry.name}`);
      // SVGs are served as images but must also be safe to open directly.
      if (extname(entry.name).toLowerCase() === '.svg') {
        const svg = await readFile(file, 'utf8');
        if (/<\s*(?:script|foreignObject|iframe|object|image)\b|\bon\w+\s*=|<!ENTITY|(?:javascript|data)\s*:|(?:xlink:)?href\s*=\s*["'](?!#)|url\(\s*["']?(?!#)/i.test(svg)) fail(`Active or external SVG: ${issue.id}/${entry.name}`);
      }
      assets.push(entry.name);
    }
    for (const match of markdown.matchAll(/!?\[[^\]]*\]\(assets\/([^\s)]+)\)/g)) if (!assets.includes(match[1])) fail(`Missing figure: ${issue.id}/${match[1]}`);
    if (issue.coverImage && !assets.includes(issue.coverImage)) fail(`Missing cover image: ${issue.id}`);
    documents.set(issue.id, { markdown, body, assets: assets.sort() });
  }
  const issues = allIssues.filter((issue) => PUBLIC_STATES.has(issue.status)).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  return { tags, allIssues, issues, documents };
}
