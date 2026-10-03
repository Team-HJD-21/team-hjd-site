import {createHash} from 'node:crypto';
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.argv[2] || path.join(root, '_site'));
if (output === root || path.parse(output).root === output) throw new Error('Build output must be a separate directory');
if (existsSync(output) && readdirSync(output).length) throw new Error('Choose an empty build directory; existing files are never deleted');
mkdirSync(output, {recursive:true});
const pages = ['index.html', '404.html', 'privacy/index.html'];
const resources = ['styles.css', 'languages.js', 'treant.js', 'slimes.js', 'astronaut.js', 'meteors.js', 'privacy/privacy.css', 'privacy/privacy.js'];
const hash = content => createHash('sha256').update(content).digest('hex').slice(0, 16);
const images = readdirSync(path.join(root, 'assets')).filter(name => name.endsWith('.png')).sort();
const version = hash(Buffer.concat([...pages, ...resources, ...images.map(name=>'assets/'+name)].map(name=>Buffer.concat([Buffer.from(name), readFileSync(path.join(root,name))]))));
// Keep original asset URLs usable by email clients and old HTML during rollout.
cpSync(path.join(root, 'assets'), path.join(output, 'assets'), {recursive:true});
mkdirSync(path.join(output, 'privacy'), {recursive:true});
const fingerprinted = new Map();
function versionImages(source) {
  // Includes literal and template-string sprite URLs such as slime-${kind}.
  return source.replace(/assets\/[^\s"'\x60)]+\.png(?!\?)/g, value=>value+'?v='+version);
}
for (const name of resources) {
  const transformed = versionImages(readFileSync(path.join(root, name), 'utf8'));
  const extension = path.extname(name);
  const target = name.slice(0,-extension.length)+'.'+hash(transformed)+extension;
  fingerprinted.set(name, target);
  writeFileSync(path.join(output,target), transformed);
  // Legacy aliases are not referenced by new pages, but remain for old bookmarks.
  writeFileSync(path.join(output,name), transformed);
}
for (const name of pages) {
  const folder = path.posix.dirname(name);
  let html = readFileSync(path.join(root,name),'utf8').replace('</head>', '<meta name="site-build" content="'+version+'"></head>');
  html = html.replace(/\b(src|href)="([^"]+)"/g, (match,attribute,url)=>{
    if (/^(?:[a-z]+:|#|\/\/)/i.test(url)) return match;
    const [pathname,fragment] = url.split('#');
    const clean = pathname.split('?')[0];
    const resolved = clean.startsWith('/') ? clean.slice(1) : path.posix.normalize(path.posix.join(folder,clean));
    if (fingerprinted.has(resolved)) {
      const target = fingerprinted.get(resolved);
      const relative = clean.startsWith('/') ? '/'+target : path.posix.relative(folder,target);
      return attribute+'="'+relative+(fragment?'#'+fragment:'')+'"';
    }
    if (resolved.startsWith('assets/') && clean.endsWith('.png')) return attribute+'="'+clean+'?v='+version+(fragment?'#'+fragment:'')+'"';
    return match;
  });
  writeFileSync(path.join(output,name),html);
}
// This deployment contains public pages only: no drafts or operational notes.
writeFileSync(path.join(output,'build-manifest.json'), JSON.stringify({version,resources:Object.fromEntries(fingerprinted)},null,2));
console.log('Built cache-versioned public site:', output, 'version:', version);
