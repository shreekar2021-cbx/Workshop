import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { handleAPI } from './groq.mjs';

const publicRoot = new URL('../public/', import.meta.url);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const assetCache = new Map();
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let response;
    if (url.pathname.startsWith('/api/')) {
      const chunks = []; let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 25 * 1024 * 1024) { res.writeHead(413); res.end(JSON.stringify({ error: 'Audio is too large. Record a shorter segment.' })); return; }
        chunks.push(chunk);
      }
      const request = new Request(url, { method: req.method, headers: req.headers, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) });
      response = await handleAPI(request, process.env);
    } else {
      const pathname = ['/','/notebook','/notebook/','/notebook.html'].includes(url.pathname) ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
      if (!/^[a-zA-Z0-9._/-]+$/.test(pathname) || pathname.split('/').includes('..')) { res.writeHead(404); res.end('Not found'); return; }
      try {
        const filename = fileURLToPath(new URL(pathname, publicRoot));
        const info = await stat(filename);
        const etag = `W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;
        const extension = pathname.slice(pathname.lastIndexOf('.'));
        const headers = { 'Content-Type': types[extension] || 'application/octet-stream', 'Cache-Control':'no-cache', 'ETag':etag, 'X-Content-Type-Options':'nosniff' };
        if (req.headers['if-none-match'] === etag) response = new Response(null, { status:304, headers });
        else {
          let cached = assetCache.get(pathname);
          if (cached?.etag !== etag) { cached = { etag, data:await readFile(filename) }; assetCache.set(pathname,cached); }
          response = new Response(cached.data, { headers });
        }
      } catch { response = new Response('Not found', { status: 404 }); }
    }
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'The request could not be completed. Please try again.' })); }
});
const port = Number(process.env.PORT || 3000);
server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`ECHO — Thought interface: http://localhost:${port}`));
