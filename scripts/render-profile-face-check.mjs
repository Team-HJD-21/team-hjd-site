// Local visual regression fixture. This script and its QA pages are not copied by the public build.
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {members} from '../data/team.mjs';
import {escape, renderProfileCard} from './team-template.mjs';

const buildRoot = path.resolve(process.argv[2] || '_site');
if (!existsSync(path.join(buildRoot, 'profile.css'))) throw new Error('Build the site first and pass its output directory');
const cases = members.filter(member => member.profileEnabled).flatMap(member => [0, 60, 120, 180].map(angle => {
  const key = `${member.slug}-${angle}`;
  const card = renderProfileCard(member)
    .replace(/\bid="([^"]+)"/g, (_, id) => `id="${key}-${id}"`)
    .replace(/aria-labelledby="([^"]+)"/g, (_, id) => `aria-labelledby="${key}-${id}"`);
  return `<section class="face-case" data-member="${member.slug}" data-angle="${angle}" style="--check-angle:${angle}deg"><h2>${escape(member.name)} · ${angle}°</h2>${card}</section>`;
}));
const folder = path.join(buildRoot, 'qa/mobile-backfaces');
mkdirSync(folder, {recursive:true});
writeFileSync(path.join(folder, 'index.html'), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local profile face checks</title><link rel="stylesheet" href="../../styles.css"><link rel="stylesheet" href="../../profile.css"><style>
body{padding:16px}.face-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:28px 12px;max-width:740px;margin:auto}h1{font-size:20px;letter-spacing:0;margin:0 0 12px}body>p{font-size:12px;color:var(--muted);margin:0 0 24px}.face-case{min-width:0}.face-case h2{font-size:10px;font-weight:400;letter-spacing:0;min-height:34px;margin:0 0 12px;overflow-wrap:anywhere}.face-case .member-profile{display:block;padding:0}.face-case .member-copy,.face-case .portrait-orbit{display:none}.face-case .portrait-stage{width:128px;max-width:100%;padding:0;margin:auto}.face-case .portrait-card{width:100%;aspect-ratio:3/4}.face-case .portrait-flipper{animation:none!important;transform:rotateY(var(--check-angle))}.face-case .portrait-card::before,.face-case .portrait-sheen::after{animation:none!important;opacity:0}.face-case .portrait-topline{inset:10px 10px auto}.face-case .portrait-topline .rocket-mark{width:20px}.face-case .portrait-caption{left:10px;right:10px;bottom:12px}.face-case .portrait-caption>span{font-size:11px}.face-case .portrait-back .rocket-mark{width:55px}.face-case .portrait-back::before{inset:8px}.face-case .portrait-placeholder>span{font-size:28px}@media(max-width:600px){.face-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style></head><body><h1>Local profile face checks</h1><p>0°/60°: front photo (or null). 120°/180°: rocket only. No portrait or name should show on the reverse.</p><main class="face-grid">${cases.join('\n')}</main></body></html>`);
console.log('Local-only face fixture:', path.join(folder, 'index.html'));
