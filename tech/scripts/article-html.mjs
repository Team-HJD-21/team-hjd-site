// Pandoc emits one caption paragraph. Never match across later paragraphs.
function captionContents(html) {
  if (!html.startsWith('<em>') || !html.endsWith('</em>')) return null;
  let depth = 0;
  for (const match of html.matchAll(/<\/?em>/g)) {
    depth += match[0] === '<em>' ? 1 : -1;
    if (depth < 0 || depth === 0 && match.index + match[0].length !== html.length) return null;
  }
  return depth === 0 ? html.slice(4, -5) : null;
}

export function renderArticleFigures(html, id = 'article') {
  const result = html.replace(/<p>(<img\b[^>]+>)<\/p>\s*<p>((?:(?!<\/?p\b)[\s\S])*?)<\/p>/g, (_, image, caption) => {
    assertInlineFormatting(caption, id);
    const contents = captionContents(caption);
    if (contents === null) throw new Error(`Figure caption must be one fully emphasized paragraph in ${id}; escape literal asterisks such as A\\*.`);
    const src = image.match(/\bsrc="([^"]+)"/)?.[1];
    if (!src) throw new Error(`Figure source missing in ${id}`);
    return `<figure class="article-figure"><a class="image-zoom" href="${src}" data-lightbox aria-label="그림 원본 크기로 보기">${image.replace('<img ', '<img loading="lazy" decoding="async" ')}</a><div class="figure-tools"><a href="${src}" target="_blank" rel="noopener noreferrer">원본 크기로 보기 ↗</a></div><figcaption>${contents}</figcaption></figure>`;
  });
  if (/<p><img\b[^>]+><\/p>/.test(result)) throw new Error(`Figure must be followed by one caption paragraph in ${id}`);
  return result;
}

export function assertInlineFormatting(html, id = 'article') {
  const stack = [], formatting = new Set(['em', 'strong']);
  const blocks = new Set(['p','div','section','figure','figcaption','table','thead','tbody','tr','th','td','pre','ul','ol','li','blockquote','details','summary','h1','h2','h3','h4','h5','h6']);
  for (const match of html.matchAll(/<!--[\s\S]*?-->|<\/?([a-z][a-z0-9]*)\b[^>]*>/gi)) {
    if (!match[1]) continue;
    const name = match[1].toLowerCase(), closing = match[0].startsWith('</');
    if (formatting.has(name)) {
      if (closing) {
        if (stack.pop() !== name) throw new Error(`Unbalanced inline formatting (${name}) in ${id}`);
      } else stack.push(name);
    } else if (stack.length && blocks.has(name)) throw new Error(`Inline formatting crosses a ${name} boundary in ${id}`);
  }
  if (stack.length) throw new Error(`Unclosed inline formatting in ${id}`);
}
