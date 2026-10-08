import http from 'node:http';
import { generateKeyPairSync, privateDecrypt, constants } from 'node:crypto';
import { encryptCas } from '../../tools/grade-export/cas-encryption.mjs';

export async function createMockSchool({ htmlExport = false, failLogin = false, periods = { '2025': [{ value: '3', label: '第一学期' }, { value: '12', label: '第二学期' }], '2024': [{ value: '16', label: '暑期学期' }] } } = {}) {
  const records = [];
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });
  const key = publicKey.export({ format: 'jwk' });
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString();
    const url = new URL(req.url, 'http://mock.invalid'); const form = new URLSearchParams(raw);
    records.push({ path: url.pathname, method: req.method, form, cookie: req.headers.cookie || '', raw });
    function send(status, body, headers = {}) { res.writeHead(status, { 'Content-Type': 'text/html', ...headers }); res.end(body); }
    if (url.pathname === '/sso/driotlogin') {
      if (url.searchParams.get('ticket') === 'fixture') send(302, '', { Location: '/jwglxt/', 'Set-Cookie': 'JSESSIONID=sso-user; Path=/jwglxt; HttpOnly' });
      else send(302, '', { Location: '/tpass/login?service=fixture' });
    } else if (url.pathname === '/tpass/login') {
      if (req.method === 'GET') send(200, '<form action="/tpass/login?service=fixture"><input name="lt" value="LT-fixture"><input name="execution" value="e1s1"></form>', { 'Set-Cookie': 'JSESSIONID=cas-session; Path=/tpass; HttpOnly' });
      else if (!failLogin && req.headers.cookie?.includes('cas-session') && form.get('rsa') === encryptCas('20230001correct-horseLT-fixture') && form.get('ul') === '8' && form.get('pl') === '13') send(302, '', { Location: '/sso/driotlogin?ticket=fixture' });
      else send(200, '<div id="tips">用户名或密码错误</div>');
    } else if (url.pathname === '/jwglxt/xtgl/login_slogin.html') {
      if (req.method === 'GET') send(200, '<input name="csrftoken" value="csrf-fixture"><input name="language" value="zh_CN"><input name="csrfTokenLogout" value="logout-fixture">', { 'Set-Cookie': 'JSESSIONID=initial; Path=/jwglxt; HttpOnly' });
      else {
        let decrypted = '';
        try {
          const block = privateDecrypt({ key: privateKey, padding: constants.RSA_NO_PADDING }, Buffer.from(form.get('mm') || '', 'base64'));
          decrypted = block.subarray(block.indexOf(0, 2) + 1).toString();
        } catch { /* wrong key */ }
        if (!failLogin && decrypted === 'correct-horse' && form.getAll('mm').length === 2 && req.headers.cookie?.includes('logged-out')) send(302, '', { Location: '/jwglxt/', 'Set-Cookie': 'JSESSIONID=direct-user; Path=/jwglxt' });
        else send(200, '<div id="tips">用户名或密码错误</div>');
      }
    } else if (url.pathname.endsWith('login_getPublicKey.html')) send(200, JSON.stringify({ modulus: Buffer.from(key.n, 'base64url').toString('base64'), exponent: Buffer.from(key.e, 'base64url').toString('base64') }), { 'Content-Type': 'application/json' });
    else if (url.pathname.endsWith('login_logoutAccount.html')) send(200, '{}', { 'Content-Type': 'application/json', 'Set-Cookie': 'JSESSIONID=logged-out; Path=/jwglxt' });
    else if (url.pathname === '/jwglxt/') send(200, '<h1>教务主页</h1>');
    else if (url.pathname.endsWith('index_initMenu.html')) send(200, '<h1>菜单</h1>');
    else if (url.pathname.endsWith('cjcx_cxDgXscj.html')) {
      if (!/sso-user|direct-user/.test(req.headers.cookie || '')) { send(401, 'expired'); return; }
      const years = Object.keys(periods).sort().reverse(), year = form.get('xnm') || years[0];
      send(200, '<select id="xnm">' + years.map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}-${Number(y) + 1} 学年</option>`).join('') + '</select><select name="xqm">' + (periods[year] || []).map((t, i) => `<option value="${t.value}" ${i ? '' : 'selected'}>${t.label}</option>`).join('') + '</select>');
    }
    else if (url.pathname.endsWith('export_exportConfig.html')) {
      if (!/sso-user|direct-user/.test(req.headers.cookie || '')) send(401, 'expired');
      else if (htmlExport) send(200, '<html>没有数据</html>');
      else send(200, 'MOCK-XLS-BYTES\n' + raw, { 'Content-Type': 'application/vnd.ms-excel', 'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(form.get('fileName') + '.xls') });
    } else send(404, 'missing');
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  return { base: `http://127.0.0.1:${server.address().port}`, records, close: () => new Promise(done => { server.closeAllConnections(); server.close(done); }) };
}
