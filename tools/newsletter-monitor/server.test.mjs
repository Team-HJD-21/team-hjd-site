import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';

test('local monitor requires one-time bootstrap, session, exact Host and same Origin', {timeout:15000}, async t=>{
 const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..');
 const privateRoot=join(root,'.local','newsletter-monitor');
 await mkdir(privateRoot,{recursive:true});
 const startupPath=join(privateRoot,`test-${randomUUID()}.json`);
 const child=spawn(process.execPath,[join(here,'server.mjs'),startupPath],{windowsHide:true,stdio:'ignore'});
 t.after(async()=>{child.kill();await unlink(startupPath).catch(()=>{});});
 let startup;
 for(let i=0;i<100;i++){
  try{startup=JSON.parse(await readFile(startupPath,'utf8'));break;}catch{}
  if(child.exitCode!==null)throw new Error('Local server exited before bootstrap');
  await new Promise(r=>setTimeout(r,50));
 }
 assert.ok(startup);const origin=`http://127.0.0.1:${startup.port}`;
 assert.equal((await fetch(origin+'/api/state')).status,403);
 assert.equal((await fetch(origin+'/',{headers:{Host:'invalid.example'}})).status,403);
 const open=await fetch(startup.url,{redirect:'manual'});
 assert.equal(open.status,303);assert.equal(open.headers.get('location'),'/');
 const cookie=open.headers.get('set-cookie');
 assert.match(cookie,/HttpOnly; SameSite=Strict/);
 const headers={Cookie:cookie.split(';')[0]};
 assert.equal((await fetch(startup.url,{redirect:'manual'})).status,403);
 const state=await fetch(origin+'/api/state',{headers});
 assert.equal(state.status,200);assert.equal(state.headers.get('cache-control'),'no-store');
 assert.equal((await state.json()).report,null);
 const wrongOrigin=await fetch(origin+'/api/refresh',{method:'POST',headers:{...headers,Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'});
 assert.equal(wrongOrigin.status,403);
 assert.equal(wrongOrigin.headers.get('access-control-allow-origin'),null);
 const wrongType=await fetch(origin+'/api/refresh',{method:'POST',headers:{...headers,Origin:origin,'Content-Type':'text/plain'},body:'{}'});
 assert.equal(wrongType.status,403);
 assert.equal((await fetch(origin+'/api/preview?index=0',{headers})).status,404);
 assert.equal((await fetch(origin+'/server.mjs',{headers})).status,404);
 const page=await fetch(origin+'/',{headers});
 assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/default-src 'self'/);
});
