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

const BASH = process.platform === 'win32' ? 'D:/6.SoftWare/2.Tool/Git/Git/bin/bash.exe' : 'bash';
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
  write(path.join(source, 'scripts', 'release', 'templates', 'ujn-guide-nginx.conf'), [
    'root $release_root/current/site;',
    'location ^~ /api/ { proxy_pass http://127.0.0.1:$backend_port; }',
    'location = /admin { proxy_pass http://127.0.0.1:$backend_port; }',
    'location ^~ /admin/ { proxy_pass http://127.0.0.1:$backend_port; }',
  ].join('\n'));
  write(path.join(server, 'package.json'), JSON.stringify({ name: 'fixture-server', version: '5.0.0' }));
  write(path.join(server, 'upload-policy.js'), fs.readFileSync(path.join(__dirname, '../../server/upload-policy.js'), 'utf8'));
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
    'access_log off; error_log /dev/null crit;',
    'client_max_body_size 35m;',
    'root /srv/ujn-guide/current/site;',
    'location ^~ /api/ { proxy_pass http://127.0.0.1:3005; }',
    'location ^~ /api/admin/restore-imports/ { client_max_body_size 128m; proxy_pass http://127.0.0.1:3005; }',
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

function runDeploy(fixture, releaseDir, runtime, extra = [], env = process.env) {
  // 脚本期望 --release-root 是根目录（内含 releases/ 子目录）
  return spawnSync(BASH, [
    script,
    '--release-root', toPosix(fixture.root),
    '--release-dir', toPosix(releaseDir),
    '--env-file', toPosix(runtime.envFile),
    '--nginx-config', toPosix(runtime.nginxConfig),
    '--allow-initial',
    ...extra,
  ], { encoding: 'utf8', env, timeout: 45000 });
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

// Execute the real switching script. npm/systemd/HTTP are substituted. Windows
// also adapts MSYS shortcut naming; Linux exercises native symlink renames.
function runtimeFixture() {
  const fixture = makeFixture();
  commitFixture(fixture.source);
  commitFixture(fixture.server);
  makeReleaseRoot(fixture);
  const old = makeReleaseDir(fixture, '20260907.old');
  const next = makeReleaseDir(fixture, '20260907.next');
  const runtime = writeRuntimeFiles(fixture.root);
  const bin = path.join(fixture.root, 'bin');
  write(path.join(bin, 'npm'), '#!/usr/bin/env bash\nexit 0\n');
  write(path.join(bin, 'systemctl'), `#!/usr/bin/env bash
set -eu
printf '%s\\n' "$*" >> "$UJN_DEPLOY_TEST_ROOT/service.log"
case "$1" in
  restart)
    target="$(basename "$(realpath "$UJN_DEPLOY_TEST_ROOT/current")")"
    if [[ "$target" == "\${UJN_RESTART_FAIL:-}" ]]; then exit 1; fi
    printf '%s' active > "$UJN_DEPLOY_TEST_ROOT/state"
    ;;
  stop) printf '%s' inactive > "$UJN_DEPLOY_TEST_ROOT/state" ;;
  show) cat "$UJN_DEPLOY_TEST_ROOT/state" ;;
  *) exit 10 ;;
esac
`);
  write(path.join(bin, 'curl'), `#!/usr/bin/env bash
set -eu
target="$(realpath "$UJN_DEPLOY_TEST_ROOT/current")"
node "$UJN_DEPLOY_TEST_ROOT/health.cjs" "$target" "$UJN_DEPLOY_TEST_ROOT"
`);
  if (process.platform === 'win32') {
    write(path.join(bin, 'mv'), `#!/usr/bin/env bash
set -eu
if [[ "$#" == 3 && "$1" == -Tf && -L "$2" && ! -e "$3" && ! -L "$3" ]]; then
  exec /usr/bin/mv -Tf "$2" "$3.lnk"
fi
exec /usr/bin/mv "$@"
`);
    fs.chmodSync(path.join(bin, 'mv'), 0o755);
  }
  write(path.join(fixture.root, 'health.cjs'), `
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const target = process.argv[2], root = process.argv[3], id = path.basename(target);
const countFile = path.join(root, id + '.attempts');
const count = fs.existsSync(countFile) ? Number(fs.readFileSync(countFile, 'utf8')) + 1 : 1;
fs.writeFileSync(countFile, String(count));
const mode = process.env.UJN_HEALTH_MODE || '';
if (mode === 'all-fail' || (mode === 'next-fail' && id.endsWith('next')) || (mode === 'old-fail' && id.endsWith('old'))) process.exit(7);
if (mode === 'slow' && count === 1) process.exit(7);
const bytes = fs.readFileSync(path.join(target, 'release-manifest.json'));
const manifest = JSON.parse(bytes);
const release = {
  id: manifest.release.id,
  manifestSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  staticSiteSha256: manifest.artifacts.staticSite.sha256,
  adminUiSha256: manifest.artifacts.adminUi.sha256
};
if (mode === 'mixed' && id.endsWith('next')) release.adminUiSha256 = 'wrong-digest';
console.log(JSON.stringify({ success: true, release }));
`);
  for (const name of ['npm', 'systemctl', 'curl']) fs.chmodSync(path.join(bin, name), 0o755);
  // Git Bash prepends its own /usr/bin at startup. BASH_ENV restores our
  // substitution priority before either the driver or its child scripts run.
  write(path.join(fixture.root, 'test-bash-env'), 'export PATH="$UJN_DEPLOY_TEST_ROOT/bin:$PATH"\n');
  const env = { ...process.env, MSYS: 'winsymlinks:lnk', UJN_DEPLOY_TEST_ROOT: toPosix(fixture.root), BASH_ENV: toPosix(path.join(fixture.root, 'test-bash-env')) };
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
  env.PATH = bin + path.delimiter + process.env.PATH;
  const shell = source => spawnSync(BASH, ['-c', source], { encoding: 'utf8', env });
  const link = (target, name) => {
    const result = shell(`ln -s "${toPosix(target)}" "${toPosix(path.join(fixture.root, name))}"`);
    assert.equal(result.status, 0, result.stderr);
  };
  const target = name => shell(`realpath "${toPosix(path.join(fixture.root, name))}"`).stdout.trim();
  return { fixture, old, next, runtime, env, shell, link, target };
}

test('真实切换：慢启动重试成功后才更新 previous', () => {
  const f = runtimeFixture();
  try {
    f.link(f.old, 'current');
    const healthProbe = f.shell(`curl | node "${toPosix(path.join(__dirname, '../../scripts/release/verify-running-release.js'))}" "${toPosix(f.old)}"`);
    assert.equal(healthProbe.status, 0, 'health fixture: ' + healthProbe.stdout + healthProbe.stderr);
    f.env.UJN_HEALTH_MODE = 'slow';
    const result = runDeploy(f.fixture, f.next, f.runtime, ['--readiness-timeout', '8'], f.env);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(f.target('current'), toPosix(f.next));
    assert.equal(f.target('previous'), toPosix(f.old));
    assert.ok(Number(fs.readFileSync(path.join(f.fixture.root, '20260907.next.attempts'))) >= 2);
  } finally { fs.rmSync(f.fixture.root, { recursive: true, force: true }); }
});

test('真实切换：错误摘要或重启失败会回退并重新验证旧 release', () => {
  for (const mode of ['mixed', 'restart-failed']) {
    const f = runtimeFixture();
    try {
      f.link(f.old, 'current');
      if (mode === 'mixed') f.env.UJN_HEALTH_MODE = mode;
      else f.env.UJN_RESTART_FAIL = '20260907.next';
      const result = runDeploy(f.fixture, f.next, f.runtime, ['--readiness-timeout', '2'], f.env);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.equal(f.target('current'), toPosix(f.old));
      assert.match(result.stdout, /原 release 已重新启动且通过摘要校验/);
      assert.equal(fs.readFileSync(path.join(f.fixture.root, 'state'), 'utf8'), 'active');
      assert.ok(fs.existsSync(path.join(f.fixture.root, '20260907.old.attempts')));
    } finally { fs.rmSync(f.fixture.root, { recursive: true, force: true }); }
  }
});

test('真实切换：候选和回退均失败时停止服务并返回人工处置状态', () => {
  const f = runtimeFixture();
  try {
    f.link(f.old, 'current');
    f.env.UJN_HEALTH_MODE = 'all-fail';
    const result = runDeploy(f.fixture, f.next, f.runtime, ['--readiness-timeout', '2'], f.env);
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.equal(f.target('current'), toPosix(f.old));
    assert.equal(fs.readFileSync(path.join(f.fixture.root, 'state'), 'utf8'), 'inactive');
    assert.match(result.stdout, /人工处置/);
  } finally { fs.rmSync(f.fixture.root, { recursive: true, force: true }); }
});

test('真实首发：失败后停止候选再移除 current，不删除 release 数据', () => {
  const f = runtimeFixture();
  try {
    f.env.UJN_HEALTH_MODE = 'all-fail';
    const result = runDeploy(f.fixture, f.next, f.runtime, ['--readiness-timeout', '2'], f.env);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.equal(fs.readFileSync(path.join(f.fixture.root, 'state'), 'utf8'), 'inactive');
    assert.equal(f.shell(`test -L "$UJN_DEPLOY_TEST_ROOT/current"`).status, 1);
    assert.ok(fs.existsSync(f.next));
    assert.match(result.stdout, /候选服务已停止/);
  } finally { fs.rmSync(f.fixture.root, { recursive: true, force: true }); }
});

test('真实回滚命令：回滚目标失败后恢复原 current 并核对健康', () => {
  const f = runtimeFixture();
  try {
    f.link(f.next, 'current');
    f.link(f.old, 'previous');
    f.env.UJN_HEALTH_MODE = 'old-fail';
    const result = spawnSync(BASH, [script, '--rollback', '--release-root', toPosix(f.fixture.root),
      '--env-file', toPosix(f.runtime.envFile), '--nginx-config', toPosix(f.runtime.nginxConfig),
      '--readiness-timeout', '2'], { encoding: 'utf8', env: f.env, timeout: 45000 });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.equal(f.target('current'), toPosix(f.next));
    assert.equal(f.target('previous'), toPosix(f.old));
    assert.match(result.stdout, /原 release 已重新启动且通过摘要校验/);
  } finally { fs.rmSync(f.fixture.root, { recursive: true, force: true }); }
});
