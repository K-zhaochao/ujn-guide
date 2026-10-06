'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { execFileSync } = require('node:child_process');

const {
  createRelease,
  verifyRelease,
} = require('../../scripts/release/release-manifest');
const { verifyHealthPayload } = require('../../scripts/release/verify-running-release');
const { parseEnv, validateConfig } = require('../../scripts/release/validate-production-config');

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, 'utf8');
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ujn-release-'));
  const source = path.join(root, 'source');
  const server = path.join(root, 'server');
  const site = path.join(root, 'site');
  write(path.join(source, 'scripts', 'release', 'templates', 'ujn-guide-nginx.conf'), [
    'root $release_root/current/site;',
    'location ^~ /api/ { proxy_pass http://127.0.0.1:$backend_port; }',
    'location = /admin { proxy_pass http://127.0.0.1:$backend_port; }',
    'location ^~ /admin/ { proxy_pass http://127.0.0.1:$backend_port; }',
  ].join('\n'));
  write(path.join(server, 'package.json'), JSON.stringify({ name: 'fixture-server', version: '5.0.0' }));
  write(path.join(server, 'routes', 'admin-ui.js'), 'module.exports = {};\n');
  write(path.join(server, 'public', 'admin-ui-state.js'), 'window.AdminUiState = {};\n');
  write(path.join(server, 'public', 'favicon.svg'), '<svg></svg>\n');
  write(path.join(server, 'migrations.js'), 'module.exports = {};\n');
  write(path.join(server, '.env.example'), 'JWT_SECRET=\n');
  write(path.join(site, 'index.html'), '<h1>fixture</h1>\n');
  return { root, source, server, site, output: path.join(root, 'release') };
}

function commitFixture(directory) {
  const run = args => execFileSync('git', ['-C', directory, ...args], { stdio: 'ignore' });
  run(['init', '-q']);
  run(['config', 'user.email', 'release-test@example.invalid']);
  run(['config', 'user.name', 'Release Test']);
  run(['add', '.']);
  run(['commit', '-qm', 'fixture']);
}

test('release manifest 对静态站、管理 UI、迁移和运行变量生成可复核摘要', () => {
  const fixture = makeFixture();
  const result = createRelease({
    releaseId: '20260811.1',
    output: fixture.output,
    sourceRoot: fixture.source,
    serverDir: fixture.server,
    siteDir: fixture.site,
    migrations: [{ id: 'm1', checksum: 'a'.repeat(64) }],
    rootRevision: 'root-revision',
    serverRevision: 'server-revision',
    skipGitCheck: true,
  });
  assert.equal(result.manifest.runtime.topology, 'same-origin');
  assert.equal(result.manifest.artifacts.migrations.definitions.length, 1);
  assert.equal(result.manifest.artifacts.adminUi.files.length, 3);
  assert.deepEqual(verifyRelease(fixture.output), {
    ok: true,
    releaseDir: fixture.output,
    releaseId: '20260811.1',
    errors: [],
  });

  const health = verifyHealthPayload({
    success: true,
    release: {
      id: result.manifest.release.id,
      manifestSha256: result.manifestSha256,
      staticSiteSha256: result.manifest.artifacts.staticSite.sha256,
      adminUiSha256: result.manifest.artifacts.adminUi.sha256,
    },
  }, { ...result.manifest, manifestSha256: result.manifestSha256 });
  assert.deepEqual(health, { ok: true, errors: [] });
});

test('任一受控文件被篡改或 health 摘要不匹配时必须拒绝', () => {
  const fixture = makeFixture();
  const result = createRelease({
    releaseId: 'release-2',
    output: fixture.output,
    sourceRoot: fixture.source,
    serverDir: fixture.server,
    siteDir: fixture.site,
    migrations: [{ id: 'm1', checksum: 'b'.repeat(64) }],
    rootRevision: 'root-revision',
    serverRevision: 'server-revision',
    skipGitCheck: true,
  });
  write(path.join(fixture.output, 'server', 'routes', 'admin-ui.js'), 'tampered\n');
  const check = verifyRelease(fixture.output);
  assert.equal(check.ok, false);
  assert.ok(check.errors.includes('adminUi 摘要不匹配'));
  const health = verifyHealthPayload({ success: true, release: { id: 'release-2' } }, { ...result.manifest, manifestSha256: result.manifestSha256 });
  assert.equal(health.ok, false);
  assert.ok(health.errors.includes('health 静态站摘要不匹配'));
});

