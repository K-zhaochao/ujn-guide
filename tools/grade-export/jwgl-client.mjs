import { createPublicKey, publicEncrypt, constants } from 'node:crypto';
import { exportFields, EXPORT_PATH } from './jwgl-endpoint.mjs';
import { encryptCas } from './cas-encryption.mjs';

export class ExportError extends Error {}

/** Per-export jar: host/path isolation is essential for the CAS -> JWGL chain. */
export class CookieJar {
  constructor() { this.store = new Map(); }
  absorb(response, requestUrl) {
    const url = new URL(requestUrl);
    const raw = response.headers.getSetCookie?.() || [response.headers.get('set-cookie')].filter(Boolean);
    for (const line of raw) {
      const [pair, ...attrs] = String(line).split(';');
      const index = pair.indexOf('=');
      if (index < 1) continue;
      const name = pair.slice(0, index).trim();
      const attributes = Object.fromEntries(attrs.map(a => {
        const at = a.indexOf('=');
        return at < 0 ? [a.trim().toLowerCase(), true] : [a.slice(0, at).trim().toLowerCase(), a.slice(at + 1).trim()];
      }));
      const domain = String(attributes.domain || url.hostname).replace(/^\./, '').toLowerCase();
      if (domain !== url.hostname && !url.hostname.endsWith('.' + domain)) continue;
      const path = attributes.path || url.pathname.slice(0, url.pathname.lastIndexOf('/')) || '/';
      const key = `${domain}|${path}|${name}`;
      const expires = attributes['max-age'] !== undefined ? Date.now() + Number(attributes['max-age']) * 1000
        : attributes.expires ? Date.parse(attributes.expires) : Infinity;
      if (expires <= Date.now()) { this.store.delete(key); continue; }
      this.store.set(key, { name, value: pair.slice(index + 1).trim(), domain, path, hostOnly: !attributes.domain, secure: !!attributes.secure, expires });
    }
  }
  header(requestUrl) {
    const url = new URL(requestUrl);
    return [...this.store.values()].filter(c =>
      (c.hostOnly ? url.hostname === c.domain : url.hostname === c.domain || url.hostname.endsWith('.' + c.domain))
      && (url.pathname === c.path || url.pathname.startsWith(c.path.endsWith('/') ? c.path : c.path + '/'))
      && (!c.secure || url.protocol === 'https:') && c.expires > Date.now()
    ).sort((a, b) => b.path.length - a.path.length).map(c => `${c.name}=${c.value}`).join('; ');
  }
  clear() { this.store.clear(); }
}

function inputValue(html, name) {
  for (const tag of html.match(/<input\b[^>]*>/gi) || []) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/g)].map(m => [m[1].toLowerCase(), m[2] ?? m[3] ?? m[4]]));
    if (attrs.name === name || attrs.id === name) return attrs.value || '';
  }
  for (const select of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    if (!new RegExp(`(?:name|id)=["']${name}["']`).test(select[1])) continue;
    const options = [...select[2].matchAll(/<option\b([^>]*)>/gi)];
    const option = options.find(m => /\bselected\b/i.test(m[1])) || options[0];
    return option ? (/value=["']([^"']*)["']/i.exec(option[1]) || [])[1] || '' : '';
  }
  return '';
}

function attributes(source) {
  return Object.fromEntries([...source.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/g)].map(m => [m[1].toLowerCase(), m[2] ?? m[3] ?? m[4]]));
}
function plainLabel(value) {
  return value.replace(/<[^>]*>/g, '').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })[entity.toLowerCase()] || match;
  }).replace(/\s+/g, ' ').trim().slice(0, 100);
}
/** Only options supplied by this student's authenticated query page; no calendar guesses. */
export function schoolOptions(html, name) {
  for (const select of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    const attrs = attributes(select[1]); if (attrs.name !== name && attrs.id !== name) continue;
    const options = [], seen = new Set();
    for (const option of select[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)) {
      const props = attributes(option[1]), value = props.value, label = plainLabel(option[2]);
      if (/\bdisabled\b/i.test(option[1]) || !label || !value || seen.has(value)) continue;
      if (!(name === 'xnm' ? /^\d{4}(?:-\d{4})?$/.test(value) : /^\d{1,3}$/.test(value))) continue;
      seen.add(value); options.push({ value, label, selected: /\bselected\b/i.test(option[1]) });
    }
    return options;
  }
  return [];
}

function loginError(html) {
  const match = /<[^>]*(?:id=["']tips["']|class=["'][^"']*bg_danger[^"']*["'])[^>]*>([\s\S]*?)<\/[^>]+>/i.exec(html);
  return match ? match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) : '请核对账号密码，或到学校入口检查验证码与二次认证';
}

export function safeFileName(name, fallback = '成绩单.xls') {
  const cleaned = String(name || '').replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, '_').replace(/^\.+|[. ]+$/g, '').trim();
  return cleaned.slice(0, 180) || fallback;
}

