// Servidor local simples para testar o catálogo no seu computador.
// Uso:  node scripts/dev-server.mjs   (ou: npm run dev)
// Abre em http://localhost:5173  (catálogo)  e  http://localhost:5173/admin/  (painel)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT) || 5173;
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.sql': 'text/plain; charset=utf-8',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    let file = join(root, path);
    if (!file.startsWith(root)) { res.writeHead(403).end('403'); return; }
    let s = await stat(file).catch(() => null);
    if (s && s.isDirectory()) {
      if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' }).end(); return; }
      file = join(file, 'index.html');
      s = await stat(file).catch(() => null);
    }
    if (!s) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado'); return; }
    res.writeHead(200, { 'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
}).listen(port, () => console.log(`Catálogo:  http://localhost:${port}/\nPainel:    http://localhost:${port}/admin/`));
