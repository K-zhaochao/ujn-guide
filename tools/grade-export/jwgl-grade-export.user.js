// ==UserScript==
// @name         济大教务 · 成绩一键导出
// @namespace    https://ujn.matehub.top/
// @version      1.0.0
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

  run.addEventListener('click', async () => {
    const year = panel.querySelector('#ujn-export-year').value;
    const term = panel.querySelector('#ujn-export-term').value;
    const page = readPageParams();
    run.disabled = true;
    say('正在请求教务系统…');

    try {
      const xnm = optionValue('#xnm', year) || page.xnm || year;
      const xqm = optionValue('#xqm', term) || page.xqm || term;

      const body = new URLSearchParams({
        gnmkdmKey: page.gnmkdm,
        xnm,
        xqm,
        'exportModel.selectCol': '',
        'exportModel.exportWjgs': 'xls',
        fileName: '成绩单',
      });
      if (page.dcclbh) body.set('dcclbh', page.dcclbh);

      // 带上 ?gnmkdm=<菜单码>：正方系统的功能请求一般都需要它
      const url = `/jwglxt/cjcx/cjcx_dcXsKccjList.html?gnmkdm=${encodeURIComponent(page.gnmkdm)}`;
      console.log('[成绩导出] 请求', url, Object.fromEntries(body));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: body.toString(),
        credentials: 'same-origin',
      });

      const type = response.headers.get('Content-Type') || '';
      if (!response.ok) throw new Error(`HTTP ${response.status}（${type || '无 Content-Type'}）`);

      if (type.includes('text/html')) {
        // 把服务端原话打出来——上一版只说「多半是会话过期」，等于没说，无从下手
        const text = await response.text();
        const hint = (text.match(/<div[^>]*id=["']tips["'][^>]*>([\s\S]*?)<\/div>/i) || [])[1]
          || (text.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]
          || text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
        console.warn('[成绩导出] 服务端返回了网页，前 1500 字：', text.slice(0, 1500));
        throw new Error('返回的是网页而不是表格。服务端提示：'
          + String(hint).replace(/\s+/g, ' ').trim().slice(0, 160));
      }

      const disposition = response.headers.get('Content-Disposition') || '';
      const matched = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
      const name = safeName(decodeURIComponent(matched ? matched[1] : ''));

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = name.endsWith('.xls') ? name : name + '.xls';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
      say('已导出 ' + link.download + '（' + Math.round(blob.size / 1024) + ' KB）', 'ok');
    } catch (error) {
      say('导出失败：' + error.message, 'error');
      console.error('[成绩导出]', error);
    } finally {
      run.disabled = false;
    }
  });

  console.log('[成绩导出] 面板已就绪：右下角「📊 导出成绩」');
})();
