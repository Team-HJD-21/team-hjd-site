// Korean remains available without JavaScript. Translations contain only trusted site copy.
const translations = [
  ['.skip-link', 'Skip to content', '跳转到正文'],
  ['nav a[href="#about"]', 'About', '关于我们'],
  ['nav a[href="#project"]', 'Games', '游戏'],
  ['.nav-contact', 'Contact', '联系我们'],
  ['nav a[href="https://docs.teamhjd.com/"]', 'Docs <span aria-hidden="true">↗</span>', '开发文档 <span aria-hidden="true">↗</span>'],
  ['footer a[href="https://docs.teamhjd.com/"]', 'Docs ↗', '开发文档 ↗'],
  ['.footer-name-label', 'Registered business name', '登记名称'],
  ['.footer-owner-label', 'Business representative', '负责人'],
  ['.footer-owner-value', 'HWANG JAEDONG', 'HWANG JAEDONG'],
  ['.footer-registration-label', 'Business registration no.', '韩国营业登记号'],
  ['.footer-address-label', 'Business address', '营业地址'],
  ['.footer-privacy', 'Privacy policy (Korean)', '隐私政策（韩文）'],
  ['.contact-privacy-note', 'Review our privacy notice before opening your email app.', '请先阅读隐私说明，再打开邮件应用。'],
  ['.hero-caption', 'IN DEVELOPMENT · PC GAME', '开发中 · PC 游戏'],
  ['.project .section-label p', 'OUR GAME', '我们的游戏'],
  ['.about .section-label p', 'THE STUDIO', '工作室'],
  ['.contact .section-label p', 'GET IN TOUCH', '联系'],
  ['.project-status', '<span class="status-dot" aria-hidden="true"></span> IN DEVELOPMENT', '<span class="status-dot" aria-hidden="true"></span> 开发中'],
  ['.art-caption', 'STRATEGY. DEFENSE. SURVIVAL.', '策略 · 防御 · 生存'],
  ['#hero-title', 'Power your defenses.<br><em>Stand your ground.</em>', '部署防御，<br><em>迎战来敌。</em>'],
  ['.hero-description', 'Power is limited. The aliens keep coming.<br>Manage your turrets and fight alongside them in a strategic defense game.', '电力有限，外星生物却源源不断。<br>调配炮塔电力，亲自加入战斗，守住防线。'],
  ['.actions .primary', 'View on Steam <span aria-hidden="true">↗</span>', '在 Steam 上查看 <span aria-hidden="true">↗</span>'],
  ['.actions .text-link', 'Explore the game <span aria-hidden="true">↓</span>', '了解游戏 <span aria-hidden="true">↓</span>'],
  ['#about-title', 'Built on a love<br>of making games.', '热爱开发，<br>用心做游戏。'],
  ['.about-content > div:last-child > p:first-child', 'We are TeamHJD, a game development team. We combine our ideas and skills to bring our games to life.', '我们是 TeamHJD，一支游戏开发团队。我们将创意与技术相结合，一起把想法做成游戏。'],
  ['.about-content .muted', 'HJD stands for Happy Journey of Developers.<br>For us, making games is a journey we share.', 'HJD 是 Happy Journey of Developers 的缩写。<br>对我们而言，游戏开发是一段共同探索的旅程。'],
  ['#leadership-title', 'Co-founders', '联合创始人'],
  ['.small-note', 'Currently in development', '开发中'],
  ['.project-genre', 'Strategic defense', '策略防守'],
  ['.project-copy > p:not([class])', 'Every turret draws power, and there is only so much to go around. Switch turrets on and off to keep your defenses running, decide where power matters most, and take the fight into your own hands.', '每座炮塔都需要电力，而可用电力有限。灵活开关炮塔，把电力留给最需要的地方，再亲自上阵抵御来袭的敌人。'],
  ['.project-disclaimer', 'In development. Features and content are subject to change.', '游戏正在开发中，玩法与内容可能调整。'],
  ['.project-copy .text-link', 'Explore the code on GitHub <span aria-hidden="true">↗</span>', '在 GitHub 上查看源代码 <span aria-hidden="true">↗</span>'],
  ['.steam-link', 'View on Steam <span aria-hidden="true">↗</span>', '在 Steam 上查看 <span aria-hidden="true">↗</span>'],
  ['#project-team-title', 'The team behind THE DEVELOPER', 'THE DEVELOPER 开发团队'],
  ['#project .team-roster > p', 'A five-person team, including both co-founders, is bringing THE DEVELOPER to life.', 'THE DEVELOPER 由五人团队共同开发，两位联合创始人也参与其中。'],
  ['.project-team > div:first-child h4', 'Co-founders', '联合创始人'],
  ['.project-team > div:last-child h4', 'Team', '开发成员'],
  ['#contact-title', 'Let’s talk.', '联系我们'],
  ['.contact-content > div > p:first-child', 'Questions about TeamHJD or THE DEVELOPER? Get in touch by email.', '想了解 TeamHJD 或 THE DEVELOPER？欢迎通过邮件联系我们。'],
];
const copy = translations.map(([selector, en, zh]) => {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Missing translation target: ${selector}`);
  return {element, ko: element.innerHTML, en, 'zh-CN': zh};
});
const descriptions = {
  ko: '게임 개발팀 TeamHJD. 개발 중인 프로젝트 THE DEVELOPER와 팀의 소식을 만나보세요.',
  en: 'TeamHJD is the game development team behind THE DEVELOPER, a strategic defense game currently in development.',
  'zh-CN': 'TeamHJD 游戏开发团队，正在制作策略防守游戏 THE DEVELOPER。了解我们的游戏与团队。',
};
const labels = {
  ko: ['TeamHJD 홈', '주 메뉴', 'THE DEVELOPER 공식 아트. Steam 스토어로 이동합니다.', 'THE DEVELOPER 공식 Steam 아트. 게임 화면이 아닙니다.'],
  en: ['TeamHJD home', 'Main navigation', 'THE DEVELOPER official artwork. Visit the Steam store.', 'THE DEVELOPER official Steam artwork. Not a gameplay screenshot.'],
  'zh-CN': ['TeamHJD 首页', '主导航', 'THE DEVELOPER 官方宣传图。前往 Steam 商店。', 'THE DEVELOPER 官方 Steam 宣传图，非实机截图。'],
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
  ['.header .wordmark', '.header nav', '.game-visual', '.project-art'].forEach((selector, index) => {
    document.querySelector(selector).setAttribute('aria-label', labels[lang][index]);
  });
  document.querySelector('.footer-links').setAttribute('aria-label', {ko:'하단 메뉴',en:'Footer navigation','zh-CN':'页脚导航'}[lang]);
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
  // Safari may blur summary on a button tap without focusing the button.
  // Closing on a null target removes the option before its click arrives.
  if (event.relatedTarget && !switcher.contains(event.relatedTarget)) switcher.open = false;
});
