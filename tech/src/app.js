(() => {
  'use strict';

  async function subscriptionPost(endpoint, body) {
    const response = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin'});
    const result = await response.json();
    if(!response.ok) throw new Error(result.message || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    return result;
  }
  const subscribeForm = document.querySelector('[data-subscribe-form]');
  const pendingStorage='gambungi-subscription-pending';
  const subscriptionChannel=typeof BroadcastChannel==='function' ? new BroadcastChannel('gambungi-subscription') : null;
  let pendingSubscription=null, pendingTimer=null, checkingSubscription=false;
  const warnPending=event=>{event.preventDefault();event.returnValue=true;};
  const savePending=()=>{try{if(pendingSubscription)sessionStorage.setItem(pendingStorage,JSON.stringify(pendingSubscription));else sessionStorage.removeItem(pendingStorage);}catch{}};
  const lockSubscription=locked=>subscribeForm?.querySelectorAll('input:not([type=hidden]),button[type=submit]').forEach(field=>field.disabled=locked);
  const finishPending=(confirmed,message)=>{
    pendingSubscription=null;clearTimeout(pendingTimer);savePending();window.removeEventListener('beforeunload',warnPending);
    if(!subscribeForm)return;
    lockSubscription(confirmed);subscribeForm.dataset.state=confirmed?'confirmed':'idle';
    subscribeForm.querySelector('button[type=submit]').textContent=confirmed?'구독 완료':'구독하기';
    subscribeForm.querySelector('[data-subscribe-status]').textContent=message;
    subscribeForm.querySelector('[data-subscribe-reset]').hidden=true;
    const manageLink=subscribeForm.querySelector('[data-subscribe-manage]');if(manageLink)manageLink.hidden=!confirmed;
  };
  async function checkSubscription(force=false){
    if(!pendingSubscription || checkingSubscription)return;
    clearTimeout(pendingTimer);
    if(Date.now()>pendingSubscription.expiresAt){finishPending(false,'인증 대기 시간이 끝났습니다. 다시 신청해 주세요.');return;}
    if(document.hidden && !force){pendingTimer=setTimeout(checkSubscription,5000);return;}
    checkingSubscription=true;
    try{
      const result=await subscriptionPost('/api/subscription-status',{token:pendingSubscription.watchToken});
      if(result.state==='confirmed')finishPending(true,'구독 확인이 완료됐습니다! 매일 새로운 게임 개발 이야기로 찾아뵙겠습니다.');
      else if(result.state==='expired')finishPending(false,'인증 대기가 만료됐습니다. 다시 신청해 주세요.');
    }catch{ /* Keep the pending state through temporary network failures. */ }
    finally{checkingSubscription=false;if(pendingSubscription)pendingTimer=setTimeout(checkSubscription,3000);}
  }
  function beginPending(result,email){
    pendingSubscription={watchToken:result.watchToken,expiresAt:result.expiresAt,email};savePending();lockSubscription(true);
    subscribeForm.dataset.state='waiting';subscribeForm.querySelector('button[type=submit]').textContent='인증 대기 중';
    subscribeForm.querySelector('[data-subscribe-status]').textContent=result.message;
    subscribeForm.querySelector('[data-subscribe-reset]').hidden=false;
    window.addEventListener('beforeunload',warnPending);clearTimeout(pendingTimer);checkSubscription();
  }
  if(subscribeForm){
    const reset=document.createElement('button');reset.type='button';reset.className='subscribe-reset';reset.dataset.subscribeReset='';reset.hidden=true;reset.textContent='이메일 주소 다시 입력';
    subscribeForm.append(reset);
    reset.addEventListener('click',()=>{if(confirm('이 창의 인증 대기를 종료하고 이메일 주소를 다시 입력할까요?'))finishPending(false,'이메일 주소를 확인하고 다시 신청해 주세요.');});
    try{const saved=JSON.parse(sessionStorage.getItem(pendingStorage)||'null');if(saved && /^[\w-]{43}$/.test(saved.watchToken) && saved.expiresAt>Date.now()){subscribeForm.elements.email.value=saved.email || '';beginPending({message:'이메일 인증을 기다리고 있습니다. 메일에서 확인 버튼을 눌러 주세요.',...saved},saved.email);}}catch{}
    window.addEventListener('focus',()=>checkSubscription(true));document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkSubscription(true);});
    if(subscriptionChannel)subscriptionChannel.onmessage=event=>{if(event.data?.type==='subscription-confirmed')checkSubscription(true);};
  }
  subscribeForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if(!subscribeForm.reportValidity()) return;
    const button=subscribeForm.querySelector('button[type=submit]'), status=subscribeForm.querySelector('[data-subscribe-status]');
    button.disabled=true; status.textContent='인증 메일을 준비하고 있습니다…';
    const values=new FormData(subscribeForm);
    try {const result=await subscriptionPost('/api/subscribe',{email:values.get('email'),website:values.get('website'),consentVersion:'2026-11-03',privacyConsent:values.has('privacyConsent'),emailConsent:values.has('emailConsent'),overseasConsent:values.has('overseasConsent')});if(result.waiting && result.watchToken)beginPending(result,String(values.get('email')));else status.textContent=result.message;}
    catch(error){status.textContent=error.message;} finally{if(!pendingSubscription)button.disabled=false;}
  });
  const actionForm=document.querySelector('[data-subscription-action]');
  const manageForm=document.querySelector('[data-manage-form]');
  manageForm?.addEventListener('submit',async event=>{event.preventDefault();if(!manageForm.reportValidity())return;const button=manageForm.querySelector('button'),status=manageForm.querySelector('[data-manage-status]');button.disabled=true;try{const result=await subscriptionPost('/api/manage',{email:new FormData(manageForm).get('email')});status.textContent=result.message;}catch(error){status.textContent=error.message;}finally{button.disabled=false;}});
  if(actionForm){
    // Merely loading an email link must never confirm or unsubscribe a reader.
    const token=new URLSearchParams(location.search).get('token') || '';
    history.replaceState(null,'',location.pathname);
    actionForm.addEventListener('submit',async event=>{
      event.preventDefault();const button=actionForm.querySelector('button'),status=actionForm.querySelector('[data-subscription-status]');
      button.disabled=true;
      try{const result=await subscriptionPost(`/api/${actionForm.dataset.subscriptionAction}`,{token});status.textContent=result.message;if(actionForm.dataset.subscriptionAction==='confirm'){subscriptionChannel?.postMessage({type:'subscription-confirmed'});status.textContent+=' 원래 신청 창에도 완료 상태가 자동 반영됩니다. 이 창은 닫으셔도 됩니다.';}}
      catch(error){status.textContent=error.message;button.disabled=false;}
    });
  }

  const themeButton = document.querySelector('[data-theme-toggle]');
  const preference = window.matchMedia('(prefers-color-scheme: dark)');
  const currentTheme = () => document.documentElement.dataset.theme || 'dark';
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

  const relatedSites = document.querySelector('#related-sites');
  document.addEventListener('click', (event) => {
    if (relatedSites && !relatedSites.contains(event.target)) relatedSites.open = false;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && relatedSites?.open) {
      relatedSites.open = false;
      relatedSites.querySelector('summary').focus();
    }
  });
  relatedSites?.addEventListener('focusout', (event) => {
    if (event.relatedTarget && !relatedSites.contains(event.relatedTarget)) relatedSites.open = false;
  });

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
    link.href = `/${issue.date}/${issue.slug}/`;
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

