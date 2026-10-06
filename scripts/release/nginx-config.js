'use strict';

const fs = require('node:fs');
const path = require('node:path');
const MEBIBYTE = 1024 * 1024;

// Parse the supported, explicit single-origin topology. Unsupported routing is
// rejected, never approximated as a successful production check. nginx -t and
// actual upstream/body-boundary requests remain required on the server.
function parseNginx(text) {
  const tokens = [];
  const input = String(text);
  let token = '', quote = '', escaped = false;
  const push = () => { if (token) tokens.push(token); token = ''; };
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (escaped) { token += char; escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (quote) { if (char === quote) quote = ''; else token += char; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '#') { push(); while (i < input.length && input[i] !== '\n') i++; continue; }
    if (/\s/.test(char)) { push(); continue; }
    if ('{};'.includes(char)) { push(); tokens.push(char); continue; }
    token += char;
  }
  push();
  if (quote || escaped) throw new Error('Nginx 配置引号未闭合');
  let index = 0;
  function block(nested = false) {
    const nodes = [];
    while (index < tokens.length) {
      if (tokens[index] === '}') { if (!nested) throw new Error('Nginx 配置多余的右括号'); index++; return nodes; }
      const words = [];
      while (index < tokens.length && !['{', '}', ';'].includes(tokens[index])) words.push(tokens[index++]);
      const end = tokens[index++];
      if (!words.length || !['{', ';'].includes(end)) throw new Error('Nginx 配置语法不完整');
      nodes.push({ name: words[0], args: words.slice(1), children: end === '{' ? block(true) : null });
    }
    if (nested) throw new Error('Nginx 配置缺少右括号');
    return nodes;
  }
  return block();
}

