/**
 * 把成绩导出程序打成**单文件可执行程序**（Node SEA，Single Executable Application）。
 *
 *   node scripts/tools/build-exe.mjs             # 为当前系统构建
 *   node scripts/tools/build-exe.mjs --keep-cjs  # 保留中间产物，便于排查
 *
 * 产物放在 dist/（已被 .gitignore 忽略，不进仓库）：Release 附件由
 * .github/workflows/build-binaries.yml 在打 tag 时自动构建并上传。
 *
 * 为什么需要这层转换：Node 的 SEA 目前只支持 **CommonJS** 入口，
 * 而我们的程序是 ESM（.mjs）。它只用到 node: 内置模块，所以把 import 改写成
 * require 即可，无需其它改动。这里不引入打包器，保持零依赖。
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE = join(ROOT, 'tools', 'grade-export', 'jwgl-export.mjs');
const DIST = join(ROOT, 'dist');
const WORK = join(DIST, 'sea');
const PLATFORM = process.platform; // win32 / darwin / linux
const ARCH = process.arch; // x64 / arm64
const EXT = PLATFORM === 'win32' ? '.exe' : '';
const OUTPUT = join(DIST, `ujn-grade-export-${PLATFORM}-${ARCH}${EXT}`);

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: 'inherit', ...options });
}

/**
 * 调 npx（postject）。
 *
 * Windows 上 npx 其实是 npx.cmd，而 Node 从 2024 年起禁止 execFile 直接执行 .cmd/.bat
 * （CVE-2024-27980），必须开 shell。这里踩过一次：postject 静默失败，
 * 结果 dist 里留下一个「只是 node.exe 拷贝」的假 exe（83 MB，跑起来完全不认参数）。
 */
function runNpx(args) {
  const isWindows = process.platform === 'win32';
  return run(isWindows ? 'npx.cmd' : 'npx', args, { shell: isWindows });
}

/** ESM → CJS：只改 import 行，程序本身没有其它 ESM 专属语法。 */
function toCommonJs(source) {
  const converted = source
    .replace(/^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?$/gm, "const {$1} = require('$2');")
    .replace(/^import\s+(\w+)\s+from\s+['"]([^'"]+)['"];?$/gm, "const $1 = require('$2');");
  if (/^\s*import\s/m.test(converted)) {
    throw new Error('还有没转换掉的 import，SEA 需要纯 CommonJS 入口');
  }
  return converted;
}

console.log(`[build-exe] 目标平台：${PLATFORM}-${ARCH}（Node ${process.version}）`);
mkdirSync(WORK, { recursive: true });

const cjsPath = join(WORK, 'jwgl-export.cjs');
writeFileSync(cjsPath, toCommonJs(readFileSync(SOURCE, 'utf8')), 'utf8');
console.log('[build-exe] 已把入口转换为 CommonJS');

// 1) 生成 SEA blob（Node 自带能力，无需额外依赖）
const seaConfigPath = join(WORK, 'sea-config.json');
writeFileSync(
  seaConfigPath,
  JSON.stringify(
    {
      main: cjsPath,
      output: join(WORK, 'sea-prep.blob'),
      disableExperimentalSEAWarning: true,
      useSnapshot: false,
      useCodeCache: false,
    },
    null,
    2,
  ),
  'utf8',
);
run(process.execPath, ['--experimental-sea-config', seaConfigPath]);

// 2) 以当前 node 可执行文件为底座，注入 blob
copyFileSync(process.execPath, OUTPUT);
if (PLATFORM === 'darwin') {
  // macOS 上必须先去掉原签名，注入后再临时签名，否则无法运行
  try {
    run('codesign', ['--remove-signature', OUTPUT]);
  } catch {
    console.warn('[build-exe] 去掉签名失败（可忽略）');
  }
}
runNpx([
  '--yes',
  'postject',
  OUTPUT,
  'NODE_SEA_BLOB',
  join(WORK, 'sea-prep.blob'),
  '--sentinel-fuse',
  'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  ...(PLATFORM === 'darwin' ? ['--macho-segment-name', 'NODE_SEA'] : []),
]);
if (PLATFORM === 'darwin') {
  try {
    run('codesign', ['--sign', '-', OUTPUT]);
  } catch {
    console.warn('[build-exe] 临时签名失败（可忽略）');
  }
}

// 3) 构建后自检：拿一个非法学期去跑产物，必须得到程序自己的人话报错。
//    这一步能识别出「postject 没注入成功、产物只是 node.exe 拷贝」的假货。
try {
  const probe = execFileSync(OUTPUT, ['--user', 'buildcheck', '--password', 'buildcheck', '--term', '9'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  throw new Error(`产物没有按预期拒绝非法参数，输出：${probe.slice(0, 120)}`);
} catch (error) {
  const text = `${error.stdout || ''}${error.stderr || ''}`;
  if (!text.includes('学期只能是')) {
    throw new Error(`构建自检失败：产物没有给出预期的人话报错。\n${text.slice(0, 300)}`);
  }
  console.log('[build-exe] 自检通过：产物能运行，并给出了预期的参数校验提示');
}

const size = statSync(OUTPUT).size / 1048576;
console.log(`[build-exe] 完成：${OUTPUT}（${size.toFixed(1)} MB）`);
if (!process.argv.includes('--keep-cjs')) {
  rmSync(WORK, { recursive: true, force: true });
}
console.log('[build-exe] 双击它即可运行；首次运行会依次询问学号、密码、学期。');
