// Optional authoring tool. The generated PNG/SVG are committed; deployment needs no renderer/font.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const [rendererPath,fontPath]=process.argv.slice(2);
if(!rendererPath || !fontPath)throw new Error('Usage: node scripts/create-share-image.mjs <resvg-js module path> <Korean font file>');
const require=createRequire(import.meta.url);
const {Resvg}=require(resolve(rendererPath));
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const logo=(await readFile(join(project,'assets/brand/gambungi-email-logo.png'))).toString('base64');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><title>겜붕이의 노트 — 매일 12시에 읽는 노트들</title><rect width="1200" height="630" fill="#080f17"/><rect x="40" y="40" width="1120" height="550" rx="32" fill="#13202c" stroke="#2c3b48"/><image x="155" y="134" width="890" height="222.5" href="data:image/png;base64,${logo}"/><text x="600" y="438" text-anchor="middle" font-family="Malgun Gothic" font-size="40" fill="#d9eea6">매일 12시에 읽는 노트들</text><text x="600" y="533" text-anchor="middle" font-family="Malgun Gothic" font-size="21" letter-spacing="1" fill="#a2afab">tech.teamhjd.com</text></svg>`;
const image=new Resvg(svg,{font:{loadSystemFonts:false,fontFiles:[resolve(fontPath)],defaultFontFamily:'Malgun Gothic'}});
await writeFile(join(project,'assets/brand/gambungi-share-v1.svg'),image.toString());
await writeFile(join(project,'assets/brand/gambungi-share-v1.png'),image.render().asPng());
console.log('Created 1200×630 branded share image using the original wordmark.');
