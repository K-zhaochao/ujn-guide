'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const test = require('node:test');

const { createLocalServer } = require('../../scripts/dev/local-proxy');

function listen(server) {
  return new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
}

function close(server) {
  return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

test('本地站点代理静态文件、API 与管理后台路径', async () => {
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'ujn-local-site-'));
  fs.mkdirSync(path.join(site, 'pets'), { recursive: true });
  fs.writeFileSync(path.join(site, 'pets', 'index.html'), '<h1>pets</h1>', 'utf8');

  const requests = [];
  const backend = http.createServer((req, res) => {
    requests.push({ method: req.method, url: req.url });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ path: req.url }));
  });
  await listen(backend);
  const backendPort = backend.address().port;

  const local = createLocalServer({ siteDir: site, backendPort });
  await listen(local);
  const localPort = local.address().port;
  try {
    const staticResponse = await fetch(`http://127.0.0.1:${localPort}/pets/`);
    assert.equal(staticResponse.status, 200);
    assert.equal(await staticResponse.text(), '<h1>pets</h1>');

    const apiResponse = await fetch(`http://127.0.0.1:${localPort}/api/health`);
    assert.equal(apiResponse.status, 200);
    assert.deepEqual(await apiResponse.json(), { path: '/api/health' });

    const adminResponse = await fetch(`http://127.0.0.1:${localPort}/admin`);
    assert.equal(adminResponse.status, 200);
    assert.deepEqual(requests, [
      { method: 'GET', url: '/api/health' },
      { method: 'GET', url: '/admin' },
    ]);
  } finally {
    await close(local);
    await close(backend);
    fs.rmSync(site, { recursive: true, force: true });
  }
});

test('本地站点在后端不可用时返回明确的 502', async () => {
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'ujn-local-site-'));
  const local = createLocalServer({ siteDir: site, backendPort: 65534 });
  await listen(local);
  const localPort = local.address().port;
  try {
    const response = await fetch(`http://127.0.0.1:${localPort}/api/health`);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).success, false);
  } finally {
    await close(local);
    fs.rmSync(site, { recursive: true, force: true });
  }
});
