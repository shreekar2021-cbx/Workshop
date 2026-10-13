import { readFile, mkdir, rm, writeFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
await rm(new URL('dist/', root), { recursive: true, force: true });
await mkdir(new URL('dist/server/', root), { recursive: true });
await mkdir(new URL('dist/.openai/', root), { recursive: true });
const assets = {};
for (const name of await readdir(new URL('public/', root))) {
  const content = await readFile(new URL(`public/${name}`, root), 'utf8');
  if (name.endsWith('.js')) {
    const checked = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(`public/${name}`, root))], { encoding: 'utf8' });
    if (checked.status) throw new Error(checked.stderr);
  }
  assets[`/${name}`] = content;
}
const api = await readFile(new URL('server/groq.mjs', root), 'utf8');
const worker = `${api}\nconst assets = ${JSON.stringify(assets)};\nexport default { async fetch(request, env) { const path = new URL(request.url).pathname; if(path.startsWith('/api/')) return handleAPI(request, env); const assetPath = ['/','/notebook','/notebook/','/notebook.html'].includes(path) ? '/index.html' : path; const content = assets[assetPath]; if(content === undefined) return new Response('Not found', {status:404}); const type = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.svg') ? 'image/svg+xml' : 'text/html'; return new Response(content, { headers: {'Content-Type': type + '; charset=utf-8', 'X-Content-Type-Options': 'nosniff'} }); } };\n`;
await writeFile(new URL('dist/server/index.js', root), worker);
const hosting = JSON.parse(await readFile(new URL('.openai/hosting.json', root), 'utf8'));
delete hosting.static;
await writeFile(new URL('dist/.openai/hosting.json', root), JSON.stringify(hosting, null, 2));
const check = spawnSync(process.execPath, ['--check', fileURLToPath(new URL('dist/server/index.js', root))], { encoding: 'utf8' });
if (check.status) throw new Error(check.stderr);
console.log('Production build ready: dist/server/index.js. Node deployment uses npm start.');
