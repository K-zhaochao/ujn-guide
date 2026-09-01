import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const views = require('../../docs/pets/pet-views.js');

const C = {
  bg: '#fff', fg: '#374151', fgDark: '#1f2937', border: '#e5e7eb', soft: '#f3f4f6',
  imgBg: '#f3f4f6', muted: '#9ca3af', faint: '#b0b4bb', primary: '#3b82f6',
  gradA: '#fdf2f8', gradB: '#fff7ed', overlay: 'rgba(0,0,0,.55)', chipBg: '#fff',
  avatarBg: '#e5e7eb', danger: '#ef4444', dangerBg: '#fee2e2', success: '#22c55e',
  inputBg: '#fff',
};

function makeViews(overrides) {
  return views.createPetViews(Object.assign({
    C,
    catEmoji: { 猫猫: '🐱' },
    CATEGORIES: [
      { id: 1, key: '猫猫', emoji: '🐱', metadata: { groupUrl: 'https://t.me/x', groupIcon: '💬', groupLabel: '加入群聊' } },
      { id: 2, key: '狗狗', emoji: '🐶' },
    ],
    SUBMISSION_TYPES: [
      { id: 1, key: '猫猫', code: 'cat', emoji: '🐱' },
      { id: 2, key: '狗狗', code: 'dog', emoji: '🐶' },
    ],
    contentSchema: {
      schemaVersion: 'v1',
      types: [
        { id: 1, code: 'cat', name: '猫猫', icon: '🐱' },
        { id: 2, code: 'dog', name: '狗狗', icon: '🐶' },
      ],
      fields: [
        { id: 'f1', key: 'location', label: '常出没地点', dataType: 'location', sortOrder: 10 },
        { id: 'f2', key: 'temper', label: '性格', dataType: 'select', options: [{ code: 'gentle', label: '温顺' }], sortOrder: 20 },
        { id: 'f3', key: 'note', label: '备注', dataType: 'textarea', sortOrder: 30, required: true },
      ],
      bindings: [
        { typeId: 1, fieldId: 'f1', sortOrder: 1 },
        { typeId: 1, fieldId: 'f2', sortOrder: 2 },
        { typeId: 1, fieldId: 'f3', sortOrder: 3 },
      ],
      constraints: { maxImages: 5, maxImageBytes: 5 * 1024 * 1024 },
    },
    fieldKey: f => (f && (f.key || f.fieldKey)) || '',
    fieldIcon: () => '•',
    fieldDisplayValue: (f, v) => (v == null ? '' : String(v)),
    publicFieldEntries: () => [],
    petEmoji: p => (p && p.type && p.type.icon) || '🐾',
    paginationPages: (total, current) => {
      const pages = [1, total];
      for (let p = current - 2; p <= current + 2; p++) if (p >= 1 && p <= total) pages.push(p);
      return [...new Set(pages)].sort((a, b) => a - b);
    },
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]),
    formatDate: iso => (iso ? String(iso).slice(0, 10) : ''),
    formatDateTime: iso => (iso ? String(iso).slice(0, 16).replace('T', ' ') : ''),
    humanizeDuration: ms => (ms ? ms + 'ms' : ''),
    resolveImage: url => url || '',
    displayName: u => (u && (u.nickname || u.username)) || '匿名',
    imageLimitLabel: () => '5 MB',
  }, overrides || {}));
}

