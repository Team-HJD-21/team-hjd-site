import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// The company source is the authority for shared styles, links and legal text.
export async function loadCompanyBrand(project) {
  const companyRoot = join(project, '..');
  const source = await readFile(join(companyRoot, 'index.html'), 'utf8');
  const match = source.match(/<footer class="shell footer">[\s\S]*?<\/footer>/);
  if (!match) throw new Error('Company footer contract changed; update the shared footer adapter.');
  let footer = match[0].replace('class="shell footer"', 'class="shell footer company-footer"');
  footer = footer.replace(/\b(href|src)="([^"]+)"/g, (_, attribute, url) => {
    if (attribute === 'src' && url === 'assets/teamhjd-wordmark.png') return 'src="/assets/brand/teamhjd-wordmark.png"';
    return `${attribute}="${new URL(url, 'https://teamhjd.com/').href}"`;
  });
  footer = footer.replace(/(<details class="related-sites"[\s\S]*?<ul>)/, '$1<li><a href="https://teamhjd.com/" target="_blank" rel="noopener noreferrer">TeamHJD</a></li>');
  footer = footer.replace(/(<a\b[^>]*href="https:\/\/tech\.teamhjd\.com\/?")/g, '$1 aria-current="page"');
  footer = footer.replace('</nav>', '<a href="/terms/">노트 이용안내</a><a href="/subscription/manage/">구독 관리·해지</a></nav>');
  const stylesheet = (await readFile(join(companyRoot, 'styles.css'), 'utf8')).replace(/url\((["']?)assets\//g, 'url($1https://teamhjd.com/assets/');
  return { footer, stylesheet, wordmark: await readFile(join(companyRoot, 'assets/teamhjd-wordmark.png')) };
}
