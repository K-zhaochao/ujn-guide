/**
 * jwgl-export.mjs 的自测：用一个本地假教务系统把整套流程跑一遍。
 *
 *   node tools/grade-export/test-mock.mjs
 *
 * 假系统实现了说明文档里的那几个接口（登录页 / 公钥 / 注销 / 五个加密脚本 /
 * 提交登录 / 菜单初始化 / 导出），并特意留了两个"坑"以便验证失败分支：
 *   - 密码不对 → 返回 200 + 正文里带 #tips 提示（真实系统就是这样，不是 401）；
 *   - 学年传 1999 → 导出接口返回网页而不是表格。
 *
 * 它能证明的：参数、Cookie 继承、沙箱里执行学校脚本、302 跟进、文件落盘、
 * 文件名清洗、错误信息是否人话——**不能**证明真实教务系统的行为（那要真账号去试）。
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CLI = resolve(import.meta.dirname, 'jwgl-export.mjs');
const PASSWORD = 'correct-horse';

// ==================== 假教务系统 ====================

const loginPage = `<!DOCTYPE html><html><body>
  <form id="loginForm" action="/jwglxt/xtgl/login_slogin.html" method="post">
    <input type="hidden" name="csrftoken" value="csrf-abc123">
    <input type="hidden" name="language" value="zh_CN">
    <input type="hidden" name="ydType" value="">
    <input type="hidden" name="csrfTokenLogout" value="logout-xyz789">
    <input type="text" name="yhm"><input type="password" name="mm">
  </form></body></html>`;

const rsaScripts = {
  'jsbn.js': 'var BigIntegerShim = true;',
  'prng4.js': 'var SecureRandomShim = true;',
  'rng.js': 'var RngShim = true;',
  // 模仿真实 jsbn 的 API：RSAKey 实例上的 encrypt(text, modulus, exponent) 返回十六进制
  'rsa.js': `function RSAKey() {}
RSAKey.prototype.encrypt = function (text, modulus, exponent) {
  if (!modulus || !exponent) throw new Error('缺少公钥');
  // 密文里带上明文长度，方便假系统判断"密码对不对"（真实系统是 RSA，没法这样验）
  return 'aa' + String(text).length.toString(16) + 'ff';
};`,
  'base64.js': `function hexToBase64(hex) { return 'BASE64(' + hex + ')'; }`,
};

function readBody(request) {
  return new Promise(done => {
    let raw = '';
    request.on('data', chunk => (raw += chunk));
    request.on('end', () => done(raw));
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const path = url.pathname;
  const send = (status, body, headers = {}) => {
    response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
    response.end(body);
  };

  if (path === '/jwglxt/xtgl/login_slogin.html' && request.method === 'GET') {
    send(200, loginPage, { 'Set-Cookie': 'JSESSIONID=SESSION-1; Path=/' });
    return;
  }

  if (path === '/jwglxt/xtgl/login_getPublicKey.html') {
    // 真实系统会检查会话是否继承：没有 Cookie 就不给公钥
    if (!request.headers.cookie?.includes('JSESSIONID=SESSION-1')) {
      send(403, 'no session');
      return;
    }
    send(200, JSON.stringify({ modulus: 'AQAB', exponent: 'AQAB' }), {
      'Content-Type': 'application/json',
    });
    return;
  }

  if (path === '/jwglxt/xtgl/login_logoutAccount.html') {
    const body = await readBody(request);
    send(200, JSON.stringify({ status: body.includes('logout-xyz789') ? 1 : 0 }), {
      'Content-Type': 'application/json',
    });
    return;
  }

  if (path.startsWith('/zftal-ui-v5-1.0.2/assets/plugins/crypto/rsa/')) {
    const name = path.split('/').pop();
    if (!rsaScripts[name]) {
      send(404, 'not found');
      return;
    }
    send(200, rsaScripts[name], { 'Content-Type': 'application/javascript' });
    return;
  }

  if (path === '/jwglxt/xtgl/login_slogin.html' && request.method === 'POST') {
    const form = new URLSearchParams(await readBody(request));
    const user = form.get('yhm');
    const mm = form.getAll('mm');
    // 假系统的"正确密码"约定：密文正好等于「正确密码长度」编码出来的那串
    // （用等号比较，别用 includes——之前写成 includes('d')，结果 'deadbeef' 前缀自己就带 d，
    //   密码错了也会放行，用例 2 因此假绿过一轮）
    const expected = 'BASE64(aa' + PASSWORD.length.toString(16) + 'ff)';
    const ok = user === '20230001' && mm.length === 2 && mm[0] === mm[1] && mm[0] === expected;
    if (!ok) {
      send(200, '<html><body><div id="tips">用户名或密码错误，请重新输入</div></body></html>');
      return;
    }
    send(302, '', {
      Location: '/jwglxt/',
      'Set-Cookie': 'JSESSIONID=SESSION-2; Path=/; BIGipServerjwgl=node-a;',
    });
    return;
  }

  if (path === '/jwglxt/' || path === '/jwglxt/xtgl/index_initMenu.html') {
    send(200, '<html><body>菜单</body></html>');
    return;
  }

  if (path === '/jwglxt/cjcx/cjcx_dcXsKccjList.html' && request.method === 'POST') {
    const form = new URLSearchParams(await readBody(request));
    if (form.get('xnm') === '1999') {
      send(200, '<html><body><div id="tips">该学年没有成绩记录</div></body></html>');
      return;
    }
    if (form.get('gnmkdmKey') !== 'N305005' || form.get('dcclbh') !== 'JW_N305005_GLY') {
      send(200, '<html><body>参数不对</body></html>');
      return;
    }
    response.writeHead(200, {
      'Content-Type': 'application/vnd.ms-excel',
      // HTTP 头不能直接放中文，真实服务器用的是 RFC 5987 的 filename*=UTF-8'' 形式
      // （我的 CLI 会优先读它，读不到再退回 filename）
      'Content-Disposition':
        'attachment; filename="grades.xls"; filename*=UTF-8\'\'2025-1%20%E6%88%90%E7%BB%A9%E5%8D%95.xls',
    });
    response.end(Buffer.from('MOCK-XLS-BYTES\n' + form.toString()));
    return;
  }

  send(404, 'not found');
});

// ==================== 跑用例 ====================

function runCli(args) {
  return new Promise(done => {
    const child = spawn(process.execPath, [CLI, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', chunk => (out += chunk));
    child.stderr.on('data', chunk => (err += chunk));
    child.on('close', code => done({ code, out, err }));
  });
}

const results = [];
function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? '  ✓' : '  ✗'} ${name}${condition ? '' : ' → ' + detail}`);
}

await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const workdir = await mkdtemp(join(tmpdir(), 'jwgl-test-'));

try {
  console.log('\n用例 1：正常导出');
  const ok = await runCli([
    '--base', base, '--user', '20230001', '--password', PASSWORD,
    '--term', '1', '--year', '2025', '--output', join(workdir, 'ok.xls'),
  ]);
  check('退出码为 0', ok.code === 0, `code=${ok.code} err=${ok.err.slice(0, 200)}`);
  check('打印了完成信息', ok.out.includes('✅'), ok.out.slice(-160));
  const file = await readFile(join(workdir, 'ok.xls'), 'utf8').catch(() => '');
  check('文件真的写出来了', file.includes('MOCK-XLS-BYTES'), '文件内容为空');
  check('请求参数正确（gnmkdmKey / 学期码 3）', file.includes('gnmkdmKey=N305005') && file.includes('xqm=3'), file);
  check('学年透传正确', file.includes('xnm=2025'), file);

  console.log('\n用例 2：密码错误（系统返回 200 + #tips）');
  const bad = await runCli([
    '--base', base, '--user', '20230001', '--password', 'wrong', '--term', '1',
    '--output', join(workdir, 'bad.xls'),
  ]);
  check('退出码非 0', bad.code !== 0, `code=${bad.code}`);
  check('提示里带上了系统原文', bad.err.includes('用户名或密码错误'), bad.err.slice(0, 200));
  check('没有生成文件', !(await readFile(join(workdir, 'bad.xls')).catch(() => null)));

  console.log('\n用例 3：该学年没有成绩（导出接口返回网页）');
  const empty = await runCli([
    '--base', base, '--user', '20230001', '--password', PASSWORD,
    '--term', '1', '--year', '1999', '--output', join(workdir, 'empty.xls'),
  ]);
  check('退出码非 0', empty.code !== 0, `code=${empty.code}`);
  check('提示说明是"返回网页而不是表格"', empty.err.includes('网页而不是表格'), empty.err.slice(0, 240));

  console.log('\n用例 4：学期参数非法');
  const term = await runCli([
    '--base', base, '--user', '20230001', '--password', PASSWORD, '--term', '9',
    '--output', join(workdir, 'term.xls'),
  ]);
  check('退出码非 0', term.code !== 0);
  check('提示学期只能是 1/2/3', term.err.includes('学期只能是'), term.err.slice(0, 160));

  console.log('\n用例 5：默认文件名（不给 --output 时用系统给的名字）');
  const named = await runCli(['--base', base, '--user', '20230001', '--password', PASSWORD, '--term', '2']);
  check('退出码为 0', named.code === 0, named.err.slice(0, 200));
  check('用了 Content-Disposition 里的文件名', named.out.includes('2025-1 成绩单.xls'), named.out.slice(-200));
} finally {
  server.close();
  await rm(workdir, { recursive: true, force: true });
}

const failed = results.filter(item => !item.ok);
console.log(`\n${failed.length ? '❌' : '✅'} ${results.length - failed.length}/${results.length} 项通过`);
process.exit(failed.length ? 1 : 0);
