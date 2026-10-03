// Korean remains available without JavaScript. Translations contain only trusted site copy.
const translations = [
  ['.skip-link', 'Skip to content', '跳转到正文'],
  ['nav a[href="#about"]', 'About us', '团队介绍'],
  ['nav a[href="#project"]', 'Projects', '项目'],
  ['.nav-contact', 'Contact', '联系我们'],
  ['#hero-title', 'Games we create together.<br>A <em>journey</em> we share.', '一起创造游戏。<br>一起踏上开发的<em>旅程。</em>'],
  ['.hero-description', 'We are TeamHJD — a game development team.<br>We turn ideas into playable experiences.', '我们是游戏开发团队 TeamHJD。<br>我们将创意变成可以亲身体验的游戏。'],
  ['.actions .primary', 'Explore our project <span aria-hidden="true">↗</span>', '探索我们的项目 <span aria-hidden="true">↗</span>'],
  ['.actions .text-link', 'Meet the team <span aria-hidden="true">→</span>', '了解我们的团队 <span aria-hidden="true">→</span>'],
  ['#about-title', 'Turning the joy of development<br>into games.', '将开发的乐趣<br>融入游戏。'],
  ['.about-content > div > p:first-child', 'TeamHJD is a team of developers creating games together. We bring our ideas and skills together to build a shared play experience.', 'TeamHJD 是一个携手制作游戏的开发团队。我们汇集各自的创意与技术，共同打造游戏体验。'],
  ['.about-content .muted', 'HJD stands for Happy Journey of Developers.<br>Our name reflects the development journey we share.', 'HJD 是 Happy Journey of Developers 的缩写。<br>我们的名字承载着共同前行的开发之旅。'],
  ['#leadership-title', 'Co-representatives', '联合负责人'],
  ['.small-note', 'Our project in development', '正在开发的项目'],
  ['.project-genre', 'Strategy defense game', '策略防御游戏'],
  ['.project-copy > p:not([class])', 'Manage your defenses by switching turrets on and off within a limited power budget. Decide where to focus your power and join the battle yourself to respond to threats.', '在有限的电力预算内，通过开启与关闭炮塔来部署防御。决定将电力集中在何处，并亲自参与战斗以应对威胁。'],
  ['.project-disclaimer', 'This project is in development. Details may change.', '项目正在开发中，具体内容可能有所调整。'],
  ['.project-copy .text-link', 'View the project on GitHub <span aria-hidden="true">↗</span>', '在 GitHub 上查看项目 <span aria-hidden="true">↗</span>'],
  ['#project-team-title', 'The team behind THE DEVELOPER', 'THE DEVELOPER 项目团队'],
  ['#project .team-roster > p', 'Our two co-representatives and three team members are developing the game together.', '两位联合负责人与三位团队成员共同参与游戏开发。'],
  ['.project-team > div:first-child h4', 'Co-representatives', '联合负责人'],
  ['.project-team > div:last-child h4', 'Team members', '团队成员'],
  ['#contact-title', 'We look forward<br>to hearing from you.', '期待与你<br>交流。'],
  ['.contact-content p', 'Email us with questions about our team or project.', '如有关于团队或项目的问题，欢迎通过电子邮件联系我们。'],
];
const copy = translations.map(([selector, en, zh]) => {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Missing translation target: ${selector}`);
  return {element, ko: element.innerHTML, en, 'zh-CN': zh};
});
const descriptions = {
  ko: '게임 개발팀 TeamHJD. 개발 중인 프로젝트 THE DEVELOPER와 팀의 소식을 만나보세요.',
  en: 'Meet TeamHJD — a game development team creating THE DEVELOPER.',
  'zh-CN': '了解游戏开发团队 TeamHJD 与正在开发的项目 THE DEVELOPER。',
};
const labels = {
  ko: ['TeamHJD 홈', '주 메뉴', 'TeamHJD 로켓 로고', 'THE DEVELOPER 프로젝트 타이틀 그래픽. 게임 화면이 아닙니다.'],
  en: ['TeamHJD home', 'Main navigation', 'TeamHJD rocket logo', 'THE DEVELOPER title graphic. Not a gameplay screenshot.'],
  'zh-CN': ['TeamHJD 首页', '主导航', 'TeamHJD 火箭标志', 'THE DEVELOPER 项目标题图。并非游戏截图。'],
};
const switcher = document.querySelector('#language-switcher');
const languageButtons = [...switcher.querySelectorAll('[data-language]')];
const languageNames = {ko: '한국어', en: 'English', 'zh-CN': '简体中文'};
function applyLanguage(language) {
  const lang = Object.hasOwn(descriptions, language) ? language : 'ko';
  for (const item of copy) item.element.innerHTML = item[lang];
  document.documentElement.lang = lang;
  document.querySelector('meta[name="description"]').content = descriptions[lang];
  document.querySelector('meta[property="og:description"]').content = descriptions[lang];
  ['.header .wordmark', 'nav', '.brand-scene', '.project-art'].forEach((selector, index) => {
    document.querySelector(selector).setAttribute('aria-label', labels[lang][index]);
  });
  document.querySelector('#current-language').textContent = languageNames[lang];
  languageButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === lang)));
  return lang;
}
let savedLanguage;
try { savedLanguage = localStorage.getItem('teamhjd-language'); } catch { /* Storage may be disabled. */ }
applyLanguage(new URL(location.href).searchParams.get('lang') || savedLanguage || 'ko');
languageButtons.forEach(button => button.addEventListener('click', () => {
  const lang = applyLanguage(button.dataset.language);
  try { localStorage.setItem('teamhjd-language', lang); } catch { /* Selection still works without storage. */ }
  const url = new URL(location.href);
  url.searchParams.set('lang', lang);
  history.replaceState(null, '', url);
  switcher.open = false;
  switcher.querySelector('summary').focus();
}));
document.addEventListener('click', event => {
  if (!switcher.contains(event.target)) switcher.open = false;
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && switcher.open) {
    switcher.open = false;
    switcher.querySelector('summary').focus();
  }
});
switcher.addEventListener('focusout', event => {
  if (!switcher.contains(event.relatedTarget)) switcher.open = false;
});
