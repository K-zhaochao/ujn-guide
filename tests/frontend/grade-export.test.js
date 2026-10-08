import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

const source = readFileSync(resolve('docs/javascripts/grade-export.js'), 'utf8');
const page = readFileSync(resolve('docs/tools/grade-export.md'), 'utf8');
const html = /<form id="grade-export-form"[\s\S]*?<\/form>/.exec(page)[0];
const handlers = []; globalThis.document$ = { subscribe: fn => handlers.push(fn) };
new Function(source)();
const flush = () => new Promise(done => setTimeout(done, 0));
const json = data => ({ ok: true, json: async () => data });
const statusResponse = () => json({ enabled: true });
const sessionToken = 'T'.repeat(43);
const metadata = () => ({ sessionToken, expiresIn: 600, years: [{ value: '2025', label: '2025-2026 学年' }, { value: '2024', label: '2024-2025 学年' }], terms: [{ value: '3', label: '第一学期' }, { value: '12', label: '第二学期' }], year: '2025', term: '3' });
const form = () => document.getElementById('grade-export-form');
const submit = () => form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
const widget = name => form().querySelector('[data-grade-select="' + name + '"]');
const trigger = name => widget(name).querySelector('[role="combobox"]');
const option = (name, label) => Array.from(widget(name).querySelectorAll('[role="option"]')).find(n => n.textContent === label);
function boot() { document.body.innerHTML = html; handlers.forEach(fn => fn()); }
function fill() { form().elements.user.value = '20230001'; form().elements.password.value = 'fixture-secret'; }
async function loggedIn() { boot(); await flush(); fill(); submit(); await flush(); }
function key(name, key) { trigger(name).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); }
function fileResponse() { return { ok: true, headers: { get: key => key === 'content-type' ? 'application/vnd.ms-excel' : "attachment; filename*=UTF-8''" + encodeURIComponent('2025 成绩单.xls') }, blob: async () => new Blob(['xls']) }; }
beforeEach(() => {
  window.history.replaceState({}, '', '/tools/grade-export/');
  globalThis.fetch = vi.fn().mockImplementation((url) => Promise.resolve(url.endsWith('/status') ? statusResponse() : url.endsWith('/login') ? json(metadata()) : url.endsWith('/logout') ? json({ loggedOut: true }) : fileResponse()));
  URL.createObjectURL = vi.fn(() => 'blob:fixture'); URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => { document.body.innerHTML = ''; handlers.forEach(fn => fn()); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('two-step grade export page', () => {
  it('offers only the on-site flow with no plugins, CLI, installers or manual year values', () => {
    expect(page).not.toMatch(/Tampermonkey|Violentmonkey|install\.|jwgl-export\.mjs|不经本站服务|本地命令行/);
    boot(); expect(form().elements.year.type).toBe('hidden'); expect(form().querySelector('select')).toBeNull();
    expect(form().querySelector('[data-grade-export]').hidden).toBe(true);
  });
  it('checks the service and enables only the credential stage', async () => {
    boot(); expect(form().elements.password.disabled).toBe(true); await flush();
    expect(form().elements.password.disabled).toBe(false); expect(trigger('year').disabled).toBe(true);
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/grade-export\/status$/);
  });
  it('unavailable service keeps login disabled without offering discontinued tools', async () => {
    fetch.mockRejectedValue(new Error()); boot(); await flush();
    expect(form().elements.password.disabled).toBe(true); expect(form().textContent).toContain('成绩导出暂未开放');
    expect(form().textContent).not.toContain('本地工具');
  });
  it('logs in once, immediately clears password, and displays school-only options without downloading yet', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem'); boot(); await flush(); fill(); submit(); submit();
    expect(form().elements.password.value).toBe(''); expect(form().getAttribute('aria-busy')).toBe('true'); await flush();
    expect(fetch).toHaveBeenCalledTimes(2);
    const opts = fetch.mock.calls[1][1]; expect(JSON.parse(opts.body)).toEqual({ user: '20230001', password: 'fixture-secret', mode: 'sso' });
    expect(fetch.mock.calls[1][0]).toMatch(/\/login$/); expect(opts.credentials).toBe('omit'); expect(opts.headers['X-UJN-Grade-Export']).toBe('1');
    expect(storage).not.toHaveBeenCalled(); expect(form().outerHTML).not.toContain(sessionToken); expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    expect(form().querySelector('[data-grade-login]').hidden).toBe(true); expect(form().querySelector('[data-grade-export]').hidden).toBe(false);
    expect(form().elements.user.disabled).toBe(true); expect(trigger('year').disabled).toBe(false);
    expect(widget('year').textContent).toContain('2024-2025 学年'); expect(widget('year').textContent).not.toContain('2026-2027');
  });
  it('changes year and fetches that account year-specific terms before allowing export', async () => {
    await loggedIn();
    fetch.mockImplementationOnce(() => Promise.resolve(json({ ...metadata(), year: '2024', terms: [{ value: '16', label: '暑期学期' }], term: '16' })));
    trigger('year').click(); option('year', '2024-2025 学年').click();
    expect(trigger('term').disabled).toBe(true); expect(form().querySelector('[type="submit"]').disabled).toBe(true); await flush();
    const [url, opts] = fetch.mock.calls[2]; expect(url).toMatch(/\/periods$/); expect(JSON.parse(opts.body)).toEqual({ sessionToken, year: '2024' });
    expect(form().elements.term.value).toBe('16'); expect(widget('term').textContent).toContain('暑期学期');
    expect(widget('term').textContent).not.toContain('第一学期'); expect(form().querySelector('[type="submit"]').disabled).toBe(false);
  });
  it('keyboard arrows/Enter choose terms, Escape and outside click close the themed listbox', async () => {
    await loggedIn(); key('term', 'ArrowDown'); expect(trigger('term').getAttribute('aria-expanded')).toBe('true');
    key('term', 'End'); key('term', 'Enter'); expect(form().elements.term.value).toBe('12');
    expect(option('term', '第二学期').getAttribute('aria-selected')).toBe('true'); expect(trigger('term').getAttribute('aria-expanded')).toBe('false');
    trigger('term').click(); key('term', 'Escape'); expect(widget('term').querySelector('[role="listbox"]').hidden).toBe(true);
    trigger('term').click(); document.body.click(); expect(trigger('term').getAttribute('aria-expanded')).toBe('false');
  });
  it('pointer focus moving into an option does not close the menu before its click is delivered', async () => {
    await loggedIn(); trigger('term').focus(); trigger('term').click();
    const next = option('term', '第二学期'); next.focus();
    expect(widget('term').querySelector('[role="listbox"]').hidden).toBe(false);
    next.click(); expect(form().elements.term.value).toBe('12');
  });
  it('exports with only the short-lived token and raw school year/term values, no password', async () => {
    await loggedIn(); key('term', 'ArrowDown'); key('term', 'End'); key('term', 'Enter'); submit(); submit(); await flush();
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ sessionToken, year: '2025', term: '12' });
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce(); expect(form().textContent).toContain('已开始下载'); expect(form().getAttribute('aria-busy')).toBe('false');
  });
  it('logout invalidates server session and returns to login without retaining password', async () => {
    await loggedIn(); form().querySelector('[data-grade-logout]').click(); await flush();
    expect(fetch.mock.calls[2][0]).toMatch(/\/logout$/); expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ sessionToken });
    expect(form().querySelector('[data-grade-login]').hidden).toBe(false); expect(form().elements.password.disabled).toBe(false); expect(form().elements.password.value).toBe('');
    expect(widget('year').querySelectorAll('[role="option"]').length).toBe(0);
  });
  it('school login error is rendered as text and allows retry', async () => {
    fetch.mockImplementationOnce(() => Promise.resolve(statusResponse())).mockImplementationOnce(() => Promise.resolve({ ok: false, status: 422, json: async () => ({ message: '<img src=x onerror=alert(1)> 登录失败' }) }));
    boot(); await flush(); fill(); submit(); await flush();
    expect(form().textContent).toContain('登录失败'); expect(form().querySelector('img')).toBeNull(); expect(form().elements.password.value).toBe(''); expect(form().querySelector('[type="submit"]').disabled).toBe(false);
  });
  it('school option labels are text-only, never executable HTML', async () => {
    const data = metadata(); data.terms[0].label = '<img src=x onerror=alert(1)>学期';
    fetch.mockImplementationOnce(() => Promise.resolve(statusResponse())).mockImplementationOnce(() => Promise.resolve(json(data)));
    await loggedIn(); expect(widget('term').textContent).toContain('<img'); expect(widget('term').querySelector('img')).toBeNull();
  });
  it('invalid account metadata cannot unlock export and releases any newly returned token', async () => {
    fetch.mockImplementationOnce(() => Promise.resolve(statusResponse())).mockImplementationOnce(() => Promise.resolve(json({ sessionToken, years: [], terms: [] })));
    await loggedIn(); expect(form().textContent).toContain('完整的可查询'); expect(form().querySelector('[data-grade-export]').hidden).toBe(true);
    expect(fetch.mock.calls[2][0]).toMatch(/\/logout$/);
  });
  it('failed year refresh disables export instead of retaining stale term options', async () => {
    await loggedIn(); fetch.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 502, json: async () => ({ message: '学校暂时不可达' }) }));
    trigger('year').click(); option('year', '2024-2025 学年').click(); await flush();
    expect(form().querySelector('[type="submit"]').disabled).toBe(true); expect(widget('term').querySelectorAll('[role="option"]').length).toBe(0);
    expect(form().textContent).toContain('学校暂时不可达');
    fetch.mockImplementationOnce(() => Promise.resolve(json({ ...metadata(), year: '2024', terms: [{ value: '16', label: '暑期学期' }], term: '16' })));
    trigger('year').click(); option('year', '2024-2025 学年').click(); await flush();
    expect(form().querySelector('[type="submit"]').disabled).toBe(false); expect(form().elements.term.value).toBe('16');
  });
  it('server-expired session resets selection and requires fresh login', async () => {
    await loggedIn(); fetch.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 401, json: async () => ({ message: '登录会话已过期' }) }));
    submit(); await flush(); expect(form().querySelector('[data-grade-login]').hidden).toBe(false); expect(form().elements.password.disabled).toBe(false); expect(form().textContent).toContain('已过期');
  });
  it('rejects an HTML export response rather than downloading it', async () => {
    await loggedIn(); fetch.mockImplementationOnce(() => Promise.resolve({ ok: true, headers: { get: () => 'text/html' } }));
    submit(); await flush(); expect(form().textContent).toContain('不是 Excel 文件'); expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('cancel aborts pending login and resets credential stage', async () => {
    fetch.mockImplementationOnce(() => Promise.resolve(statusResponse())).mockImplementationOnce((_, opts) => new Promise((resolve, reject) => opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
    boot(); await flush(); fill(); submit(); form().querySelector('[data-grade-cancel]').click(); await flush();
    expect(fetch.mock.calls[1][1].signal.aborted).toBe(true); expect(form().textContent).toContain('已取消'); expect(form().getAttribute('aria-busy')).toBe('false'); expect(form().elements.password.value).toBe('');
  });
  it('cancel remains available while reading the export body and clears server session', async () => {
    await loggedIn(); fetch.mockImplementationOnce((_, opts) => Promise.resolve({ ...fileResponse(), blob: () => new Promise((resolve, reject) => opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))) }));
    submit(); await flush(); form().querySelector('[data-grade-cancel]').click(); await flush();
    expect(fetch.mock.calls[2][1].signal.aborted).toBe(true); expect(form().querySelector('[data-grade-login]').hidden).toBe(false); expect(fetch.mock.calls[3][0]).toMatch(/\/logout$/);
  });
  it('navigation clears typed password/session and reinitialization does not duplicate handlers', async () => {
    await loggedIn(); handlers.forEach(fn => fn()); expect(fetch).toHaveBeenCalledTimes(2); const previous = form();
    document.body.innerHTML = '<h1>Other page</h1>'; handlers.forEach(fn => fn()); await flush();
    expect(previous.elements.password.value).toBe(''); expect(fetch.mock.calls[2][0]).toMatch(/\/logout$/);
    boot(); await flush(); expect(fetch.mock.calls[3][0]).toMatch(/\/status$/);
  });
  it('API paths retain a static-site prefix', async () => {
    window.history.replaceState({}, '', '/ujn-guide/tools/grade-export/'); boot(); await flush(); expect(fetch.mock.calls[0][0]).toMatch(/\/ujn-guide\/api\/grade-export\/status$/);
  });
  it('frontend expires memory token and returns to login without browser persistence', async () => {
    vi.useFakeTimers(); const data = { ...metadata(), expiresIn: 1 };
    fetch.mockImplementationOnce(() => Promise.resolve(statusResponse())).mockImplementationOnce(() => Promise.resolve(json(data)));
    boot(); await vi.advanceTimersByTimeAsync(0); fill(); submit(); await vi.advanceTimersByTimeAsync(0);
    expect(form().querySelector('[data-grade-export]').hidden).toBe(false);
    await vi.advanceTimersByTimeAsync(1001); expect(form().querySelector('[data-grade-login]').hidden).toBe(false); expect(form().textContent).toContain('已到期');
    expect(fetch.mock.calls[2][0]).toMatch(/\/logout$/);
  });
});


