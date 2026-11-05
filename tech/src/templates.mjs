export const SITE_URL = 'https://tech.teamhjd.com';
export const SITE_NAME = '겜붕이의 노트';
export const issuePath = issue => `/${issue.date}/${issue.slug}/`;

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
    <h2><a href="${issuePath(issue)}">${escapeHtml(issue.title)}</a></h2>
    <p>${escapeHtml(issue.description)}</p>
    <div class="tags" aria-label="글의 태그">${tagLinks(issue.tags, tags, { limit: 6 })}</div>
  </article>`;
}

export function page({ title, description, path = '/', active, content, math = false, data = null, footer = '', assetVersion = '1' }) {
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
  <meta property="og:image" content="${SITE_URL}/assets/brand/gambungi-share-v1.png">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="겜붕이의 노트 by TeamHJD · 매일 12시에 읽는 노트들">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${SITE_URL}/assets/brand/gambungi-share-v1.png">
  <meta name="twitter:image:alt" content="겜붕이의 노트 by TeamHJD · 매일 12시에 읽는 노트들">
  <link rel="icon" href="/assets/favicons/v1/notes/favicon.ico" sizes="16x16 32x32 48x48">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicons/v1/notes/favicon-32.png">
  <link rel="icon" type="image/svg+xml" sizes="any" href="/assets/favicons/v1/notes/favicon.svg">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/favicons/v1/notes/apple-touch-icon.png">
  <link rel="alternate" type="application/rss+xml" title="겜붕이의 노트" href="/feed.xml">
  <script>document.documentElement.dataset.theme='dark';try{const t=localStorage.getItem('frame-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}</script>
  <link rel="stylesheet" href="/assets/teamhjd.css?v=${assetVersion}">
  <link rel="stylesheet" href="/assets/styles.css?v=${assetVersion}">
  ${math ? '<link rel="stylesheet" href="/assets/vendor/katex/katex.min.css">' : ''}
  <script src="/assets/app.js?v=${assetVersion}" defer></script>
</head>
<body id="page-top">
  <a class="skip-link" href="#main-content">본문으로 건너뛰기</a>
  <header class="site-header">
    <a class="brand" href="/" aria-label="겜붕이의 노트 by TeamHJD, 글 목록"><img class="brand-wordmark" src="/assets/brand/gambungi-wordmark.svg" width="720" height="180" alt="겜붕이의 노트 by TeamHJD"></a>
    <nav class="site-nav" aria-label="주 메뉴">
      <a href="/"${active === 'index' ? ' aria-current="page"' : ''}>글 목록</a>
      <a href="/tags/"${active === 'tags' ? ' aria-current="page"' : ''}>태그 검색</a>
      <a class="nav-subscribe" href="/subscribe/"${active === 'subscribe' ? ' aria-current="page"' : ''}>구독하기</a>
      <button class="theme-toggle" type="button" aria-label="화면 색상 바꾸기" title="화면 색상 바꾸기" data-theme-toggle>
        <svg class="theme-icon" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" stroke="none"/></svg>
      </button>
    </nav>
  </header>
  <main id="main-content">${content}</main>
  ${footer}
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
    <header class="archive-heading"><h1>매일 하나씩 알아가는<br><em>호기심 가득한 게임 개발.</em></h1><p>하루 10분의 호기심이 쌓여, 게임 개발을 바라보는 깊이가 달라집니다.</p><p class="publish-schedule">매일 낮 12시, 새로운 노트를 이메일로 보내드립니다.</p></header>
    <div class="archive-count">글 ${issues.length}개</div>
    <div class="issue-list">${issues.map((issue) => issueCard(issue, tags)).join('')}</div>
  </div>`;
}

