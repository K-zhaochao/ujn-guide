---
title: 综测计算器
description: 济南大学综测计算器，支持 GPA 加权计算、综合素质细项和 Excel/WPS 表格导入。基于校友 WHHWWHHWWHHWWHHW 的开源作品适配，成绩仅在浏览器本地计算。
tags:
  - 绿皮书
  - 综测
  - 计算器
hide:
  - toc
---

# 🧮 综合测评成绩计算器

<!-- Adapted from WHHWWHHWWHHWWHHW/zongce-calculator (Apache-2.0).
     Modified by 济南大学校园通, 2026-09-07: native MkDocs interface,
     accessible forms, scoped styles, validation and instant navigation.
     See ../../assets/zongce-calculator/NOTICE.txt and LICENSE.txt. -->

<div class="zc-calculator" markdown>

<div class="zc-intro" markdown>

填入绩点与综合素质成绩，实时查看综测结果。由济大校友 **WHHWWHHWWHHWWHHW** 开源贡献，本站适配展示。

[:fontawesome-brands-github: 原作者开源仓库 ↗](https://github.com/WHHWWHHWWHHWWHHW/zongce-calculator){ .md-button .zc-repo-button target="_blank" rel="noopener noreferrer" }

<div class="zc-badges"><span>浏览器本地计算</span><span>成绩不上传</span><span>无需登录</span></div>

</div>

<p class="zc-note">依据《济南大学本科学生综合测评办法》第九～十一条规则计算，并参考原作者实现进行试算。能力分请填写按本学院细则审核后的得分，最终成绩以学院、教务处公布结果为准。</p>

</div>

<!-- Keep the form in its own raw HTML block: nested md_in_html blocks can
     otherwise turn indented controls into code. Links above/below stay Markdown. -->
<div class="zc-calculator" data-zc-calculator markdown="0">

<p data-zc-loading role="status">正在准备计算器…</p>
<noscript><p>请开启浏览器 JavaScript 后使用计算功能。也可先查阅上方综测办法和原作者仓库。</p></noscript>

<!-- zc:form:start -->
<form class="zc-form" data-zc-form aria-label="综合测评计算" novalidate hidden markdown="0">
  <div class="zc-layout">
    <div class="zc-fields">
      <details class="zc-disclosure zc-import">
        <summary>从表格导入 <span class="zc-summary-hint">可选 · Excel / WPS</span></summary>
        <div class="zc-disclosure-content">
          <p class="zc-help">从 Excel / WPS 复制表格粘贴到下方，或读取 CSV、TXT、TSV 文件。读取会替换当前成绩，表格缺失的项目会清空并提示补填。</p>
          <label for="zc-import-text">粘贴表格内容</label>
          <textarea id="zc-import-text" rows="5" placeholder="学分绩点&#9;3.6524&#10;第二课堂&#9;2.5&#10;公益劳动&#9;4&#10;体测成绩&#9;85&#10;宿舍成绩&#9;92&#10;能力分&#9;38" spellcheck="false"></textarea>
          <div class="zc-actions">
            <button type="button" class="zc-button zc-button-primary" data-zc-action="import">读取并填入</button>
            <button type="button" class="zc-button" data-zc-action="sample">填入示例模板</button>
          </div>
          <label class="zc-file-label" for="zc-import-file">或读取本地文件</label>
          <input type="file" id="zc-import-file" accept=".csv,.txt,.tsv" aria-describedby="zc-file-help">
          <p class="zc-help" id="zc-file-help">文件只在当前浏览器读取。XLSX 请先另存为 CSV，或直接复制单元格粘贴。</p>
          <details class="zc-disclosure zc-format-help">
            <summary>支持哪些表格格式？</summary>
            <div class="zc-disclosure-content zc-help">
              <p>支持「每行一个项目：字段名 + 数值」的两列表格，也支持「表头一行 + 数据一行」的横向表格。字段名支持学分绩点 / GPA、第二课堂、公益劳动、体测、宿舍、能力分、综合素质总分、政治素养、品德修养、纪律观念和诚信评价。</p>
              <p>思想品德四项可填一个得分，也可在同一单元格内填一组评议分数，用逗号、空格或换行分隔。导入综合素质总分时自动切换为直接输入；包含细项时优先按细则计算。</p>
            </div>
          </details>
          <p class="zc-import-status" data-zc-import-status role="status" aria-live="polite"></p>
        </div>
      </details>

      <section class="zc-card" aria-labelledby="zc-academic-title">
        <div class="zc-section-heading"><h2 id="zc-academic-title"><span class="zc-step">01</span> 学业水平</h2><span class="zc-weight">占总分 75%</span></div>
        <div class="zc-field">
          <label for="zc-gpa">平均学分绩点（GPA）</label>
          <input type="number" id="zc-gpa" data-zc-field="gpa" min="0" step="any" inputmode="decimal" placeholder="例如 3.6524" aria-describedby="zc-gpa-help zc-error-gpa">
          <p class="zc-help" id="zc-gpa-help">以教务处提供的平均学分绩点为准。</p>
          <p class="zc-error" id="zc-error-gpa" hidden></p>
        </div>
        <details class="zc-disclosure">
          <summary>按课程学分计算 GPA</summary>
          <div class="zc-disclosure-content">
            <p class="zc-help">输入各课程的学分与对应绩点，计算加权平均值；课程绩点的换算以教务处规则为准。</p>
            <div class="zc-course-head" aria-hidden="true"><span>课程名称（可选）</span><span>学分</span><span>绩点</span><span></span></div>
            <div data-zc-courses></div>
            <button type="button" class="zc-button" data-zc-action="add-course">＋ 添加课程</button>
            <p class="zc-help" data-zc-gpa-help role="status">加权平均 GPA：—</p>
            <button type="button" class="zc-button" data-zc-action="apply-gpa" disabled>应用到 GPA</button>
          </div>
        </details>
      </section>

      <section class="zc-card" aria-labelledby="zc-quality-title">
        <div class="zc-section-heading"><h2 id="zc-quality-title"><span class="zc-step">02</span> 综合素质</h2><span class="zc-weight">折算后占 25%</span></div>
        <fieldset class="zc-mode">
          <legend class="zc-sr-only">综合素质填写方式</legend>
          <label><input type="radio" name="zc-quality-mode" value="detail" checked><span>按细则计算</span></label>
          <label><input type="radio" name="zc-quality-mode" value="direct"><span>直接输入总分</span></label>
        </fieldset>

        <div data-zc-quality-direct hidden>
          <div class="zc-field">
            <label for="zc-quality">综合素质评价总分</label>
            <input type="number" id="zc-quality" data-zc-field="quality" min="0" max="100" step="any" inputmode="decimal" placeholder="0–100" aria-describedby="zc-quality-help zc-error-quality">
            <p class="zc-help" id="zc-quality-help">已有学院核定总分时，可直接填入，满分 100 分。</p>
            <p class="zc-error" id="zc-error-quality" hidden></p>
          </div>
        </div>

        <div data-zc-quality-detail>
          <h3>思想品德行为习惯 <span class="zc-max">/ 30 分</span></h3>
          <p class="zc-help">填写最终得分，或切换为评议名单：分别去掉 10% 最高分和最低分（人数四舍五入），再取平均。</p>
          <div class="zc-review-grid" data-zc-reviews></div>
          <h3>综合能力表现 <span class="zc-max">/ 70 分</span></h3>
          <p class="zc-help">基础分 20 分 + 能力分 50 分，各项不超过对应满分。</p>
          <div class="zc-input-grid">
            <div class="zc-field">
              <label for="zc-ketang">第二课堂积分</label>
              <input type="number" id="zc-ketang" data-zc-field="ketang" min="0" step="any" inputmode="decimal" placeholder="例如 2.5" aria-describedby="zc-ketang-help zc-error-ketang">
              <p class="zc-help" id="zc-ketang-help">每 0.5 积分计 0.25 分，最高 5 分。</p>
              <p class="zc-error" id="zc-error-ketang" hidden></p>
            </div>
            <div class="zc-field">
              <label for="zc-gongyi">公益劳动次数</label>
              <input type="number" id="zc-gongyi" data-zc-field="gongyi" min="0" step="1" inputmode="numeric" placeholder="例如 4" aria-describedby="zc-gongyi-help zc-error-gongyi">
              <p class="zc-help" id="zc-gongyi-help">每次计 0.5 分，最高 5 分。</p>
              <p class="zc-error" id="zc-error-gongyi" hidden></p>
            </div>
            <div class="zc-field">
              <label for="zc-tice">体质健康测试成绩</label>
              <input type="number" id="zc-tice" data-zc-field="tice" min="0" step="any" inputmode="decimal" placeholder="例如 85" aria-describedby="zc-tice-help zc-error-tice">
              <p class="zc-help" id="zc-tice-help">达到 60 分计 5 分，否则计 0 分。</p>
              <p class="zc-error" id="zc-error-tice" hidden></p>
            </div>
            <div class="zc-field">
              <label for="zc-sushe">宿舍检查平均成绩</label>
              <input type="number" id="zc-sushe" data-zc-field="sushe" min="0" max="100" step="any" inputmode="decimal" placeholder="例如 92" aria-describedby="zc-sushe-help zc-error-sushe">
              <p class="zc-help" id="zc-sushe-help">达到 60 分计 5 分，否则计 0 分。</p>
              <p class="zc-error" id="zc-error-sushe" hidden></p>
            </div>
          </div>
          <div class="zc-field zc-ability">
            <label for="zc-nengli">能力分（自主申报审核）</label>
            <input type="number" id="zc-nengli" data-zc-field="nengli" min="0" max="50" step="any" inputmode="decimal" placeholder="0–50" aria-describedby="zc-nengli-help zc-error-nengli">
            <p class="zc-help" id="zc-nengli-help">填写按本学院细则核定的得分，涵盖评优、社会工作、实践、创新创业、文体活动等。</p>
            <p class="zc-error" id="zc-error-nengli" hidden></p>
          </div>
        </div>
      </section>
    </div>

    <aside class="zc-result" aria-labelledby="zc-result-title">
      <p class="zc-result-eyebrow" id="zc-result-title">综合测评试算结果</p>
      <div class="zc-total" role="status" aria-live="polite" aria-atomic="true"><span class="zc-sr-only">综合测评成绩：</span><output data-zc-total>—</output></div>
      <p class="zc-result-state" data-zc-result-state>填写成绩后自动计算</p>
      <div class="zc-contributions"><span>学业贡献 <strong data-zc-academic-part>—</strong></span><span>素质贡献 <strong data-zc-quality-part>—</strong></span></div>
      <dl class="zc-breakdown">
        <div><dt>平均学分绩点</dt><dd data-zc-gpa-total>—</dd></div>
        <div><dt>综合素质评价</dt><dd><span data-zc-quality-total>—</span> <small>/ 100</small></dd></div>
        <div data-zc-detail-result><dt>思想品德行为习惯</dt><dd><span data-zc-review-total>—</span> <small>/ 30</small></dd></div>
        <div data-zc-detail-result><dt>综合能力表现</dt><dd><span data-zc-ability-total>—</span> <small>/ 70</small></dd></div>
      </dl>
      <p class="zc-formula">GPA × 75%<br>＋ 综合素质评价 ÷ 20 × 25%</p>
      <p class="zc-help">结果保留 4 位小数。未填写的项目按 0 分试算；请补齐后核对。</p>
      <button type="button" class="zc-button zc-reset" data-zc-action="reset">清空重填</button>
    </aside>
  </div>
</form>
<!-- zc:form:end -->

</div>

<div class="zc-calculator" markdown>

<details class="zc-disclosure zc-support" markdown>
<summary>支持工具原作者</summary>
<div class="zc-disclosure-content" markdown>

感谢校友整理综测细则并开源这份工具。如果它帮你节省了时间，可以通过原作者提供的赞赏码支持维护。此处支持的是**计算器原作者**。

![计算器原作者提供的赞赏码](../../assets/zongce-calculator/author-support.jpg){ .zc-support-image loading="lazy" width="240" }

[访问原作者仓库](https://github.com/WHHWWHHWWHHWWHHW/zongce-calculator){ target="_blank" rel="noopener noreferrer" }

</div>
</details>

<p class="zc-license" markdown>
原作以 [Apache-2.0](../../assets/zongce-calculator/LICENSE.txt) 开源。本站适配了布局、主题、输入校验与导航；详见[来源与修改说明](../../assets/zongce-calculator/NOTICE.txt)。刷新或离开页面会清除本次输入。
</p>

</div>
