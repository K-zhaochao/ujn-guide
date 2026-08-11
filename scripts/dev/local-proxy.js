'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function portFrom(value, name) {
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }
  return port;
}

function isBackendPath(pathname) {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/');
}

function staticFile(siteRoot, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const candidate = path.resolve(siteRoot, `.${decoded}`);
  if (candidate !== siteRoot && !candidate.startsWith(`${siteRoot}${path.sep}`)) return null;
  if (!fs.existsSync(candidate)) return null;
  return fs.statSync(candidate).isDirectory() ? path.join(candidate, 'index.html') : candidate;
}

function serveStatic(req, res, siteRoot, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method not allowed');
    return;
  }

  const file = staticFile(siteRoot, pathname);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const type = MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Cache-Control': 'no-cache' };
  if (req.method === 'HEAD') {
    res.writeHead(200, headers);
    res.end();
    return;
  }

  res.writeHead(200, headers);
  fs.createReadStream(file).on('error', () => {
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Failed to read static file');
  }).pipe(res);
}

function proxyRequest(req, res, backendPort) {
  const headers = { ...req.headers };
  delete headers.connection;
  headers['x-forwarded-for'] = req.socket.remoteAddress || '';
  headers['x-forwarded-proto'] = 'http';

  const upstream = http.request({
    host: '127.0.0.1',
    port: backendPort,
    method: req.method,
    path: req.url,
    headers,
  }, upstreamResponse => {
    res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(res);
  });

  upstream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    }
    res.end(JSON.stringify({ success: false, message: `Local backend on port ${backendPort} is unavailable` }));
  });
  req.pipe(upstream);
}

function createLocalServer({ siteDir, backendPort = 3005 } = {}) {
  const siteRoot = path.resolve(siteDir || path.join(__dirname, '..', '..', 'site'));
  const resolvedBackendPort = portFrom(backendPort, 'BACKEND_PORT');
  if (!fs.existsSync(siteRoot) || !fs.statSync(siteRoot).isDirectory()) {
    throw new Error(`Static site directory does not exist: ${siteRoot}. Run npm run build first.`);
  }

  return http.createServer((req, res) => {
    const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
    if (isBackendPath(pathname)) proxyRequest(req, res, resolvedBackendPort);
    else serveStatic(req, res, siteRoot, pathname);
  });
}

function main() {
  const port = portFrom(process.env.DEV_PORT || 8000, 'DEV_PORT');
  const backendPort = portFrom(process.env.BACKEND_PORT || 3005, 'BACKEND_PORT');
  const server = createLocalServer({ backendPort });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Local site: http://127.0.0.1:${port}`);
    console.log(`Proxy target: http://127.0.0.1:${backendPort}`);
  });
}

if (require.main === module) main();

module.exports = { createLocalServer, isBackendPath, portFrom, staticFile };
