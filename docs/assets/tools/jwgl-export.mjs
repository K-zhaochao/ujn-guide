#!/usr/bin/env node
/**
 * 济大教务 · 成绩导出（本地版）
 * =====================================
 *
 * 这是「本地全自动」那条路线：在你自己的电脑上跑，帮你完成
 * 「登录教务系统 → 进成绩页 → 导出 Excel」这一整套动作。
 *
 * 它做什么、不做什么：
 *   - 账号密码只在本机内存里用一次（用来登录），**不写入磁盘、不发给任何第三方**；
 *   - 导出文件只写到你自己指定的目录；
 *   - 参考实现来自一位不愿意透露信息的学长提供的说明文档（登录流程 / Cookie / 导出接口）。
 *
 * 用法：
 *   node jwgl-export.mjs                        # 交互式，一步步问
 *   node jwgl-export.mjs --user 学号 --year 2025 --term 1 --output ./成绩.xls
 *
 * 参数：
 *   --user    学号（不给就问）
 *   --year    学年，如 2025；不给就用成绩页默认值
 *   --term    学期：1=第一学期 2=第二学期 3=短学期（默认 1）
 *   --output  输出文件路径，默认当前目录
 *   --base    教务系统地址（默认 https://jwgl.ujn.edu.cn，仅测试时改）
 *   --keep    出错时保留调试信息（不打印密码，只打印步骤与状态码）
 */

import { createInterface } from 'node:readline';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import vm from 'node:vm';

/** 默认保存位置：优先「下载」目录，没有就退回用户主目录。 */
function downloadDir() {
  const candidates = [
    join(homedir(), 'Downloads'),
    join(homedir(), '下载'),
    homedir(),
  ];
  return candidates.find(candidate => existsSync(candidate)) || homedir();
}

// ==================== 基础工具 ====================

const TERM_MAP = { 1: '3', 2: '12', 3: '16' }; // 交互里说人话，发给系统用代码
const TERM_LABEL = { 1: '第一学期', 2: '第二学期', 3: '短学期' };

class ExportError extends Error {}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[(i += 1)] : true;
    out[name] = value;
  }
  return out;
}

/** 会话 Cookie：登录全流程必须共用同一个，否则第二步就拿不到公钥。 */
class CookieJar {
  constructor() {
    this.store = new Map();
  }

