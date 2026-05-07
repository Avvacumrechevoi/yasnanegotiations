// ════════════════════════════════════════════════════════════════════
// scripts/serve.mjs — простой статический сервер для docs/.
// Используется в `npm run test` (Playwright поднимает его в webServer)
// и для локальной разработки.
// ════════════════════════════════════════════════════════════════════

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../docs');
const PORT = process.env.PORT || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer(async (req, res) => {
  try {
    let url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if(url === '/' || url === '') url = '/index.html';
    let file = path.join(ROOT, url);
    // защита от directory traversal
    if(!file.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }

    let st;
    try { st = await fs.stat(file); }
    catch { res.writeHead(404); res.end('not found'); return; }
    if(st.isDirectory()) file = path.join(file, 'index.html');

    const ext = path.extname(file).toLowerCase();
    const data = await fs.readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch(e){
    res.writeHead(500);
    res.end('server error: ' + e.message);
  }
});

server.listen(PORT, () => {
  console.log(`▶ static server: http://localhost:${PORT}/`);
  console.log(`  docs/ root: ${ROOT}`);
});
