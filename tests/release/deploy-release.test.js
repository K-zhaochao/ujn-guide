'use strict';

// deploy-release.sh 的 dry-run 函数化测试（Git Bash 环境）：
//   - dry-run 部署通过验证后只打印计划，不创建/修改 current 符号链接；
//   - 验证失败（缺失目录 / 无效 manifest）时退出码非 0，且不切流；
//   - 回滚 dry-run 同样不修改链接。
// 使用 release-manifest 的 fixture 生成有效 release 目录。

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { execFileSync, spawnSync } = require('node:child_process');

const BASH = 'D:/6.SoftWare/2.Tool/Git/Git/bin/bash.exe';
const script = path.join(__dirname, '../../scripts/release/deploy-release.sh');
const { createRelease } = require('../../scripts/release/release-manifest');

function toPosix(winPath) {
  return winPath.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, letter) => `/${letter.toLowerCase()}`);
}

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, 'utf8');
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ujn-deploy-'));
  const source = path.join(root, 'source');
  const server = path.join(root, 'server');
  const site = path.join(root, 'site');
  write(path.join(source, 'docs', 'pets', 'pets.js'), "const API_BASE = '';\n");
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
  write(path.join(server, 'migrations.js'), 'module.exports = { MIGRATION_DEFINITIONS: [{ id: 1, checksum: "abc" }] };\n');
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

function makeReleaseDir(fixture, id) {
  const output = path.join(fixture.root, 'releases', id);
  const result = createRelease({
    releaseId: id,
    output,
    sourceRoot: fixture.source,
    serverDir: fixture.server,
    siteDir: fixture.site,
    skipGitCheck: true,
  });
  return result.output;
}

function writeRuntimeFiles(root) {
  const envFile = path.join(root, 'pet.env');
  const nginxConfig = path.join(root, 'ujn-guide-nginx.conf');
  write(envFile, [
    'MAIN_SITE_URL=https://ujn.matehub.top',
    'ALLOWED_ORIGINS=https://ujn.matehub.top',
    'OAUTH_CALLBACK_BASE=https://ujn.matehub.top/api/auth',
    'PORT=3005',
    'BIND_HOST=127.0.0.1',
    'ADMIN_PATH=/admin',
  ].join('\n') + '\n');
  write(nginxConfig, [
    'client_max_body_size 35m;',
    'root /srv/ujn-guide/current/site;',
    'location ^~ /api/ { proxy_pass http://127.0.0.1:3005; }',
    'location = /admin { proxy_pass http://127.0.0.1:3005; }',
    'location ^~ /admin/ { proxy_pass http://127.0.0.1:3005; }',
  ].join('\n') + '\n');
  return { envFile, nginxConfig };
}

/** 构造发布根：fixture.root 下建 releases/（deploy-release.sh 要求 release-root 内含 releases/） */
function makeReleaseRoot(fixture) {
  const releaseRoot = path.join(fixture.root, 'releases');
  fs.mkdirSync(releaseRoot, { recursive: true });
  return releaseRoot;
}

function runDeploy(fixture, releaseDir, runtime, extra = []) {
  // 脚本期望 --release-root 是根目录（内含 releases/ 子目录）
  return spawnSync(BASH, [
    script,
    '--release-root', toPosix(fixture.root),
    '--release-dir', toPosix(releaseDir),
    '--env-file', toPosix(runtime.envFile),
    '--nginx-config', toPosix(runtime.nginxConfig),
    '--allow-initial',
    ...extra,
  ], { encoding: 'utf8' });
}

function linkExists(target, name) {
  const link = path.join(target, name);
  try {
    fs.lstatSync(link);
    return link;
  } catch {
    return null;
  }
}

test('dry-run 部署：通过验证但不创建 current 符号链接', () => {
  const fixture = makeFixture();
  commitFixture(fixture.source);
  commitFixture(fixture.server);
  const releaseRoot = makeReleaseRoot(fixture);
  const releaseDir = makeReleaseDir(fixture, '20260813.1');
  const runtime = writeRuntimeFiles(fixture.root);

  const result = runDeploy(fixture, releaseDir, runtime, ['--dry-run']);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.match(result.stdout, /dry-run/);
  // 验证后不切流：current 链接必须不存在
  assert.equal(linkExists(releaseRoot, 'current'), null);
});

