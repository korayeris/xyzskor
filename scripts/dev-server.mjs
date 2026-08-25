import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = normalize(fileURLToPath(new URL('..', import.meta.url)));
const requestedStaticRoot = process.env.XYZSKOR_STATIC_ROOT ? resolve(sourceRoot, process.env.XYZSKOR_STATIC_ROOT) : sourceRoot;
const root = normalize(requestedStaticRoot.startsWith(sourceRoot) ? requestedStaticRoot : sourceRoot);
const edgeOrigin = process.env.XYZSKOR_EDGE_ORIGIN || 'https://xyzskor-tr.korayeris2002.chatgpt.site';
const port = Number(process.env.XYZSKOR_DEV_PORT || 4173);
const mime = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.webmanifest':'application/manifest+json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp', '.svg':'image/svg+xml', '.ico':'image/x-icon'
};

async function proxyApi(req, res) {
  try {
    const upstream = await fetch(new URL(req.url, edgeOrigin), { method:req.method, headers:{ Accept:req.headers.accept || 'application/json' } });
    const body = req.method === 'HEAD' ? null : Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      'Content-Type':upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control':'no-store',
      'X-XYZSkor-Dev-Proxy':'Sites'
    });
    res.end(body);
  } catch {
    res.writeHead(502, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' });
    res.end(JSON.stringify({ error:'development_api_unavailable' }));
  }
}

async function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  const relative = pathname === '/' || !extname(pathname) ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = normalize(join(root, relative));
  if (!file.startsWith(root)) { res.writeHead(403); res.end('Forbidden'); return; }
  try {
    if (!(await stat(file)).isFile()) throw new Error('not_file');
    res.writeHead(200, { 'Content-Type':mime[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control':'no-store' });
    if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

http.createServer((req, res) => {
  if (!['GET','HEAD'].includes(req.method || 'GET')) { res.writeHead(405, { Allow:'GET, HEAD' }); res.end(); return; }
  if ((req.url || '').startsWith('/api/')) proxyApi(req, res); else serveStatic(req, res);
}).listen(port, '127.0.0.1', () => console.log(`XYZSkor: http://127.0.0.1:${port}`));
