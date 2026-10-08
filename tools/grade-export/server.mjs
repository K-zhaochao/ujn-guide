import http from 'node:http';
import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs';
import { resolve, join, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { JwglClient, ExportError } from './jwgl-client.mjs';

const API = '/api/grade-export/';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.pdf': 'application/pdf' };
const BASE_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
function sendJson(res, status, payload) {
  if (res.destroyed) return;
  res.writeHead(status, { ...BASE_HEADERS, 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(payload));
}
async function readJson(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw Object.assign(new Error('请以 JSON 提交表单'), { status: 415 });
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) throw Object.assign(new Error('表单内容过长'), { status: 413 });
    chunks.push(chunk);
  }
  let input;
  try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('表单格式错误'), { status: 400 }); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Object.assign(new Error('表单格式错误'), { status: 400 });
  return input;
}
function invalid(message, status = 400) { return Object.assign(new Error(message), { status }); }
function tokenKey(token) { return createHash('sha256').update(token).digest('hex'); }
function serveStatic(req, res, siteDir, pathname) {
  if (!['GET', 'HEAD'].includes(req.method)) { sendJson(res, 405, { message: '仅支持 GET / HEAD' }); return; }
  if (!existsSync(siteDir)) { sendJson(res, 503, { message: '先运行 npm run build 生成静态站点' }); return; }
  let file;
  try {
    const root = realpathSync(siteDir); const candidate = resolve(root, '.' + decodeURIComponent(pathname));
    if (candidate !== root && !candidate.startsWith(root + sep)) throw new Error();
    file = realpathSync(statSync(candidate).isDirectory() ? join(candidate, 'index.html') : candidate);
    if (!file.startsWith(root + sep) || !statSync(file).isFile()) throw new Error();
  } catch { sendJson(res, 404, { message: '页面不存在' }); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
  if (req.method === 'HEAD') res.end(); else createReadStream(file).on('error', () => res.destroy()).pipe(res);
}
/** Short-lived memory-only school sessions. No passwords, account database or disk exports. */
export function createGradeServer({ siteDir = resolve('site'), publicOrigin, allowedOrigins = [], trustProxy = false, clientFactory = options => new JwglClient(options), base = 'https://jwgl.ujn.edu.cn', maxActive = 4, quota = 6, windowMs = 600000, timeoutMs = 75000, sessionMs = 600000, maxSessions = 100 } = {}) {
  if (!['http://jwgl.ujn.edu.cn', 'https://jwgl.ujn.edu.cn', 'https://jwglxt.ujn.edu.cn'].includes(base)) throw new Error('JWGL_BASE must be a configured school origin');
  if (publicOrigin && (new URL(publicOrigin).origin !== publicOrigin || (!publicOrigin.startsWith('https:') && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(publicOrigin)))) throw new Error('GRADE_PUBLIC_ORIGIN must be HTTPS or loopback');
  if (!Array.isArray(allowedOrigins) || allowedOrigins.some(origin => typeof origin !== 'string' || new URL(origin).origin !== origin || !origin.startsWith('https:'))) throw new Error('GRADE_ALLOWED_ORIGINS must contain exact HTTPS origins');
  const attempts = new Map(), sessions = new Map(); let active = 0;
  function discard(key) {
    const session = sessions.get(key); if (!session) return;
    sessions.delete(key); session.controller?.abort(); session.client.dispose();
  }
  function sweep() { for (const [key, session] of sessions) if (session.expires <= Date.now()) discard(key); }
  const sweepTimer = setInterval(sweep, Math.min(30000, sessionMs)); sweepTimer.unref();
  const server = http.createServer(async (req, res) => {
    let pathname;
    try { pathname = new URL(req.url, 'http://127.0.0.1').pathname; } catch { sendJson(res, 400, { message: '地址格式错误' }); return; }
    if (!pathname.startsWith(API)) { serveStatic(req, res, siteDir, pathname); return; }
    const origin = publicOrigin || `http://127.0.0.1:${server.address().port}`;
    const requestOrigin = req.headers.origin;
    const originAllowed = requestOrigin === origin || allowedOrigins.includes(requestOrigin);
    if (allowedOrigins.includes(requestOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    }
    const action = pathname.slice(API.length);
    if (!['status', 'login', 'periods', 'export', 'logout'].includes(action)) { sendJson(res, 404, { message: '接口不存在' }); return; }
    if (req.method === 'OPTIONS') {
      const headers = (req.headers['access-control-request-headers'] || '').toLowerCase().split(',').map(h => h.trim()).filter(Boolean);
      if (!originAllowed || req.headers['access-control-request-method'] !== (action === 'status' ? 'GET' : 'POST') || headers.some(h => !['content-type', 'x-ujn-grade-export'].includes(h))) { sendJson(res, 403, { message: '请从本站成绩导出页提交' }); return; }
      res.writeHead(204, { ...BASE_HEADERS, 'Access-Control-Allow-Methods': action === 'status' ? 'GET' : 'POST', 'Access-Control-Allow-Headers': 'Content-Type, X-UJN-Grade-Export', 'Access-Control-Max-Age': '600' }); res.end(); return;
    }
    if (req.method === 'GET' && action === 'status') { sendJson(res, 200, { enabled: true, modes: ['sso', 'direct'], transport: 'server', maxFileMB: 20 }); return; }
    if (action === 'status') { sendJson(res, 405, { message: '仅支持 GET' }); return; }
    if (req.method !== 'POST') { sendJson(res, 405, { message: '请通过页面表单提交' }); return; }
    if (!originAllowed || req.headers['x-ujn-grade-export'] !== '1') { sendJson(res, 403, { message: '请从本站成绩导出页提交' }); return; }
    const now = Date.now(); sweep();
    for (const [key, entry] of attempts) if (now - entry.start >= windowMs) attempts.delete(key);
    // Do not trust browser X-Forwarded-For. Nginx has a separate per-IP limit.
    const peer = req.socket.remoteAddress;
    const proxied = trustProxy && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer) && /^[\da-f:.]{3,45}$/i.test(req.headers['x-real-ip'] || '');
    const ip = proxied ? req.headers['x-real-ip'] : peer;
    const rate = attempts.get(ip) || { start: now, count: 0, requests: 0 };
    if ((action === 'login' && rate.count >= quota) || rate.requests >= 60 || (!attempts.has(ip) && attempts.size >= 4096)) { sendJson(res, 429, { message: '提交较频繁，请稍后再试' }); return; }
    if (active >= maxActive) { sendJson(res, 503, { message: '导出服务繁忙，请稍后重试' }); return; }
    rate.requests++; if (action === 'login') rate.count++; attempts.set(ip, rate); active++;
    let input, client, session, key, retained = false, ownsSession = false;
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs); timer.unref();
    const disconnect = () => { if (!res.writableFinished) controller.abort(); }; res.on('close', disconnect);
    try {
      input = await readJson(req);
      if (action === 'login') {
        const { user, password, mode = 'sso' } = input;
        if (typeof user !== 'string' || !/^[a-zA-Z0-9._@-]{1,64}$/.test(user.trim()) || typeof password !== 'string' || !password || password.length > 256 || !['sso', 'direct'].includes(mode)) throw invalid('请填写有效的账号、密码和登录方式');
        if (sessions.size >= maxSessions || [...sessions.values()].filter(s => s.ip === ip).length >= 2) throw invalid('当前登录会话较多，请退出已有会话或稍后重试', 503);
        client = clientFactory({ base, signal: controller.signal });
        await (mode === 'sso' ? client.loginSso(user.trim(), password) : client.loginDirect(user.trim(), password));
        input.password = '';
        const periods = await client.getAvailablePeriods();
        if (controller.signal.aborted || res.destroyed) throw new DOMException('Cancelled', 'AbortError');
        // Parallel logins may have completed since the initial capacity check.
        if (sessions.size >= maxSessions || [...sessions.values()].filter(s => s.ip === ip).length >= 2) throw invalid('当前登录会话较多，请稍后重试', 503);
        const token = randomBytes(32).toString('base64url'); key = tokenKey(token);
        session = { client, ip, expires: Date.now() + sessionMs, busy: false, years: new Set(periods.years.map(y => y.value)), terms: new Map([[periods.year, new Set(periods.terms.map(t => t.value))]]) };
        client.signal = undefined; sessions.set(key, session); retained = true;
        sendJson(res, 200, { ...periods, sessionToken: token, expiresIn: Math.ceil(sessionMs / 1000) }); return;
      }
      if (typeof input.sessionToken !== 'string' || !/^[\w-]{43}$/.test(input.sessionToken)) throw invalid('登录会话已过期，请重新登录', 401);
      key = tokenKey(input.sessionToken); session = sessions.get(key);
      if (!session || session.ip !== ip || session.expires <= now) throw invalid('登录会话已过期，请重新登录', 401);
      if (action === 'logout') { discard(key); sendJson(res, 200, { loggedOut: true }); return; }
      if (session.busy) throw invalid('该账号正在查询或导出，请等待当前操作完成', 409);
      if (typeof input.year !== 'string' || !session.years.has(input.year)) throw invalid('请选择此账号可查询的学年');
      if (action === 'export' && (typeof input.term !== 'string' || !session.terms.get(input.year)?.has(input.term))) throw invalid('请选择学校返回的可查询学期');
      session.busy = true; ownsSession = true; session.controller = controller; client = session.client; client.signal = controller.signal; retained = true;
      if (action === 'periods') {
        const periods = await client.getAvailablePeriods({ year: input.year });
        if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        session.years = new Set(periods.years.map(y => y.value)); session.terms.set(periods.year, new Set(periods.terms.map(t => t.value)));
        sendJson(res, 200, { ...periods, expiresIn: Math.max(0, Math.floor((session.expires - Date.now()) / 1000)) }); return;
      }
      const result = await client.exportGrades({ year: input.year, term: input.term });
      if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (!res.destroyed) {
        res.writeHead(200, { ...BASE_HEADERS, 'Content-Type': result.contentType, 'Content-Disposition': `attachment; filename="ujn-grades.xls"; filename*=UTF-8''${encodeURIComponent(result.filename)}`, 'Content-Length': result.buffer.length }); res.end(result.buffer);
      }
    } catch (error) {
      const aborted = controller.signal.aborted;
      if (ownsSession && (aborted || error instanceof ExportError)) discard(key);
      const message = aborted || ['TimeoutError', 'AbortError'].includes(error.name) ? '学校响应超时或导出已取消，请稍后重试'
        : error instanceof ExportError ? error.message : error.status ? error.message : '教务系统暂时不可达，请检查服务端网络后重试';
      sendJson(res, error.status || (error instanceof ExportError ? 422 : 502), { message, sessionExpired: !!ownsSession && !sessions.has(key) });
    } finally {
      if (input) { input.password = ''; input.sessionToken = ''; }
      if (ownsSession) { session.busy = false; session.controller = undefined; client.signal = undefined; }
      if (!retained) client?.dispose(); clearTimeout(timer); res.off('close', disconnect); active--;
    }
  });
  server.requestTimeout = 10000; server.headersTimeout = 10000;
  server.on('close', () => { clearInterval(sweepTimer); for (const key of sessions.keys()) discard(key); });
  return server;
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const port = Number(process.env.GRADE_PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('GRADE_PORT must be a valid port');
  createGradeServer({ publicOrigin: process.env.GRADE_PUBLIC_ORIGIN, allowedOrigins: (process.env.GRADE_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean), trustProxy: process.env.GRADE_TRUST_PROXY === '1', base: process.env.JWGL_BASE || 'https://jwgl.ujn.edu.cn' }).listen(port, '127.0.0.1', () => console.log(`Grade export service: http://127.0.0.1:${port}/tools/grade-export/`));
}
