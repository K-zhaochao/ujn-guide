'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateConfig, uploadRequestPolicy } = require('../../scripts/release/validate-production-config');
const { loadNginxConfig, parseNginx, bodyBytes } = require('../../scripts/release/nginx-config');
const { readDeploymentUploadPolicy } = require('../../server/upload-policy');
const env = { MAIN_SITE_URL: 'https://guide.example.org', BIND_HOST: '127.0.0.1', PORT: '3005' };
const proxy = 'proxy_pass http://127.0.0.1:3005;';
const nginx = `server { listen 443 ssl; server_name guide.example.org; client_max_body_size 28m;
  access_log off; error_log /dev/null crit;
  location ^~ /api/ { ${proxy} }
  location ^~ /api/admin/restore-imports/ { client_max_body_size 128m; ${proxy} }
  location = /admin { ${proxy} }
  location ^~ /admin/ { ${proxy} }
}`;

test('candidate backend is the only source for defaults, 10/20 images and strict invalid inputs', () => {
  for (const extra of [{}, { MAX_IMAGES_PER_SUBMISSION: '10', MAX_IMAGE_SIZE_MB: '2' }, { MAX_IMAGES_PER_SUBMISSION: '20', MAX_IMAGE_SIZE_MB: '2' }]) {
    assert.deepEqual(uploadRequestPolicy(extra), readDeploymentUploadPolicy(extra));
  }
  assert.equal(uploadRequestPolicy({}).nginxBodyMb, 28);
  assert.equal(uploadRequestPolicy({ MAX_IMAGES_PER_SUBMISSION: 20 }).nginxBodyMb, 55);
  assert.equal(validateConfig(env, nginx).ok, true);
  assert.equal(validateConfig({ ...env, MAX_IMAGES_PER_SUBMISSION: '20' }, nginx.replace('28m', '35m')).ok, false);
  assert.equal(validateConfig({ ...env, MAX_IMAGES_PER_SUBMISSION: '20' }, nginx.replace('28m', '55m')).ok, true);
  for (const value of ['0', '-1', '21', '2.5', '2x', '999999999999999999']) assert.equal(validateConfig({ ...env, MAX_IMAGES_PER_SUBMISSION: value }, nginx).ok, false);
  assert.equal(validateConfig({ ...env, MAX_IMAGE_SIZE_MB: '51' }, nginx).ok, false);
});

test('effective body limit uses the selected vhost, longest prefix/exact overrides, and binary restore separately', () => {
  const unrelated = 'server { listen 443 ssl; server_name unrelated.org; client_max_body_size 1g; }\n';
  assert.equal(validateConfig(env, unrelated + nginx.replace('28m', '1m')).ok, false);
  assert.equal(validateConfig(env, unrelated + nginx).ok, true);
  for (const declaration of [
    `location = /api/submissions { client_max_body_size 1m; ${proxy} }`,
    `location ^~ /api/my/submissions/ { client_max_body_size 1m; ${proxy} }`,
    `location = /api/admin/submissions/specific_pet { client_max_body_size 1m; ${proxy} }`,
    `location ^~ /api/admin/restore-imports/big_file/ { client_max_body_size 28m; ${proxy} }`,
  ]) assert.equal(validateConfig(env, nginx.replace(/}$/, declaration + '}')).ok, false);
  assert.equal(validateConfig(env, nginx.replace('128m', '28m')).ok, false);
  assert.equal(validateConfig({ ...env, BACKUP_EXPORT_MAX_MB: '200' }, nginx).ok, false);
  assert.equal(validateConfig({ ...env, BACKUP_EXPORT_MAX_MB: '200' }, nginx.replace('128m', '200m')).ok, true);
  assert.equal(validateConfig(env, nginx.replace('^~ /api/', '/api/')).ok, false);
  assert.equal(validateConfig(env, nginx.replace('28m', '0')).ok, false);
});

test('body boundary compares exact encoded bytes and honors http inheritance and quoted/comments syntax', () => {
  const bytes = uploadRequestPolicy({}).requestBodyBytes;
  assert.equal(validateConfig(env, nginx.replace('28m', String(bytes - 1))).ok, false);
  assert.equal(validateConfig(env, nginx.replace('28m', String(bytes))).ok, true);
  const inherited = 'http { client_max_body_size 28m; ' + nginx.replace('client_max_body_size 28m;', '') + ' }';
  assert.equal(validateConfig(env, inherited).ok, true);
  assert.equal(validateConfig(env, '# client_max_body_size 500m;\n' + nginx.replace('28m', '1m')).ok, false);
  assert.equal(validateConfig(env, nginx.replace('guide.example.org;', '"guide.example.org";')).ok, true);
  for (const input of ['server {', '}', 'server_name "broken', 'missing terminator']) assert.throws(() => parseNginx(input));
  for (const input of ['1.5m', '0', '-1', '1t']) assert.throws(() => bodyBytes(input));
});

test('includes expand in the actual prefix, reject unresolved/cyclic includes, and CLI requires candidate path', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ujn-nginx-contract-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const config = path.join(root, 'nginx.conf');
  const included = path.join(root, 'site.conf');
  fs.writeFileSync(config, 'include site.conf;');
  fs.writeFileSync(included, nginx);
  assert.throws(() => loadNginxConfig(config), /prefix/);
  assert.equal(validateConfig(env, loadNginxConfig(config, { prefix: root })).ok, true);
  fs.writeFileSync(included, 'include nginx.conf;');
  assert.throws(() => loadNginxConfig(config, { prefix: root }), /循环/);
  assert.equal(validateConfig(env, 'include secret-location.conf;').ok, false);
  fs.writeFileSync(included, nginx);
  fs.writeFileSync(config, 'include site*.conf;');
  assert.equal(validateConfig(env, loadNginxConfig(config, { prefix: root })).ok, true);
  const environment = path.join(root, 'synthetic.env');
  fs.writeFileSync(environment, Object.entries(env).map(([key, value]) => key + '=' + value).join('\n'));
  const args = [path.resolve(__dirname, '../../scripts/release/validate-production-config.js'), '--env-file', environment, '--nginx-config', config, '--nginx-prefix', root];
  assert.equal(spawnSync(process.execPath, args, { encoding: 'utf8' }).status, 1);
  assert.equal(spawnSync(process.execPath, [...args, '--server-dir', path.resolve(__dirname, '../../server')], { encoding: 'utf8' }).status, 0);
});
