'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateConfig } = require('../../scripts/release/validate-production-config');
const templateRoot = path.resolve(__dirname, '../../scripts/release/templates');
const format = fs.readFileSync(path.join(templateRoot, 'ujn-guide-log-format.conf'), 'utf8');
const site = fs.readFileSync(path.join(templateRoot, 'ujn-guide-nginx.conf'), 'utf8')
  .replaceAll('$server_name', 'guide.example.org').replaceAll('$backend_port', '3005').replaceAll('$release_root', '/srv/ujn-guide');
const config = `http { ${format} ${site} }`;
const env = { MAIN_SITE_URL: 'https://guide.example.org', BIND_HOST: '127.0.0.1', PORT: '3005' };

test('production log templates keep safe access diagnostics and isolate raw API error logs', () => {
  assert.deepEqual(validateConfig(env, config), { ok: true, errors: [] });
  assert.equal(validateConfig(env, config.replaceAll('error_log /dev/null crit;', '')).ok, false);
  assert.equal(validateConfig(env, config.replace('error_log /dev/null crit;', 'error_log /var/log/nginx/raw-api.log;')).ok, false);
  assert.equal(validateConfig(env, site).ok, false, 'vhost alone cannot prove its named format safe');
});

test('combined, referer, header, repeated/encoded query and unknown mapped variables cannot enter access logs', () => {
  for (const variable of ['$request', '$request_uri', '$args', '${args}', '$query_string', '$http_referer', '$http_authorization', '$http_cookie', '$arg_code', '$mapped_unverified']) {
    const result = validateConfig(env, config.replace('"path":"$uri"', `"path":"${variable}"`));
    assert.equal(result.ok, false, variable);
    assert.ok(result.errors.some(message => message.includes('access_log')));
  }
  assert.equal(validateConfig(env, config.replace('escape=json', 'escape=none')).ok, false);
  assert.equal(validateConfig(env, config.replace('ujn-guide-access.log ujn_safe;', 'ujn-guide-access.log combined;')).ok, false);
  assert.equal(validateConfig(env, config.replace('ujn-guide-access.log ujn_safe;', '$args.log ujn_safe;')).ok, false);
});

test('effective logging checks http inheritance, nested overrides and every access_log destination', () => {
  const access = 'access_log /var/log/nginx/ujn-guide-access.log ujn_safe;';
  const inherited = `http { ${format} ${access} ${site.replace(access, '')} }`;
  assert.equal(validateConfig(env, inherited).ok, true);
  assert.equal(validateConfig(env, inherited.replace('location ^~ /api/ {', 'location ^~ /api/ { access_log /tmp/raw.log combined;')).ok, false);
  assert.equal(validateConfig(env, config.replace(access, access + ' access_log /tmp/raw.log;')).ok, false);
  assert.equal(validateConfig(env, config.replace(access, access + ' access_log /tmp/safe.log ujn_safe;')).ok, true);
  assert.equal(validateConfig(env, config.replace('location ^~ /api/ {', 'location ^~ /api/ { location /nested { access_log /tmp/raw.log combined; }')).ok, false);
  assert.equal(validateConfig(env, config.replace(access, 'access_log off;')).ok, true);
});
