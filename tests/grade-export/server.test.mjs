import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGradeServer } from '../../tools/grade-export/server.mjs';
import { JwglClient } from '../../tools/grade-export/jwgl-client.mjs';
import { createMockSchool } from './mock-school.mjs';
import { setTimeout as delay } from 'node:timers/promises';

const credentials = { user: '20230001', password: 'correct-horse', mode: 'sso' };
const periods = { years: [{ value: '2025', label: '2025-2026' }], terms: [{ value: '3', label: '第一学期' }], year: '2025', term: '3' };
const fake = () => ({ async loginSso() {}, async getAvailablePeriods() { return periods; }, async exportGrades() { return { buffer: Buffer.from('xls'), filename: 'test.xls', contentType: 'application/vnd.ms-excel' }; }, dispose() {} });
async function start(options) {
  const server = createGradeServer(options); await new Promise(done => server.listen(0, '127.0.0.1', done));
  const origin = 'http://127.0.0.1:' + server.address().port;
  return { origin, server, post: (action, input, headers = {}) => fetch(origin + '/api/grade-export/' + action, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-UJN-Grade-Export': '1', ...headers }, body: JSON.stringify(input) }), close: () => new Promise(done => { server.closeAllConnections(); server.close(done); }) };
}
async function login(service, headers) {
  const response = await service.post('login', credentials, headers); assert.equal(response.status, 200); return response.json();
}
const selection = token => ({ sessionToken: token, year: '2025', term: '3' });
test('login -> authenticated school options -> export without forwarding school cookies or re-sending password', async () => {
  const school = await createMockSchool(); const service = await start({ clientFactory: o => new JwglClient({ ...o, base: school.base, ssoOrigin: school.base, allowedOrigins: [school.base] }) });
  try {
    assert.equal((await (await fetch(service.origin + '/api/grade-export/status')).json()).enabled, true);
    const logged = await login(service); assert.match(logged.sessionToken, /^[\w-]{43}$/); assert.equal(logged.expiresIn, 600);
    assert.deepEqual(logged.years.map(y => y.value), ['2025', '2024']); assert.deepEqual(logged.terms.map(t => t.value), ['3', '12']);
    assert.doesNotMatch(JSON.stringify(logged), /correct-horse|JSESSIONID|sso-user/);
    const response = await service.post('export', selection(logged.sessionToken)); assert.equal(response.status, 200);
    assert.equal(response.headers.get('set-cookie'), null); assert.match(response.headers.get('content-disposition'), /filename\*=UTF-8/); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.match(await response.text(), /MOCK-XLS-BYTES/);
    assert.equal(school.records.filter(r => r.path === '/tpass/login' && r.method === 'POST').length, 1);
    const refreshed = await (await service.post('periods', { sessionToken: logged.sessionToken, year: '2024' })).json();
    assert.deepEqual(refreshed.terms, [{ value: '16', label: '暑期学期' }]);
    assert.equal((await service.post('export', { sessionToken: logged.sessionToken, year: '2024', term: '16' })).status, 200);
  } finally { await service.close(); await school.close(); }
});
test('invalid Origin, simple forms and bad credential fields never reach school', async () => {
  let calls = 0; const service = await start({ quota: 20, clientFactory: () => { calls++; throw new Error(); } });
  try {
    assert.equal((await service.post('login', credentials, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await service.post('login', credentials, { 'X-UJN-Grade-Export': '' })).status, 403);
    assert.equal((await service.post('login', { ...credentials, mode: 'invalid' })).status, 400);
    assert.equal((await service.post('login', { ...credentials, password: '' })).status, 400);
    assert.equal((await service.post('login', credentials, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await service.post('login', { ...credentials, extra: 'x'.repeat(9000) })).status, 413);
    assert.equal(calls, 0);
  } finally { await service.close(); }
});
test('arbitrary year/term, unqueried years, and missing/fake sessions are rejected before export', async () => {
  let exports = 0; const service = await start({ clientFactory: () => ({ ...fake(), async exportGrades() { exports++; } }) });
  try {
    assert.equal((await service.post('export', credentials)).status, 401);
    const data = await login(service);
    assert.equal((await service.post('export', { ...selection(data.sessionToken), year: '2030' })).status, 400);
    assert.equal((await service.post('export', { ...selection(data.sessionToken), term: '12' })).status, 400);
    assert.equal((await service.post('periods', { sessionToken: data.sessionToken, year: '2030' })).status, 400);
    assert.equal((await service.post('export', selection('x'.repeat(43)))).status, 401); assert.equal(exports, 0);
  } finally { await service.close(); }
});
test('logout disposes CookieJar and immediately invalidates token', async () => {
  let disposed = 0; const service = await start({ clientFactory: () => ({ ...fake(), dispose() { disposed++; } }) });
  try { const data = await login(service); assert.equal(disposed, 0); assert.equal((await service.post('logout', { sessionToken: data.sessionToken })).status, 200); assert.equal(disposed, 1); assert.equal((await service.post('export', selection(data.sessionToken))).status, 401); }
  finally { await service.close(); }
});
test('absolute session expiry disposes client without persisting anything', async () => {
  let disposed = 0; const service = await start({ sessionMs: 40, clientFactory: () => ({ ...fake(), dispose() { disposed++; } }) });
  try { const data = await login(service); await delay(90); assert.equal((await service.post('export', selection(data.sessionToken))).status, 401); assert.equal(disposed, 1); }
  finally { await service.close(); }
});
test('server shutdown clears live sessions', async () => {
  let disposed = 0; const service = await start({ clientFactory: () => ({ ...fake(), dispose() { disposed++; } }) });
  await login(service); await service.close(); assert.equal(disposed, 1);
});
test('generic upstream errors are not reflected and failed login client is cleared', async () => {
  let disposed = false; const service = await start({ clientFactory: () => ({ loginSso() { throw new Error('SECRET password cookie'); }, dispose() { disposed = true; } }) });
  try { const response = await service.post('login', credentials); assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /SECRET|password|cookie/); assert.ok(disposed); }
  finally { await service.close(); }
});
test('login rate limit prevents repeated credential attempts but does not consume login quota on metadata/export', async () => {
  const service = await start({ quota: 1, clientFactory: fake });
  try { const data = await login(service); assert.equal((await service.post('export', selection(data.sessionToken))).status, 200); assert.equal((await service.post('periods', { sessionToken: data.sessionToken, year: '2025' })).status, 200); assert.equal((await service.post('login', credentials)).status, 429); }
  finally { await service.close(); }
});
test('school timeout aborts and releases active slot', async () => {
  let disposed = 0;
  const service = await start({ timeoutMs: 30, clientFactory: ({ signal }) => ({ loginSso: () => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })), dispose() { disposed++; } }) });
  try { const response = await service.post('login', credentials); assert.equal(response.status, 502); assert.match(await response.text(), /超时/); assert.equal(disposed, 1); }
  finally { await service.close(); }
});
test('config disallows arbitrary upstreams and plaintext public origins', () => {
  assert.throws(() => createGradeServer({ base: 'http://127.0.0.1:1234' }), /school origin/);
  assert.throws(() => createGradeServer({ publicOrigin: 'http://example.com' }), /HTTPS/);
});
test('global concurrency ceiling rejects extra requests and releases after login', async () => {
  let entered, release; const started = new Promise(done => { entered = done; }); const waiting = new Promise(done => { release = done; });
  const service = await start({ maxActive: 1, clientFactory: () => ({ ...fake(), async loginSso() { entered(); await waiting; } }) });
  try { const first = service.post('login', credentials); await started; assert.equal((await service.post('login', credentials)).status, 503); release(); assert.equal((await first).status, 200); }
  finally { release(); await service.close(); }
});
test('per-session lock prevents duplicate export and logout cancels the in-flight school operation', async () => {
  let entered; const started = new Promise(done => { entered = done; }); let disposed = 0;
  const service = await start({ clientFactory: () => ({ ...fake(), exportGrades() { entered(); return new Promise((_, reject) => this.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })); }, dispose() { disposed++; } }) });
  try {
    const data = await login(service); const first = service.post('export', selection(data.sessionToken)); await started;
    assert.equal((await service.post('export', selection(data.sessionToken))).status, 409);
    assert.equal((await service.post('logout', { sessionToken: data.sessionToken })).status, 200);
    assert.equal((await first).status, 502); assert.equal(disposed, 1);
  } finally { await service.close(); }
});
test('forwarded IP is ignored unless trusting loopback proxy; tokens remain bound to the originating peer', async () => {
  const normal = await start({ quota: 1, clientFactory: fake }); const proxy = await start({ quota: 1, trustProxy: true, clientFactory: fake });
  try {
    const normalData = await login(normal, { 'X-Real-IP': '192.0.2.1' });
    assert.equal((await normal.post('login', credentials, { 'X-Real-IP': '192.0.2.2' })).status, 429);
    assert.equal((await normal.post('export', selection(normalData.sessionToken), { 'X-Real-IP': '192.0.2.2' })).status, 200);
    const data = await login(proxy, { 'X-Real-IP': '192.0.2.1' });
    assert.equal((await proxy.post('export', selection(data.sessionToken), { 'X-Real-IP': '192.0.2.2' })).status, 401);
    assert.equal((await proxy.post('export', selection(data.sessionToken), { 'X-Real-IP': '192.0.2.1' })).status, 200);
    assert.equal((await proxy.post('login', credentials, { 'X-Real-IP': '192.0.2.2' })).status, 200);
  } finally { await normal.close(); await proxy.close(); }
});
test('bounded session store rejects new login and permits login after explicit logout', async () => {
  const service = await start({ maxSessions: 1, clientFactory: fake });
  try { const data = await login(service); assert.equal((await service.post('login', credentials)).status, 503); await service.post('logout', { sessionToken: data.sessionToken }); assert.equal((await service.post('login', credentials)).status, 200); }
  finally { await service.close(); }
});
test('authenticated school HTML errors invalidate the affected session only', async () => {
  const school = await createMockSchool({ htmlExport: true }); const service = await start({ clientFactory: o => new JwglClient({ ...o, base: school.base, ssoOrigin: school.base, allowedOrigins: [school.base] }) });
  try { const data = await login(service); const response = await service.post('export', selection(data.sessionToken)); assert.equal(response.status, 422); assert.equal((await response.json()).sessionExpired, true); assert.equal((await service.post('export', selection(data.sessionToken))).status, 401); }
  finally { await service.close(); await school.close(); }
});