export function subscribeContent() {
  return `<div class="archive-shell subscribe-shell">
    <header class="archive-heading"><h1>구독하기</h1><p>매일 낮 12시, 새로운 게임 개발 이야기를 이메일로 받아보세요.</p></header>
    <section class="subscription-panel" aria-label="이메일 구독 신청">
      <form class="subscribe-form" action="/api/subscribe" method="post" data-subscribe-form>
        <input type="hidden" name="consentVersion" value="2026-11-03">
        <label for="subscriber-email">이메일 주소</label>
        <div class="subscribe-input-row"><input id="subscriber-email" name="email" type="email" maxlength="254" autocomplete="email" placeholder="you@example.com" required><button type="submit">구독하기</button></div>
        <div class="subscribe-consents">
          <label><input type="checkbox" name="privacyConsent" required><span><a href="/subscription/privacy/" target="_blank" rel="noopener noreferrer">개인정보 수집·이용</a>에 동의합니다. <small>필수</small></span></label>
          <label><input type="checkbox" name="emailConsent" required><span>겜붕이의 노트 이메일 수신에 동의합니다. <small>필수</small></span></label>
          <label><input type="checkbox" name="overseasConsent" required><span><a href="/subscription/privacy/#overseas" target="_blank" rel="noopener noreferrer">개인정보 국외 이전</a>에 동의합니다. <small>필수</small></span></label>
        </div>
        <div class="subscribe-trap" aria-hidden="true"><label>Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
        <p class="subscribe-note">이메일 확인 후 구독이 시작되며, 메일에서 언제든 해지하실 수 있습니다.</p>
        <p class="subscribe-status" role="status" aria-live="polite" data-subscribe-status></p>
        <p data-subscribe-manage hidden><a href="/subscription/manage/">구독 관리·해지하기</a></p>
      </form>
      <p class="subscription-help">구독 중이신가요? <a href="/subscription/manage/">구독 관리·해지하기</a></p>
    </section>
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
      <div class="meta"><time datetime="${escapeHtml(issue.date)}">${formatDate(issue.date)}</time><span>${escapeHtml(issue.format || '기술 해설')}${issue.status === 'sample' ? ' · 샘플' : ''}</span></div>
      <h1 id="issue-title">${escapeHtml(issue.title)}</h1>
      <p class="article-deck">${escapeHtml(issue.question)}</p>
      <div class="tags" aria-label="관련 태그">${tagLinks(issue.tags.filter((id) => id !== 'technical-explainer'), tags)}</div>
    </header>
    <details class="article-toc"><summary>이 글의 목차</summary><ol>${toc.map((item) => `<li><a href="#${escapeHtml(item.id)}">${item.title}</a></li>`).join('')}</ol></details>
    <p class="article-intro">${escapeHtml(issue.summary)}</p>
    <div class="prose">${body}</div>
    <section class="downloads" aria-labelledby="downloads-title"><h2 id="downloads-title">파일로 읽기</h2><div class="download-links"><a href="/downloads/${escapeHtml(issue.id)}.md" download>Markdown ↓</a><a href="/downloads/${escapeHtml(issue.id)}.zip" download>본문과 그림 ZIP ↓</a></div></section>
    <section class="article-feedback" data-feedback-issue="${escapeHtml(issue.id)}" aria-labelledby="feedback-title">
      <h2 id="feedback-title">오늘의 노트는 어땠나요?</h2>
      <div class="feedback-options" role="group" aria-label="글 반응 한 가지 선택"><button type="button" data-feedback-choice="useful" aria-pressed="false" disabled>유용해요</button><button type="button" data-feedback-choice="curious" aria-pressed="false" disabled>더 궁금해요</button><button type="button" data-feedback-choice="hard" aria-pressed="false" disabled>어려워요</button><button type="button" data-feedback-choice="easy" aria-pressed="false" disabled>좀 쉬워요</button></div>
      <p class="feedback-status" role="status" aria-live="polite" data-feedback-status></p><button type="button" class="feedback-undo" data-feedback-undo hidden>반응 취소</button>
      <noscript><p>반응을 남기려면 JavaScript를 켜 주세요.</p></noscript>
    </section>
    <nav class="article-bottom-nav" aria-label="다음 읽기"><a href="/">← 글 목록</a><a href="/tags/">태그로 더 찾기 →</a></nav>
  </article>`;
}
