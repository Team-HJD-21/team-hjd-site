import {readFileSync, existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const html = readFileSync('index.html', 'utf8');
const css = readFileSync('styles.css', 'utf8');
assert.match(html, /<html lang="ko">/);
assert.match(html, /https:\/\/teamhjd.com\//);
assert.match(html, /property="og:image" content="https:\/\/teamhjd.com\/assets\/teamhjd-social.png"/);
assert.ok(existsSync('assets/teamhjd-social.png'), 'Missing company sharing logo');
assert.match(html, /https:\/\/docs.teamhjd.com\//);
assert.match(html, /개발 중/);
assert.match(html, /href="privacy\/index.html#email"/);
assert.match(html, /class="footer-privacy"/);
assert.match(html, /https:\/\/store.steampowered.com\/app\/4336820\/The_Developer\//);
assert.match(html, /id="language-switcher"/);
for (const name of ['YANG HYUNSEOK','HWANG JAEDONG','KIM JINTAE','LEE YOUNGBIN','JO SUBIN']) assert.ok(html.includes(name), `Missing team member ${name}`);
assert.ok(!html.includes('JO SUNBIN'), 'Incorrect team member spelling');
for (const value of ['팀 에이치제이디(TeamHJD)', '황재동', '622-10-17519', '경기도 수원시 영통구 태장로 71번길 19']) assert.ok(html.includes(value), `Missing registered business detail ${value}`);
assert.match(css, /max-width:600px/);
assert.match(css, /prefers-reduced-motion/);
const languageSource = readFileSync('languages.js', 'utf8');
assert.ok(!/co-representatives|联合负责人/i.test(languageSource), 'Outdated literal leadership titles');
assert.ok(languageSource.includes('Co-founders') && languageSource.includes('联合创始人'), 'Missing localized founder titles');
assert.ok(!/Co-CEOs|联席 CEO/.test(languageSource), 'Incorrect executive titles');
assert.ok(html.includes('전력을 나누고,') && html.includes('몰려오는 적을 막아라.'));
for (const asset of ['treant-walk', 'treant-infected-walk', 'slime-tentacle-walk', 'slime-king-walk', 'astronaut-sheet', 'meteor-big', 'meteor-small']) {
  assert.ok(existsSync(`assets/${asset}.png`), `Missing visitor asset ${asset}`);
}
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
assert.equal(ids.length, new Set(ids).size, 'Duplicate HTML IDs');
for (const [, path] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (path.startsWith('#')) assert.ok(ids.includes(path.slice(1)), `Missing anchor ${path}`);
  else if (!/^(?:https?:|mailto:)/.test(path)) assert.ok(existsSync(path.split('#')[0]), `Missing file ${path}`);
}
const privacy = readFileSync('privacy/index.html', 'utf8');
for (const value of ['문의 처리 완료 후 6개월', '황재동', '양현석', 'Google Asia Pacific Pte. Ltd.', '2026-10-04', 'id="collection-consent"', 'id="transfer-consent"']) assert.ok(privacy.includes(value), `Missing privacy detail ${value}`);
assert.ok(!/공개 전 확인|미지정|공개 전 검토용 초안/.test(privacy), 'Draft placeholders must not be published');
assert.ok(existsSync('privacy/privacy.css') && existsSync('privacy/privacy.js'));
assert.ok(!/localStorage|fetch\(|XMLHttpRequest/.test(readFileSync('privacy/privacy.js','utf8')), 'Consent must not add tracking or a backend');
assert.match(readFileSync('404.html','utf8'), /https:\/\/docs.teamhjd.com/);
console.log('Public website links, assets, anchors and responsive safeguards passed.');
