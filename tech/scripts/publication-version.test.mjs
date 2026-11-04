import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationVersion} from './publication-version.mjs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
test('an asset-only correction changes the content version without changing the issue ID',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'note-version-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const issue={id:'stable',assetDirectory:'.'},doc={markdown:'본문',assets:['figure.svg']};
 await writeFile(join(dir,'figure.svg'),'<svg>first</svg>');const before=await publicationVersion(dir,issue,doc);
 await writeFile(join(dir,'figure.svg'),'<svg>corrected</svg>');assert.notEqual(await publicationVersion(dir,issue,doc),before);
});
test('content version changes for manuscript/metadata and stays stable across publication state and CRLF',async()=>{
 const issue={id:'test',date:'2026-11-05',slug:'test',title:'검수',summary:'원리',tags:[],status:'scheduled'},doc={markdown:'본문\n',assets:[]};
 const original=await publicationVersion('.',issue,doc);
 assert.notEqual(await publicationVersion('.',{...issue,summary:'변경'},doc),original);
 assert.notEqual(await publicationVersion('.',issue,{...doc,markdown:'다른 본문\n'}),original);
 assert.equal(await publicationVersion('.',{...issue,status:'published',publishedAt:'2026-11-05T03:00:00Z'},{...doc,markdown:'본문\r\n'}),original);
});
