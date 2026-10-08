/**
 * 教务成绩导出 —— 地址解析、校内网探测、导出参数（真实值）。
 *
 * 这些常量与规则全部来自**学校页面自己的源码**，不是猜的：
 *   - 导出接口：POST <base>/jwglxt/zftal/drdc/export_exportConfig.html
 *   - 模板号：dcclbh = JW_N305005_XSCXCJ（学生成绩；JW_N305005_GLY 是管理员模板）
 *   - 导出列：exportModel.selectCol，格式「字段@列名」，共 23 列
 *   - 文件类型：exportModel.exportWjgs = xls
 * 之前版本用的是 cjcx_dcXsKccjList.html + 管理员模板，服务端只会回一个通用错误页。
 *
 * 校内/校外两种访问方式：
 *   - 校内直连：https://jwgl.ujn.edu.cn/jwglxt/...
 *   - 校外经 WebVPN：https://webvpn.ujn.edu.cn/http/<一长串十六进制>/jwglxt/...
 *     那段 /http/<token>/ 是每个后端系统各自的入口，**不同账号/会话可能不同**，
 *     所以必须从用户粘贴的地址里解析，不能写死。
 */

/** 导出的接口路径（拼在 base 之后）。 */
export const EXPORT_PATH = 'jwglxt/zftal/drdc/export_exportConfig.html';

/** 学生成绩导出模板号。 */
export const EXPORT_DCCLBH = 'JW_N305005_XSCXCJ';

/** 页面「自定义导出」里默认勾选的列，顺序与页面一致。 */
export const DEFAULT_COLUMNS = [
  'xnmmc@学年', 'xqmmc@学期', 'kch@课程代码', 'kcmc@课程名称', 'kcxzmc@课程性质',
  'xf@学分', 'cjbz@成绩备注', 'jd@绩点', 'ksxz@成绩性质', 'sfxwkc@是否学位课程',
  'kkbmmc@开课学院', 'kcbj@课程标记', 'kclbmc@课程类别', 'kcgsmc@课程归属',
  'jxbmc@教学班', 'jsxm@任课教师', 'khfsmc@考核方式', 'xh@学号', 'xm@姓名',
  'xsbjmc@学生标记', 'cj@成绩', 'cjsfzf@是否成绩作废', 'xfjd@学分绩点',
];

/** 校内直连时优先尝试的地址（第一个通了就用它）。 */
export const CAMPUS_CANDIDATES = [
  'https://jwgl.ujn.edu.cn',
  'http://jwgl.ujn.edu.cn',
  'https://jwglxt.ujn.edu.cn',
];

/** 探测用的轻量页面：能拿到**真正的正方登录页**才算连得上。 */
export const PROBE_PATH = 'jwglxt/xtgl/login_slogin.html';

/**
 * 判断一段 HTML 是否真的是教务系统登录页。
 *
 * 为什么需要它：最初我用"有响应就算通"，结果在一台**明确不在校园网**的机器上
 * 也探测成功了——校外同样可能拿到响应（ISP 的 DNS 劫持、门户跳转页、
 * 或者该域名本身就公网可达）。用它当判据会把校外误判成校内，
 * 于是程序带着错误的地址去登录，报错还指不到原因。
 */
