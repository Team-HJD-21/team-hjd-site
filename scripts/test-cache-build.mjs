import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TEAMHJD_PLAYWRIGHT || 'playwright');
const root=process.cwd();
const testRoot=mkdtempSync(path.resolve(root,'../.codex/cache-build-'));
const fixture=path.join(testRoot,'fixture');mkdirSync(path.join(fixture,'scripts'),{recursive:true});
for(const name of ['index.html','404.html','styles.css','languages.js','treant.js','slimes.js','astronaut.js','meteors.js','assets','privacy','scripts/build-site.mjs']) cpSync(path.join(root,name),path.join(fixture,name),{recursive:true});
const build=output=>execFileSync(process.execPath,[path.join(fixture,'scripts/build-site.mjs'),output],{encoding:'utf8'});
const first=path.join(testRoot,'first'),second=path.join(testRoot,'second'),changed=path.join(testRoot,'changed');
build(first);build(second);
const manifest=folder=>JSON.parse(readFileSync(path.join(folder,'build-manifest.json')));
assert.deepEqual(manifest(first),manifest(second),'Identical content must build deterministically');
writeFileSync(path.join(fixture,'styles.css'),readFileSync(path.join(fixture,'styles.css'),'utf8')+'\n/* cache regression change */\n');
build(changed);
assert.notEqual(manifest(first).resources['styles.css'],manifest(changed).resources['styles.css'],'Changed CSS needs a new URL');
assert.notEqual(manifest(first).version,manifest(changed).version);
for(const folder of [first,changed]){
  assert.ok(!existsSync(path.join(folder,'drafts')));
  assert.ok(!existsSync(path.join(folder,'scripts/privacy-operations.md')));
  for(const name of ['index.html','privacy/index.html','404.html']){
    const html=readFileSync(path.join(folder,name),'utf8');
    for(const [,url] of html.matchAll(/(?:src|href)="([^"]+)"/g)){
      if(!/\.(?:css|js|png)(?:\?|$)/.test(url)||/^[a-z]+:/i.test(url)) continue;
      const clean=url.split('?')[0];
      const target=clean.startsWith('/')?path.join(folder,clean.slice(1)):path.resolve(folder,path.dirname(name),clean);
      assert.ok(existsSync(target), 'Missing built resource '+url);
      if(/\.(css|js)$/.test(clean))assert.match(clean,/\.[a-f0-9]{16}\.(css|js)$/);
    }
  }
  const js=readFileSync(path.join(folder,manifest(folder).resources['slimes.js']),'utf8');
  assert.ok(js.includes('slime-${kind}-walk.png?v='+manifest(folder).version),'Dynamic image URLs must be versioned');
}
let phase='old';const requested=[];
const oldHtml=execFileSync('git',['show','7d885f6:index.html'],{encoding:'utf8'});
const oldCss=execFileSync('git',['show','7d885f6:styles.css'],{encoding:'utf8'});
const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.replace(/^\//,'')||'index.html';requested.push(name);
  if(phase==='old' && name==='index.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(oldHtml);return;}
  if(phase==='old' && name==='styles.css'){res.setHeader('Content-Type','text/css');res.setHeader('Cache-Control','public,max-age=31536000');res.end(oldCss);return;}
  const base=phase==='old'?root:changed,file=path.resolve(base,name);
  if(!file.startsWith(path.resolve(base)+path.sep)||!existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.json':'application/json'})[path.extname(file)]||'application/octet-stream');
  res.setHeader('Cache-Control',name.endsWith('.html')?'no-store':'public,max-age=31536000');
  res.end(readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const base='http://127.0.0.1:'+server.address().port;
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto(base,{waitUntil:'networkidle'});assert.equal(requested.filter(p=>p==='styles.css').length,1);
  phase='new';
  await page.goto(base+'/?new-release=1',{waitUntil:'networkidle'});
  assert.equal(await page.locator('.hero').evaluate(el=>Math.round(el.getBoundingClientRect().height)),660);
  assert.equal(await page.locator('.meteor-layer').evaluate(el=>getComputedStyle(el).position),'absolute');
  assert.equal(await page.locator('.meteor').count(),5);
  assert.equal(requested.filter(p=>p==='styles.css').length,1,'Old cached URL must not be requested again');
  assert.ok(requested.includes(manifest(changed).resources['styles.css']));
  await page.goto(base+'/privacy/index.html',{waitUntil:'networkidle'});
  assert.equal(await page.locator('#collection-consent').count(),1);
  assert.ok(requested.includes(manifest(changed).resources['privacy/privacy.js']));
  await page.close();
  const mixed=await browser.newPage({viewport:{width:1440,height:900}});
  await mixed.route('**/*.css',route=>route.fulfill({contentType:'text/css',body:oldCss}));
  await mixed.goto(base,{waitUntil:'networkidle'});
  assert.equal(await mixed.locator('.hero').evaluate(el=>Math.round(el.getBoundingClientRect().height)),660,'Even a stale stylesheet must not push hero content into a new grid row');
  assert.equal(await mixed.locator('.meteor-layer').evaluate(el=>getComputedStyle(el).position),'absolute');
  await mixed.close();
  for(const width of [320,390,1440]){
    const p=await browser.newPage({viewport:{width,height:900}});
    const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto(base,{waitUntil:'networkidle'});
    assert.equal(await p.locator('.meteor').count(),width<600?3:5);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await p.locator('#language-switcher summary').click();await p.locator('[data-language="en"]').click();
    assert.equal(await p.locator('html').getAttribute('lang'),'en');
    assert.deepEqual(errors,[]);
    await p.close();
  }
  console.log('PASS: content fingerprinting, old browser cache bypass, CSS mismatch guard, privacy links, images and responsive controls');
  console.log('QA artifacts:',testRoot);
}finally{await browser.close();server.close();}