function loadNginxConfig(file, { prefix = '', stack = [] } = {}) {
  const absolute = path.resolve(file);
  if (stack.includes(absolute) || stack.length >= 24) throw new Error('Nginx include 循环或层级过深');
  const expand = nodes => nodes.flatMap(node => {
    if (node.name !== 'include') return [{ ...node, children: node.children ? expand(node.children) : null }];
    const target = node.args[0];
    if (node.args.length !== 1 || !target || target.includes('$')) throw new Error('无法确定 Nginx include 路径');
    if (!path.isAbsolute(target) && !prefix) throw new Error('相对 include 必须提供真实 --nginx-prefix，或使用已展开的虚拟主机配置');
    const pattern = path.isAbsolute(target) ? target : path.resolve(prefix, target);
    const files = /[*?\[]/.test(pattern) ? fs.globSync(pattern.replaceAll('\\', '/')).sort() : [pattern];
    if (!files.length) throw new Error('Nginx include 未匹配文件，拒绝不完整检查');
    return files.flatMap(item => loadNginxConfig(item, { prefix, stack: [...stack, absolute] }));
  });
  return expand(parseNginx(fs.readFileSync(absolute, 'utf8')));
}

function own(nodes, name) {
  const found = nodes.filter(node => node.name === name);
  if (found.length > 1) throw new Error(`Nginx 重复 ${name} 指令`);
  return found[0]?.args;
}

function bodyBytes(value) {
  const match = /^(\d+)([kmg])?$/i.exec(String(value || ''));
  if (!match || Number(match[1]) === 0) throw new Error('client_max_body_size 必须为明确的有限正整数上限');
  const result = Number(match[1]) * ({ k: 1024, m: MEBIBYTE, g: 1024 * MEBIBYTE }[match[2]?.toLowerCase()] || 1);
  if (!Number.isSafeInteger(result)) throw new Error('client_max_body_size 超出有效范围');
  return result;
}

function selectServer(nodes, hostname) {
  const http = nodes.find(node => node.name === 'http');
  const context = http ? http.children : nodes;
  const servers = context.filter(node => node.name === 'server' && node.children);
  if (!servers.length) return { nodes: context, parent: [], inherited: 1024 * 1024 };
  const matches = servers.filter(node => (own(node.children, 'server_name') || []).includes(hostname)
    && node.children.some(item => item.name === 'listen' && item.args.some(arg => arg === '443' || arg.endsWith(':443'))));
  if (matches.length !== 1) throw new Error('必须唯一定位 MAIN_SITE_URL 对应的 HTTPS server_name/443 配置');
  const body = own(context, 'client_max_body_size');
  return { nodes: matches[0].children, parent: context, inherited: body ? bodyBytes(body[0]) : MEBIBYTE };
}

function validateLogSafety(server) {
  const errors = [];
  const safeVariables = new Set(['time_iso8601', 'msec', 'request_id', 'request_method', 'uri', 'status', 'body_bytes_sent', 'request_time', 'upstream_status', 'upstream_response_time']);
  const formats = new Map();
  for (const node of [...server.parent, ...server.nodes].filter(node => node.name === 'log_format')) {
    if (formats.has(node.args[0])) errors.push('Nginx 日志格式重复定义');
    formats.set(node.args[0], node.args.slice(1));
  }
  const logs = (nodes, inherited) => {
    const ownLogs = nodes.filter(node => node.name === 'access_log');
    return ownLogs.length ? ownLogs : inherited;
  };
  function inspect(nodes, access, errorLog, api = false) {
    const active = logs(nodes, access);
    const ownErrors = nodes.filter(node => node.name === 'error_log');
    const errorsHere = ownErrors.length ? ownErrors : errorLog;
    for (const log of active) {
      if (log.args.length === 1 && log.args[0] === 'off') continue;
      const format = formats.get(log.args[1] || 'combined');
      const variables = format && format.slice(1).join('').match(/\$(?:\{[a-z0-9_]+\}|[a-z0-9_]+)/gi) || [];
      if (!format || format[0] !== 'escape=json' || log.args[0].includes('$')
        || variables.some(value => !safeVariables.has(value.replace(/[$\{\}]/g, '')))) {
        errors.push('Nginx access_log 必须显式使用已展开的安全 JSON 格式（仅路径/状态/耗时，无查询、请求头或未知变量）');
      }
    }
    if (api && (!errorsHere.length || errorsHere.some(log => log.args[0] !== '/dev/null'))) {
      errors.push('Nginx API 原生 error_log 可能包含凭据；请使用 /dev/null 并保留安全访问日志和后端结构化错误日志');
    }
    for (const node of nodes.filter(item => item.name === 'location' && item.children)) {
      inspect(node.children, active, errorsHere, api || node.args.at(-1)?.startsWith('/api/'));
    }
  }
  inspect(server.nodes, logs(server.parent, [{ args: ['logs/access.log', 'combined'] }]), server.parent.filter(node => node.name === 'error_log'));
  return [...new Set(errors)];
}

function validateNginx(nodesOrText, { hostname, port, uploadPolicy }) {
  const errors = [];
  const nodes = typeof nodesOrText === 'string' ? parseNginx(nodesOrText) : nodesOrText;
  function noIncludes(items) {
    for (const node of items) {
      if (node.name === 'include') throw new Error('Nginx include 未展开，无法核对实际 location');
      if (node.children) noIncludes(node.children);
    }
  }
  noIncludes(nodes);
  const server = selectServer(nodes, hostname);
  errors.push(...validateLogSafety(server));
  const body = own(server.nodes, 'client_max_body_size');
  const defaultBody = body ? bodyBytes(body[0]) : server.inherited;
  const locations = server.nodes.filter(node => node.name === 'location').map(node => {
    const modifier = node.args.length === 2 ? node.args[0] : '';
    const pathname = node.args.at(-1);
    return { ...node, modifier, pathname };
  });
  if (!locations.some(item => item.modifier === '^~' && item.pathname === '/api/')) errors.push('Nginx 缺少高优先级 /api/ 反向代理');
  if (!locations.some(item => item.modifier === '=' && item.pathname === '/admin')
    || !locations.some(item => item.modifier === '^~' && item.pathname === '/admin/')) errors.push('Nginx 缺少 /admin 反向代理');
  if (errors.length) return errors;
  if (server.nodes.some(node => ['rewrite', 'return', 'if'].includes(node.name))) throw new Error('API 所在 server 不支持条件跳转/改写；请将 HTTP 跳转放入独立虚拟主机');
  for (const item of locations.filter(item => item.pathname?.startsWith('/api/') && !['~', '~*'].includes(item.modifier))) {
    if (!['^~', '='].includes(item.modifier) || item.children.some(node => node.name === 'location' || ['rewrite', 'return', 'if', 'error_page'].includes(node.name))) {
      throw new Error('API location 必须使用扁平的 ^~ 前缀或精确匹配，禁止未能证明安全的嵌套/正则/改写');
    }
  }
  function selected(url) {
    const exact = locations.find(item => item.modifier === '=' && item.pathname === url);
    if (exact) return exact;
    return locations.filter(item => !['=', '~', '~*'].includes(item.modifier) && url.startsWith(item.pathname))
      .sort((a, b) => b.pathname.length - a.pathname.length)[0];
  }
  const families = ['/api/submissions', '/api/my/submissions/', '/api/admin/submissions/'];
  const restore = '/api/admin/restore-imports/';
  const urls = new Set(['/api/submissions', '/api/my/submissions/_check_', '/api/admin/submissions/_check_', restore + '_check_/file', '/admin', '/admin/']);
  for (const location of locations) {
    if ([...families, restore].some(family => location.pathname?.startsWith(family))) urls.add(location.pathname);
  }
  for (const url of urls) {
    const location = selected(url);
    if (!location) { errors.push(`Nginx 未找到 ${url} 的代理位置`); continue; }
    const proxy = own(location.children, 'proxy_pass');
    if (!proxy || proxy.length !== 1 || proxy[0] !== `http://127.0.0.1:${port}`) errors.push('Nginx 反向代理端口与 PORT 不一致');
    if (!url.startsWith('/api/')) continue;
    const ownBody = own(location.children, 'client_max_body_size');
    const actual = ownBody ? bodyBytes(ownBody[0]) : defaultBody;
    const required = url.startsWith(restore) ? uploadPolicy.restoreRequestBytes : uploadPolicy.requestBodyBytes;
    if (actual < required) errors.push(`Nginx ${url} 命中 ${location.modifier} ${location.pathname} 的 client_max_body_size 不足，至少需要 ${Math.ceil(required / MEBIBYTE)}m`);
  }
  return [...new Set(errors)];
}

module.exports = { parseNginx, loadNginxConfig, validateNginx, bodyBytes };
