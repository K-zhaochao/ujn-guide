/**
 * jwgl-endpoint.mjs 的单元测试。
 *
 *   node tools/grade-export/test-endpoint.mjs
 *
 * 重点是把两类真实地址钉死（校内直连 / 校外 WebVPN），以及探测逻辑的两个方向：
 * 有响应就算可达、连不上就换下一个。这些规则一旦写错，.exe 就会"看起来在跑但永远导不出"。
 */

import assert from 'node:assert/strict';
import {
  CAMPUS_CANDIDATES,
  DEFAULT_COLUMNS,
  EXPORT_DCCLBH,
  detectCampusBase,
  exportFields,
  exportUrl,
  parseBaseUrl,
} from './jwgl-endpoint.mjs';

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push([name, true]);
    console.log('  ✓ ' + name);
  } catch (error) {
    results.push([name, false]);
    console.log('  ✗ ' + name + ' → ' + error.message);
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    results.push([name, true]);
    console.log('  ✓ ' + name);
  } catch (error) {
    results.push([name, false]);
    console.log('  ✗ ' + name + ' → ' + error.message);
  }
}

console.log('\nWebVPN 地址解析（校外，用户粘贴的那条）');
const webvpn = parseBaseUrl(
  'https://webvpn.ujn.edu.cn/http/77726476706e69737468656265737421fae046906925625e300d8db9d6562d'
  + '/jwglxt/cjcx/cjcx_cxDgXscj.html?gnmkdm=N305005&layout=default',
);
check('base 保留 /http/<hex> 前缀', () => {
  assert.equal(
    webvpn.base,
    'https://webvpn.ujn.edu.cn/http/77726476706e69737468656265737421fae046906925625e300d8db9d6562d',
  );
});
check('gnmkdm / layout 从地址里取到', () => {
  assert.equal(webvpn.gnmkdm, 'N305005');
  assert.equal(webvpn.layout, 'default');
});
check('WebVPN 不算校内直连', () => assert.equal(webvpn.campus, false));
check('导出地址带前缀且指向真实接口', () => {
  assert.equal(
    exportUrl(webvpn.base),
    webvpn.base + '/jwglxt/zftal/drdc/export_exportConfig.html',
  );
});

console.log('\n校内直连地址解析');
const campus = parseBaseUrl('https://jwgl.ujn.edu.cn');
check('base 就是域名本身', () => assert.equal(campus.base, 'https://jwgl.ujn.edu.cn'));
check('缺省 gnmkdm = N305005、layout = default', () => {
  assert.equal(campus.gnmkdm, 'N305005');
  assert.equal(campus.layout, 'default');
});
check('识别为校内直连', () => assert.equal(campus.campus, true));
check('只有域名时也算得对（补 https://）', () => {
  assert.equal(parseBaseUrl('jwgl.ujn.edu.cn').base, 'https://jwgl.ujn.edu.cn');
});
check('空地址要报错，而不是静默用默认值', () => {
  assert.throws(() => parseBaseUrl('   '));
});
check('把说明文字当地址粘进来时要当场拒绝（不能算成 punycode 域名）', () => {
  // 两种情况都要拦住：能解析但不像域名（punycode 乱码）、以及压根解析不了
  assert.throws(() => parseBaseUrl('把你成绩查询页的地址粘在这里'), /网址|看不懂/);
  assert.throws(() => parseBaseUrl('请粘贴地址'), /网址|看不懂/);
  assert.throws(() => parseBaseUrl('hello world'), /网址|看不懂/);
});
check('真地址不会被误判', () => {
  assert.equal(parseBaseUrl('https://jwgl.ujn.edu.cn').base, 'https://jwgl.ujn.edu.cn');
  assert.equal(
    parseBaseUrl('https://webvpn.ujn.edu.cn/http/abc123/jwglxt/x.html').base,
    'https://webvpn.ujn.edu.cn/http/abc123',
  );
});

console.log('\n导出字段（必须与页面 doExport() 拼出来的一致）');
const fields = new URLSearchParams(exportFields({ xnm: '2024', xqm: '3', gnmkdm: 'N305005' }));
check('模板号是学生成绩那个', () => assert.equal(fields.get('dcclbh'), EXPORT_DCCLBH));
check('模板号不是管理员模板', () => assert.notEqual(fields.get('dcclbh'), 'JW_N305005_GLY'));
check('导出类型 xls、排序标志 0', () => {
  assert.equal(fields.get('exportModel.exportWjgs'), 'xls');
  assert.equal(fields.get('pxfs'), '0');
});
check('23 个导出列，且都是「字段@列名」', () => {
  const columns = fields.getAll('exportModel.selectCol');
  assert.equal(columns.length, DEFAULT_COLUMNS.length);
  assert.equal(columns.length, 23);
  assert.ok(columns.every((column) => column.includes('@')));
});
check('学年/学期/菜单码都带上了', () => {
  assert.equal(fields.get('xnm'), '2024');
  assert.equal(fields.get('xqm'), '3');
  assert.equal(fields.get('gnmkdm'), 'N305005');
});

console.log('\n校内网探测（判据必须从严：只有真的是教务系统登录页才算通）');
const LOGIN_HTML = '<html><input type="hidden" name="csrftoken" value="x"><input name="yhm"></html>';
const PORTAL_HTML = '<html><title>上网认证</title><p>请先登录校园网</p></html>';

await checkAsync('拿到真正的教务系统登录页 → 认为可直连', async () => {
  const fake = async () => ({ status: 200, text: async () => LOGIN_HTML });
  assert.equal(await detectCampusBase(fake), CAMPUS_CANDIDATES[0]);
});
await checkAsync('302 跳转不算通（避免被跳去门户页）', async () => {
  const fake = async () => ({ status: 302, text: async () => '' });
  assert.equal(await detectCampusBase(fake), null);
});
await checkAsync('200 但是门户/劫持页也不算通（校外误判的真实原因）', async () => {
  const fake = async () => ({ status: 200, text: async () => PORTAL_HTML });
  assert.equal(await detectCampusBase(fake), null);
});
await checkAsync('第一个连不上会顺延到下一个', async () => {
  let call = 0;
  const fake = async () => {
    call += 1;
    if (call === 1) throw new Error('DNS 失败');
    return { status: 200, text: async () => LOGIN_HTML };
  };
  assert.equal(await detectCampusBase(fake), CAMPUS_CANDIDATES[1]);
});
await checkAsync('全都连不上返回 null（校外）', async () => {
  const fake = async () => {
    throw new Error('ENOTFOUND');
  };
  assert.equal(await detectCampusBase(fake), null);
});

const failed = results.filter(([, ok]) => !ok);
console.log(`\n${failed.length ? '❌' : '✅'} ${results.length - failed.length}/${results.length} 项通过`);
process.exit(failed.length ? 1 : 0);