// Article feedback is independent of subscription and tag-search initialization.
(()=>{
 const root=document.querySelector('[data-feedback-issue]');if(!root)return;
 const buttons=[...root.querySelectorAll('[data-feedback-choice]')],undo=root.querySelector('[data-feedback-undo]'),status=root.querySelector('[data-feedback-status]');
 let selected=null,busy=true;
 const lock=value=>{busy=value;buttons.forEach(button=>button.disabled=value);undo.disabled=value;root.setAttribute('aria-busy',String(value));};
 const select=value=>{selected=value;buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.feedbackChoice===value)));undo.hidden=!value;};
 async function api(method,choice){
  const url='/api/feedback'+(method==='GET'?'?issueId='+encodeURIComponent(root.dataset.feedbackIssue):'');
  const response=await fetch(url,{method,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000),...(method==='GET'?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify({issueId:root.dataset.feedbackIssue,...(choice?{choice}:{})})})});
  const data=await response.json();if(!response.ok)throw new Error(data.message||'반응을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');return data;
 }
 async function send(choice){
  if(busy)return;if(choice&&choice===selected){status.textContent='선택하신 반응입니다.';return;}
  lock(true);status.textContent='저장하고 있습니다.';
  try{
   const write=async()=>{let result=await api(choice?'POST':'DELETE',choice);if(result.needsCookie)result=await api('POST',choice);return result;};
   const result=navigator.locks?await navigator.locks.request('gambungi-article-feedback',write):await write();
   if(result.needsCookie)throw new Error('반응을 남기려면 이 사이트의 쿠키를 허용해 주세요.');
   select(result.choice);status.textContent=selected?'반응을 남겨 주셔서 감사합니다.':'반응을 취소했습니다.';
  }catch(error){status.textContent=error.name==='TimeoutError'||error.name==='TypeError'?'저장 결과를 확인하지 못했습니다. 다시 눌러 주세요.':error.message;}
  finally{lock(false);}
 }
 buttons.forEach(button=>button.addEventListener('click',()=>send(button.dataset.feedbackChoice)));undo.addEventListener('click',()=>send(null));
 async function load(){lock(true);try{const result=await api('GET');select(result.choice);status.textContent=selected?'반응을 남겨 주셔서 감사합니다.':'';}catch{status.textContent='반응을 불러오지 못했습니다. 다시 눌러 주세요.';}finally{lock(false);}}
 load();window.addEventListener('pageshow',event=>{if(event.persisted)load();});
})();
