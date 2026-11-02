// Code-native favicon compositions. The original rocket PNG is embedded unchanged.
// Export tool only; deploys consume committed files and require no renderer install.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root,'.local/favicon-tools/package.json'));
const {Resvg} = require('@resvg/resvg-js');
const destination = path.join(root,'assets/favicons/v1');
const source = readFileSync(path.join(root,'assets/favicon.png'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const variants = [
  {id:'teamhjd',name:'TeamHJD',host:'teamhjd.com',feature:'Original rocket',glyph:''},
  {id:'docs',name:'TeamHJD Docs',host:'docs.teamhjd.com',feature:'Open book',glyph:'<path d="M3 5c3-1 6 0 9 2 3-2 6-3 9-2v14c-3-1-6 0-9 2-3-2-6-3-9-2V5Zm9 2v14"/>'},
  {id:'launcher',name:'Game Test Launcher',host:'testlauncher.teamhjd.com',feature:'Play',glyph:'<path d="m8 4 13 8L8 20Z" fill="currentColor" stroke="none"/>'},
  {id:'notes',name:'겜붕이의 노트',host:'tech.teamhjd.com',feature:'Notebook',glyph:'<rect x="5" y="3" width="15" height="18" rx="2"/><path d="M9 3v18m4-12h4m-4 5h4"/>'},
  {id:'portfolio',name:'HyunSeok Portfolio',host:'hyunseok.teamhjd.com',feature:'Person',glyph:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2c0-7 16-7 16 0v2"/>'},
  {id:'threadle',name:'Threadle',host:'threadle.teamhjd.com',feature:'Thread branches',glyph:'<circle cx="6" cy="5" r="3"/><circle cx="18" cy="10" r="3"/><circle cx="6" cy="20" r="3"/><path d="M6 8v9m0-7h9"/>'},
  {id:'pixelpin',name:'PixelPin',host:'pixelpin.teamhjd.com',feature:'Color eyedropper',glyph:'<path d="m14 4 6 6M6 13l7-7 5 5-7 7-6 1 1-6Zm9-10 3-1 4 4-1 3M4 21h2"/>'},
];
const sizes = [16,32,48,64,180,192,512];
mkdirSync(destination,{recursive:true});
const manifest = {version:'1.0.0',source:'assets/favicon.png',sourceSha256:hash(source),renderer:'@resvg/resvg-js@2.6.2',palette:{accent:'#d9eea6',ink:'#080f17'},variants:[]};
for (const variant of variants) {
  const folder = path.join(destination,variant.id);
  mkdirSync(folder,{recursive:true});
  const badge = variant.glyph ? `<circle cx="14.5" cy="14.5" r="13" fill="#d9eea6" stroke="#080f17" stroke-width="2.5"/><g transform="translate(5.5 5.5) scale(.75)" color="#080f17" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${variant.glyph}</g>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="${variant.name}"><title>${variant.name}</title><image width="64" height="64" href="data:image/png;base64,${source.toString('base64')}"/>${badge}</svg>\n`;
  const files = {};
  const save = (name,bytes) => {writeFileSync(path.join(folder,name),bytes);files[name]={bytes:Buffer.byteLength(bytes),sha256:hash(bytes)};};
  save('favicon.svg',svg);
  const pngs = new Map();
  for (const size of sizes) {
    const png = new Resvg(svg,{fitTo:{mode:'width',value:size},font:{loadSystemFonts:false}}).render().asPng();
    pngs.set(size,png);
    save(size===180?'apple-touch-icon.png':`favicon-${size}.png`,png);
  }
  // ICO directory with PNG-compressed 16/32/48 entries, supported by modern browsers.
  const icoSizes=[16,32,48], header=Buffer.alloc(6+icoSizes.length*16);
  header.writeUInt16LE(1,2); header.writeUInt16LE(icoSizes.length,4);
  let offset=header.length;
  for(let index=0;index<icoSizes.length;index++) {
    const size=icoSizes[index], entry=6+index*16, png=pngs.get(size);
    header[entry]=header[entry+1]=size;
    header.writeUInt16LE(1,entry+4); header.writeUInt16LE(32,entry+6);
    header.writeUInt32LE(png.length,entry+8); header.writeUInt32LE(offset,entry+12);
    offset+=png.length;
  }
  save('favicon.ico',Buffer.concat([header,...icoSizes.map(size=>pngs.get(size))]));
  manifest.variants.push({...variant,glyph:undefined,files});
}
writeFileSync(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const tabs = mode => `<div class="tabs ${mode}">${variants.map(v=>`<div class="tab"><img src="${v.id}/favicon-16.png" width="16" height="16" alt=""><span>${v.name}</span></div>`).join('')}</div>`;
const preview = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TeamHJD Favicon Family v1</title><link rel="icon" type="image/svg+xml" href="teamhjd/favicon.svg"><style>*{box-sizing:border-box}body{margin:0;background:#080f17;color:#f3f0e8;font:14px/1.6 system-ui;padding:28px}h1{margin:0;font-size:24px}p{color:#a2afab}.tabs{display:flex;border-radius:10px;padding:8px;gap:4px;margin:16px 0}.tabs.dark{background:#13202c}.tabs.light{background:#e9edef;color:#1c2730}.tab{display:flex;gap:8px;align-items:center;flex:1;min-width:0;padding:9px 7px;border-radius:7px;background:#ffffff0a}.tab img{flex:none}.tab span{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.light .tab{background:#fff}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:22px}.card{border:1px solid #2c3b48;background:#13202c;border-radius:12px;padding:16px}.sizes{display:flex;align-items:center;gap:18px;min-height:70px}.card small{display:block;color:#a2afab;font-size:11px}.card strong{font-size:13px}.note{font-size:12px}@media(max-width:700px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.tabs{overflow:auto}.tab{flex:none;width:140px}}</style><h1>TeamHJD · One rocket, one family.</h1><p>원본 손그림 로켓 + 동일한 원형 바탕 + 서비스별 작은 배지 · v1.0.0</p>${tabs('dark')}${tabs('light')}<div class="grid">${variants.map(v=>`<article class="card"><div class="sizes"><img src="${v.id}/favicon.svg" width="64" height="64" alt="${v.name}"><img src="${v.id}/favicon-32.png" width="32" height="32" alt=""><img src="${v.id}/favicon-16.png" width="16" height="16" alt=""></div><strong>${v.name}</strong><small>${v.host} · ${v.feature}</small></article>`).join('')}</div><p class="note">위 탭 모양은 16px 렌더링 비교용입니다. 로켓 원본의 픽셀과 색상은 변경하지 않았습니다.</p></html>`;
writeFileSync(path.join(destination,'preview.html'),preview);
console.log(`Generated ${variants.length} favicon variants and manifest at ${destination}`);
