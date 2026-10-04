// Trusted public copy; Korean HTML also works without JavaScript.
const publicCopy = {
  home: ['Company website ↗', '公司官网 ↗'],
  pressHeading: ['Press kit', '媒体资料包'],
  pressLead: ['Official information and media for introducing TeamHJD and The Developer.', '用于介绍 TeamHJD 和 The Developer 的官方信息与媒体素材。'],
  overview: ['Game & studio', '游戏与工作室'], usage: ['Usage terms', '使用条件'], assets: ['Logos & official artwork', '标志与官方宣传图'], screenshots: ['Game screenshots', '游戏截图'], trailer: ['Trailer', '预告片'],
  gameDescription: ['The Developer is a strategic defense game where you distribute limited power across your turrets and fight alongside them to repel alien attacks.', 'The Developer 是一款策略防守游戏：调配有限电力，让炮塔发挥作用，同时亲自上阵抵御外星生物。'],
  studioDescription: ['TeamHJD is a game development team. Our name stands for Happy Journey of Developers: a shared journey of bringing our ideas and skills together to make games.', 'TeamHJD 是一支游戏开发团队。我们的名字意为 Happy Journey of Developers：把彼此的创意与技术汇聚起来，一起探索游戏开发。'],
  developer: ['Developer', '开发团队'], platformLabel: ['Platforms', '支持平台'], languageLabel: ['Game languages', '游戏语言'], gameLanguages: ['Korean and English; Chinese planned for a later update', '韩语、英语；后续计划加入中文'], releaseLabel: ['Target release', '发行目标'], release: ['February 2027 (planned)', '计划于 2027 年 2 月发行'], steam: ['Official Steam page ↗', '官方 Steam 页面 ↗'], contactLabel: ['Contact', '联系我们'],
  developmentNote: ['The game is in development. These images may differ from the release version; plans and features are subject to change.', '游戏正在开发中。这些图片可能与发行版本不同，计划与具体内容也可能调整。'],
  usageAllowed: ['You may use these materials in game introductions, news articles, and reviews.', '允许将这些素材用于游戏介绍、新闻报道和评测。'],
  usageCredit: ['Credit TeamHJD as the source.', '必须注明素材来源为 TeamHJD。'], usageNoAlter: ['Do not alter the images.', '禁止修改图片。'],
  usageNoAI: ['Use for AI model training, fine-tuning, or training datasets is prohibited.', '禁止用于 AI 模型训练、微调或训练数据集。'],
  usageContact: ['We recommend contacting support@teamhjd.com before use. Advance contact is encouraged, not required.', '建议使用前联系 support@teamhjd.com；事先咨询属于建议，并非强制条件。'],
  pressContact: ['Prepare a press enquiry ↗', '准备媒体咨询邮件 ↗'],
  scope: ['This permission applies only to the public materials in this press kit. It does not permit redistribution of source code or original in-game assets.', '该许可仅适用于本媒体资料包中的公开素材，不允许分发游戏源代码或原始游戏资产。'],
  companyLogo: ['Company logo', '公司标志'], gameArtwork: ['The Developer official artwork', 'The Developer 官方宣传图'], download: ['Download original PNG ↓', '下载原始 PNG ↓'],
  screenshotsNote: ['Five game screenshots approved for public use. Original PNG files are provided without alterations.', '五张可公开使用的游戏截图，提供未经修改的原始 PNG 文件。'],
  trailerNote: ['Watch the official trailer on YouTube. No third-party video player is loaded automatically on this page.', '可在 YouTube 观看官方预告片。本页不会自动加载第三方视频播放器。'], watchTrailer: ['Watch on YouTube ↗', '前往 YouTube 观看 ↗'], privacy: ['Privacy policy (Korean)', '隐私政策（韩文）'],
  policy: ['Content use & AI training policy', '内容使用与 AI 训练政策'], policyDate: ['Effective October 5, 2026', '生效日期：2026 年 10 月 5 日'],
  policyLead: ['Search and information retrieval are welcome. Use of our content for AI training is not permitted.', '欢迎搜索和信息查询，但不允许将本站内容用于 AI 训练。'],
  policyScopeTitle: ['Scope', '适用范围'],
  policyScope: ['This policy applies to text, images, logos, screenshots, and other content on TeamHJD websites and documentation (teamhjd.com and docs.teamhjd.com). Third-party rights remain with their owners; separately stated rights and licenses also apply.', '本政策适用于 TeamHJD 网站及文档站（teamhjd.com、docs.teamhjd.com）的文字、图片、标志、截图及其他内容。第三方权利归其权利人所有；单独注明的权利与许可条件也适用。'],
  allowedTitle: ['Permitted uses', '允许的使用'],
  allowedBody: ['Ordinary and AI-powered search, real-time retrieval to answer a user’s question, and links to sources are permitted. This does not authorize keeping our content for AI training or adding it to training datasets.', '允许普通搜索、AI 搜索、为回答用户问题而进行的实时信息查询以及提供来源链接。这不授予为 AI 训练保存内容或将其纳入训练数据集的权利。'],
  prohibitedTitle: ['Prohibited uses', '禁止的使用'],
  prohibitedBody: ['Without prior written permission from TeamHJD, our content must not be used for AI or machine-learning training, retraining, fine-tuning, or the collection, creation, or distribution of training datasets. Public access or a download does not constitute permission for these uses.', '未经 TeamHJD 事先书面许可，不得将内容用于 AI 或机器学习模型训练、再训练、微调，或训练数据集的收集、制作、分发。公开访问或下载不构成对这些用途的许可。'],
  pressUsageTitle: ['Materials for articles & reviews', '报道与评测素材'],
  pressUsageBody: ['Images for game introductions, articles, and reviews may be used under the press-kit terms: credit TeamHJD, do not alter images, and do not use them for AI training. We recommend contacting us before use.', '游戏介绍、报道和评测可按媒体资料包条件使用图片：必须注明 TeamHJD 来源，不得修改图片，不得用于 AI 训练。建议使用前联系我们。'],
  viewPress: ['View press-kit terms ↗', '查看媒体资料使用条件 ↗'], implementationTitle: ['Crawler settings & limitations', '爬虫设置与限制'],
  implementationBody: ['Our robots.txt declines training crawlers while allowing separate search crawlers. This is a request to services that honor these rules, not a technical guarantee against all collection or AI training. Blocking Google-Extended may also limit some Gemini retrieval uses, but does not block ordinary Google Search.', 'robots.txt 拒绝训练爬虫，并允许用途可区分的搜索爬虫。这是向遵守规则的服务提出的请求，无法从技术上保证阻止所有采集或 AI 训练。屏蔽 Google-Extended 也可能限制 Gemini 的部分信息查询用途，但不会屏蔽普通 Google 搜索。'],
};
const pageItems = [...document.querySelectorAll('[data-copy]')].map(element => ({element, key:element.dataset.copy, ko:element.textContent}));
const switcher = document.querySelector('#page-language');
const names = {ko:'한국어', en:'English', 'zh-CN':'简体中文'};
function applyPageLanguage(language) {
  const lang = Object.hasOwn(names, language) ? language : 'ko';
  for (const item of pageItems) {
    if (!publicCopy[item.key]) throw new Error(`Missing translation: ${item.key}`);
    item.element.textContent = lang === 'ko' ? item.ko : publicCopy[item.key][lang === 'en' ? 0 : 1];
  }
  document.documentElement.lang = lang;
  document.querySelector('#page-current-language').textContent = names[lang];
  for (const button of switcher.querySelectorAll('[data-page-language]')) button.setAttribute('aria-pressed', String(button.dataset.pageLanguage === lang));
  for (const link of document.querySelectorAll('a')) {
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || /\.(png|webp)$/i.test(url.pathname) || link.getAttribute('href').startsWith('#')) continue;
    url.searchParams.set('lang', lang); link.href = url.pathname + url.search + url.hash;
  }
  return lang;
}
let storedLanguage; try { storedLanguage = localStorage.getItem('teamhjd-language'); } catch {}
applyPageLanguage(new URL(location.href).searchParams.get('lang') || storedLanguage || 'ko');
for (const button of switcher.querySelectorAll('[data-page-language]')) button.addEventListener('click', () => {
  const lang = applyPageLanguage(button.dataset.pageLanguage);
  try { localStorage.setItem('teamhjd-language', lang); } catch {}
  const url = new URL(location.href); url.searchParams.set('lang', lang); history.replaceState(null, '', url);
  switcher.open = false; switcher.querySelector('summary').focus();
});
document.addEventListener('click', event => { if (!switcher.contains(event.target)) switcher.open = false; });
document.addEventListener('keydown', event => { if (event.key === 'Escape') switcher.open = false; });