export function looksLikeJwglLogin(html) {
  const text = String(html || '');
  if (!text) return false;
  // 正方登录页的特征：隐藏字段 csrftoken / 用户名输入框 name="yhm" / 登录表单地址
  return /csrftoken/i.test(text) && /name=["']?yhm/i.test(text);
}

/**
 * 解析用户粘贴的地址，得到请求要用的 base 与随地址变化的参数。
 *
 * 兼容三种输入：
 *   - 完整地址：https://webvpn.ujn.edu.cn/http/<hex>/jwglxt/cjcx/cjcx_cxDgXscj.html?gnmkdm=N305005&layout=default
 *   - 只有前缀：https://webvpn.ujn.edu.cn/http/<hex>/
 *   - 只有域名：https://jwgl.ujn.edu.cn
 *
 * @param {string} input 用户粘贴的地址
 * @returns {{ base: string, gnmkdm: string, layout: string, campus: boolean }}
 */
export function parseBaseUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new Error('地址为空');
  let url;
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    throw new Error(`看不懂这个地址：${raw}`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('教务地址必须是没有内嵌账号密码的 HTTP(S) 网址');
  }

  // 一眼假的地址要当场拒绝。
  // 踩过的坑：把说明文字（或别的什么）当地址传进来时，new URL() 会把它当成域名、
  // 转成一串 punycode（xn--…），然后程序带着一个莫名其妙的 base 去请求，
  // 报错信息完全指不到问题。这里要求 hostname 必须像个正常域名。
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname) || /^xn--/i.test(url.hostname)) {
    throw new Error(
      `这不像一个网址：${raw}\n`
      + '请把浏览器地址栏里的完整地址粘进来（以 http:// 或 https:// 开头，例如\n'
      + '  https://jwgl.ujn.edu.cn\n'
      + '  https://webvpn.ujn.edu.cn/http/<一长串字母数字>/jwglxt/cjcx/cjcx_cxDgXscj.html?gnmkdm=N305005）',
    );
  }

  // WebVPN 前缀：/http/<一长串十六进制>（大小写都可能）
  const prefix = (url.pathname.match(/^\/http\/[0-9a-f]+/i) || [])[0] || '';

  return {
    base: url.origin + prefix,
    gnmkdm: url.searchParams.get('gnmkdm') || 'N305005',
    layout: url.searchParams.get('layout') || 'default',
    // 走 WebVPN 的不算校内直连
    campus: !prefix && /\.ujn\.edu\.cn$/i.test(url.hostname) && !/webvpn/i.test(url.hostname),
  };
}

/**
 * 导出接口完整地址（WebVPN 前缀已包含在 base 里）。
 * @param {string} base
 */
export function exportUrl(base) {
  return `${String(base).replace(/\/+$/, '')}/${EXPORT_PATH}`;
}

/**
 * 探测是否真的能直连教务系统：逐个试候选地址，返回第一个**确认是教务系统**的地址。
 *
 * 判据刻意从严：
 *   - HTTP 必须是 200（302 多半是被跳去登录页/门户页，不算）；
 *   - 响应正文必须真的是正方登录页（见 looksLikeJwglLogin）；
 *   - 超时很短（默认 3 秒），不让校外的同学干等。
 * 只有三条都满足才认为"校内直连可用"，否则返回 null → 让用户粘地址。
 *
 * @param {typeof fetch} fetchImpl
 * @param {string[]} [candidates]
 * @param {number} [timeoutMs]
 * @returns {Promise<string|null>}
 */
export async function detectCampusBase(fetchImpl, candidates = CAMPUS_CANDIDATES, timeoutMs = 3000) {
  for (const candidate of candidates) {
    const base = candidate.replace(/\/+$/, '');
    try {
      const response = await fetchImpl(`${base}/${PROBE_PATH}`, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: 'text/html' },
      });
      if (!response || response.status !== 200) continue;
      const html = typeof response.text === 'function' ? await response.text() : '';
      if (looksLikeJwglLogin(html)) return base;
    } catch {
      // 连不上、超时、证书错误……都算不可直连，试下一个
    }
  }
  return null;
}

/**
 * 导出请求的字段 —— 与页面 export.js 的 doExport() 拼出来的完全一致。
 * @param {{ xnm?: string, xqm?: string, gnmkdm?: string, fileName?: string }} [options]
 */
export function exportFields(options = {}) {
  const fields = [];
  if (options.xnm) fields.push(['xnm', options.xnm]);
  if (options.xqm) fields.push(['xqm', options.xqm]);
  if (options.gnmkdm) fields.push(['gnmkdm', options.gnmkdm]);
  fields.push(['dcclbh', EXPORT_DCCLBH]);
  fields.push(['pxfs', '0']);
  for (const column of DEFAULT_COLUMNS) fields.push(['exportModel.selectCol', column]);
  fields.push(['exportModel.exportWjgs', 'xls']);
  fields.push(['fileName', options.fileName || '成绩单']);
  return new URLSearchParams(fields).toString();
}
