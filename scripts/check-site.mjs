import {readFileSync, existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const html = readFileSync('index.html', 'utf8');
const css = readFileSync('styles.css', 'utf8');
assert.match(html, /<html lang="ko">/);
assert.match(html, /https:\/\/teamhjd.com\//);
assert.match(html, /https:\/\/docs.teamhjd.com\//);
assert.match(html, /개발 중/);
assert.match(html, /mailto:support@teamhjd.com/);
assert.match(html, /id="language-switcher"/);
for (const name of ['YANG HYUNSEOK','HWANG JAEDONG','KIM JINTAE','LEE YOUNGBIN','JO SUNBIN']) assert.ok(html.includes(name), `Missing team member ${name}`);
assert.match(css, /max-width:600px/);
assert.match(css, /prefers-reduced-motion/);
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
assert.equal(ids.length, new Set(ids).size, 'Duplicate HTML IDs');
for (const [, path] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (path.startsWith('#')) assert.ok(ids.includes(path.slice(1)), `Missing anchor ${path}`);
  else if (!/^(?:https?:|mailto:)/.test(path)) assert.ok(existsSync(path), `Missing file ${path}`);
}
assert.match(readFileSync('404.html','utf8'), /https:\/\/docs.teamhjd.com/);
console.log('Public website links, assets, anchors and responsive safeguards passed.');