test('管理后台静态模块被篡改时 release 校验必须拒绝', () => {
  const fixture = makeFixture();
  createRelease({
    releaseId: 'release-admin-static',
    output: fixture.output,
    sourceRoot: fixture.source,
    serverDir: fixture.server,
    siteDir: fixture.site,
    migrations: [{ id: 'm1', checksum: 'e'.repeat(64) }],
    rootRevision: 'root-revision',
    serverRevision: 'server-revision',
    skipGitCheck: true,
  });
  write(path.join(fixture.output, 'server', 'public', 'admin-ui-state.js'), 'tampered\n');
  const check = verifyRelease(fixture.output);
  assert.equal(check.ok, false);
  assert.ok(check.errors.includes('adminUi 摘要不匹配'));
  assert.ok(check.errors.includes('adminUi 资源集合不匹配'));
});

test('正式打包只复制 Git 已跟踪的后端文件，不携带被忽略密钥', () => {
  const fixture = makeFixture();
  write(path.join(fixture.server, '.gitignore'), '.env.*\n!.env.example\n');
  commitFixture(fixture.source);
  commitFixture(fixture.server);
  write(path.join(fixture.server, '.env.local'), 'JWT_SECRET=must-not-be-packaged\n');
  createRelease({
    releaseId: 'release-tracked-only',
    output: fixture.output,
    sourceRoot: fixture.source,
    serverDir: fixture.server,
    siteDir: fixture.site,
    migrations: [{ id: 'm1', checksum: 'd'.repeat(64) }],
  });
  assert.equal(fs.existsSync(path.join(fixture.output, 'server', '.env.local')), false);
  const check = verifyRelease(fixture.output);
  assert.equal(check.ok, true, JSON.stringify(check));
});

test('生产配置必须保持同源 OAuth、CORS、Nginx 和后端端口契约', () => {
  const env = parseEnv([
    'MAIN_SITE_URL=https://guide.example.test',
    'BIND_HOST=127.0.0.1',
    'PORT=3100',
  ].join('\n'));
  const nginx = [
    'access_log off; error_log /dev/null crit;',
    'client_max_body_size 35m;',
    'location ^~ /api/ { proxy_pass http://127.0.0.1:3100; }',
    'location ^~ /api/admin/restore-imports/ { client_max_body_size 128m; proxy_pass http://127.0.0.1:3100; }',
    'location = /admin { proxy_pass http://127.0.0.1:3100; }',
    'location ^~ /admin/ { proxy_pass http://127.0.0.1:3100; }',
  ].join('\n');
  assert.deepEqual(validateConfig(env, nginx), { ok: true, errors: [] });
  const legacyLocations = validateConfig(env, nginx.replaceAll('^~ ', ''));
  assert.equal(legacyLocations.ok, false);
  assert.ok(legacyLocations.errors.includes('Nginx 缺少高优先级 /api/ 反向代理'));
  const invalid = validateConfig({ ...env, OAUTH_CALLBACK_BASE: 'http://127.0.0.1:3100/api/auth' }, nginx.replaceAll(':3100', ':3000'));
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.includes('OAUTH_CALLBACK_BASE 如保留必须等于 MAIN_SITE_URL + /api/auth'));
  assert.ok(invalid.errors.includes('Nginx 反向代理端口与 PORT 不一致'));

  const publicBind = validateConfig({ ...env, BIND_HOST: '0.0.0.0' }, nginx);
  assert.ok(publicBind.errors.includes('同源发布的 BIND_HOST 必须为 127.0.0.1'));

  const customAdminPath = validateConfig({ ...env, ADMIN_PATH: '/private-admin' }, nginx);
  assert.ok(customAdminPath.errors.includes('同源发布的 ADMIN_PATH 如保留必须为 /admin'));

  const tooSmallBody = validateConfig(env, nginx.replace('35m', '15m'));
  assert.ok(tooSmallBody.errors.some(message => message.includes('至少需要 28m')));

  const customUploadPolicy = validateConfig({ ...env, MAX_IMAGES_PER_SUBMISSION: '1', MAX_IMAGE_SIZE_MB: '1' }, nginx.replace('35m', '1m'));
  assert.ok(customUploadPolicy.errors.some(message => message.includes('至少需要 3m')));
});

test('部署脚本默认检查同源后端的 3005 health 端点', () => {
  const script = fs.readFileSync(path.join(__dirname, '../../scripts/release/deploy-release.sh'), 'utf8');
  assert.match(script, /health_url="http:\/\/127\.0\.0\.1:3005\/api\/health"/);
  assert.match(script, /default: http:\/\/127\.0\.0\.1:3005\/api\/health/);
});
