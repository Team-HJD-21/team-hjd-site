export const SITE_URL = 'https://tech.teamhjd.com';
export const SITE_NAME = '겜붕이의 노트';

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

export function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function formatDate(value) {
  return value.replaceAll('-', '.');
}

export function tagLinks(ids, tags, { limit = ids.length } = {}) {
  return ids.slice(0, limit).map((id) => {
    const tag = tags.find((candidate) => candidate.id === id);
    if (!tag) return '';
    return `<a class="tag" href="/tags/?q=${encodeURIComponent(tag.ko)}" title="${escapeHtml(tag.en)}">${escapeHtml(tag.ko)}</a>`;
  }).join('');
}

export function issueCard(issue, tags) {
  return `<article class="issue-card">
    <div class="meta"><time datetime="${escapeHtml(issue.date)}">${formatDate(issue.date)}</time>${issue.status === 'sample' ? '<span class="sample-label">샘플</span>' : ''}</div>
    <h2><a href="/articles/${escapeHtml(issue.slug)}/">${escapeHtml(issue.title)}</a></h2>
    <p>${escapeHtml(issue.description)}</p>
    <div class="tags" aria-label="글의 태그">${tagLinks(issue.tags, tags, { limit: 6 })}</div>
  </article>`;
}

export function page({ title, description, path = '/', active, content, math = false, data = null, articleImage = null }) {
  const canonical = `${SITE_URL}${path}`;
  const pageTitle = title === SITE_NAME ? SITE_NAME : `${title} · ${SITE_NAME}`;
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" content="#fcfbf8" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#080f17" media="(prefers-color-scheme: dark)">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="${active === 'article' ? 'article' : 'website'}">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  ${articleImage ? `<meta property="og:image" content="${SITE_URL}${escapeHtml(articleImage)}">` : ''}
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <script>try{const t=localStorage.getItem('frame-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}</script>
  <link rel="stylesheet" href="/assets/styles.css">
  ${math ? '<link rel="stylesheet" href="/assets/vendor/katex/katex.min.css">' : ''}
  <script src="/assets/app.js" defer></script>
</head>
<body id="page-top">
  <a class="skip-link" href="#main-content">본문으로 건너뛰기</a>
  <header class="site-header">
    <a class="brand" href="/" aria-label="겜붕이의 노트, 글 목록"><span class="brand-name">겜붕이의 노트</span><span class="publisher">TEAMHJD</span></a>
    <nav class="site-nav" aria-label="주 메뉴">
      <a href="/"${active === 'index' ? ' aria-current="page"' : ''}>글 목록</a>
      <a href="/tags/"${active === 'tags' ? ' aria-current="page"' : ''}>태그 검색</a>
      <button class="theme-toggle" type="button" aria-label="화면 색상 바꾸기" title="화면 색상 바꾸기" data-theme-toggle>
        <svg class="theme-icon" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" stroke="none"/></svg>
      </button>
    </nav>
  </header>
  <main id="main-content">${content}</main>
  <footer class="site-footer"><a href="/">${SITE_NAME}</a><span>TEAMHJD</span><a href="#page-top">맨 위로 ↑</a></footer>
  <dialog class="image-dialog" aria-label="그림 확대 보기" data-image-dialog>
    <div class="image-dialog-toolbar"><a href="#" target="_blank" rel="noopener noreferrer" data-image-original>원본 열기 ↗</a><form method="dialog"><button type="submit" autofocus aria-label="확대한 그림 닫기">닫기 ×</button></form></div>
    <div class="image-dialog-viewport"><img alt="" data-image-full></div>
    <p class="image-dialog-caption" data-image-caption></p>
  </dialog>
  ${data ? `<script type="application/json" id="content-index">${safeJson(data)}</script>` : ''}
</body>
</html>
`;
}

export function indexContent(issues, tags) {
  return `<div class="archive-shell">
    <header class="archive-heading"><p class="eyebrow">GAME DEVELOPMENT</p><h1>게임 기술을 읽는 시간</h1><p>원리에서 구현까지, 오래 두고 읽을 이야기.</p></header>
    <div class="archive-count">글 ${issues.length}개</div>
    <div class="issue-list">${issues.map((issue) => issueCard(issue, tags)).join('')}</div>
  </div>`;
}

export function searchContent(issues, tags) {
  return `<div class="archive-shell search-shell" data-search-page>
    <header class="archive-heading"><h1>태그로 찾기</h1></header>
    <form class="search-form" action="/tags/" method="get" role="search">
      <label for="tag-query">태그 검색</label>
      <div class="search-row"><input id="tag-query" type="search" name="q" maxlength="120" autocomplete="off" placeholder="클라이언트 예측, reconciliation, UE5" aria-describedby="search-count"><button class="search-clear" type="button" data-search-clear hidden>지우기</button></div>
    </form>
    <p id="search-count" class="archive-count" role="status" aria-live="polite">글 ${issues.length}개</p>
    <div class="search-results" data-search-results>${issues.map((issue) => issueCard(issue, tags)).join('')}</div>
    <p class="empty-results" data-search-empty hidden>해당 태그의 글이 없습니다.</p>
    <section class="tag-browser" aria-labelledby="tag-browser-heading"><h2 id="tag-browser-heading">태그 둘러보기</h2><div data-tag-browser></div></section>
  </div>`;
}

export function articleContent(issue, tags, body, toc) {
  return `<article class="reading-shell" aria-labelledby="issue-title">
    <header class="article-header">
      <div class="meta"><time datetime="${escapeHtml(issue.date)}">${formatDate(issue.date)}</time><span>기술 해설${issue.status === 'sample' ? ' · 샘플' : ''}</span></div>
      <h1 id="issue-title">${escapeHtml(issue.title)}</h1>
      <p class="article-deck">${escapeHtml(issue.question)}</p>
      <div class="tags" aria-label="관련 태그">${tagLinks(issue.tags.filter((id) => id !== 'technical-explainer'), tags)}</div>
    </header>
    <details class="article-toc"><summary>이 글의 목차</summary><ol>${toc.map((item) => `<li><a href="#${escapeHtml(item.id)}">${item.title}</a></li>`).join('')}</ol></details>
    <p class="article-intro">${escapeHtml(issue.summary)}</p>
    <div class="prose">${body}</div>
    <section class="downloads" aria-labelledby="downloads-title"><h2 id="downloads-title">파일로 읽기</h2><div class="download-links"><a href="/downloads/${escapeHtml(issue.id)}.md" download>Markdown ↓</a><a href="/downloads/${escapeHtml(issue.id)}.zip" download>본문과 그림 ZIP ↓</a></div></section>
    <nav class="article-bottom-nav" aria-label="다음 읽기"><a href="/">← 글 목록</a><a href="/tags/">태그로 더 찾기 →</a></nav>
  </article>`;
}