/** Read bounded bodies, including login pages, to avoid unbounded upstream memory. */
async function readBody(response, limit = 2 * 1024 * 1024) {
  const chunks = []; let size = 0;
  for await (const chunk of response.body || []) {
    size += chunk.length;
    if (size > limit) throw new ExportError('学校响应超过大小限制，请缩小导出范围');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export class JwglClient {
  constructor({ base = 'https://jwgl.ujn.edu.cn', ssoOrigin = 'http://sso.ujn.edu.cn', signal, fetchImpl = fetch, allowedOrigins, gnmkdm = 'N305005', layout = 'default' } = {}) {
    this.base = base.replace(/\/+$/, ''); this.ssoOrigin = ssoOrigin;
    this.signal = signal; this.fetch = fetchImpl; this.jar = new CookieJar();
    this.gnmkdm = gnmkdm; this.layout = layout;
    this.allowedOrigins = new Set(allowedOrigins || [new URL(base).origin, ssoOrigin, 'https://sso.ujn.edu.cn', 'http://jwgl.ujn.edu.cn', 'https://jwgl.ujn.edu.cn']);
  }
  url(path) {
    const url = new URL(/^https?:/.test(path) ? path : this.base + '/' + path.replace(/^\//, ''));
    if (!this.allowedOrigins.has(url.origin) || url.username || url.password) throw new ExportError('学校登录跳转到了未配置的地址');
    return url.href;
  }
  async request(path, { method = 'GET', body, headers = {} } = {}) {
    const url = this.url(path); const cookie = this.jar.header(url);
    const timeout = AbortSignal.timeout(15000);
    const response = await this.fetch(url, {
      method, body, redirect: 'manual', signal: this.signal ? AbortSignal.any([this.signal, timeout]) : timeout,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36', Accept: '*/*', ...(cookie ? { Cookie: cookie } : {}), ...headers },
    });
    this.jar.absorb(response, url); return response;
  }
  async text(path, options) {
    const response = await this.request(path, options);
    return { response, text: (await readBody(response)).toString('utf8') };
  }
  async followResponse(response, fromUrl) {
    let url = fromUrl;
    for (let hops = 0; [301,302,303,307,308].includes(response.status); hops++) {
      if (hops >= 8) throw new ExportError('学校登录跳转次数过多');
      const location = response.headers.get('location');
      if (!location) throw new ExportError('学校登录跳转缺少地址');
      url = this.url(new URL(location, url).href); await response.body?.cancel();
      response = await this.request(url, { headers: { Accept: 'text/html' } });
    }
    return { response, url, html: (await readBody(response)).toString('utf8') };
  }
  async loginSso(user, password) {
    const entry = this.url('/sso/driotlogin');
    const page = await this.followResponse(await this.request(entry), entry);
    if (page.response.status !== 200) throw new ExportError('统一认证登录页暂时不可用');
    const lt = inputValue(page.html, 'lt'), execution = inputValue(page.html, 'execution');
    if (!lt || !execution) throw new ExportError('统一认证登录表单已变化，请检查学校入口');
    const match = /<form[^>]*action=["']([^"']*)["']/i.exec(page.html);
    const action = this.url(new URL((match?.[1] || page.url).replace(/&amp;/g, '&'), page.url).href);
    const form = new URLSearchParams({ rsa: encryptCas(user + password + lt), ul: String(user.length), pl: String(password.length), lt, execution, _eventId: 'submit' });
    const response = await this.request(action, { method: 'POST', body: form.toString(), headers: {
      'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html', Origin: new URL(action).origin, Referer: page.url,
    } });
    if (![302,303].includes(response.status)) {
      await response.body?.cancel();
      throw new ExportError('统一认证登录未成功，请核对账号密码；若学校要求验证码或二次认证，请到学校入口完成登录');
    }
    const final = await this.followResponse(response, action);
    if (final.response.status !== 200 || inputValue(final.html, 'lt') || /name=["']yhm["']/i.test(final.html) || !new URL(final.url).pathname.includes('/jwglxt')) throw new ExportError('统一认证会话未进入教务系统，请在学校入口检查账号状态');
  }
  async loginDirect(user, password) {
    const loginPath = '/jwglxt/xtgl/login_slogin.html';
    const page = await this.text(loginPath, { headers: { Accept: 'text/html' } });
    if (page.response.status !== 200) throw new ExportError(`打不开登录页（HTTP ${page.response.status}）`);
    const stamp = Date.now();
    const keyResult = await this.text(`/jwglxt/xtgl/login_getPublicKey.html?time=${stamp}&_=${stamp}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    let payload;
    try { payload = JSON.parse(keyResult.text); } catch { throw new ExportError('学校公钥接口返回异常'); }
    if (!payload.modulus || !payload.exponent) throw new ExportError('学校公钥接口缺少 modulus/exponent');
    const logoutToken = inputValue(page.text, 'csrfTokenLogout');
    if (logoutToken) {
      const logout = await this.request('/jwglxt/xtgl/login_logoutAccount.html', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrftoken: logoutToken }).toString() });
      await logout.body?.cancel();
    }
    let encrypted;
    try {
      const key = createPublicKey({ format: 'jwk', key: { kty: 'RSA', n: Buffer.from(payload.modulus, 'base64').toString('base64url'), e: Buffer.from(payload.exponent, 'base64').toString('base64url') } });
      encrypted = publicEncrypt({ key, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(password)).toString('base64');
    } catch { throw new ExportError('RSA 密码加密失败，请检查学校公钥接口'); }
    const form = new URLSearchParams({ csrftoken: inputValue(page.text, 'csrftoken'), language: inputValue(page.text, 'language'), ydType: inputValue(page.text, 'ydType'), yhm: user });
    form.append('mm', encrypted); form.append('mm', encrypted);
    const response = await this.request(loginPath + `?time=${Date.now()}`, { method: 'POST', body: form.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: new URL(this.base).origin, Referer: this.url(loginPath) } });
    if (![302,303].includes(response.status)) throw new ExportError('登录失败：' + loginError((await readBody(response)).toString('utf8')));
    const final = await this.followResponse(response, this.url(loginPath));
    if (final.response.status !== 200 || /name=["']yhm["']/i.test(final.html)) throw new ExportError('登录会话尚未建立');
  }
  queryPath() {
    return `/jwglxt/cjcx/cjcx_cxDgXscj.html?gnmkdm=${encodeURIComponent(this.gnmkdm)}&layout=${encodeURIComponent(this.layout)}`;
  }
  async getAvailablePeriods({ year = '' } = {}) {
    await this.text('/jwglxt/xtgl/index_initMenu.html', { headers: { Accept: 'text/html' } });
    const query = this.queryPath();
    const filterPage = await this.text(query, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: this.url(query) }, body: new URLSearchParams({ xnm: year, xqm: '' }).toString() });
    if (filterPage.response.status !== 200 || /name=["'](?:yhm|lt)["']/i.test(filterPage.text)) throw new ExportError('成绩查询会话已过期，请重新登录');
    const years = schoolOptions(filterPage.text, 'xnm'), terms = schoolOptions(filterPage.text, 'xqm');
    if (!years.length || !terms.length) throw new ExportError('学校尚未返回可查询的学年、学期列表，请稍后重试');
    if (years.length > 64 || terms.length > 128) throw new ExportError('学校查询选项数量异常，请稍后重试');
    if (year && !years.some(option => option.value === year)) throw new ExportError('该学年不在此账号可查询的列表中');
    const effectiveYear = year || years.find(option => option.selected)?.value || years[0].value;
    if (!year) return this.getAvailablePeriods({ year: effectiveYear });
    const term = terms.find(option => option.selected)?.value || terms[0].value;
    return { years: years.map(({ value, label }) => ({ value, label })), terms: terms.map(({ value, label }) => ({ value, label })), year: effectiveYear, term };
  }
  async exportGrades({ year, term } = {}) {
    if (!/^\d{4}(?:-\d{4})?$/.test(year || '') || !/^\d{1,3}$/.test(term || '')) throw new ExportError('请先选择学校返回的学年、学期');
    const query = this.queryPath();
    // Submit the exact school option values, not a hard-coded semester mapping.
    const filterPage = await this.text(query, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: this.url(query) }, body: new URLSearchParams({ xnm: year, xqm: term }).toString() });
    if (filterPage.response.status !== 200 || /name=["'](?:yhm|lt)["']/i.test(filterPage.text)) throw new ExportError('成绩查询会话已过期，请重新登录');
    const effectiveYear = year || inputValue(filterPage.text, 'xnm');
    const filename = `${effectiveYear || '当前学年'}-${term} 成绩单`;
    const response = await this.request('/' + EXPORT_PATH + `?gnmkdm=${encodeURIComponent(this.gnmkdm)}&layout=${encodeURIComponent(this.layout)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/vnd.ms-excel,application/octet-stream,*/*', Origin: new URL(this.base).origin, Referer: this.url(query) },
      body: exportFields({ xnm: effectiveYear, xqm: term, fileName: filename }),
    });
    if (response.status !== 200) { await response.body?.cancel(); throw new ExportError(`导出失败（HTTP ${response.status}）`); }
    const buffer = await readBody(response, 20 * 1024 * 1024);
    const type = (response.headers.get('content-type') || '').toLowerCase();
    const head = buffer.subarray(0, 400).toString('utf8');
    if (!buffer.length || /html|json/.test(type) || /^\s*(?:<!doctype|<html|\{)/i.test(head)) throw new ExportError('教务系统返回的是网页而不是表格，可能是会话过期或没有该学期成绩');
    const disposition = response.headers.get('content-disposition') || '';
    const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    const plain = /filename="?([^";]+)"?/i.exec(disposition);
    let suggested = plain?.[1] || filename + '.xls';
    if (utf8) { try { suggested = decodeURIComponent(utf8[1]); } catch { /* use plain/fallback */ } }
    suggested = safeFileName(suggested);
    if (!/\.xls$/i.test(suggested)) suggested += '.xls';
    return { buffer, filename: suggested, contentType: 'application/vnd.ms-excel' };
  }
  dispose() { this.jar.clear(); }
}
