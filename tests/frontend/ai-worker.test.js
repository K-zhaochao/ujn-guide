import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

// ai-worker.js 是 Cloudflare Worker 脚本（ESM 语法但测试按 CJS 包装解析）。
// 用 new Function 在 CommonJS 包装中执行源码：把 export default 换成 module.exports，
// 避免 vite 对 ESM 语法和 import() 的干预。
const require = createRequire(import.meta.url);
const source = readFileSync(require.resolve('../../workers/ai-worker.js'), 'utf8');
const moduleSrc = source.replace(/^export default/m, 'module.exports =');
const mod = { exports: {} };
new Function('module', 'exports', 'require', moduleSrc)(mod, mod.exports, require);
const worker = mod.exports;

/** 构造 POST 请求；headers 可覆盖默认的合法 Origin 与 Token */
function makePost({ origin = 'https://ujn.matehub.top', token = 'REPLACE_WITH_YOUR_ACCESS_TOKEN', body, contentType, contentLength } = {}) {
  const headers = new Headers();
  if (origin) headers.set('Origin', origin);
  if (token) headers.set('X-Access-Token', token);
  headers.set('Content-Type', contentType || 'application/json');
  if (contentLength !== undefined) headers.set('Content-Length', String(contentLength));
  return new Request('https://ujn.matehub.top/api/ai', {
    method: 'POST',
    headers,
    body: body === undefined ? JSON.stringify({ question: '图书馆几点关门？', context: '济南大学图书馆开放时间为 8:00-22:00。' }) : body,
  });
}

/** 构造正常 env：KV 与 AI binding 均可用 */
function makeEnv({ kvGet = async () => '0', aiRun, kvMissing = false, aiMissing = false } = {}) {
  return {
    AI_LIMIT_KV: kvMissing ? null : {
      get: kvGet,
      put: async () => {},
    },
    AI: aiMissing ? null : {
      run: aiRun || (async () => new ReadableStream({
        start(c) { c.enqueue(new TextEncoder().encode('data: {"response":"你好"}')); c.close(); },
      })),
    },
  };
}

async function readBody(response) {
  return JSON.parse(await response.text());
}

describe('AI Worker（workers/ai-worker.js）', () => {
  it('CORS 预检：OPTIONS 返回 204 与允许头', async () => {
    const res = await worker.fetch(new Request('https://ujn.matehub.top/api/ai', { method: 'OPTIONS' }), makeEnv());
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('X-Access-Token');
  });

  it('非 POST 方法：返回 405 并提示仅支持 POST', async () => {
    const res = await worker.fetch(new Request('https://ujn.matehub.top/api/ai', { method: 'GET' }), makeEnv());
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
    const data = await readBody(res);
    expect(data.error).toContain('POST');
  });

  it('Origin 校验：允许域通过，未知域与缺失来源被 403', async () => {
    const ok = await worker.fetch(makePost(), makeEnv());
    expect(ok.status).not.toBe(403);
    const denied = await worker.fetch(makePost({ origin: 'https://evil.example.com' }), makeEnv());
    expect(denied.status).toBe(403);
    const missing = await worker.fetch(makePost({ origin: '' }), makeEnv());
    expect(missing.status).toBe(403);
  });

  it('Token 校验：缺失或错误返回 403', async () => {
    const bad = await worker.fetch(makePost({ token: 'wrong' }), makeEnv());
    expect(bad.status).toBe(403);
    const missing = await worker.fetch(makePost({ token: '' }), makeEnv());
    expect(missing.status).toBe(403);
  });

  it('Content-Type 与请求体大小：非 JSON 400、超长 413', async () => {
    const badType = await worker.fetch(makePost({ contentType: 'text/plain' }), makeEnv());
    expect(badType.status).toBe(400);
    const tooBig = await worker.fetch(makePost({ contentLength: 999999, body: JSON.stringify({ question: 'x', context: 'y' }) }), makeEnv());
    expect(tooBig.status).toBe(413);
  });

  it('参数校验：无效 JSON、缺少 question/context、字数超限均为 400', async () => {
    const invalidJson = await worker.fetch(makePost({ body: '{not json' }), makeEnv());
    expect(invalidJson.status).toBe(400);
    const missingField = await worker.fetch(makePost({ body: JSON.stringify({ question: 'hi' }) }), makeEnv());
    expect(missingField.status).toBe(400);
    const tooLong = await worker.fetch(makePost({ body: JSON.stringify({ question: 'x'.repeat(2001), context: 'y' }) }), makeEnv());
    expect(tooLong.status).toBe(400);
  });

  it('限流 KV 未就绪：熔断拒绝并返回 500 system_error', async () => {
    const res = await worker.fetch(makePost(), makeEnv({ kvMissing: true }));
    expect(res.status).toBe(500);
    const data = await readBody(res);
    expect(data.error).toBe('system_error');
  });

  it('全局限流：达到 GLOBAL_DAILY_LIMIT 返回 429 daily_limit_global', async () => {
    const res = await worker.fetch(makePost(), makeEnv({ kvGet: async key => (key.startsWith('global:') ? '4000' : '0') }));
    expect(res.status).toBe(429);
    const data = await readBody(res);
    expect(data.error).toBe('daily_limit_global');
    expect(data.quota.limit).toBe(4000);
  });

  it('用户限流：达到 USER_DAILY_LIMIT 返回 429 daily_limit_user 并带 X-RateLimit 头', async () => {
    const res = await worker.fetch(makePost(), makeEnv({ kvGet: async key => (key.startsWith('user:') ? '20' : '0') }));
    expect(res.status).toBe(429);
    const data = await readBody(res);
    expect(data.error).toBe('daily_limit_user');
    expect(res.headers.get('X-RateLimit-Limit')).toBe('20');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('限流通过：预扣用户与全局计数后调用 AI', async () => {
    const puts = [];
    let aiCalled = false;
    const env = makeEnv({
      kvGet: async () => '0',
      aiRun: async () => {
        aiCalled = true;
        return new ReadableStream({ start(c) { c.close(); } });
      },
    });
    env.AI_LIMIT_KV.put = async (key, value) => { puts.push([key, value]); };
    const res = await worker.fetch(makePost(), env);
    expect(res.status).toBe(200);
    expect(aiCalled).toBe(true);
    expect(puts.some(p => p[0].startsWith('user:') && p[1] === '1')).toBe(true);
    expect(puts.some(p => p[0].startsWith('global:') && p[1] === '1')).toBe(true);
  });

  it('流式成功：返回 text/event-stream 且带 no-cache', async () => {
    const res = await worker.fetch(makePost(), makeEnv());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache');
  });

  it('AI 未配置：返回 500 ai_not_configured', async () => {
    const res = await worker.fetch(makePost(), makeEnv({ aiMissing: true }));
    expect(res.status).toBe(500);
    const data = await readBody(res);
    expect(data.error).toBe('ai_not_configured');
  });

  it('上游异常：AI.run 抛错映射为 500 ai_error，不泄露内部信息', async () => {
    const res = await worker.fetch(makePost(), makeEnv({ aiRun: async () => { throw new Error('upstream boom'); } }));
    expect(res.status).toBe(500);
    const data = await readBody(res);
    expect(data.error).toBe('ai_error');
    expect(JSON.stringify(data)).not.toContain('upstream boom');
  });
});
