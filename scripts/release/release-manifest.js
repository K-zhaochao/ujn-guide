'use strict';

/**
 * Build and verify a deployable release directory without reading secrets.
 * The output deliberately contains only source, static files and public release
 * metadata; runtime secrets stay in the server's external EnvironmentFile.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FORMAT = 'ujn-release-manifest';
const FORMAT_VERSION = 1;
const RELEASE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SERVER_EXCLUDES = new Set(['.git', 'node_modules', '.env', 'pets.db', 'pets.db-shm', 'pets.db-wal', 'reports', 'data']);
const REQUIRED_RUNTIME_KEYS = ['RELEASE_ID', 'RELEASE_MANIFEST_SHA256', 'RELEASE_STATIC_SITE_SHA256', 'RELEASE_ADMIN_UI_SHA256'];

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function sha256File(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function hashDirectory(directory, { excludeNames = new Set() } = {}) {
  const root = path.resolve(directory);
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error(`必须是普通目录：${root}`);
  const hash = crypto.createHash('sha256');
  let fileCount = 0;
  let totalBytes = 0;
  function walk(current, relative = '') {
    const entries = fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (excludeNames.has(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      const rel = path.posix.join(relative.split(path.sep).join('/'), entry.name);
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) throw new Error(`release 不允许符号链接：${absolute}`);
      if (stat.isDirectory()) {
        walk(absolute, rel);
      } else if (stat.isFile()) {
        const digest = sha256File(absolute);
        hash.update(`file\0${rel}\0${stat.size}\0${digest}\n`);
        fileCount++;
        totalBytes += stat.size;
      } else {
        throw new Error(`release 不允许非常规文件：${absolute}`);
      }
    }
  }
  walk(root);
  return { sha256: hash.digest('hex'), fileCount, totalBytes };
}

function readPackageVersion(serverDir) {
  const packageFile = path.join(serverDir, 'package.json');
  const packageInfo = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  if (!packageInfo.name || !packageInfo.version) throw new Error(`后端 package.json 缺少 name 或 version：${packageFile}`);
  return { name: packageInfo.name, version: packageInfo.version };
}

function readMigrationDefinitions(serverDir) {
  const modulePath = path.resolve(serverDir, 'migrations.js');
  delete require.cache[modulePath];
  const migrations = require(modulePath);
  const definitions = migrations.MIGRATION_DEFINITIONS;
  if (!Array.isArray(definitions) || definitions.length === 0) throw new Error('迁移定义为空，拒绝创建 release');
  return definitions.map(item => ({ id: String(item.id), checksum: String(item.checksum) }));
}

function gitValue(directory, args) {
  return execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function assertGitClean(directory, label) {
  const status = gitValue(directory, ['status', '--porcelain=v1']);
  if (status) throw new Error(`${label} 工作区不干净，拒绝创建不可变 release`);
}

function assertSameOriginFrontEnd(sourceRoot) {
  const petScript = path.join(sourceRoot, 'docs', 'pets', 'pets.js');
  const source = fs.readFileSync(petScript, 'utf8');
  const match = source.match(/const\s+API_BASE\s*=\s*(['"])(.*?)\1\s*;/);
  if (!match || match[2] !== '') throw new Error('宠物前端必须将 API_BASE 固定为同源空串');
  if (/https?:\/\/(?:localhost|127\.0\.0\.1)/i.test(source)) {
    throw new Error('宠物前端发布源码仍包含 localhost 或 127.0.0.1 地址');
  }
}

function readRuntimeTemplate(sourceRoot) {
  const template = path.join(sourceRoot, 'scripts', 'release', 'templates', 'ujn-guide-nginx.conf');
  const contents = fs.readFileSync(template, 'utf8');
  for (const fragment of ['location ^~ /api/', 'location = /admin', 'location ^~ /admin/', 'proxy_pass http://127.0.0.1:$backend_port', 'root $release_root/current/site']) {
    if (!contents.includes(fragment)) throw new Error(`Nginx 发布模板缺少同源接线：${fragment}`);
  }
  return { path: template, sha256: sha256File(template) };
}

function releaseManifest({ releaseId, sourceRoot, serverDir, siteDir, migrations, rootRevision, serverRevision, createdAt } = {}) {
  const id = String(releaseId || '').trim();
  if (!RELEASE_ID_PATTERN.test(id)) throw new Error('release ID 只能包含字母、数字、点、下划线和连字符，且长度不超过 128');
  const root = path.resolve(sourceRoot || path.join(__dirname, '..', '..'));
  const server = path.resolve(serverDir || path.join(root, 'server'));
  const site = path.resolve(siteDir || path.join(root, 'site'));
  assertSameOriginFrontEnd(root);
  const staticSite = hashDirectory(site);
  if (staticSite.fileCount === 0) throw new Error('静态站构建产物为空，拒绝创建 release');
  const adminUiFile = path.join(server, 'routes', 'admin-ui.js');
  const migrationSource = path.join(server, 'migrations.js');
  const configTemplate = path.join(server, '.env.example');
  const definitionList = migrations || readMigrationDefinitions(server);
  const packageInfo = readPackageVersion(server);
  const nginxTemplate = readRuntimeTemplate(root);
  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    release: { id, createdAt: createdAt || new Date().toISOString() },
    source: {
      rootRevision: rootRevision || gitValue(root, ['rev-parse', 'HEAD']),
      serverRevision: serverRevision || gitValue(server, ['rev-parse', 'HEAD']),
      serverPackage: packageInfo,
    },
    artifacts: {
      staticSite,
      adminUi: { path: 'server/routes/admin-ui.js', sha256: sha256File(adminUiFile) },
      migrations: {
        path: 'server/migrations.js',
        sourceSha256: sha256File(migrationSource),
        definitions: definitionList,
        definitionsSha256: sha256Text(JSON.stringify(definitionList)),
      },
      configTemplate: { path: 'server/.env.example', sha256: sha256File(configTemplate) },
      nginxTemplate: { path: 'scripts/release/templates/ujn-guide-nginx.conf', sha256: nginxTemplate.sha256 },
    },
    runtime: {
      topology: 'same-origin',
      apiPath: '/api',
      adminPath: '/admin',
      requiredEnvironment: REQUIRED_RUNTIME_KEYS,
    },
  };
}

function copyDirectory(source, destination, { excludeNames = new Set() } = {}) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (excludeNames.has(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`release 不允许符号链接：${from}`);
    if (entry.isDirectory()) copyDirectory(from, to, { excludeNames });
    else if (entry.isFile()) fs.copyFileSync(from, to);
    else throw new Error(`release 不允许非常规文件：${from}`);
  }
}

function copyTrackedFiles(source, destination) {
  const files = execFileSync('git', ['-C', source, 'ls-files', '-z'], { encoding: 'buffer' })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  if (files.length === 0) throw new Error(`后端仓库没有已跟踪文件：${source}`);
  for (const relative of files) {
    if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) {
      throw new Error(`Git 跟踪路径不安全：${relative}`);
    }
    const from = path.join(source, relative);
    const to = path.join(destination, relative);
    const stat = fs.lstatSync(from);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`release 只允许普通后端文件：${from}`);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}

function parseEnvFile(file) {
  const values = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

function createRelease(options = {}) {
  const root = path.resolve(options.sourceRoot || path.join(__dirname, '..', '..'));
  const server = path.resolve(options.serverDir || path.join(root, 'server'));
  const site = path.resolve(options.siteDir || path.join(root, 'site'));
  const output = path.resolve(options.output || '');
  if (!output) throw new Error('必须使用 --output 指定新的 release 目录');
  if (fs.existsSync(output)) throw new Error(`release 输出目录已经存在：${output}`);
  if (!options.skipGitCheck) {
    assertGitClean(root, '主站');
    assertGitClean(server, '后端');
  }
  const manifest = releaseManifest({ ...options, sourceRoot: root, serverDir: server, siteDir: site });
  fs.mkdirSync(output, { recursive: false });
  copyDirectory(site, path.join(output, 'site'));
  if (options.skipGitCheck) copyDirectory(server, path.join(output, 'server'), { excludeNames: SERVER_EXCLUDES });
  else copyTrackedFiles(server, path.join(output, 'server'));
  const manifestPath = path.join(output, 'release-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  const manifestSha256 = sha256File(manifestPath);
  const releaseEnv = [
    `RELEASE_ID=${manifest.release.id}`,
    `RELEASE_MANIFEST_SHA256=${manifestSha256}`,
    `RELEASE_STATIC_SITE_SHA256=${manifest.artifacts.staticSite.sha256}`,
    `RELEASE_ADMIN_UI_SHA256=${manifest.artifacts.adminUi.sha256}`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(output, 'server', 'release.env'), releaseEnv, { encoding: 'utf8', mode: 0o640 });
  return { output, manifestPath, manifestSha256, manifest };
}

function verifyRelease(releaseDir) {
  const root = path.resolve(releaseDir);
  const manifestPath = path.join(root, 'release-manifest.json');
  const errors = [];
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (error) {
    return { ok: false, releaseDir: root, errors: [`无法读取 release manifest：${error.message}`] };
  }
  if (manifest.format !== FORMAT || manifest.formatVersion !== FORMAT_VERSION) errors.push('release manifest 格式不受支持');
  if (!manifest.release || !RELEASE_ID_PATTERN.test(String(manifest.release.id || ''))) errors.push('release ID 无效');
  const staticSite = path.join(root, 'site');
  const server = path.join(root, 'server');
  try {
    const actual = hashDirectory(staticSite);
    if (actual.sha256 !== manifest.artifacts?.staticSite?.sha256) errors.push('静态站摘要不匹配');
  } catch (error) { errors.push(`静态站校验失败：${error.message}`); }
  for (const [key, relative] of Object.entries({
    adminUi: 'routes/admin-ui.js',
    migrations: 'migrations.js',
    configTemplate: '.env.example',
  })) {
    try {
      const actual = sha256File(path.join(server, relative));
      const expected = key === 'migrations'
        ? manifest.artifacts?.migrations?.sourceSha256
        : manifest.artifacts?.[key]?.sha256;
      if (actual !== expected) errors.push(`${key} 摘要不匹配`);
    } catch (error) { errors.push(`${key} 校验失败：${error.message}`); }
  }
  try {
    const pkg = readPackageVersion(server);
    if (pkg.name !== manifest.source?.serverPackage?.name || pkg.version !== manifest.source?.serverPackage?.version) {
      errors.push('后端 package 版本不匹配');
    }
  } catch (error) { errors.push(`后端 package 校验失败：${error.message}`); }
  try {
    const env = parseEnvFile(path.join(server, 'release.env'));
    const expected = {
      RELEASE_ID: manifest.release.id,
      RELEASE_MANIFEST_SHA256: sha256File(manifestPath),
      RELEASE_STATIC_SITE_SHA256: manifest.artifacts?.staticSite?.sha256,
      RELEASE_ADMIN_UI_SHA256: manifest.artifacts?.adminUi?.sha256,
    };
    for (const key of REQUIRED_RUNTIME_KEYS) {
      if (env[key] !== expected[key]) errors.push(`release.env 的 ${key} 不匹配`);
    }
  } catch (error) { errors.push(`release.env 校验失败：${error.message}`); }
  return { ok: errors.length === 0, releaseDir: root, releaseId: manifest.release?.id || '', errors };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (token === '--create') args.create = true;
    else if (token === '--verify') args.verify = true;
    else if (token === '--release-id' || token === '--output' || token === '--release-dir' || token === '--site-dir' || token === '--server-dir') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`${token} 缺少参数`);
      args[token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    } else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`未知参数：${token}`);
  }
  return args;
}

function usage() {
  return [
    '创建不可变 release：',
    '  node scripts/release/release-manifest.js --create --release-id 20260811.1 --output /srv/ujn-guide/releases/20260811.1',
    '校验已生成 release：',
    '  node scripts/release/release-manifest.js --verify --release-dir /srv/ujn-guide/releases/20260811.1',
  ].join('\n');
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) { console.log(usage()); return { ok: true }; }
  if (args.create === args.verify) throw new Error('必须且只能选择 --create 或 --verify');
  if (args.create) {
    if (!args.releaseId || !args.output) throw new Error('创建 release 需要 --release-id 与 --output');
    const result = createRelease(args);
    console.log(JSON.stringify({ success: true, output: result.output, releaseId: result.manifest.release.id, manifestSha256: result.manifestSha256 }, null, 2));
    return result;
  }
  if (!args.releaseDir) throw new Error('校验 release 需要 --release-dir');
  const result = verifyRelease(args.releaseDir);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 2;
  return result;
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  }
}

module.exports = {
  FORMAT,
  FORMAT_VERSION,
  REQUIRED_RUNTIME_KEYS,
  sha256Text,
  sha256File,
  hashDirectory,
  parseEnvFile,
  releaseManifest,
  createRelease,
  verifyRelease,
  assertSameOriginFrontEnd,
  copyTrackedFiles,
  main,
};
