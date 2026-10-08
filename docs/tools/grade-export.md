---
title: 教务成绩导出
hide:
  - toc
---

# 📊 教务成绩导出

在学校官网登录，回到这里选择范围，由教务系统直接下载 Excel 成绩单。

<div id="grade-export-tool" class="grade-export">
  <ol class="grade-export__steps" aria-label="导出步骤"><li data-grade-step="login" aria-current="step">1 · 官网登录</li><li data-grade-step="export">2 · 本站导出</li></ol>
  <section data-grade-login aria-label="前往官网登录">
    <p class="grade-export__lead">账号密码只在学校官网填写</p>
    <p class="grade-export__hint">在同一浏览器打开教务系统，登录并进入「成绩查询」，然后回到本页。</p>
    <div class="grade-export__actions"><a class="md-button md-button--primary" href="http://jwgl.ujn.edu.cn/sso/driotlogin" target="_blank" rel="noopener noreferrer" data-grade-official>打开教务官网 ↗</a><button class="md-button" type="button" data-grade-continue>我已登录，继续</button></div>
  </section>
  <form id="grade-export-form" action="https://jwgl.ujn.edu.cn/jwglxt/zftal/drdc/export_exportConfig.html?gnmkdm=N305005&amp;layout=default" method="post" target="_blank" rel="noopener noreferrer" accept-charset="UTF-8" hidden>
    <div class="grade-export__session"><span>使用此浏览器中的教务登录状态</span><button type="button" data-grade-reset>重新登录 / 切换账号</button></div>
    <div class="grade-export__grid">
      <label for="grade-year">学年起始年份<input id="grade-year" name="xnm" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required placeholder="例如：2025 对应 2025—2026 学年" autocomplete="off"></label>
      <label><span id="grade-term-label">学期</span><div class="grade-select" data-grade-select="term"><input name="xqm" type="hidden"><button class="grade-select__trigger" type="button" role="combobox" aria-labelledby="grade-term-label" aria-expanded="false" aria-haspopup="listbox" aria-controls="grade-term-options"><span data-grade-value>请选择学期</span><span class="grade-select__arrow" aria-hidden="true"></span></button><ul class="grade-select__menu" id="grade-term-options" role="listbox" aria-labelledby="grade-term-label" hidden></ul></div></label>
    </div>
    <p class="grade-export__hint" data-grade-options-note>按官网成绩查询页填写；这里不会自动读取账号的学年和学期。</p>
    <details class="grade-export__import"><summary>从官网查询页面读取选项（可选）</summary><p>先在官网选择所需学年，再将成绩查询页面保存为 HTML 文件，选择该文件即可读取其中的学年、学期选项。文件仅在当前浏览器处理。</p><label for="grade-page-file">选择查询页面<input id="grade-page-file" type="file" accept=".html,.htm,text/html" data-grade-import></label><p class="grade-export__hint">如果保存的文件没有查询下拉框，直接按官网手动填写即可。</p></details>
    <div data-grade-fields></div>
    <div class="grade-export__actions"><button class="md-button md-button--primary" type="submit" disabled>向学校提交并下载 Excel</button><a href="https://jwgl.ujn.edu.cn/jwglxt/cjcx/cjcx_cxDgXscj.html?gnmkdm=N305005&amp;layout=default" target="_blank" rel="noopener noreferrer">打开官网成绩查询 ↗</a></div>
  </form>
  <p class="grade-export__status" data-grade-status role="status" aria-live="polite">先在官网登录，再回到本页继续。</p>
  <p class="grade-export__note">本站不接收账号密码。提交后请查看新打开的学校页面及浏览器下载列表；若出现登录页或错误页，请在官网重新登录，或使用官网的导出按钮。</p>
</div>

<noscript>启用 JavaScript 后可在本站选择导出范围；也可打开学校官网直接查询和导出。</noscript>
