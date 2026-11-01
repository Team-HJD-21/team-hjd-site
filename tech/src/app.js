(() => {
  'use strict';

  const themeButton = document.querySelector('[data-theme-toggle]');
  const preference = window.matchMedia('(prefers-color-scheme: dark)');
  const currentTheme = () => document.documentElement.dataset.theme || (preference.matches ? 'dark' : 'light');
  function updateThemeLabel() {
    const label = currentTheme() === 'dark' ? '밝은 화면으로 보기' : '어두운 화면으로 보기';
    themeButton?.setAttribute('aria-label', label);
    themeButton?.setAttribute('title', label);
  }
  themeButton?.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('frame-theme', next); } catch {}
    updateThemeLabel();
  });
  preference.addEventListener('change', updateThemeLabel);
  updateThemeLabel();

  const dialog = document.querySelector('[data-image-dialog]');
  let savedOverflow = '';
  document.querySelectorAll('[data-lightbox]').forEach((link) => {
    link.addEventListener('click', (event) => {
      // The image remains an ordinary link when dialog support is unavailable.
      if (!dialog || typeof dialog.showModal !== 'function') return;
      event.preventDefault();
      const image = link.querySelector('img');
      const full = dialog.querySelector('[data-image-full]');
      full.src = link.href;
      full.alt = image.alt;
      dialog.querySelector('[data-image-original]').href = link.href;
      dialog.querySelector('[data-image-caption]').textContent = link.closest('figure').querySelector('figcaption')?.textContent || image.alt;
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      dialog.showModal();
    });
  });
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog?.addEventListener('close', () => { document.body.style.overflow = savedOverflow; });

  const searchRoot = document.querySelector('[data-search-page]');
  if (!searchRoot) return;
  const index = JSON.parse(document.getElementById('content-index').textContent);
  const input = searchRoot.querySelector('#tag-query');
  const clear = searchRoot.querySelector('[data-search-clear]');
  const count = searchRoot.querySelector('#search-count');
  const results = searchRoot.querySelector('[data-search-results]');
  const empty = searchRoot.querySelector('[data-search-empty]');
  const browser = searchRoot.querySelector('[data-tag-browser]');

  // Alias normalization preserves + and # so C++ and C# remain distinct.
  const normalize = (value) => value.normalize('NFKC').toLowerCase().replace(/[\s_-]+/g, '');
  const tagById = new Map(index.tags.map((tag) => [tag.id, tag]));
  const tagCounts = new Map(index.tags.map((tag) => [tag.id, index.issues.filter((issue) => issue.tags.includes(tag.id)).length]));
  const create = (tagName, className, text) => {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const tagUrl = (tag) => `/tags/?q=${encodeURIComponent(tag.ko)}`;

  function chooseTag(tag, event) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    input.value = tag.ko;
    render(true);
    input.focus({ preventScroll: true });
    input.scrollIntoView({ block: 'center', behavior: 'auto' });
  }

  function makeTagLink(tag, { bilingual = false, selected = false, showCount = false } = {}) {
    const label = bilingual && tag.ko !== tag.en ? `${tag.ko} · ${tag.en}` : tag.ko;
    const link = create('a', `tag${selected ? ' is-selected' : ''}`, label);
    link.href = tagUrl(tag);
    link.title = tag.en;
    if (selected) link.setAttribute('aria-current', 'true');
    if (showCount) link.append(create('span', 'tag-count', String(tagCounts.get(tag.id))));
    link.addEventListener('click', (event) => chooseTag(tag, event));
    return link;
  }

  function makeIssueCard(issue) {
    const card = create('article', 'issue-card');
    const meta = create('div', 'meta');
    const time = create('time', '', issue.date.replaceAll('-', '.'));
    time.dateTime = issue.date;
    meta.append(time);
    if (issue.status === 'sample') meta.append(create('span', 'sample-label', '샘플'));
    const heading = create('h2');
    const link = create('a', '', issue.title);
    link.href = `/articles/${issue.slug}/`;
    heading.append(link);
    const tags = create('div', 'tags');
    tags.setAttribute('aria-label', '글의 태그');
    issue.tags.slice(0, 6).forEach((id) => tags.append(makeTagLink(tagById.get(id))));
    card.append(meta, heading, create('p', '', issue.description), tags);
    return card;
  }

  function render(updateUrl) {
    const query = input.value.trim();
    const normalized = normalize(query);
    const matching = index.tags.filter((tag) => [tag.id, tag.ko, tag.en, ...tag.aliases].some((alias) => normalize(alias).includes(normalized)));
    const matchingIds = new Set(matching.map((tag) => tag.id));
    // Matching always uses each issue's explicit tag IDs, never the whole catalog.
    const visibleIssues = index.issues.filter((issue) => !query || issue.tags.some((id) => matchingIds.has(id)));
    results.replaceChildren(...visibleIssues.map(makeIssueCard));
    count.textContent = `글 ${visibleIssues.length}개`;
    empty.hidden = visibleIssues.length !== 0;
    empty.textContent = query ? `‘${query}’ 태그로 연결된 글이 없습니다.` : '아직 글이 없습니다.';
    clear.hidden = query === '';

    const fragments = [];
    for (const group of [...new Set(index.tags.map((tag) => tag.group))]) {
      const groupTags = (query ? matching : index.tags).filter((tag) => tag.group === group);
      if (!groupTags.length) continue;
      const section = create('section', 'tag-group');
      const list = create('div', 'tags');
      groupTags.forEach((tag) => list.append(makeTagLink(tag, { bilingual: true, selected: Boolean(query), showCount: true })));
      section.append(create('h3', '', group), list);
      fragments.push(section);
    }
    browser.replaceChildren(...fragments);
    if (!fragments.length) browser.append(create('p', 'empty-results', '일치하는 태그가 없습니다.'));
    if (updateUrl) {
      const url = new URL(window.location.href);
      if (query) url.searchParams.set('q', query); else url.searchParams.delete('q');
      history.replaceState(null, '', `${url.pathname}${url.search}`);
    }
  }

  input.value = new URLSearchParams(window.location.search).get('q')?.slice(0, 120) || '';
  input.addEventListener('input', () => render(true));
  clear.addEventListener('click', () => { input.value = ''; render(true); input.focus(); });
  searchRoot.querySelector('form').addEventListener('submit', (event) => { event.preventDefault(); render(true); });
  window.addEventListener('popstate', () => { input.value = new URLSearchParams(window.location.search).get('q')?.slice(0, 120) || ''; render(false); });
  render(false);
})();
