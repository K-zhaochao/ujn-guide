/*
 * Adapted from WHHWWHHWWHHWWHHW/zongce-calculator (Apache-2.0).
 * https://github.com/WHHWWHHWWHHWWHHW/zongce-calculator
 * Modified by 济南大学校园通, 2026-09-07: scoped event handling,
 * accessible validation, local file import and MkDocs instant navigation.
 * See NOTICE.txt / LICENSE.txt. No scores are stored or transmitted.
 */
(function () {
  'use strict';
  const core = window.UJNGuideZongceCore;
  if (!core) return;
  const mounted = new WeakSet();

  function mount(root) {
    if (!root || mounted.has(root)) return;
    mounted.add(root);
    const query = selector => root.querySelector(selector);
    const all = selector => [...root.querySelectorAll(selector)];
    const form = query('[data-zc-form]');
    let courseId = 0;
    let fileReadVersion = 0;
    let importing = false;
    let missingImported = new Set();

    query('[data-zc-reviews]').innerHTML = core.REVIEW_FIELDS.map(field => `
      <div class="zc-review-item">
        <label for="zc-${field.id}">${field.label} <span class="zc-max">/ ${field.max} 分</span></label>
        <select data-zc-review-mode="${field.id}" aria-label="${field.label}填写方式">
          <option value="direct">直接得分</option><option value="list">评议名单</option>
        </select>
        <input type="number" id="zc-${field.id}" data-zc-field="${field.id}" min="0" max="${field.max}" step="any" inputmode="decimal" placeholder="0–${field.max}" aria-describedby="zc-error-${field.id}">
        <textarea id="zc-${field.id}-list" data-zc-list="${field.id}" rows="3" aria-label="${field.label}评议分数" aria-describedby="zc-preview-${field.id} zc-error-${field.id}" placeholder="用逗号、空格或换行分隔" hidden></textarea>
        <p class="zc-help zc-review-preview" id="zc-preview-${field.id}" hidden></p>
        <p class="zc-error" id="zc-error-${field.id}" hidden></p>
      </div>`).join('');

    function qualityMode() { return query('[name="zc-quality-mode"]:checked').value; }
    function fieldControl(field) {
      return field.review && query(`[data-zc-review-mode="${field.id}"]`).value === 'list'
        ? query(`[data-zc-list="${field.id}"]`) : query(`[data-zc-field="${field.id}"]`);
    }

    function render() {
      const mode = qualityMode();
      query('[data-zc-quality-direct]').hidden = mode !== 'direct';
      query('[data-zc-quality-detail]').hidden = mode !== 'detail';
      all('[data-zc-detail-result]').forEach(element => { element.hidden = mode !== 'detail'; });
      all('.zc-error').forEach(element => { element.hidden = true; });
      all('[aria-invalid]').forEach(element => { element.removeAttribute('aria-invalid'); });
      for (const field of core.REVIEW_FIELDS) {
        const list = query(`[data-zc-review-mode="${field.id}"]`).value === 'list';
        query(`#zc-${field.id}`).hidden = list;
        query(`#zc-${field.id}-list`).hidden = !list;
        query(`#zc-preview-${field.id}`).hidden = !list;
        query(`label[for="zc-${field.id}${list ? '' : '-list'}"]`)?.setAttribute('for', `zc-${field.id}${list ? '-list' : ''}`);
      }
      let filled = false;
      const errors = [];
      const values = {};
      for (const field of core.activeFields(mode)) {
        const control = fieldControl(field);
        const raw = control.value.trim();
        if (raw) filled = true;
        try {
          if (control.validity?.badInput) throw new Error('请输入有效数字。');
          if (control.hasAttribute('data-zc-list')) {
            values[field.id] = core.reviewScores(field, raw);
            const count = values[field.id].length;
            query(`#zc-preview-${field.id}`).textContent = count
              ? `共 ${count} 人，去极值后均分 ${core.reviewMean(values[field.id]).toFixed(4)}` : '填入评议分数后自动计算均分';
          } else values[field.id] = core.readValue(field, raw);
          if (raw) missingImported.delete(field.id);
          if (missingImported.has(field.id)) {
            const hint = query(`#zc-error-${field.id}`);
            hint.textContent = '表格未提供，请补填（当前按 0 试算）。';
            hint.hidden = false;
          }
        } catch (error) {
          errors.push(`${field.label}：${error.message}`);
          control.setAttribute('aria-invalid', 'true');
          const hint = query(`#zc-error-${field.id}`);
          hint.textContent = error.message;
          hint.hidden = false;
          if (field.review) query(`#zc-preview-${field.id}`).textContent = '';
        }
      }
      const result = errors.length || !filled ? null : core.calculate(values, mode);
      const display = value => value === undefined || value === null ? '—' : value.toFixed(4);
      query('[data-zc-total]').textContent = display(result?.total);
      query('[data-zc-academic-part]').textContent = display(result?.academicPart);
      query('[data-zc-quality-part]').textContent = display(result?.qualityPart);
      query('[data-zc-gpa-total]').textContent = display(result?.gpa);
      query('[data-zc-quality-total]').textContent = display(result?.quality);
      query('[data-zc-review-total]').textContent = display(result?.review);
      query('[data-zc-ability-total]').textContent = display(result?.ability);
      query('.zc-result').dataset.invalid = String(errors.length > 0);
      query('[data-zc-result-state]').textContent = errors.length ? '请先修正标红的输入，再查看结果。'
        : filled ? '实时试算 · 请核对各项成绩' : '填写成绩后自动计算';
    }

    function updateCourses() {
      let value = null;
      try {
        const courses = all('[data-zc-course]').map(row => {
          const inputs = [...row.querySelectorAll('input[type="number"]')];
          if (inputs.some(input => input.validity.badInput)) throw new Error('课程学分和绩点必须为有效数字。');
          return { credit: inputs[0].value, grade: inputs[1].value };
        });
        value = core.weightedGpa(courses);
        query('[data-zc-gpa-help]').textContent = `加权平均 GPA：${value === null ? '—' : value.toFixed(4)}`;
      } catch (error) { query('[data-zc-gpa-help]').textContent = error.message; }
      query('[data-zc-action="apply-gpa"]').disabled = value === null;
      return value;
    }

    function addCourse() {
      courseId++;
      const row = document.createElement('div');
      row.className = 'zc-course-row';
      row.dataset.zcCourse = '';
      row.innerHTML = `<input type="text" aria-label="课程 ${courseId} 名称（可选）" placeholder="课程名称">
        <input type="number" min="0" step="any" inputmode="decimal" aria-label="课程 ${courseId} 学分" placeholder="学分">
        <input type="number" min="0" step="any" inputmode="decimal" aria-label="课程 ${courseId} 绩点" placeholder="绩点">
        <button class="zc-button" type="button" data-zc-action="remove-course" aria-label="删除课程 ${courseId}">移除</button>`;
      query('[data-zc-courses]').appendChild(row);
      updateCourses();
    }

    function importStatus(message, error = false) {
      query('[data-zc-import-status]').textContent = message;
      query('[data-zc-import-status]').dataset.error = String(error);
    }

    function applyImport(text) {
      let parsed;
      try { parsed = core.parseImport(text); }
      catch (error) { importStatus(`${error.message} 当前成绩未修改。`, true); return; }
      all('[data-zc-field], [data-zc-list]').forEach(control => { control.value = ''; });
      all('[data-zc-review-mode]').forEach(control => { control.value = 'direct'; });
      query(`[name="zc-quality-mode"][value="${parsed.mode}"]`).checked = true;
      for (const field of core.FIELDS) {
        const entry = parsed.entries[field.id];
        if (!entry) continue;
        if (entry.list) {
          query(`[data-zc-review-mode="${field.id}"]`).value = 'list';
          query(`[data-zc-list="${field.id}"]`).value = entry.value.join(', ');
        } else query(`[data-zc-field="${field.id}"]`).value = String(entry.value);
      }
      missingImported = new Set(parsed.missing.map(field => field.id));
      query('[data-zc-courses]').replaceChildren();
      addCourse();
      render();
      const used = core.activeFields(parsed.mode).filter(field => parsed.entries[field.id]);
      const messages = [`已填入 ${used.length} 项：${used.map(field => field.label).join('、')}。`];
      if (parsed.missing.length) messages.push(`待补填：${parsed.missing.map(field => field.label).join('、')}。`);
      if (parsed.ignoredTotal) messages.push('检测到细项，已按细则计算；表格中的综合素质总分不参与本次试算。');
      importStatus(messages.join('\n'));
    }

    function readFile(file) {
      const version = ++fileReadVersion;
      if (!file) return;
      if (!/\.(csv|txt|tsv)$/i.test(file.name)) { importStatus('请选择 CSV、TXT 或 TSV 文件；XLSX 请先另存为 CSV。', true); return; }
      if (file.size > 2 * 1024 * 1024) { importStatus('文件过大，请控制在 2 MB 以内。', true); return; }
      const reader = new FileReader();
      importing = true;
      importStatus('正在本地读取文件…');
      reader.onload = () => {
        if (version !== fileReadVersion || !root.isConnected) return;
        importing = false;
        query('#zc-import-text').value = String(reader.result);
        applyImport(String(reader.result));
      };
      reader.onerror = () => {
        if (version !== fileReadVersion || !root.isConnected) return;
        importing = false;
        importStatus('文件读取失败，请改用复制粘贴方式。', true);
      };
      reader.readAsText(file, 'UTF-8');
    }

    function invalidatePendingFile() {
      fileReadVersion++;
      if (importing) { importing = false; importStatus('已取消文件读取，保留当前输入。'); }
    }

    root.addEventListener('input', event => {
      invalidatePendingFile();
      if (event.target.closest('[data-zc-course]')) updateCourses();
      if (event.target.matches('[data-zc-field], [data-zc-list]')) render();
    });
    root.addEventListener('change', event => {
      if (event.target.id === 'zc-import-file') readFile(event.target.files[0]);
      else if (event.target.matches('[name="zc-quality-mode"], [data-zc-review-mode]')) { invalidatePendingFile(); render(); }
    });
    root.addEventListener('click', event => {
      const button = event.target.closest('[data-zc-action]');
      if (!button || !root.contains(button)) return;
      const action = button.dataset.zcAction;
      invalidatePendingFile();
      if (action === 'add-course') addCourse();
      else if (action === 'remove-course') { button.closest('[data-zc-course]').remove(); updateCourses(); }
      else if (action === 'apply-gpa') {
        const value = updateCourses();
        if (value !== null) { query('#zc-gpa').value = value.toFixed(4); render(); }
      } else if (action === 'sample') { query('#zc-import-text').value = core.IMPORT_TEMPLATE; importStatus('示例已填入，点击「读取并填入」即可试算。'); }
      else if (action === 'import') applyImport(query('#zc-import-text').value);
      else if (action === 'reset') {
        form.reset(); missingImported.clear(); importStatus('');
        query('[data-zc-courses]').replaceChildren(); addCourse(); render();
      }
    });
    form.addEventListener('submit', event => { event.preventDefault(); render(); });
    addCourse(); render();
    form.hidden = false;
    const loading = query('[data-zc-loading]');
    if (loading) loading.hidden = true;
  }

  function boot() { document.querySelectorAll('[data-zc-calculator]').forEach(mount); }
  if (typeof document$ !== 'undefined' && document$.subscribe) document$.subscribe(boot);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}());
