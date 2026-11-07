import test from 'node:test';
import assert from 'node:assert/strict';
import {renderArticleFigures,assertInlineFormatting} from './article-html.mjs';

test('a figure retains links and nested emphasis while removing only its full outer emphasis',()=>{
 const html='<p><img src="/figure.svg" alt="figure" /></p>\n<p><em>A* caption with <strong>cost</strong>, <em>one term</em> and <a href="https://example.test/">source</a>.</em></p>';
 const result=renderArticleFigures(html);
 assert.match(result,/<figcaption>A\* caption with <strong>cost<\/strong>, <em>one term<\/em> and <a /);
 assert.ok(result.includes('data-lightbox'));assert.ok(result.includes('loading="lazy"'));
 assertInlineFormatting(result);
});

test('a prematurely closed caption fails rather than consuming later paragraphs or a second figure',()=>{
 const html='<p><img src="/one.svg" /></p><p><em>Caption A</em>* text.*</p><p>Following paragraph</p><h2>Next section</h2><p><img src="/two.svg" /></p><p><em>Second caption</em></p>';
 assert.throws(()=>renderArticleFigures(html,'broken-caption'),/fully emphasized paragraph/);
 assert.throws(()=>renderArticleFigures('<p><img src="/one.svg" /></p><h2>Next section</h2>'),/caption paragraph/);
 assert.throws(()=>renderArticleFigures('<p><img src="/one.svg" /></p><p><em>Caption<section>Wrong block</section></em></p>'),/formatting/);
});

test('two figures stay separate from their intervening paragraphs and headings',()=>{
 const html='<p><img src="/one.svg" /></p><p><em>First caption</em></p><p>Following paragraph</p><h2>Next section</h2><p><img src="/two.svg" /></p><p><em>Second caption</em></p>';
 const result=renderArticleFigures(html);
 assert.equal((result.match(/<figure\b/g)||[]).length,2);
 assert.ok(result.includes('</figure><p>Following paragraph</p><h2>Next section</h2><figure'));
 assert.deepEqual([...result.matchAll(/<figcaption>([\s\S]*?)<\/figcaption>/g)].map(m=>m[1]),['First caption','Second caption']);
 assertInlineFormatting(result);
});

test('balanced tag counts cannot hide reversed, crossing or unclosed emphasis',()=>{
 for(const html of ['text</em><p><em>tail</p>','<p><em>first</p><p>rest</em></p>','<p><strong><em>text</strong></em></p>','<p><em>tail'])assert.throws(()=>assertInlineFormatting(html),/formatting/);
});

test('legitimate inline emphasis, escaped code and comments remain supported',()=>{
 assertInlineFormatting('<h2>A <em>term</em></h2><p>Some <strong><em>words</em></strong> and <code>&lt;em&gt;</code>.</p><!-- <em> ignored -->');
});