describe('宠物前端渲染层', () => {
  it('公开宠物卡片：名称、点赞徽章、投稿人、无障碍语义', () => {
    const v = makeViews();
    const html = v.petCardHtml({
      id: 'pet_1', name: '小白', category: '猫猫', type: { name: '猫猫', icon: '🐱' },
      images: ['https://a.com/x.jpg'], likeCount: 3, liked: true,
      contributor: { username: 'alice', profileUrl: 'https://github.com/alice' },
    });
    expect(html).toContain('data-id="pet_1"');
    expect(html).toContain('role="button"');
    expect(html).toContain('aria-label="查看 小白 详情"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('❤️');
    expect(html).toContain('@alice');
    expect(html).toContain('https://github.com/alice');
  });

  it('公开宠物卡片：未命名、无图、未点赞的兜底展示', () => {
    const v = makeViews();
    const html = v.petCardHtml({ id: 'pet_2', category: '狗', likeCount: 0 });
    expect(html).toContain('未命名宠物');
    expect(html).toContain('🤍');
    expect(html).toContain('🐾');
    expect(html).toContain('data-id="pet_2"');
  });

  it('卡片 XSS 防护：名称 / 投稿人内容被转义', () => {
    const v = makeViews();
    const html = v.petCardHtml({ id: 'pet_3', name: '<img src=x onerror=alert(1)>', category: '猫猫' });
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img');
  });

  it('图鉴整体：按分类分组、群聊链接、空态、单页计数', () => {
    const v = makeViews();
    const html = v.galleryHtml({
      allPets: [
        { id: 'a', name: 'A', category: '猫猫', type: { name: '猫猫' } },
        { id: 'b', name: 'B', category: '猫猫', type: { name: '猫猫' } },
      ],
      searchQuery: '', currentPage: 1, totalPages: 1, totalCount: 2,
    });
    expect(html).toContain('猫猫');
    expect(html).toContain('2 只');
    expect(html).toContain('加入群聊');
    expect(html).toContain('https://t.me/x');
    expect(html).toContain('共 2 只 · 第 1/1 页');
    // 分页条始终显示：单页也渲染 上一页/下一页 + 每页数量下拉
    expect(html).toContain('🐾 上一页');
    expect(html).toContain('下一页 🐾');
    expect(html).toContain('每页');

    const empty = v.galleryHtml({ allPets: [], searchQuery: '不存在', currentPage: 1, totalPages: 1, totalCount: 0 });
    expect(empty).toContain('未找到相关宠物 🔍');
  });

  it('图鉴分页：多页渲染上一页 / 数字 / 下一页与页码统计', () => {
    const v = makeViews();
    const html = v.galleryHtml({
      allPets: [{ id: 'a', name: 'A', category: '猫猫', type: { name: '猫猫' } }],
      searchQuery: '', currentPage: 2, totalPages: 5, totalCount: 97,
    });
    expect(html).toContain('🐾 上一页');
    expect(html).toContain('下一页 🐾');
    expect(html).toContain('共 97 只 · 第 2/5 页');
    expect(html).toContain('data-page="5"');
    expect(html).toContain('pet-pager-size');
  });

  it('我的收藏：复用公开卡片，使用独立分页类名与空状态', () => {
    const v = makeViews();
    const html = v.likedPetsHtml({
      pets: [{ id: 'liked_1', name: '收藏宠物', category: '猫猫', type: { name: '猫猫' } }],
      currentPage: 2, totalPages: 3, totalCount: 25,
    });
    expect(html).toContain('data-id="liked_1"');
    expect(html).toContain('pet-liked-page-btn');
    expect(html).not.toContain('class="pet-page-btn"');
    expect(html).toContain('共 25 只 · 第 2/3 页');
    expect(v.likedPetsHtml({ pets: [], totalCount: 0 })).toContain('还没有收藏');
  });

  it('详情弹窗：字段行、投稿人、时间、点赞按钮与灯箱缩略图', () => {
    const v = makeViews({
      publicFieldEntries: p => [
        { field: { key: 'location', label: '常出没地点' }, value: '图书馆' },
      ],
    });
    const html = v.detailModalHtml({
      id: 'pet_9', name: '大白', category: '猫猫', type: { name: '猫猫', icon: '🐱' },
      images: ['https://a.com/1.jpg', 'https://a.com/2.jpg'],
      likeCount: 5, liked: false,
      contributor: { username: 'bob', nickname: '阿波', avatarUrl: 'https://a.com/av.png' },
      createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-05T00:00:00Z',
    });
    expect(html).toContain('大白');
    expect(html).toContain('常出没地点');
    expect(html).toContain('图书馆');
    expect(html).toContain('@阿波');
    expect(html).toContain('投稿于');
    expect(html).toContain('更新于');
    expect(html).toContain('id="pet-detail-main"');
    expect(html).toContain('data-detail-img="1"');
    expect(html).toContain('id="pet-like-btn"');
    expect(html).toContain('🤍</span><span>5');
  });

  it('动态字段：select 单选 / 多选 / 必填 / 只读 / textarea 全行', () => {
    const v = makeViews();
    const select = v.dynamicFieldHtml(
      { key: 'temper', label: '性格', dataType: 'select', required: true, options: [{ code: 'gentle', label: '温顺' }] },
      'gentle', 'pet-field-'
    );
    expect(select).toContain('data-field-key="temper"');
    expect(select).toContain('required');
    expect(select).toContain('<option value="gentle" selected>温顺</option>');
    expect(select).toContain('*');

    const multiselect = v.dynamicFieldHtml(
      { key: 'tags', label: '标签', dataType: 'multiselect', options: [{ code: 'a', label: 'A' }, { code: 'b', label: 'B' }] },
      ['a', 'b'], 'pet-field-'
    );
    expect(multiselect).toContain('multiple size="4"');
    expect(multiselect).toContain('grid-column:1 / -1');

    const readonly = v.dynamicFieldHtml(
      { key: 'old', label: '旧字段', dataType: 'text', readOnly: true }, '保留值', 'pet-field-'
    );
    expect(readonly).toContain('disabled aria-readonly="true"');
    expect(readonly).toContain('该字段当前不可编辑');

    const textarea = v.dynamicFieldHtml({ key: 'note', label: '备注', dataType: 'textarea' }, '内容', 'pet-field-');
    expect(textarea).toContain('<textarea');
    expect(textarea).toContain('grid-column:1 / -1');
  });

  it('投稿字段区：过滤 name 字段，空类型给出提示', () => {
    const v = makeViews();
    const html = v.renderSubmitFieldsHtml(1, { location: '图书馆' });
    expect(html).toContain('data-field-key="location"');
    expect(html).not.toContain('data-field-key="name"');
    const empty = v.renderSubmitFieldsHtml(2, {});
    expect(empty).toContain('该类型暂无其他需填写字段');
  });

  it('我的投稿：状态徽章、操作按钮按 availableActions 渲染、删除禁用语义', () => {
    const v = makeViews();
    // 徽章文字与底色：四种状态都应有可见的浅色底（浅色/深色主题由 CSS 变量适配）
    const approved = v.mineStatusMeta('approved');
    expect(approved).toMatchObject({ label: '✅ 已通过', color: 'var(--pet-approved-fg,#22c55e)' });
    expect(approved.bg).toBe('var(--pet-approved-bg,#dcfce7)');
    const rejected = v.mineStatusMeta('rejected');
    expect(rejected).toMatchObject({ label: '❌ 已拒绝', color: 'var(--pet-rejected-fg,#ef4444)', bg: 'var(--pet-rejected-bg,#fee2e2)' });
    const deletedMeta = v.mineStatusMeta('deleted');
    expect(deletedMeta).toMatchObject({ label: '🗑️ 已删除' });
    expect(deletedMeta.bg).toBe('var(--pet-muted-bg,#f3f4f6)');
    const pending = v.mineStatusMeta('pending');
    expect(pending).toMatchObject({ label: '⏳ 待审核' });
    expect(pending.bg).toBe('var(--pet-pending-bg,#fef3c7)');
    expect(pending.color).toBe('var(--pet-pending-fg,#92400e)');

    const row = v.mineRowHtml({
      id: 'pet_10', name: '小黄', status: 'approved', category: '猫猫',
      type: { name: '猫猫' }, shortId: 'abc123', createdAt: '2026-08-01T00:00:00Z',
      availableActions: ['view', 'edit', 'delete'],
    });
    expect(row).toContain('✅ 已通过');
    expect(row).not.toContain('pet-view-btn');
    expect(row).toContain('class="pet-edit-btn"');
    expect(row).toContain('class="pet-del-btn"');
    expect(row).not.toContain('pet-restore-btn');
    expect(row).not.toContain('pet-history-btn');

    const pendingRevision = v.mineRowHtml({
      id: 'pet_10', name: '小黄', status: 'approved', category: '猫猫',
      pendingRevisionCount: 2, latestRevision: { id: 'rev_1' }, availableActions: ['edit'],
    });
    expect(pendingRevision).toContain('📝 修改待审核');
    expect(pendingRevision).toContain('2 条候选修改正在待审核');
    expect(pendingRevision).toContain('图鉴仍显示当前公开版本');
    expect(pendingRevision).toContain('查看待审修改');

    const revisionHistory = v.mineRowHtml({
      id: 'pet_12', status: 'approved', latestRevision: { id: 'rev_2' }, availableActions: [],
    });
    expect(revisionHistory).toContain('查看修改记录');

    const rejectedRevision = v.mineRowHtml({
      id: 'pet_13', name: '小黑', status: 'approved', category: '猫猫',
      latestRevision: { id: 'rev_rejected', status: 'rejected', reviewReason: '请补充清晰的发现地点', canWithdraw: true, rowVersion: 3 }, availableActions: ['edit'],
    });
    expect(rejectedRevision).toContain('修改审核未通过');
    expect(rejectedRevision).toContain('请补充清晰的发现地点');
    expect(rejectedRevision).not.toContain('pet-revision-review-btn');
    expect(rejectedRevision).toContain('class="pet-rejected-revision-edit-btn"');
    expect(rejectedRevision).toContain('class="pet-rejected-revision-withdraw"');
    expect(rejectedRevision).toContain('data-revision="rev_rejected"');
    expect(rejectedRevision).toContain('按意见重新修改');
    expect(rejectedRevision).toContain('撤回修改');

    const deleted = v.mineRowHtml({
      id: 'pet_11', status: 'deleted', createdAt: '2026-08-01T00:00:00Z',
      availableActions: ['restore'],
    });
    expect(deleted).toContain('🗑️ 已删除');
    expect(deleted).not.toContain('class="pet-restore-btn"');
    expect(deleted).toContain('未命名宠物');
  });

  it('我的投稿分页：边界页与省略号', () => {
    const v = makeViews();
    const html = v.minePaginationNumbersHtml(5, 8);
    expect(html).toContain('data-page="1"');
    expect(html).toContain('data-page="8"');
    expect(html).toContain('…');
    const single = v.minePaginationNumbersHtml(1, 1);
    expect(single).toContain('data-page="1"');
    expect(single).not.toContain('…');
  });

  it('我的投稿历史与修订：时间线、字段差异、撤回按钮', () => {
    const v = makeViews();
    const history = v.mineHistoryHtml([
      { label: '创建投稿', detail: '首次提交', createdAt: '2026-08-01T00:00:00Z', actor: 'alice' },
    ]);
    expect(history).toContain('创建投稿');
    expect(history).toContain('首次提交');
    expect(history).toContain('alice');
    expect(v.mineHistoryHtml([])).toContain('暂无历史记录');

    const revisions = v.mineRevisionsHtml([
      {
        id: 'rev_1', status: 'pending', createdAt: '2026-08-02T00:00:00Z',
        diff: { changes: [{ key: 'location', from: '旧地点', to: '新地点' }], imagesChanged: true },
        canWithdraw: true, rowVersion: 3,
      },
    ], 'pet_12');
    expect(revisions).toContain('待审核');
    expect(revisions).toContain('旧地点');
    expect(revisions).toContain('新地点');
    expect(revisions).toContain('图片顺序或内容已修改');
    expect(revisions).toContain('class="pet-revision-withdraw"');
    expect(revisions).toContain('data-submission="pet_12"');
    expect(v.mineRevisionsHtml([], 'pet_12')).toContain('暂无公开修订记录');
    expect(v.revisionValue(null)).toBe('未填写');
    expect(v.revisionValue('x')).toBe('x');
    expect(v.revisionValue({ a: 1 })).toBe('{"a":1}');
  });

  it('类型字段绑定：按 sortOrder 排序、过滤归档字段', () => {
    const v = makeViews();
    const fields = v.schemaFieldsForType(1);
    expect(fields.map(f => f.key)).toEqual(['location', 'temper', 'note']);
    expect(fields[2].required).toBe(true);
    expect(v.schemaFieldsForType(999)).toEqual([]);
  });

  it('我的投稿类型标签与图标：对象类型优先，字符串回退，未知分类兜底', () => {
    const v = makeViews();
    expect(v.mineTypeLabel({ type: { name: '猫猫', code: 'cat' } })).toBe('猫猫');
    expect(v.mineTypeLabel({ type: { code: 'cat' } })).toBe('cat');
    expect(v.mineTypeLabel({ category: '狗狗' })).toBe('狗狗');
    expect(v.mineTypeLabel({})).toBe('未分类');

    expect(v.mineTypeIcon({ type: { icon: '🦁' } })).toBe('🦁');
    expect(v.mineTypeIcon({ category: '猫猫' })).toBe('🐱');
    expect(v.mineTypeIcon({})).toBe('🐾');
  });
});
