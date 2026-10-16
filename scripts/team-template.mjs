import {members} from '../data/team.mjs';

export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
export const provided = value => typeof value === 'string' && value.trim() !== '' && value.trim().toUpperCase() !== 'X';
const arrow = '<span aria-hidden="true">↗</span>';
const icons = {
  blog: '<path d="M5 3h11a3 3 0 0 1 3 3v15H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3M4 17h15M8 7h7M8 11h5"/>',
  portfolio: '<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M9 6V4h6v2M4 11h16M10 11v3h4v-3"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 10v7M7 7v.1M11 17v-7M11 13c0-4 6-4 6 0v4"/>',
  github: '<path d="M9 19c-4 1-4-2-6-2m12 5v-4c0-1 .1-1.5-.5-2 3-.3 5.5-1.5 5.5-6 0-1.5-.5-2.5-1.5-3.5.2-.9.2-2-.2-3.5 0 0-1.3-.4-4 1a13 13 0 0 0-6.6 0c-2.7-1.4-4-1-4-1-.4 1.5-.4 2.6-.2 3.5C2.5 7.5 2 8.5 2 10c0 4.5 2.5 5.7 5.5 6-.6.5-.5 1-.5 2v4"/>',
};

export function renderRoster(project) {
  return `<ul class="people participant-list">${project.participants.map(person => {
    const member = members.find(item => item.id === person.memberId);
    if (!member) throw new Error(`Unknown member: ${person.memberId}`);
    const name = member.profileEnabled
      ? `<a class="member-profile-link" href="team/${escape(member.slug)}/index.html?from=${escape(project.id)}">${escape(member.rosterName)} ${arrow}</a>`
      : `<span>${escape(member.rosterName)}</span>`;
    return `<li>${name}<span class="participant-meta" lang="en">${(person.roles || []).filter(provided).map(role => `<span>${escape(role)}</span>`).join('')}</span></li>`;
  }).join('')}</ul>`;
}

export function renderStudioLeadership() {
  return `<ul class="people studio-leaders">${members.filter(member => member.organizationTitle?.ko === '공동대표').map(member => `<li><a class="member-profile-link" href="team/${escape(member.slug)}/index.html?from=studio">${escape(member.rosterName)}</a></li>`).join('')}</ul>`;
}

