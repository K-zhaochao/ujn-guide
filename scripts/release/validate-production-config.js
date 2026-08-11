'use strict';

const fs = require('fs');
const path = require('path');

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

function hasLocation(nginx, pattern) {
  return pattern.test(String(nginx || ''));
}

function validateConfig(env, nginxText) {
  const errors = [];
  const mainSite = parseHttpsOrigin('MAIN_SITE_URL', env.MAIN_SITE_URL, errors);
  const allowedOrigins = String(env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean)
    .map(value => parseHttpsOrigin('ALLOWED_ORIGINS', value, errors));
  if (!allowedOrigins.length) errors.push('ALLOWED_ORIGINS 不能为空');
  if (mainSite && !allowedOrigins.includes(mainSite)) errors.push('ALLOWED_ORIGINS 必须包含 MAIN_SITE_URL');

  const callback = String(env.OAUTH_CALLBACK_BASE || '').trim().replace(/\/+$/, '');
  const expectedCallback = mainSite ? `${mainSite}/api/auth` : '';
  if (callback !== expectedCallback) errors.push('OAUTH_CALLBACK_BASE 必须等于 MAIN_SITE_URL + /api/auth');

  const port = Number(env.PORT);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) errors.push('PORT 必须是 1 到 65535 的整数');
  if (String(env.ADMIN_PATH || '').trim() !== '/admin') errors.push('同源发布的 ADMIN_PATH 必须为 /admin');

  const nginx = String(nginxText || '');
  if (!hasLocation(nginx, /(^|\n)\s*location\s+\^~\s+\/api\/\s*\{/m)) {
    errors.push('Nginx 缺少高优先级 /api/ 反向代理');
  }
  if (!hasLocation(nginx, /(^|\n)\s*location\s*=\s*\/admin\s*\{/m)
    || !hasLocation(nginx, /(^|\n)\s*location\s+\^~\s+\/admin\/\s*\{/m)) {
    errors.push('Nginx 缺少 /admin 反向代理');
  }
  if (Number.isSafeInteger(port) && !new RegExp(`proxy_pass\\s+http://127\\.0\\.0\\.1:${port}(?:[;\\s])`).test(nginx)) {
    errors.push('Nginx 反向代理端口与 PORT 不一致');
  }
  return { ok: errors.length === 0, errors };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (token === '--env-file' || token === '--nginx-config') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`${token} 缺少路径参数`);
      args[token === '--env-file' ? 'envFile' : 'nginxConfig'] = path.resolve(value);
    } else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`未知参数：${token}`);
  }
  return args;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('用法：node validate-production-config.js --env-file /etc/ujn-guide/pet.env --nginx-config /etc/nginx/sites-enabled/ujn-guide');
    return { ok: true };
  }
  if (!args.envFile || !args.nginxConfig) throw new Error('必须提供 --env-file 和 --nginx-config');
  const envContents = fs.readFileSync(args.envFile, 'utf8');
  const nginxContents = fs.readFileSync(args.nginxConfig, 'utf8');
  const result = validateConfig(parseEnv(envContents), nginxContents);
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

module.exports = { parseEnv, validateConfig, main };