test('dry-run 部署：验证失败（目录缺失）时退出非 0 且不切流', () => {
  const fixture = makeFixture();
  commitFixture(fixture.source);
  commitFixture(fixture.server);
  const releaseRoot = makeReleaseRoot(fixture);
  const runtime = writeRuntimeFiles(fixture.root);

  const missing = path.join(releaseRoot, '20260813.999');
  const result = runDeploy(fixture, missing, runtime, ['--dry-run']);
  assert.notEqual(result.status, 0, `stdout: ${result.stdout}`);
  assert.equal(linkExists(releaseRoot, 'current'), null);
});

test('dry-run 部署：验证失败（manifest 损坏）时退出非 0 且不切流', () => {
  const fixture = makeFixture();
  commitFixture(fixture.source);
  commitFixture(fixture.server);
  const releaseRoot = makeReleaseRoot(fixture);
  const releaseDir = makeReleaseDir(fixture, '20260813.2');
  const runtime = writeRuntimeFiles(fixture.root);
  // 破坏 manifest 使校验失败
  write(path.join(releaseDir, 'release-manifest.json'), '{ "broken": true }');

  const result = runDeploy(fixture, releaseDir, runtime, ['--dry-run']);
  assert.notEqual(result.status, 0, `stdout: ${result.stdout}`);
  assert.equal(linkExists(releaseRoot, 'current'), null);
});

test('回滚 dry-run：无 previous 时退出非 0；有 previous 时打印计划且不切流', () => {
  const fixture = makeFixture();
  commitFixture(fixture.source);
  commitFixture(fixture.server);
  const releaseRoot = makeReleaseRoot(fixture);
  const runtime = writeRuntimeFiles(fixture.root);
  const releaseDir = makeReleaseDir(fixture, '20260813.3');

  // 无 previous：回滚应失败
  const noPrevious = spawnSync(BASH, [
    script, '--rollback', '--release-root', toPosix(fixture.root),
    '--env-file', toPosix(runtime.envFile), '--nginx-config', toPosix(runtime.nginxConfig),
  ], { encoding: 'utf8' });
  assert.notEqual(noPrevious.status, 0, `stdout: ${noPrevious.stdout}`);

  // 有 previous/current：用 Git Bash 的 ln -s 创建（[[ -L ]] 可识别）
  // Windows 无开发者模式时 native symlink 失败，用 winsymlinks:lnk 让 MSYS 以 .lnk 模拟
  // 注意：脚本在 release-root 根下查找 previous/current（release-root = fixture.root）
  const previousLink = path.join(fixture.root, 'previous');
  const currentLink = path.join(fixture.root, 'current');
  const msysEnv = { ...process.env, MSYS: 'winsymlinks:lnk' };
  const mkLink = (target, link) => spawnSync(BASH, ['-c', `ln -s "${toPosix(target)}" "${toPosix(link)}"`], { encoding: 'utf8', env: msysEnv });
  const mkPrev = mkLink(releaseDir, previousLink);
  assert.equal(mkPrev.status, 0, `ln -s previous 失败: ${mkPrev.stderr}`);
  const mkCur = mkLink(releaseDir, currentLink);
  assert.equal(mkCur.status, 0, `ln -s current 失败: ${mkCur.stderr}`);
  const dryRunRollback = spawnSync(BASH, [
    script, '--rollback', '--release-root', toPosix(fixture.root),
    '--env-file', toPosix(runtime.envFile), '--nginx-config', toPosix(runtime.nginxConfig),
    '--dry-run',
  ], { encoding: 'utf8', env: msysEnv });
  assert.equal(dryRunRollback.status, 0, `stderr: ${dryRunRollback.stderr}`);
  assert.match(dryRunRollback.stdout, /dry-run/);
  // 回滚 dry-run 不应改变 previous 链接内容（Windows 下 .lnk 需经 bash 解析）
  const resolved = spawnSync(BASH, ['-c', `realpath "${toPosix(previousLink)}"`], { encoding: 'utf8', env: msysEnv });
  assert.equal(resolved.status, 0, resolved.stderr);
  assert.equal(resolved.stdout.trim(), toPosix(releaseDir));
});
