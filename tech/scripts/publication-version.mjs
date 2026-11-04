import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function publicationVersion(project,issue,document){
 const assets=await Promise.all([...document.assets].sort().map(async name=>[name,createHash('sha256').update(await readFile(join(project,issue.assetDirectory,name))).digest('hex')]));
 const metadata=Object.fromEntries(['id','date','slug','title','description','question','summary','tags','coverImage','format'].map(key=>[key,issue[key]??null]));
 return createHash('sha256').update(JSON.stringify({version:1,metadata,markdown:document.markdown.replaceAll('\r\n','\n'),assets})).digest('hex');
}
