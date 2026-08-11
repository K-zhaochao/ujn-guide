import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const petClient = require('../../docs/pets/pet-client.js');

function jsonResponse(status, data = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(data),
  };
}

describe('宠物前端基础模块', () => {
  it('以浏览器全局加载，并只接受 HTTP(S) 链接', () => {
    expect(window.UJNGuidePetClient).toBe(petClient);
    expect(petClient.safeHttpUrl('https://example.test/group')).toBe('https://example.test/group');
    expect(petClient.safeHttpUrl('http://example.test')).toBe('http://example.test/');
    expect(petClient.safeHttpUrl('javascript:alert(1)')).toBe('');
    expect(petClient.safeHttpUrl('not a url')).toBe('');
  });

  it('为同源请求保留 Cookie，并只向写操作附加 CSRF 头', async () => {
    const send = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { pets: [] }))
      .mockResolvedValueOnce(jsonResponse(201, { success: true }));
    const client = petClient.createApiClient({
      baseUrl: '/api',
      fetchImpl: send,
      getCsrfToken: () => 'csrf-test-token',
    });

    await client.request('/pets');
    expect(send.mock.calls[0][0]).toBe('/api/pets');
    expect(send.mock.calls[0][1]).toMatchObject({
      method: 'GET', headers: {}, credentials: 'same-origin', body: undefined,
    });

    await client.request('/submissions', { method: 'POST', body: { name: '测试猫' } });
    expect(send.mock.calls[1][0]).toBe('/api/submissions');
    expect(send.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf-test-token' },
      credentials: 'same-origin',
      body: JSON.stringify({ name: '测试猫' }),
    });
  });

  it('将超时和网络异常映射为稳定的前端结果', async () => {
    const timeoutClient = petClient.createApiClient({
      fetchImpl: vi.fn().mockRejectedValue({ name: 'AbortError' }),
    });
    await expect(timeoutClient.request('/slow')).resolves.toMatchObject({ ok: false, status: 408 });

    const networkClient = petClient.createApiClient({
      fetchImpl: vi.fn().mockRejectedValue(new Error('offline')),
    });
    await expect(networkClient.request('/offline')).resolves.toMatchObject({ ok: false, status: 0 });
  });

  it('恢复会话后在 401 时清除用户与 CSRF 随机数', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { success: true, csrfToken: 'csrf-test-token', user: { username: 'tester' } },
      })
      .mockResolvedValueOnce({ ok: false, status: 401, data: { message: '登录已过期' } });
    const session = petClient.createAuthSession({ request });

    await session.restore();
    expect(session.getUser()).toEqual({ username: 'tester' });
    expect(session.getCsrfToken()).toBe('csrf-test-token');

    await expect(session.request('/api/pets/1/like', { method: 'POST' })).resolves.toMatchObject({
      status: 401,
      sessionExpired: true,
      previousUser: { username: 'tester' },
    });
    expect(session.getUser()).toBeNull();
    expect(session.getCsrfToken()).toBe('');
  });

  it('登出请求由会话模块发起并在成功后清空本地状态', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { success: true, csrfToken: 'csrf-test-token', user: { username: 'tester' } },
      })
      .mockResolvedValueOnce({ ok: true, status: 200, data: { success: true } });
    const session = petClient.createAuthSession({ request });

    await session.restore();
    await expect(session.logout()).resolves.toMatchObject({ ok: true, status: 200 });
    expect(request).toHaveBeenLastCalledWith('/api/auth/logout', { method: 'POST', body: {} });
    expect(session.getUser()).toBeNull();
    expect(session.getCsrfToken()).toBe('');
  });

  it('生成 256 位 URL 安全 OAuth nonce，并在缺少安全随机源时拒绝发起登录', () => {
    const deterministicCrypto = {
      getRandomValues(bytes) {
        for (let index = 0; index < bytes.length; index++) bytes[index] = index;
        return bytes;
      },
    };
    const nonce = petClient.createOAuthNonce(deterministicCrypto, window.btoa.bind(window));
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(petClient.createOAuthNonce(null, window.btoa.bind(window))).toBe('');
  });
});
