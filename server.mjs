import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 4317);
const HOST = process.env.HOST || '0.0.0.0';
const TOKEN = process.env.CODEX_REMOTE_TOKEN || randomUUID();
const approvals = new Map();
const sessions = new Set();
const root = new URL('./public/', import.meta.url);
const pending = new Map();
const clients = new Set();
let nextId = 1;

const child = spawn('codex', ['app-server', '--listen', 'stdio://'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
let lineBuffer = '';
child.stdout.on('data', chunk => {
  lineBuffer += chunk.toString();
  const lines = lineBuffer.split(/\r?\n/); lineBuffer = lines.pop() || '';
  for (const line of lines) { if (!line.trim()) continue; try { onRpc(JSON.parse(line)); } catch { /* ignore non JSON */ } }
});
child.stderr.on('data', chunk => console.error('[codex]', chunk.toString().trim()));
child.on('exit', code => broadcast({ type: 'bridge', status: 'stopped', code }));

function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('Codex request timed out')); } }, 120000);
  });
}
function onRpc(msg) {
  if (msg.id != null && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message || 'Codex error')) : p.resolve(msg.result); return; }
  if (msg.method && msg.id != null) approvals.set(String(msg.id), msg);
  if (msg.method === 'serverRequest/resolved') approvals.delete(String(msg.params.requestId));
  broadcast({ type: 'notification', data: msg });
}
function broadcast(event) { const payload = `data: ${JSON.stringify(event)}\n\n`; for (const res of clients) res.write(payload); }
function auth(req) { const sid = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('sid='))?.slice(4); return req.headers['x-codex-token'] === TOKEN || sessions.has(sid); }
async function body(req) { let s = ''; for await (const c of req) s += c; return s ? JSON.parse(s) : {}; }
function json(res, status, data, headers = {}) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }); res.end(JSON.stringify(data)); }
async function init() { try { await rpc('initialize', { clientInfo: { name: 'codex-remote-web', title: 'Codex Remote Web', version: '0.1.0' }, capabilities: { experimentalApi: true, requestAttestation: false } }); } catch (e) { console.error(e.message); } }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return json(res,403,{error:'Origin rejected'});
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,x-codex-token' }); return res.end(); }
  if (url.pathname === '/events') { if (!auth(req)) return json(res, 401, { error: 'Unauthorized' }); res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'access-control-allow-origin': '*' }); res.write(`data: ${JSON.stringify({ type: 'bridge', status: 'connected' })}\n\n`); clients.add(res); req.on('close', () => clients.delete(res)); return; }
  if (url.pathname.startsWith('/api/')) {
    if (req.method === 'POST' && url.pathname === '/api/session') { if (req.headers['x-codex-token'] !== TOKEN) return json(res, 401, { error: 'Unauthorized' }); const sid = randomUUID(); sessions.add(sid); return json(res, 200, { ok: true }, { 'set-cookie': `sid=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400` }); }
    if (!auth(req)) return json(res, 401, { error: 'Unauthorized' });
    try {
      let result;
      if (req.method === 'GET' && url.pathname === '/api/threads') result = await rpc('thread/list', { limit: 30, sortDirection: 'desc', archived: false });
      else if (req.method === 'POST' && url.pathname === '/api/thread') { const b = await body(req); result = await rpc('thread/start', { cwd: b.cwd || process.cwd(), approvalPolicy: 'on-request', sandbox: 'workspace-write', threadSource: 'codex-remote-web' }); }
      else if (req.method === 'POST' && url.pathname === '/api/thread/resume') { const b = await body(req); result = await rpc('thread/resume', { threadId: b.threadId, excludeTurns: true }); }
      else if (req.method === 'GET' && url.pathname.startsWith('/api/thread/')) { const threadId = url.pathname.split('/').pop(); result = await rpc('thread/items/list', { threadId, limit: 200, sortDirection: 'asc' }); }
      else if (req.method === 'POST' && url.pathname === '/api/turn') { const b = await body(req); result = await rpc('turn/start', { threadId: b.threadId, input: [{ type: 'text', text: b.text, text_elements: [] }] }); }
      else if (req.method === 'POST' && url.pathname === '/api/interrupt') { const b = await body(req); result = await rpc('turn/interrupt', { threadId: b.threadId, turnId: b.turnId }); }
      else if (req.method === 'GET' && url.pathname === '/api/approvals') result = [...approvals.values()];
      else if (req.method === 'POST' && url.pathname === '/api/respond') { const b = await body(req); const request = approvals.get(String(b.id)); if (!request) return json(res,404,{error:'Request already resolved'}); if (!['item/commandExecution/requestApproval','item/fileChange/requestApproval'].includes(request.method) || !['accept','decline'].includes(b.decision)) return json(res,400,{error:'Unsupported approval'}); child.stdin.write(JSON.stringify({id:request.id,result:{decision:b.decision}})+'\n'); approvals.delete(String(b.id)); result={ok:true}; }
      else return json(res, 404, { error: 'Not found' });
      json(res, 200, result);
    } catch (e) { json(res, 500, { error: e.message }); }
    return;
  }
  let file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  if (!['index.html','app.js','styles.css','thinking.html','thinking.js'].includes(file)) return json(res, 404, { error: 'Not found' });
  try { const data = await readFile(new URL(file, root)); const ext = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'; res.writeHead(200, { 'content-type': `${ext}; charset=utf-8`, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' }); res.end(data); } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(PORT, HOST, () => { console.log(`Codex Remote Web: http://localhost:${PORT}`); console.log(`Token: ${TOKEN}`); });
init();
