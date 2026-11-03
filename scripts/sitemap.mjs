import {readFileSync} from 'node:fs';
import path from 'node:path';

// Use published canonical URLs; do not infer routes from private directories.
export function createSitemap(root, pages) {
  const urls = new Set();
  for (const page of pages) {
    if (page === '404.html') continue;
    const html = readFileSync(path.join(root, page), 'utf8');
    if (/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) continue;
    const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1];
    if (!canonical) throw new Error(`Missing canonical URL: ${page}`);
    const url = new URL(canonical);
    if (url.origin !== 'https://teamhjd.com' || url.search || url.hash) throw new Error(`Invalid sitemap URL: ${canonical}`);
    urls.add(url.href);
  }
  const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + [...urls].map(url => `  <url><loc>${escape(url)}</loc></url>`).join('\n')
    + '\n</urlset>\n';
}