export function renderProfileCard(member) {
  const hasImage = provided(member.image?.src);
  const hasPortrait = hasImage || provided(member.portraitPlaceholder);
  const links = (member.links || []).filter(link => provided(link.href) && /^https:\/\//.test(link.href) && provided(link.label));
  const interests = (member.interests || []).filter(provided);
  const email = provided(member.contactEmail) ? member.contactEmail : '';
  return `<article class="member-profile${hasPortrait ? '' : ' without-photo'}" aria-labelledby="member-name">
    ${hasPortrait ? `<div class="portrait-stage"><div class="portrait-orbit" aria-hidden="true"></div><div class="portrait-card" data-tilt>
      <div class="portrait-flipper">
      <div class="portrait-front">
      ${hasImage ? `<div class="portrait-image"><img src="../../${escape(member.image.src)}" width="${escape(member.image.width || 1608)}" height="${escape(member.image.height || 2145)}" alt="${escape(member.image.alt || member.name)}" style="object-position:${escape(member.image.position || '50% 50%')}" fetchpriority="high"></div>` : `<div class="portrait-placeholder"><span>${escape(member.portraitPlaceholder)}</span></div>`}
      <div class="portrait-shine" aria-hidden="true"></div>
      <div class="portrait-sheen" aria-hidden="true"></div>
      ${hasImage ? '<div class="portrait-topline" aria-hidden="true"><span class="rocket-mark"><img src="../../assets/teamhjd-logo.png" width="650" height="650" alt=""></span></div>' : ''}
      <div class="portrait-caption" aria-hidden="true"><span>${escape(hasImage ? member.englishName || member.name : member.name)}</span></div>
      </div>
      <div class="portrait-back" aria-hidden="true"><span class="rocket-mark"><img src="../../assets/teamhjd-logo.png" width="650" height="650" alt=""></span></div>
      </div>
    </div><div class="motion-controls" data-motion-controls hidden><button type="button" data-sensor-toggle aria-pressed="false">기울기 효과 켜기</button><button type="button" data-sensor-center hidden>기준 재설정</button><p class="motion-status" data-motion-status role="status" aria-live="polite" hidden></p></div></div>` : ''}
    <div class="member-copy">
      <p class="eyebrow profile-eyebrow"><span class="status-dot" aria-hidden="true"></span> THE PEOPLE AT TEAMHJD</p>
      <h1 id="member-name">${escape(member.name)}</h1>
      ${provided(member.englishName) ? `<p class="member-english" lang="en">${escape(member.englishName)}</p>` : ''}
      ${provided(member.shortBio) ? `<p class="member-bio" lang="ko">${escape(member.shortBio)}</p>` : ''}
      ${interests.length ? `<section class="member-interests" aria-labelledby="interests-heading"><h2 id="interests-heading" data-copy="profileInterests">관심 분야</h2><ul>${interests.map(interest => `<li>${escape(interest)}</li>`).join('')}</ul></section>` : ''}
      ${links.length || email ? `<div class="member-connect"><p class="connect-heading" data-copy="profileConnect">더 알아보기 & 연락하기</p>
      ${links.length ? `<div class="member-links">${links.map(link => `<a href="${escape(link.href)}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[link.icon] || icons.portfolio}</svg><span>${escape(link.label)}</span>${arrow}</a>`).join('')}</div>` : ''}
      ${email ? `<a class="member-email" href="mailto:${escape(email)}"><span class="email-label">EMAIL</span><span>${escape(email)}</span>${arrow}</a>` : ''}</div>` : ''}
    </div>
  </article>`;
}

export function renderProfilePage(member, home) {
  // Reuse the actual homepage chrome, including its registered business details.
  const rebase = html => html.replace(/\b(href|src)="(?!https?:|mailto:|\/\/)([^"]+)"/g, (_, attr, url) => `${attr}="../../${url.startsWith('#') ? 'index.html' + url : url}"`);
  let header = rebase(home.match(/<header class="header">[\s\S]*?<\/header>/)[0]);
  header = header.replace('id="language-switcher"', 'id="page-language"').replace('id="current-language"', 'id="page-current-language"').replaceAll('data-language=', 'data-page-language=');
  for (const [text, key] of [['팀 소개','profileAbout'], ['프로젝트','profileGames'], ['연락하기','profileContact']]) header = header.replace(`>${text}</a>`, ` data-copy="${key}">${text}</a>`);
  let footer = rebase(home.match(/<footer class="shell footer">[\s\S]*?<\/footer>/)[0]);
  const footerKeys = {'footer-name-label':'footerName','footer-owner-label':'footerOwner','footer-owner-value':'footerOwnerValue','footer-registration-label':'footerRegistration','footer-commerce-label':'footerCommerce','footer-address-label':'footerAddress','footer-privacy':'privacy','footer-press':'profilePress','footer-content-policy':'policy','ai-policy-short':'footerAI','related-sites-label':'relatedSites'};
  for (const [cls,key] of Object.entries(footerKeys)) footer = footer.replace(`class="${cls}"`, `class="${cls}" data-copy="${key}"`);
  footer = footer.replace('팀 개발 문서 <span', '<span data-copy="teamDocs">팀 개발 문서</span> <span');
  footer = footer.replace('class="business-info-link"', 'class="business-info-link" data-copy="footerBusinessCheck"');
  return `<!doctype html>
<!-- Generated by scripts/render-team.mjs. Edit data/team.mjs and scripts/team-template.mjs. -->
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#080f17">
<title>${escape(member.name)} — TeamHJD</title><meta name="description" content="${escape(provided(member.shortBio) ? member.shortBio : member.name + ' — TeamHJD')}">
<link rel="canonical" href="https://teamhjd.com/team/${escape(member.slug)}/"><link rel="icon" href="../../assets/favicon.png"><link rel="stylesheet" href="../../styles.css"><link rel="stylesheet" href="../../profile.css"></head>
<body class="profile-page"><a class="skip-link" href="#main" data-copy="profileSkip">본문으로 이동</a>${header}
<main class="shell profile-main" id="main"><div class="profile-breadcrumb"><a class="profile-back" href="../../index.html#project-team"><span aria-hidden="true">←</span> <span data-copy="profileBack">함께 만드는 사람들</span></a><span class="profile-page-label">TEAM / PROFILE</span></div>
${renderProfileCard(member)}
<div class="profile-signoff" aria-hidden="true"><span>HAPPY JOURNEY OF DEVELOPERS.</span><span>함께 만드는 즐거움 <span class="signoff-star">✳</span></span></div></main>
${footer}<script src="../../public-pages.js" defer></script><script src="../../profile.js" defer></script></body></html>\n`.replace(/^[\t ]+$/gm, '');
}
