import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folder = path.join(root,'assets/favicons/v1');
const manifest = JSON.parse(readFileSync(path.join(folder,'manifest.json'),'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const original = readFileSync(path.join(root,manifest.source));
assert.equal(hash(original),manifest.sourceSha256,'The company rocket source must remain unchanged');
assert.equal(manifest.variants.length,7);
const variants = new Set();
for(const variant of manifest.variants) {
  assert.ok(!variants.has(variant.id)); variants.add(variant.id);
  for(const [name,expected] of Object.entries(variant.files)) {
    const bytes=readFileSync(path.join(folder,variant.id,name));
    assert.equal(bytes.length,expected.bytes); assert.equal(hash(bytes),expected.sha256);
    if(name.endsWith('.png')) {
      const size=name==='apple-touch-icon.png'?180:Number(name.match(/-(\d+)\.png$/)[1]);
      assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
      assert.equal(bytes.readUInt32BE(16),size); assert.equal(bytes.readUInt32BE(20),size);
    }
    if(name.endsWith('.svg')) {
      const svg=bytes.toString('utf8');
      assert.ok(svg.includes(`data:image/png;base64,${original.toString('base64')}`));
      assert.ok(!/<script\b|<foreignObject\b|(?:href|src)="https?:/i.test(svg),'Favicon must be self-contained');
    }
    if(name.endsWith('.ico')) {
      assert.equal(bytes.readUInt16LE(2),1); assert.equal(bytes.readUInt16LE(4),3);
      for(let index=0;index<3;index++) {
        const offset=6+16*index, size=[16,32,48][index], start=bytes.readUInt32LE(offset+12), length=bytes.readUInt32LE(offset+8);
        assert.equal(bytes[offset],size); assert.equal(bytes[offset+1],size);
        assert.deepEqual(bytes.subarray(start,start+length),readFileSync(path.join(folder,variant.id,`favicon-${size}.png`)));
      }
    }
  }
}
console.log('PASS: 7 self-contained favicon variants, source integrity, SHA256 manifest, PNG dimensions and multi-resolution ICO entries.');
