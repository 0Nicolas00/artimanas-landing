import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const port = Number(process.env.PORT || 8080);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.webp':'image/webp', '.svg':'image/svg+xml', '.hdr':'application/octet-stream' };
http.createServer(async (req,res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  try { res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(await readFile(file)); }
  catch {
    if (req.headers.accept?.includes('text/html')) {
      res.writeHead(404, { 'Content-Type': types['.html'] });
      return res.end(await readFile(path.join(root,'404.html')));
    }
    res.writeHead(404);
    res.end('Archivo no encontrado');
  }
}).listen(port, '127.0.0.1', () => console.log(`Artimañas: http://localhost:${port}`));