describe('grade export usability and Pages configuration', () => {
  it('show password toggles accessibly and returns to masked state on login', async () => {
    boot(); await flush(); fill(); const toggle = form().querySelector('[data-grade-password-toggle]'); toggle.click(); expect(form().elements.password.type).toBe('text'); expect(toggle.getAttribute('aria-pressed')).toBe('true'); submit(); expect(form().elements.password.type).toBe('password'); expect(form().elements.password.value).toBe(''); await flush();
  });
  it('reconnects after a transient service failure', async () => {
    fetch.mockRejectedValueOnce(new Error()); boot(); await flush(); const retry = form().querySelector('[data-grade-retry]'); expect(retry.hidden).toBe(false); retry.click(); await flush(); expect(form().elements.password.disabled).toBe(false); expect(retry.hidden).toBe(true);
  });
  it('uses explicitly configured HTTPS API for a Pages frontend', async () => {
    const config = document.createElement('script'); config.id = 'ujn-grade-config'; config.type = 'application/json'; config.textContent = JSON.stringify({ apiUrl: 'https://grades.example/api/grade-export/' }); document.head.appendChild(config);
    try { boot(); await flush(); fill(); submit(); await flush(); expect(fetch.mock.calls[0][0]).toBe('https://grades.example/api/grade-export/status'); expect(fetch.mock.calls[1][0]).toBe('https://grades.example/api/grade-export/login'); } finally { config.remove(); }
  });
  it('rejects insecure or credential-bearing API configuration before transmitting anything', async () => {
    const config = document.createElement('script'); config.id = 'ujn-grade-config'; config.type = 'application/json'; config.textContent = JSON.stringify({ apiUrl: 'http://grades.example/api/grade-export/' }); document.head.appendChild(config);
    try { boot(); await flush(); expect(fetch).not.toHaveBeenCalled(); expect(form().elements.password.disabled).toBe(true); } finally { config.remove(); }
  });
});
