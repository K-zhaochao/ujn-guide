'use strict';

const fs = require('fs');
const path = require('path');
const { loadNginxConfig, validateNginx } = require('./nginx-config');

function uploadRequestPolicy(env = {}, serverDir = path.resolve(__dirname, '../../server')) {
  const contractFile = path.join(serverDir, 'upload-policy.js');
  const reader = require(contractFile).readDeploymentUploadPolicy;
  if (typeof reader !== 'function') throw new Error('候选后端缺少纯上传策略契约，不能使用旧默认值继续发布');
  return reader(env);
}

function parseEnv(contents) {
  const result = {};
  for (const rawLine of String(contents).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

function parseHttpsOrigin(name, raw, errors) {
  try {
    const url = new URL(String(raw || '').trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('必须是无路径的 HTTPS origin');
    }
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1') {
      throw new Error('不能使用本机地址');
    }
    return url.origin;
  } catch (error) {
    errors.push(`${name} ${error.message || '不是有效 URL'}`);
    return '';
  }
}

function validateConfig(env, nginxText, { serverDir } = {}) {
  const errors = [];
  const mainSite = parseHttpsOrigin('MAIN_SITE_URL', env.MAIN_SITE_URL, errors);
  const configuredAllowedOrigins = String(env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean)
    .map(value => parseHttpsOrigin('ALLOWED_ORIGINS', value, errors));
  const allowedOrigins = configuredAllowedOrigins.length ? configuredAllowedOrigins : (mainSite ? [mainSite] : []);
  if (mainSite && !allowedOrigins.includes(mainSite)) errors.push('ALLOWED_ORIGINS 必须包含 MAIN_SITE_URL');

  const callback = String(env.OAUTH_CALLBACK_BASE || '').trim().replace(/\/+$/, '');
  const expectedCallback = mainSite ? `${mainSite}/api/auth` : '';
  if (callback && callback !== expectedCallback) errors.push('OAUTH_CALLBACK_BASE 如保留必须等于 MAIN_SITE_URL + /api/auth');

  const port = Number(env.PORT);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) errors.push('PORT 必须是 1 到 65535 的整数');
  if (String(env.BIND_HOST || '').trim() !== '127.0.0.1') errors.push('同源发布的 BIND_HOST 必须为 127.0.0.1');
  const adminPath = String(env.ADMIN_PATH || '').trim().replace(/\/+$/, '');
  if (adminPath && adminPath !== '/admin') errors.push('同源发布的 ADMIN_PATH 如保留必须为 /admin');

  try {
    const uploadPolicy = uploadRequestPolicy(env, serverDir);
    errors.push(...validateNginx(nginxText, { hostname: mainSite ? new URL(mainSite).hostname : '', port, uploadPolicy }));
  } catch (error) { errors.push(error.message); }
  return { ok: errors.length === 0, errors };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (['--env-file', '--nginx-config', '--server-dir', '--nginx-prefix'].includes(token)) {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`${token} 缺少路径参数`);
      args[{ '--env-file': 'envFile', '--nginx-config': 'nginxConfig', '--server-dir': 'serverDir', '--nginx-prefix': 'nginxPrefix' }[token]] = path.resolve(value);
    } else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`未知参数：${token}`);
  }
  return args;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('用法：node validate-production-config.js --server-dir <candidate/server> --env-file <external.env> --nginx-config <vhost.conf> [--nginx-prefix <nginx-prefix>]');
    return { ok: true };
  }
  if (!args.envFile || !args.nginxConfig || !args.serverDir) throw new Error('必须提供 --server-dir、--env-file 和 --nginx-config');
  const envContents = fs.readFileSync(args.envFile, 'utf8');
  const nginxContents = loadNginxConfig(args.nginxConfig, { prefix: args.nginxPrefix });
  const result = validateConfig(parseEnv(envContents), nginxContents, { serverDir: args.serverDir });
  if (!result.ok) {
    console.error(result.errors.join('\n'));
    process.exitCode = 2;
  }
  return result;
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  }
}

module.exports = { parseEnv, uploadRequestPolicy, validateConfig, main };
