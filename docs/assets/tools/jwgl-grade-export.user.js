// ==UserScript==
// @name         济大教务 · 成绩一键导出
// @namespace    https://ujn.matehub.top/
// @version      1.3.0
// @description  在教务系统页面右下角加一个「导出成绩」小面板，一键把本人成绩导出成 Excel。不接触账号密码。
// @author       济南大学校园通（参考由一位不愿意透露信息的学长提供）
// @match        *://*.ujn.edu.cn/*
// @match        *://jwglxt*/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/* 工作原理
 * ========
 * 脚本运行在**教务系统自己的页面**里，所以：
 *   - 用的是你当前的登录会话（Cookie），不需要、也不会向你要账号密码；
 *   - 数据流向是「学校服务器 → 你的浏览器 → 你的下载目录」，没有第三方经手。
 * 唯一做的事：向教务系统自己的导出接口 POST 一次，把返回的表格存成文件。
 * 接口与参数来自那份说明文档的第 3 节（导出实现）。
 */
(function () {
  'use strict';

  const TERMS = [
    { label: '第一学期', value: '3' },
    { label: '第二学期', value: '12' },
    { label: '短学期', value: '16' },
  ];
  const CURRENT_YEAR = String(new Date().getFullYear());
  const YEARS = [CURRENT_YEAR, String(Number(CURRENT_YEAR) - 1), String(Number(CURRENT_YEAR) - 2)];

  const style = document.createElement('style');
  style.textContent = `
    #ujn-export-panel{position:fixed;right:18px;bottom:18px;z-index:2147483000;
      font:13px/1.5 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#1f2937}
    #ujn-export-panel *{box-sizing:border-box}
    #ujn-export-toggle{display:flex;align-items:center;gap:6px;padding:10px 14px;border:0;border-radius:999px;
      background:#4051b5;color:#fff;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 6px 20px rgba(64,81,181,.35)}
    #ujn-export-toggle:hover{background:#34429b}
    #ujn-export-body{display:none;width:260px;margin-top:10px;padding:14px;border-radius:12px;background:#fff;
      box-shadow:0 12px 32px rgba(15,23,42,.24)}
    #ujn-export-panel[data-open="1"] #ujn-export-body{display:block}
    #ujn-export-body h3{margin:0 0 4px;font-size:14px}
    #ujn-export-body p{margin:0 0 10px;font-size:12px;color:#64748b}
    #ujn-export-body label{display:block;margin:8px 0 3px;font-size:12px;color:#475569}
    #ujn-export-body select{width:100%;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;font-size:13px}
    #ujn-export-run{width:100%;margin-top:12px;padding:9px 0;border:0;border-radius:8px;background:#4051b5;color:#fff;
      font-size:13px;font-weight:600;cursor:pointer}
    #ujn-export-run:disabled{opacity:.6;cursor:progress}
    #ujn-export-status{margin-top:8px;font-size:12px;color:#64748b;word-break:break-all}
    #ujn-export-status[data-kind="error"]{color:#dc2626}
    #ujn-export-status[data-kind="ok"]{color:#16a34a}
  `;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.id = 'ujn-export-panel';
  panel.innerHTML = `
    <button id="ujn-export-toggle" type="button">📊 导出成绩</button>
    <div id="ujn-export-body">
      <h3>导出本人成绩</h3>
      <p>用的就是你当前的登录会话，不需要账号密码。</p>
      <label for="ujn-export-year">学年</label>
      <select id="ujn-export-year">${YEARS.map(y => `<option value="${y}">${y}-${Number(y) + 1}</option>`).join('')}</select>
      <label for="ujn-export-term">学期</label>
      <select id="ujn-export-term">${TERMS.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}</select>
      <button id="ujn-export-run" type="button">开始导出</button>
      <div id="ujn-export-status">准备好后点上面的按钮</div>
    </div>`;
  document.body.appendChild(panel);

  const toggle = panel.querySelector('#ujn-export-toggle');
  const run = panel.querySelector('#ujn-export-run');
  const status = panel.querySelector('#ujn-export-status');

  const say = (text, kind) => {
    status.textContent = text;
    if (kind) status.setAttribute('data-kind', kind); else status.removeAttribute('data-kind');
  };

  toggle.addEventListener('click', () => {
    panel.setAttribute('data-open', panel.getAttribute('data-open') === '1' ? '0' : '1');
  });

  /** 把后端给的文件名清洗成各系统都能保存的样子。 */
  function safeName(name) {
    const cleaned = (name || '').replace(/[\\/:*?"<>|]/g, '_').trim();
    return cleaned || `ujn-grades-${Date.now()}.xls`;
  }

  /**
   * 直接从**当前页面**读真实参数，而不是硬编码。
   *
   * 教训：第一版照着说明文档写死了 gnmkdmKey=N305005 / dcclbh=JW_N305005_GLY，
   * 在真实系统上导出接口返回的是一个 HTML 页面（而不是表格）——因为每套正方系统的
   * 导出模板号（dcclbh）可能不同，而且**功能请求通常要带 ?gnmkdm=<菜单码>**，
   * 不带就可能被重定向到错误页。现在：能从页面读到就用页面的值，读不到才退回默认。
   */
  function readPageParams() {
    const value = (selector) => {
      const el = document.querySelector(selector);
      return el && typeof el.value === 'string' ? el.value.trim() : '';
    };
    const hidden = (name) => value(`input[name="${name}"]`);
    const menuFromUrl = (location.search.match(/[?&]gnmkdm=([^&]+)/) || [])[1] || '';
    return {
      gnmkdm: hidden('gnmkdm') || menuFromUrl || 'N305005',
      xnm: value('#xnm') || hidden('xnm'),
      xqm: value('#xqm') || hidden('xqm'),
      dcclbh: hidden('dcclbh') || value('#dcclbh'),
    };
  }

  /** 从下拉框里挑出与目标值匹配的选项（学年可能写成 "2024" 或 "2024-2025"）。 */
  function optionValue(selector, wanted) {
    const select = document.querySelector(selector);
    if (!select || !wanted) return '';
    const options = Array.from(select.options || []);
    const hit = options.find((option) => option.value === wanted)
      || options.find((option) => option.textContent.trim().startsWith(String(wanted).slice(0, 4)));
    return hit ? hit.value : '';
  }

  /**
   * 找**学校自己的导出按钮**。
   *
   * 为什么优先用它：v1.1 自己拼参数请求导出接口时，真实系统返回的是通用错误页
   * （「出错啦！」= 某个参数被服务端判为非法）。各校各版本的 dcclbh / 导出列 /
   * xnm 取值形式都不同，**猜不如不猜**——让学校自己的代码去发这个请求，永远一致。
   * 找不到按钮时才退回自己构造请求（v1.1 的逻辑，保留作兜底）。
   */
  function findNativeExport() {
    const nodes = Array.from(document.querySelectorAll('a, button, input[type="button"], input[type="submit"]'));
    const byText = nodes.find((el) => (el.textContent || el.value || '').replace(/\s+/g, '').includes('导出'));
    if (byText) return byText;
    return document.querySelector('a[href*="dcXsKccj"], a[href*="dcKccj"], a[onclick*="dcXsKccj"]');
  }

  /** 把页面的学年/学期下拉框同步成面板里的选择（学校按钮会读它们）。 */
  function syncPageFilters(year, term) {
    const set = (selector, wanted) => {
      const select = document.querySelector(selector);
      if (!select || !wanted) return;
      const options = Array.from(select.options || []);
      const hit = options.find((option) => option.value === String(wanted))
        || options.find((option) => option.textContent.trim().startsWith(String(wanted).slice(0, 4)));
      if (!hit) return;
      select.value = hit.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('#xnm', year);
    set('#xqm', term);
  }

  /**
   * 真正的导出流程 —— 照学校页面 export.js 的 doExport() 复刻，参数全部来自页面源码：
   *   - 接口：POST /jwglxt/zftal/drdc/export_exportConfig.html
   *     （之前请求的 cjcx_dcXsKccjList.html 是错的，服务端于是回通用错误页「出错啦！」）
   *   - 模板号 dcclbh = JW_N305005_XSCXCJ（学生成绩；JW_N305005_GLY 是管理员模板）
   *   - 内容 = 页面筛选表单（学年/学期…）+ 多个 exportModel.selectCol（格式「字段@列名」）
   *     + exportModel.exportWjgs=xls + fileName，最后**提交整个表单**
   * 照这套拼一个隐藏表单直接提交：浏览器会像点了它自己的「导出」一样下载，
   * 但不需要人去点那个「自定义导出」弹窗。
   */
  var EXPORT_ACTION = "/jwglxt/zftal/drdc/export_exportConfig.html";
  var EXPORT_DCCLBH = "JW_N305005_XSCXCJ";
  var DEFAULT_COLUMNS = [
    "xnmmc@学年", "xqmmc@学期", "kch@课程代码", "kcmc@课程名称", "kcxzmc@课程性质",
    "xf@学分", "cjbz@成绩备注", "jd@绩点", "ksxz@成绩性质", "sfxwkc@是否学位课程",
    "kkbmmc@开课学院", "kcbj@课程标记", "kclbmc@课程类别", "kcgsmc@课程归属",
    "jxbmc@教学班", "jsxm@任课教师", "khfsmc@考核方式", "xh@学号", "xm@姓名",
    "xsbjmc@学生标记", "cj@成绩", "cjsfzf@是否成绩作废", "xfjd@学分绩点",
  ];

  /** 页面上承载筛选条件的表单（就是含学年/学期下拉框的那个）。 */
  function findFilterForm() {
    const xnm = document.querySelector("#xnm");
    if (xnm && xnm.form) return xnm.form;
    return Array.from(document.querySelectorAll("form")).find(
      (form) => form.querySelector('[name="xnm"], #xnm, [name="xqm"], #xqm'),
    ) || null;
  }

  /** 组装导出表单：克隆页面筛选条件 + 追加导出参数。 */
  function buildExportForm(xnm, xqm) {
    const form = document.createElement("form");
    form.method = "post";
    form.action = EXPORT_ACTION;
    form.style.display = "none";

    const filterForm = findFilterForm();
    if (filterForm) {
      filterForm.querySelectorAll("input[name], select[name], textarea[name]").forEach((field) => {
        if (["button", "submit", "reset", "image"].includes(field.type)) return;
        if ((field.type === "checkbox" || field.type === "radio") && !field.checked) return;
        const hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.name = field.name;
        hidden.value = field.value;
        form.appendChild(hidden);
      });
    }

    const add = (name, value) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };
    if (xnm) add("xnm", xnm);
    if (xqm) add("xqm", xqm);
    add("dcclbh", EXPORT_DCCLBH);
    add("pxfs", "0");
    DEFAULT_COLUMNS.forEach((column) => add("exportModel.selectCol", column));
    add("exportModel.exportWjgs", "xls");
    add("fileName", "成绩单");
    return form;
  }

  run.addEventListener('click', async () => {
    const year = panel.querySelector('#ujn-export-year').value;
    const term = panel.querySelector('#ujn-export-term').value;
    const page = readPageParams();
    run.disabled = true;
    say('正在导出…');

    try {
      syncPageFilters(year, term);
      const xnm = optionValue('#xnm', year) || page.xnm || year;
      const xqm = optionValue('#xqm', term) || page.xqm || term;

      const form = buildExportForm(xnm, xqm);
      document.body.appendChild(form);
      console.log('[成绩导出] 提交导出表单', {
        action: form.action,
        字段: Object.fromEntries(new FormData(form).entries()),
        列数: DEFAULT_COLUMNS.length,
      });
      say('已提交导出请求，浏览器应开始下载…', 'ok');
      form.submit();
      setTimeout(() => form.remove(), 5000);
      return;
    } catch (error) {
      console.error('[成绩导出] 组装导出表单失败：', error);
      say('导出失败：' + error.message, 'error');
      const native = findNativeExport();
      if (native) {
        native.click();
        say('已改为打开学校自带的导出弹窗，请在里面点「导出」', 'error');
      }
      run.disabled = false;
      return;
    }
  });

  // 下面是早期版本自己构造请求的路径，保留作最后兜底（排查用，正常不会走到）

  console.log('[成绩导出] 面板已就绪：右下角「📊 导出成绩」');
})();