  absorb(response) {
    const raw = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie')].filter(Boolean);
    for (const line of raw) {
      const pair = String(line).split(';')[0];
      const index = pair.indexOf('=');
      if (index > 0) this.store.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }

  header() {
    return [...this.store.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  get(name) {
    return this.store.get(name);
  }
}

const sleep = ms => new Promise(done => setTimeout(done, ms));

/** 隐藏字段解析：登录页把 csrftoken 之类的参数藏在 <input type="hidden"> 里。 */
function extractInputValue(html, name) {
  const pattern = new RegExp(
    `<input[^>]*name=["']${name}["'][^>]*value=["']([^"']*)["']`
    + `|<input[^>]*value=["']([^"']*)["'][^>]*name=["']${name}["']`,
    'i',
  );
  const match = pattern.exec(html);
  return match ? (match[1] ?? match[2] ?? '') : '';
}

function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 从登录失败页面里挖出人话提示（系统会把它放在 #tips 或 .bg_danger 里）。 */
function extractLoginError(html) {
  const tips = /<[^>]*id=["']tips["'][^>]*>([\s\S]*?)<\/[^>]+>/i.exec(html);
  if (tips) return htmlToText(tips[1]);
  const danger = /<[^>]*class=["'][^"']*bg_danger[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i.exec(html);
  if (danger) return htmlToText(danger[1]);
  return htmlToText(html).slice(0, 120);
}

function safeFileName(name, fallback) {
  const cleaned = String(name || '').replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned || fallback;
}

// ==================== 客户端 ====================

class JwglClient {
  constructor({ base, log = () => {} }) {
    this.base = base.replace(/\/+$/, '');
    this.jar = new CookieJar();
    this.log = log;
  }

  url(path) {
    return this.base + (path.startsWith('/') ? path : '/' + path);
  }

  /**
   * 带会话的请求。
   * 用 redirect: 'manual'：登录成功的标志就是 302，必须自己接住它。
   */
  async request(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
    const cookie = this.jar.header();
    const response = await fetch(this.url(path), {
      method,
      body,
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        Accept: headers.Accept || '*/*',
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
    });
    this.jar.absorb(response);
    return response;
  }

  async text(path, options) {
    const response = await this.request(path, options);
    return { response, text: await response.text() };
  }

  // ---------- 第 1 步：登录页与隐藏参数 ----------
  async openLoginPage() {
    const { response, text } = await this.text('/jwglxt/xtgl/login_slogin.html', {
      headers: { Accept: 'text/html' },
    });
    if (response.status !== 200) throw new ExportError(`打不开登录页（HTTP ${response.status}）`);
    return {
      html: text,
      fields: {
        csrftoken: extractInputValue(text, 'csrftoken'),
        language: extractInputValue(text, 'language'),
        ydType: extractInputValue(text, 'ydType'),
        csrfTokenLogout: extractInputValue(text, 'csrfTokenLogout'),
      },
    };
  }

  // ---------- 第 2 步：RSA 公钥 ----------
  async fetchPublicKey() {
    const stamp = Date.now();
    const { response, text } = await this.text(
      `/jwglxt/xtgl/login_getPublicKey.html?time=${stamp}&_=${stamp}`,
      { headers: { Accept: 'application/json, text/javascript, */*; q=0.01', 'X-Requested-With': 'XMLHttpRequest' } },
    );
    if (response.status !== 200) throw new ExportError(`拿公钥失败（HTTP ${response.status}）`);
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new ExportError('公钥接口返回的不是 JSON，可能是会话没建立（Cookie 没继承？）');
    }
    if (!payload || !payload.modulus || !payload.exponent) {
      throw new ExportError('公钥接口没给出 modulus/exponent');
    }
    return payload;
  }

  // ---------- 第 3 步：注销旧会话 ----------
  async logoutOldSession(fields) {
    if (!fields.csrfTokenLogout) return;
    await this.request('/jwglxt/xtgl/login_logoutAccount.html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
      body: new URLSearchParams({ csrftoken: fields.csrfTokenLogout }).toString(),
    });
  }

  // ---------- 第 4 步：加载学校自己的 RSA 脚本并加密 ----------
  /**
   * 密码加密用的是学校页面上的那套 jsbn，直接复用它们（而不是自己实现 RSA），
   * 这样和浏览器提交的密文格式完全一致。脚本必须在沙箱里按顺序执行。
   */
  async encryptPassword(password, publicKey) {
    const scripts = ['jsbn.js', 'prng4.js', 'rng.js', 'rsa.js', 'base64.js'];
    const sandbox = {
      window: {},
      navigator: { appName: 'Netscape', appVersion: '5.0' },
      Math, Date, String, Number, Array, Object, Error, RegExp, JSON,
      setTimeout, clearTimeout,
      console,
    };
    sandbox.self = sandbox;
    sandbox.window = sandbox;
    const context = vm.createContext(sandbox);

    for (const name of scripts) {
      const { response, text } = await this.text(
        `/zftal-ui-v5-1.0.2/assets/plugins/crypto/rsa/${name}`,
        { headers: { Accept: '*/*' } },
      );
      if (response.status !== 200) {
        throw new ExportError(`加载加密脚本 ${name} 失败（HTTP ${response.status}）`);
      }
      try {
        vm.runInContext(text, context, { filename: name });
      } catch (error) {
        throw new ExportError(`执行加密脚本 ${name} 出错：${error.message}`);
      }
    }

    const bridge = vm.runInContext(
      `(function (text, modulus, exponent) {
         if (typeof RSAKey === 'undefined') return { error: 'RSAKey 未定义' };
         var key = new RSAKey();
         var hex = '';
         try {
           hex = key.encrypt(text, modulus, exponent);
         } catch (e) { return { error: String(e) }; }
         if (typeof hexToBase64 === 'function') return { value: hexToBase64(hex) };
         return { value: hex };
       })`,
      context,
    );

    const result = bridge(password, publicKey.modulus, publicKey.exponent);
    if (!result || result.error || !result.value) {
      throw new ExportError('RSA 加密失败：' + ((result && result.error) || '没有返回密文'));
    }
    return result.value;
  }

  // ---------- 第 5 步：提交登录 ----------
  async submitLogin(fields, user, encrypted) {
    const form = new URLSearchParams();
    form.set('csrftoken', fields.csrftoken || '');
    form.set('language', fields.language || '');
    form.set('ydType', fields.ydType || '');
    form.set('yhm', user);
    // 系统要求 mm 出现两次。注意必须用 append：连续两次 set 只会替换，
    // 字段其实只有一个——这个错是本地假系统抓出来的。
    form.append('mm', encrypted);
    form.append('mm', encrypted);

    const response = await this.request(`/jwglxt/xtgl/login_slogin.html?time=${Date.now()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Origin: this.base,
        Referer: this.url('/jwglxt/xtgl/login_slogin.html'),
      },
      body: form.toString(),
    });

    const location = response.headers.get('location');
    if (response.status === 302 && location) return location;

    // 200 也可能是失败：正文里会有提示文字
    const html = await response.text();
    throw new ExportError(
      `登录失败（HTTP ${response.status}）：${extractLoginError(html) || '请核对学号与密码'}`,
    );
  }

  // ---------- 第 6 步：跟进跳转，保持会话 ----------
  async follow(location) {
    const path = location.startsWith('http') ? location.slice(this.base.length) : location;
    const { response } = await this.text(path || '/jwglxt/', { headers: { Accept: 'text/html' } });
    if (response.status !== 200) throw new ExportError(`跟进跳转失败（HTTP ${response.status}）`);
  }

  // ---------- 导出 ----------
  async exportGrades({ year, term, output, log }) {
    await this.text('/jwglxt/xtgl/index_initMenu.html', { headers: { Accept: 'text/html' } });

    const termCode = TERM_MAP[term] || term;
    const zero = c => (String(c).length === 1 ? '0' + c : String(c));
    const now = new Date();
    const fileName = safeFileName(
      `${year || now.getFullYear()}-${zero(term)} 成绩单`,
      'ujn-grades.xls',
    );

    const form = new URLSearchParams({
      gnmkdmKey: 'N305005',
      xnm: year || '',
      xqm: termCode,
      dcclbh: 'JW_N305005_GLY',
      'exportModel.selectCol': '',
      'exportModel.exportWjgs': 'xls',
      fileName,
    });

    const response = await this.request('/jwglxt/cjcx/cjcx_dcXsKccjList.html', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Origin: this.base,
        Referer: this.url('/jwglxt/cjcx/cjcx_cxXsKccjList.html'),
      },
      body: form.toString(),
    });

    if (response.status !== 200) throw new ExportError(`导出失败（HTTP ${response.status}）`);

    const type = response.headers.get('content-type') || '';
    if (type.includes('text/html')) {
      const html = await response.text();
      throw new ExportError(
        '教务系统返回的是网页而不是表格，多半是会话过期或该学年学期没有数据：'
        + (extractLoginError(html) || '').slice(0, 80),
      );
    }

    const disposition = response.headers.get('content-disposition') || '';
    // 优先读 RFC 5987 的 filename*=UTF-8''…（真实服务器放中文名都用它），读不到再退回 filename=
    const utf8Name = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    const plainName = /filename="?([^";]+)"?/i.exec(disposition);
    const suggested = safeFileName(
      utf8Name ? decodeURIComponent(utf8Name[1]) : plainName ? plainName[1] : fileName + '.xls',
      fileName + '.xls',
    );
    const named = suggested.endsWith('.xls') ? suggested : suggested + '.xls';
    // 不给 --output 时直接存到「下载」目录：双击运行的用户不该在安装目录里翻文件
    const target = resolve(output && output !== true ? output : join(downloadDir(), named));

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(target, buffer);
    log(`已保存：${target}（${Math.round(buffer.length / 1024)} KB）`);
    return target;
  }
}

// ==================== 交互式提问 ====================

function ask(question, { hidden = false } = {}) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  return new Promise(resolveAnswer => {
    if (!hidden) {
      rl.question(question, answer => {
        rl.close();
        resolveAnswer(answer.trim());
      });
      return;
    }
    // 隐藏输入：自己接管按键回显，别让密码出现在屏幕上
    process.stdout.write(question);
    const chars = [];
    const onData = chunk => {
      const text = chunk.toString('utf8');
      for (const char of text) {
        if (char === '\r' || char === '\n') {
          process.stdin.removeListener('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          rl.close();
          resolveAnswer(chars.join(''));
          return;
        }
        if (char === '\u0003') {
          process.stdout.write('\n');
          process.exit(130);
        }
        if (char === '\u007f' || char === '\b') {
          chars.pop();
          continue;
        }
        chars.push(char);
      }
    };
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

// ==================== 主流程 ====================

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const interactive = process.stdin.isTTY && !args.user;
  const log = message => console.log(message);

  console.log('\n📊 济大教务 · 成绩导出（本地版）');
  console.log('   账号密码只在本机内存里用一次，不写入磁盘、不发给任何第三方。\n');

  const user = String(args.user || (interactive ? await ask('学号：') : '')).trim();
  if (!user) throw new ExportError('没有学号，无法登录');
  const password = String(
    args.password && args.password !== true
      ? args.password
      : interactive
        ? await ask('密码（输入时不显示）：', { hidden: true })
        : '',
  );
  if (!password) throw new ExportError('没有密码，无法登录');

  let term = args.term;
  if (!term && interactive) {
    const answer = await ask('学期 [1] 第一学期  [2] 第二学期  [3] 短学期（回车=1）：');
    term = answer || '1';
  }
  term = String(term || '1');
  if (!TERM_MAP[term]) throw new ExportError(`学期只能是 1 / 2 / 3，收到的是「${term}」`);
  const year = args.year && args.year !== true ? String(args.year) : '';
  if (interactive) log(`\n将导出：${year || '页面默认学年'} · ${TERM_LABEL[term]}\n`);

  const base = String(args.base && args.base !== true ? args.base : 'https://jwgl.ujn.edu.cn');
  const client = new JwglClient({ base, log });

  const steps = [
    ['打开登录页…', () => client.openLoginPage()],
    ['获取加密公钥…', () => client.fetchPublicKey()],
  ];
  const loginPage = await (async () => {
    log('1/4 ' + steps[0][0]);
    return steps[0][1]();
  })();

  log('2/4 ' + steps[1][0]);
  const publicKey = await client.fetchPublicKey();

  log('3/4 提交登录…');
  await client.logoutOldSession(loginPage.fields);
  const encrypted = await client.encryptPassword(password, publicKey);
  const location = await client.submitLogin(loginPage.fields, user, encrypted);
  await client.follow(location);

  log('4/4 导出成绩…');
  const file = await client.exportGrades({ year, term, output: args.output, log });
  console.log(`\n✅ 完成：${file}`);
  if (client.jar.get('JSESSIONID')) log('（会话已正常建立）');
}

main().catch(error => {
  const message = error instanceof ExportError ? error.message : `${error.name}: ${error.message}`;
  console.error(`\n❌ ${message}`);
  if (error instanceof ExportError) {
    console.error('   常见原因：学号或密码不对 / 需要验证码 / 该学年学期没有成绩 / 教务系统改版。');
  }
  process.exit(1);
});
