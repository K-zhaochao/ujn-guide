'use strict';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8000';

function normalizeBaseUrl(value = DEFAULT_BASE_URL) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new Error('--base-url must be an absolute HTTP(S) origin');
  }
  if (!['http:', 'https:'].includes(url.protocol)
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('--base-url must be an HTTP(S) origin without a path, query, fragment, or credentials');
  }
  return url.origin;
}

function expectedHtml(response, body, path) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  if (!contentType.includes('text/html')) throw new Error(`${path} did not return HTML`);
  if (!/<html[\s>]/i.test(body)) throw new Error(`${path} returned an incomplete HTML document`);
}

async function request(fetchImpl, baseUrl, pathname) {
  let response;
  try {
    response = await fetchImpl(new URL(pathname, `${baseUrl}/`), { redirect: 'manual' });
  } catch (error) {
    throw new Error(`${pathname} could not be reached: ${error && error.message ? error.message : error}`);
  }
  return response;
}

async function verifyLocalDeployment({ baseUrl = DEFAULT_BASE_URL, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation is required');
  const origin = normalizeBaseUrl(baseUrl);
  const checks = [];

  const home = await request(fetchImpl, origin, '/');
  const homeBody = await home.text();
  expectedHtml(home, homeBody, '/');
  checks.push('/');

  const pets = await request(fetchImpl, origin, '/pets/');
  const petsBody = await pets.text();
  expectedHtml(pets, petsBody, '/pets/');
  checks.push('/pets/');

  const health = await request(fetchImpl, origin, '/api/health');
  if (!health.ok) throw new Error(`/api/health returned HTTP ${health.status}`);
  let healthPayload;
  try {
    healthPayload = await health.json();
  } catch {
    throw new Error('/api/health did not return JSON');
  }
  if (!healthPayload || healthPayload.success !== true) throw new Error('/api/health did not report success=true');
  checks.push('/api/health');

  const admin = await request(fetchImpl, origin, '/admin');
  const adminBody = await admin.text();
  expectedHtml(admin, adminBody, '/admin');
  if (!/id=["']app["']/i.test(adminBody)) throw new Error('/admin did not return the management application shell');
  checks.push('/admin');

  return { baseUrl: origin, checks };
}

function parseArgs(argv) {
  const args = { baseUrl: DEFAULT_BASE_URL };
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (token === '--base-url') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error('--base-url requires a value');
      args.baseUrl = value;
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    } else {
      throw new Error(`unknown argument: ${token}`);
    }
  }
  return args;
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: node scripts/release/local-deployment-smoke.js [--base-url http://127.0.0.1:8000]');
    return null;
  }
  const result = await verifyLocalDeployment({ baseUrl: args.baseUrl });
  console.log(`Local same-origin acceptance passed: ${result.baseUrl} (${result.checks.join(', ')})`);
  return result;
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Local same-origin acceptance failed: ${error.message || error}`);
    process.exitCode = 1;
  });
}

module.exports = { DEFAULT_BASE_URL, normalizeBaseUrl, verifyLocalDeployment, parseArgs, main };
