import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {validateMarkdown} from './content.mjs';
import {renderArticleFigures,assertInlineFormatting} from './article-html.mjs';
test('the deployed Pandoc mode escapes allowed inline angle brackets',()=>{
 const text='# 검사\n\n<!-- article -->\n\n## 오늘 얻어갈 것\n\n`<new>` 와 ``<vector> ` <new>``입니다.\n\n## 출처\n\n[공식](https://example.test/)\n';
 validateMarkdown(text,'render-probe');
 const rendered=spawnSync(process.env.PANDOC_PATH||'pandoc',['--from=markdown-implicit_figures','--to=html5'],{input:text,encoding:'utf8'});
 assert.equal(rendered.status,0);assert.match(rendered.stdout,/<code>&lt;new&gt;<\/code>/);assert.ok(!rendered.stdout.includes('<new>'));assert.ok(!rendered.stdout.includes('<vector>'));
});
test('the published fixed-step example renders as two columns and four data rows',()=>{
 const text=readFileSync(new URL('../content/issues/note-2026-11-06-fixed-step-interpolation.md',import.meta.url),'utf8');
 validateMarkdown(text,'note-2026-11-06-fixed-step-interpolation');
 const rendered=spawnSync(process.env.PANDOC_PATH||'pandoc',['--from=markdown-implicit_figures','--to=html5'],{input:text,encoding:'utf8'});
 assert.equal(rendered.status,0);assert.equal((rendered.stdout.match(/<table\b/g)||[]).length,1);assert.equal((rendered.stdout.match(/<th\b/g)||[]).length,2);assert.equal((rendered.stdout.match(/<td\b/g)||[]).length,8);
 assert.match(rendered.stdout,/<td[^>]*>0\.040m<\/td>/);
});
test('C# and C++ fences retain syntax tokens while literal angle brackets stay escaped',()=>{
 const text='```csharp\n// A comment\npublic class Example {\n  string message = "<script>";\n  int count = 42;\n  if (count > 0) return;\n}\n```\n\n```cpp\n// C++ comment\nint main() { const char* text = "<script>"; return 42; }\n```';
 const rendered=spawnSync(process.env.PANDOC_PATH||'pandoc',['--from=markdown-implicit_figures','--to=html5'],{input:text,encoding:'utf8'});
 assert.equal(rendered.status,0);for(const token of ['co','kw','st','dv','cf'])assert.ok(rendered.stdout.includes(`class="${token}"`),`Missing syntax token ${token}`);assert.ok(!rendered.stdout.includes('<script>'));assert.ok(rendered.stdout.includes('&lt;script&gt;'));
});
test('blank paragraph boundaries cannot hide HTML from validation',()=>{
 const text='# 검사\n\n<!-- article -->\n\n## 오늘 얻어갈 것\n\n`open\n\n<script>alert(1)</script>\n\n`\n';
 const rendered=spawnSync(process.env.PANDOC_PATH||'pandoc',['--from=markdown-implicit_figures','--to=html5'],{input:text,encoding:'utf8'});
 assert.equal(rendered.status,0);assert.ok(rendered.stdout.includes('<script>'));
 assert.throws(()=>validateMarkdown(text,'paragraph-probe'),/Unsafe HTML/);
});
test('the A-star article keeps two captions separate and leaves later sections outside emphasis',()=>{
 const text=readFileSync(new URL('../content/issues/note-2026-11-07-astar-search-costs.md',import.meta.url),'utf8');
 validateMarkdown(text,'note-2026-11-07-astar-search-costs');
 const rendered=spawnSync(process.env.PANDOC_PATH||'pandoc',['--from=markdown-implicit_figures','--to=html5','--section-divs','--wrap=none'],{input:text,encoding:'utf8'});
 assert.equal(rendered.status,0);const html=renderArticleFigures(rendered.stdout,'astar-regression');
 assertInlineFormatting(html);
 const captions=[...html.matchAll(/<figcaption>([\s\S]*?)<\/figcaption>/g)].map(m=>m[1]);assert.equal(captions.length,2);
 assert.ok(captions[0].includes('A*의 원리 참고'));for(const caption of captions)assert.ok(!/<(?:p|section|table)\b/.test(caption));
 assert.equal((html.match(/<em>/g)||[]).length,0);assert.ok(html.includes('오늘 얻어갈 것'));
});
test('an unescaped star inside an italic caption is rejected before later paragraphs can be consumed',()=>{
 const text='![first](one.svg)\n\n*First caption explains A* search.*\n\nFollowing paragraph.\n\n## Next section\n\n![second](two.svg)\n\n*Second caption.*';
 const rendered=spawnSync(process.env.PANDOC_PATH||'pandoc',['--from=markdown-implicit_figures','--to=html5','--wrap=none'],{input:text,encoding:'utf8'});
 assert.equal(rendered.status,0);assert.throws(()=>renderArticleFigures(rendered.stdout,'literal-star'),/fully emphasized paragraph/);
});
