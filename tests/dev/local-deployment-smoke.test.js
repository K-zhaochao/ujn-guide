'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const test = require('node:test');

const { createLocalServer } = require('../../scripts/dev/local-proxy');
const { normalizeBaseUrl, verifyLocalDeployment } = require('../../scripts/release/local-deployment-smoke');

function listen(server) {
  return new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
}

function close(server) {
  return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

test('本地同源验收同时验证静态主站、宠物页、health 与管理后台代理', async () => {
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'ujn-local-acceptance-'));
  fs.mkdirSync(path.join(site, 'pets'), { recursive: true });
  fs.writeFileSync(path.join(site, 'index.html'), '<!doctype html><html><body>home</body></html>', 'utf8');
  fs.writeFileSync(path.join(site, 'pets', 'index.html'), '<!doctype html><html><body>pets</body></html>', 'utf8');

  const backend = http.createServer((req, res) => {
    if (req.url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true }));
      return;
    }
    if (req.url === '/admin') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html><body><div id="app"></div></body></html>');
      return;
    }
    res.writeHead(404).end();
  });
  await listen(backend);
  const local = createLocalServer({ siteDir: site, backendPort: backend.address().port });
  await listen(local);
  try {
    const result = await verifyLocalDeployment({ baseUrl: `http://127.0.0.1:${local.address().port}` });
    assert.deepEqual(result.checks, ['/', '/pets/', '/api/health', '/admin']);
  } finally {
    await close(local);
    await close(backend);
    fs.rmSync(site, { recursive: true, force: true });
  }
});

test('本地同源验收拒绝带路径或凭据的基础地址', () => {
  assert.throws(() => normalizeBaseUrl('http://127.0.0.1:8000/pets/'), /without a path/);
  assert.throws(() => normalizeBaseUrl('http://user:pass@127.0.0.1:8000'), /without a path/);
});
