import http from 'node:http';
import {readFileSync, existsSync, statSync} from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 4173);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.json':'application/json','.txt':'text/plain'};
http.createServer((request, response) => {
  let name;
  try { name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400); response.end(); return; }
  let file = path.resolve(root, '.' + name);
  if (file !== root && !file.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, {'Content-Type':types['.html']});
    response.end(readFileSync(path.join(root, '404.html'))); return;
  }
  response.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'});
  response.end(readFileSync(file));
}).listen(port, '127.0.0.1', () => console.log(`Local preview: http://127.0.0.1:${port}`));
