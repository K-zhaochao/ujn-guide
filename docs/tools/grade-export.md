---
title: 教务成绩导出
hide:
  - toc
---

# 📊 教务成绩导出

在本站登录教务系统，选择账号可查询的学年、学期，下载 Excel 成绩单。

<form id="grade-export-form" class="grade-export" autocomplete="off">
  <ol class="grade-export__steps" aria-label="导出步骤"><li data-grade-step="login" aria-current="step">1 · 登录教务</li><li data-grade-step="export">2 · 选择并导出</li></ol>
  <section data-grade-login aria-label="登录教务系统">
    <div class="grade-export__grid">
      <label for="grade-user">学号 / 统一认证账号<input id="grade-user" name="user" type="text" required maxlength="64" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="输入自己的账号" disabled></label>
      <label for="grade-password">密码<input id="grade-password" aria-label="密码" name="password" type="password" required maxlength="256" autocomplete="off" placeholder="输入登录密码" disabled><button type="button" class="grade-export__password-toggle" data-grade-password-toggle aria-controls="grade-password" aria-pressed="false">显示密码</button></label>
      <label><span id="grade-mode-label">登录方式</span>
        <div class="grade-select" data-grade-select="mode"><input name="mode" type="hidden" value="sso"><button class="grade-select__trigger" type="button" role="combobox" aria-labelledby="grade-mode-label" aria-expanded="false" aria-haspopup="listbox" aria-controls="grade-mode-options" disabled><span data-grade-value>统一身份认证（学校入口）</span><span class="grade-select__arrow" aria-hidden="true"></span></button><ul class="grade-select__menu" id="grade-mode-options" role="listbox" aria-labelledby="grade-mode-label" hidden></ul></div>
      </label>
    </div>
    <p class="grade-export__hint">使用学校账号登录后，选择学年和学期。</p>
  </section>
  <section data-grade-export hidden aria-label="选择成绩导出范围">
    <div class="grade-export__session"><span data-grade-account></span><button type="button" data-grade-logout>退出 / 切换账号</button></div>
    <div class="grade-export__grid">
      <label><span id="grade-year-label">学年</span>
        <div class="grade-select" data-grade-select="year"><input name="year" type="hidden"><button class="grade-select__trigger" type="button" role="combobox" aria-labelledby="grade-year-label" aria-expanded="false" aria-haspopup="listbox" aria-controls="grade-year-options" disabled><span data-grade-value>登录后读取学年</span><span class="grade-select__arrow" aria-hidden="true"></span></button><ul class="grade-select__menu" id="grade-year-options" role="listbox" aria-labelledby="grade-year-label" hidden></ul></div>
      </label>
      <label><span id="grade-term-label">学期</span>
        <div class="grade-select" data-grade-select="term"><input name="term" type="hidden"><button class="grade-select__trigger" type="button" role="combobox" aria-labelledby="grade-term-label" aria-expanded="false" aria-haspopup="listbox" aria-controls="grade-term-options" disabled><span data-grade-value>登录后读取学期</span><span class="grade-select__arrow" aria-hidden="true"></span></button><ul class="grade-select__menu" id="grade-term-options" role="listbox" aria-labelledby="grade-term-label" hidden></ul></div>
      </label>
    </div>
    <p class="grade-export__hint">仅显示当前账号可查询的学年和学期。</p>
  </section>
  <div class="grade-export__actions"><button class="md-button md-button--primary" type="submit" disabled>登录并读取可查询学期</button><button class="md-button" type="button" data-grade-cancel hidden>取消操作</button></div>
  <button type="button" class="md-button grade-export__retry" data-grade-retry hidden>重新连接</button>
  <p class="grade-export__status" data-grade-status role="status" aria-live="polite">正在检查导出服务…</p>
  <p class="grade-export__note">密码提交后立即清空；登录会话 10 分钟后自动退出。成绩单仅下载到自己的设备。</p>
</form>

<noscript>启用 JavaScript 后可使用本站登录与成绩导出。</noscript>
