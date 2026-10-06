/*
 * Adapted from WHHWWHHWWHHWWHHW/zongce-calculator (Apache-2.0).
 * https://github.com/WHHWWHHWWHHWWHHW/zongce-calculator
 * Modified by 济南大学校园通, 2026-09-07: extracted pure calculations,
 * input validation and quoted CSV/TSV parsing. See NOTICE.txt / LICENSE.txt.
 */
(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  if (root) root.UJNGuideZongceCore = core;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const REVIEW_FIELDS = [
    { id: 'zhengzhi', label: '政治素养', max: 10, keywords: ['政治素养', '政治'] },
    { id: 'pinde', label: '品德修养', max: 10, keywords: ['品德修养'] },
    { id: 'jilv', label: '纪律观念', max: 5, keywords: ['纪律观念', '纪律'] },
    { id: 'chengxin', label: '诚信评价', max: 5, keywords: ['诚信评价', '诚信'] },
  ];
  const FIELDS = [
    { id: 'gpa', label: '平均学分绩点', keywords: ['学分绩点', '平均学分绩点', '绩点', 'gpa', '学业水平评价', '学业水平', '学业成绩'] },
    { id: 'ketang', label: '第二课堂积分', keywords: ['第二课堂'] },
    { id: 'gongyi', label: '公益劳动次数', integer: true, keywords: ['公益劳动', '公益'] },
    { id: 'tice', label: '体质健康测试成绩', keywords: ['体质健康', '体测', '体育测试'] },
    { id: 'sushe', label: '宿舍检查平均成绩', max: 100, keywords: ['宿舍'] },
    { id: 'nengli', label: '能力分', max: 50, keywords: ['能力分', '能力得分'] },
    { id: 'quality', label: '综合素质评价总分', max: 100, keywords: ['综合素质评价总分', '综合素质评价成绩', '综合素质总分'] },
    ...REVIEW_FIELDS.map(field => ({ ...field, review: true })),
  ];
  const IMPORT_TEMPLATE = '学分绩点\t3.6524\n第二课堂\t2.5\n公益劳动\t4\n体测成绩\t85\n宿舍成绩\t92\n能力分\t38\n政治素养\t9, 8.5, 10, 7, 9.5, 8, 9, 10, 6.5, 8\n品德修养\t9.5\n纪律观念\t4.5\n诚信评价\t5';

  function round4(value) { return Math.round((value + Number.EPSILON) * 10000) / 10000; }

  function readValue(field, raw) {
    if (raw === '' || raw === undefined || raw === null) return 0;
    const value = Number(raw);
    if (!Number.isFinite(value) || String(raw).trim() === '') throw new Error('请输入有效数字。');
    if (value < 0 || (field.max !== undefined && value > field.max)) {
      throw new Error(field.max === undefined ? '不能小于 0。' : `请输入 0–${field.max} 之间的分数。`);
    }
    if (field.integer && !Number.isInteger(value)) throw new Error('请输入非负整数次数。');
    return value;
  }

  function reviewScores(field, raw) {
    if (!String(raw || '').trim()) return [];
    const tokens = Array.isArray(raw) ? raw : String(raw).trim().split(/[,，;；\s]+/).filter(Boolean);
    return tokens.map(token => readValue(field, token));
  }

  function reviewMean(scores) {
    if (!scores.length) return 0;
    const sorted = [...scores].sort((a, b) => a - b);
    const trim = Math.min(Math.round(sorted.length * .1), Math.floor((sorted.length - 1) / 2));
    const kept = sorted.slice(trim, sorted.length - trim);
    return kept.reduce((sum, value) => sum + value, 0) / kept.length;
  }

  function activeFields(mode) { return FIELDS.filter(field => mode === 'direct' ? ['gpa', 'quality'].includes(field.id) : field.id !== 'quality'); }

  function calculate(raw, mode = 'detail') {
    const values = {};
    for (const field of activeFields(mode)) {
      values[field.id] = field.review && Array.isArray(raw[field.id])
        ? reviewMean(reviewScores(field, raw[field.id])) : readValue(field, raw[field.id]);
    }
    const review = mode === 'direct' ? null : REVIEW_FIELDS.reduce((sum, field) => sum + values[field.id], 0);
    const ability = mode === 'direct' ? null
      : Math.min(values.ketang * .5, 5) + Math.min(values.gongyi * .5, 5)
        + (values.tice >= 60 ? 5 : 0) + (values.sushe >= 60 ? 5 : 0) + values.nengli;
    const quality = mode === 'direct' ? values.quality : review + ability;
    const academicPart = values.gpa * .75;
    const qualityPart = quality / 20 * .25;
    return { gpa: values.gpa, review, ability, quality, academicPart, qualityPart, total: round4(academicPart + qualityPart) };
  }

  function weightedGpa(courses) {
    let credits = 0;
    let weighted = 0;
    for (const course of courses) {
      if (course.credit === '' && course.grade === '') continue;
      if (course.credit === '' || course.grade === '') throw new Error('请补齐每门课程的学分和绩点。');
      const credit = readValue({}, course.credit);
      const grade = readValue({}, course.grade);
      if (credit <= 0) throw new Error('课程学分必须大于 0。');
      credits += credit;
      weighted += credit * grade;
    }
    if (!Number.isFinite(credits) || !Number.isFinite(weighted)) throw new Error('课程数值过大，请检查输入。');
    return credits ? round4(weighted / credits) : null;
  }

  function matchField(label) {
    const normalized = String(label).toLowerCase().replace(/[（(].*?[)）]/g, '').replace(/[:：\s]/g, '');
    let result = null;
    let longest = 0;
    for (const field of FIELDS) for (const keyword of field.keywords) {
      if (normalized.includes(keyword) && keyword.length > longest) { result = field; longest = keyword.length; }
    }
    return result;
  }

  function parseRows(raw) {
    const text = String(raw).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    if (text.length > 2 * 1024 * 1024) throw new Error('表格过大，请控制在 2 MB 以内。');
    const delimiter = text.split('\n').find(line => line.trim())?.includes('\t') ? '\t' : ',';
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (char === '"') {
        if (quoted && text[index + 1] === '"') { cell += '"'; index++; }
        else if (quoted || !cell.trim()) quoted = !quoted;
        else cell += char;
      } else if (!quoted && (char === delimiter || char === '\n')) {
        row.push(cell.trim()); cell = '';
        if (char === '\n') { if (row.some(Boolean)) rows.push(row); row = []; }
      } else cell += char;
    }
    if (quoted) throw new Error('表格中有未闭合的引号，请检查 CSV 格式。');
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
    return rows;
  }

  function parseImport(text) {
    const rows = parseRows(text);
    const horizontal = rows.length === 2 && rows[0].filter(label => matchField(label)).length >= 2;
    if (horizontal && rows[0].length !== rows[1].length) throw new Error('表头与数据列数不一致，请检查表格。');
    const pairs = horizontal ? rows[0].map((label, index) => [label, rows[1][index]])
      : rows.filter(row => row.length >= 2).map(row => [row[0], row.slice(1).join(',')]);
    const entries = {};
    for (const [label, raw] of pairs) {
      const field = matchField(label);
      if (!field || !raw.trim()) continue;
      if (entries[field.id]) throw new Error(`「${field.label}」重复出现，请保留一项。`);
      try {
        const scores = field.review ? reviewScores(field, raw) : null;
        entries[field.id] = scores && scores.length > 1 ? { value: scores, list: true }
          : { value: readValue(field, scores ? scores[0] : raw), list: false };
      } catch (error) { throw new Error(`「${field.label}」${error.message}`); }
    }
    if (!Object.keys(entries).length) throw new Error('未识别到有效成绩，请检查字段名和表格格式。');
    const hasDetails = Object.keys(entries).some(id => id !== 'gpa' && id !== 'quality');
    const mode = hasDetails || !entries.quality ? 'detail' : 'direct';
    return { entries, mode, missing: activeFields(mode).filter(field => !entries[field.id]), ignoredTotal: hasDetails && Boolean(entries.quality) };
  }

  return { FIELDS, REVIEW_FIELDS, IMPORT_TEMPLATE, round4, readValue, reviewScores, reviewMean, activeFields, calculate, weightedGpa, parseImport };
}));
