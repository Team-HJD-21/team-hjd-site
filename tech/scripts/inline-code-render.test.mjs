import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {validateMarkdown} from './content.mjs';
test('the deployed Pandoc mode escapes allowed inline angle brackets',()=>{
 const text='# 검사\n\n<!-- article -->\n\n## 오늘 얻어갈 것\n\n`<new>` 와 ``<vector> ` <new>``입니다.\n\n## 출처\n\n[공식](https://example.test/)\n';
 validateMarkdown(text,'render-probe');
 const rendered=spawnSync(process.env.PANDOC_PATH||'pandoc',['--from=markdown-implicit_figures','--to=html5'],{input:text,encoding:'utf8'});
 assert.equal(rendered.status,0);assert.match(rendered.stdout,/<code>&lt;new&gt;<\/code>/);assert.ok(!rendered.stdout.includes('<new>'));assert.ok(!rendered.stdout.includes('<vector>'));
});