test('Pages origin opt-in handles preflight, login and filename exposure without wildcard', async () => {
  const origin = 'https://k-zhaochao.github.io', service = await start({ allowedOrigins: [origin], clientFactory: fake });
  try {
    const preflight = await fetch(service.origin + '/api/grade-export/login', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-ujn-grade-export' } });
    assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), origin); assert.equal(preflight.headers.get('access-control-allow-credentials'), null);
    const health = await fetch(service.origin + '/api/grade-export/status', { headers: { Origin: origin } }); assert.equal(health.headers.get('access-control-allow-origin'), origin);
    const logged = await login(service, { Origin: origin }); const exported = await service.post('export', selection(logged.sessionToken), { Origin: origin }); assert.equal(exported.status, 200); assert.equal(exported.headers.get('access-control-expose-headers'), 'Content-Disposition');
    const denied = await fetch(service.origin + '/api/grade-export/login', { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } }); assert.equal(denied.status, 403); assert.equal(denied.headers.get('access-control-allow-origin'), null);
  } finally { await service.close(); }
});
test('CORS remains opt-in and preflight does not accept unexpected method or header', async () => {
 const origin = 'https://k-zhaochao.github.io', service = await start({ allowedOrigins: [origin], clientFactory: fake });
 try {
  for (const headers of [{ 'Access-Control-Request-Method': 'PUT' }, { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization' }]) {
   const res = await fetch(service.origin + '/api/grade-export/login', { method: 'OPTIONS', headers: { Origin: origin, ...headers } }); assert.equal(res.status, 403);
  }
  assert.throws(() => createGradeServer({ allowedOrigins: ['*'] })); assert.throws(() => createGradeServer({ allowedOrigins: ['http://pages.example'] }));
 } finally { await service.close(); }
});
