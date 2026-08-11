'use strict';

const fs = require('fs');
const path = require('path');

function verifyHealthPayload(payload, manifest) {
  const release = payload && payload.release;
  const expected = manifest && manifest.artifacts;
  const errors = [];
  if (!payload || payload.success !== true) errors.push('health 响应未声明 success=true');
  if (!release || release.id !== manifest.release.id) errors.push('health release ID 不匹配');
  if (!release || release.staticSiteSha256 !== expected.staticSite.sha256) errors.push('health 静态站摘要不匹配');
  if (!release || release.adminUiSha256 !== expected.adminUi.sha256) errors.push('health 管理 UI 摘要不匹配');
  if (!release || release.manifestSha256 !== manifest.manifestSha256) errors.push('health manifest 摘要不匹配');
  return { ok: errors.length === 0, errors };
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length !== 1) throw new Error('用法：node verify-running-release.js <release-dir>');
  const releaseDir = path.resolve(argv[0]);
  const manifestFile = path.join(releaseDir, 'release-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  manifest.manifestSha256 = require('./release-manifest').sha256File(manifestFile);
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const result = verifyHealthPayload(payload, manifest);
  if (!result.ok) {
    console.error(result.errors.join('\n'));
    process.exitCode = 2;
  }
  return result;
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

module.exports = { verifyHealthPayload };
