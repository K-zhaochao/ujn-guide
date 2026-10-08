import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CookieJar, JwglClient, safeFileName, schoolOptions } from '../../tools/grade-export/jwgl-client.mjs';
import { encryptCas } from '../../tools/grade-export/cas-encryption.mjs';
import { createMockSchool } from './mock-school.mjs';

test('CAS native encryption matches four public-school script vectors', () => {
  const vectors = { fixture: 'BD7E296CC68B1E27611D4F6E045F0BE4', '测试123': '7DFBF89ACA3584518BC2282D6215AFE3', abc: '39644174795FB4D0', '123456789': 'C1BB5938DF9F2190B89172CB54C8C33A4B7C10BBA3854452' };
  for (const [text, expected] of Object.entries(vectors)) assert.equal(encryptCas(text), expected);
});
for (const mode of ['sso', 'direct']) test(`${mode} login -> query filters -> 23-column student export`, async () => {
  const school = await createMockSchool();
  const client = new JwglClient({ base: school.base, ssoOrigin: school.base, allowedOrigins: [school.base] });
  try {
    await (mode === 'sso' ? client.loginSso('20230001', 'correct-horse') : client.loginDirect('20230001', 'correct-horse'));
    const periods = await client.getAvailablePeriods();
    assert.deepEqual(periods.years.map(y => y.value), ['2025', '2024']);
    assert.deepEqual(periods.terms.map(t => t.value), ['3', '12']);
    assert.equal(periods.year, '2025'); assert.equal(periods.term, '3');
    assert.deepEqual((await client.getAvailablePeriods({ year: '2024' })).terms, [{ value: '16', label: '暑期学期' }]);
    const file = await client.exportGrades({ year: '2025', term: '12' });
    assert.match(file.buffer.toString(), /MOCK-XLS-BYTES/); assert.equal(file.filename, '2025-12 成绩单.xls');
    const exported = school.records.find(r => r.path.endsWith('export_exportConfig.html'));
    assert.equal(exported.form.get('dcclbh'), 'JW_N305005_XSCXCJ');
    assert.equal(exported.form.get('xqm'), '12'); assert.equal(exported.form.getAll('exportModel.selectCol').length, 23);
    assert.ok(!exported.cookie.includes('cas-session'));
    const queryAt = school.records.findIndex(r => r.path.endsWith('cjcx_cxDgXscj.html') && r.form.get('xqm') === '12');
    assert.ok(queryAt >= 0 && queryAt < school.records.indexOf(exported));
    assert.equal(school.records[queryAt].form.get('xqm'), '12');
    assert.ok(!school.records.some(r => r.raw.includes('correct-horse')));
  } finally { client.dispose(); assert.equal(client.jar.store.size, 0); await school.close(); }
});
test('HTML export is rejected rather than saved as XLS', async () => {
  const school = await createMockSchool({ htmlExport: true });
  const client = new JwglClient({ base: school.base, allowedOrigins: [school.base] });
  try { await client.loginDirect('20230001', 'correct-horse'); await assert.rejects(client.exportGrades({ year: '2025', term: '3' }), /网页而不是表格/); }
  finally { client.dispose(); await school.close(); }
});
test('CAS failure does not retry or export', async () => {
  const school = await createMockSchool({ failLogin: true }); const client = new JwglClient({ base: school.base, ssoOrigin: school.base, allowedOrigins: [school.base] });
  try { await assert.rejects(client.loginSso('20230001', 'wrong'), /未成功/); assert.equal(school.records.filter(r => r.method === 'POST').length, 1); }
  finally { client.dispose(); await school.close(); }
});
test('redirect allowlist and Cookie host/path/secure/expiry isolation', () => {
  const client = new JwglClient(); assert.throws(() => client.url('https://evil.example/'), /未配置/);
  const jar = new CookieJar();
  jar.absorb(new Response('', { headers: { 'Set-Cookie': 'JSESSIONID=cas; Path=/tpass' } }), 'https://sso.ujn.edu.cn/tpass/login');
  jar.absorb(new Response('', { headers: { 'Set-Cookie': 'JSESSIONID=school; Path=/jwglxt; Secure' } }), 'https://jwgl.ujn.edu.cn/jwglxt/');
  assert.equal(jar.header('https://jwgl.ujn.edu.cn/jwglxt/x'), 'JSESSIONID=school');
  assert.equal(jar.header('http://jwgl.ujn.edu.cn/jwglxt/x'), '');
  assert.equal(jar.header('https://sso.ujn.edu.cn/jwglxt/x'), '');
  assert.equal(jar.header('https://sso.ujn.edu.cn/tpass-other'), '');
  jar.absorb(new Response('', { headers: { 'Set-Cookie': 'JSESSIONID=gone; Path=/tpass; Max-Age=0' } }), 'https://sso.ujn.edu.cn/tpass/login');
  assert.equal(jar.header('https://sso.ujn.edu.cn/tpass/login'), '');
});
test('school options preserve live labels and codes, exclude disabled/blank/duplicate values', () => {
  const html = '<select id="xqm"><option value="">全部</option><option value="7" selected>新学期 &amp; 测试</option><option value="7">重复</option><option value="16" disabled>停用</option><option value="12"><b>第二</b>&#23398;期</option></select>';
  assert.deepEqual(schoolOptions(html, 'xqm'), [{ value: '7', label: '新学期 & 测试', selected: true }, { value: '12', label: '第二学期', selected: false }]);
  assert.match(safeFileName('../bad\n:name.xls'), /^_bad__name.xls$/);
});
test('missing account options is an explicit error, never fabricated from current year', async () => {
  const school = await createMockSchool({ periods: {} }); const client = new JwglClient({ base: school.base, allowedOrigins: [school.base] });
  try { await client.loginDirect('20230001', 'correct-horse'); await assert.rejects(client.getAvailablePeriods(), /尚未返回/); }
  finally { client.dispose(); await school.close(); }
});
test('student-specific options support only the authenticated account returned years and arbitrary school semester code', async () => {
  const school = await createMockSchool({ periods: { '2022': [{ value: '7', label: '实践学期' }] } }); const client = new JwglClient({ base: school.base, allowedOrigins: [school.base] });
  try { await client.loginDirect('20230001', 'correct-horse'); const periods = await client.getAvailablePeriods(); assert.deepEqual(periods.years.map(y => y.value), ['2022']); assert.equal(periods.term, '7'); await assert.rejects(client.getAvailablePeriods({ year: '2025' }), /尚未返回|不在/); }
  finally { client.dispose(); await school.close(); }
});
