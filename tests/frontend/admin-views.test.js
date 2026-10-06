import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const views = require('../../server/public/admin-ui-views.js');
const state = require('../../server/public/admin-ui-state.js');

// 图标表（与 admin-ui.js 的 I 结构对应；测试仅关注图标 key 是否被拼接）
const I = {
  pin: '📍', palette: '🎨', heart: '❤️', note: '📝', alert: '⚠️', check: '✅', x: '✖️',
  restore: '↩️', zap: '⚡', pencil: '✏️', trash: '🗑️', inbox: '📥', users: '👥', lock: '🔒',
  sliders: '⚙️', audit: '📋', image: '🖼️', menu: '☰', home: '🏠', logout: '🚪',
  download: '⬇️', refresh: '🔄', plus: '➕', filter: '🔍', lock_alt: '🔐',
};

function makeViews(overrides) {
  return views.createAdminUiViews(Object.assign({
    I,
    AdminUiState: state,
    LOGO: '/admin/assets/favicon.svg',
    MAIN_SITE: 'https://pets.example.com',
    catEmoji: (c) => (c === '猫猫' ? '🐱' : ''),
    getView: () => 'pending',
    getMe: () => ({ role: 'superadmin', username: 'boss', nickname: '站长', avatarUrl: '' }),
    getCounts: () => ({ pending: 3, approved: 12, rejected: 1, deleted: 0 }),
    isSuper: () => true,
    getSchema: () => ({ types: [], fields: [], bindings: [] }),
    getSettingsHistoryPage: () => 1,
    getAuditCleanupTaskState: () => ({ page: 1, pageSize: 8, total: 20 }),
  }, overrides || {}));
}

describe('管理后台渲染层（admin-ui-views）', () => {
  describe('基础工具', () => {
    it('esc：转义 HTML 特殊字符', () => {
      const v = makeViews();
      expect(v.esc('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#39;');
      expect(v.esc(null)).toBe('');
      expect(v.esc(0)).toBe('0');
    });

    it('fmtTime：数据库 UTC 转北京时间（UTC+8）', () => {
      const v = makeViews();
      // 输入带 Z 后缀的 UTC 时间，任何运行机时区下结果都确定
      expect(v.fmtTime('2026-08-12T03:00:00Z')).toBe('2026-08-12 11:00');
      expect(v.fmtTime('')).toBe('');
    });

    it('resolveImg：外链/协议相对原样，相对路径补前导斜杠', () => {
      const v = makeViews();
      expect(v.resolveImg('https://a.com/x.jpg')).toBe('https://a.com/x.jpg');
      expect(v.resolveImg('data:image/png;base64,AA')).toBe('data:image/png;base64,AA');
      expect(v.resolveImg('../../uploads/x.jpg')).toBe('/uploads/x.jpg');
      expect(v.resolveImg('./uploads/x.jpg')).toBe('/uploads/x.jpg');
      expect(v.resolveImg('')).toBe('');
    });

    it('avatarHtml：有头像输出 img，无头像输出首字符回退', () => {
      const v = makeViews();
      const withAvatar = v.avatarHtml({ avatarUrl: 'https://a.com/a.png' }, 32);
      expect(withAvatar).toContain('<img class="avatar"');
      expect(withAvatar).toContain('src="https://a.com/a.png"');
      const fallback = v.avatarHtml({ username: 'alice' }, 24);
      expect(fallback).toContain('avatar-fallback');
      expect(fallback).toContain('A');
    });

    it('profileLink：有主页时包外链，否则原样', () => {
      const v = makeViews();
      const linked = v.profileLink({ profileUrl: 'https://github.com/x' }, '<b>inner</b>');
      expect(linked).toContain('<a href="https://github.com/x"');
      expect(linked).toContain('<b>inner</b>');
      expect(v.profileLink({}, '<b>inner</b>')).toBe('<b>inner</b>');
    });

    it('imagesHTML：字符串与对象数组均可渲染，并过滤重复地址', () => {
      const v = makeViews();
      const html = v.imagesHTML(['https://a.com/1.jpg', { url: 'https://a.com/1.jpg' }, { url: '/uploads/2.jpg' }]);
      expect(html).toContain('data-lightbox="https://a.com/1.jpg"');
      expect(html).toContain('data-lightbox="/uploads/2.jpg"');
      expect((html.match(/https:\/\/a\.com\/1\.jpg/g) || []).length).toBe(2);
      expect(v.imagesHTML(null)).toContain('images-preview');
    });
  });

  describe('动态字段展示', () => {
    it('adminFieldValueText：select/multiselect code→label，boolean→是/否', () => {
      const v = makeViews();
      const selectField = { dataType: 'select', options: [{ code: 'gentle', label: '温顺' }, { code: 'shy', label: '怕生' }] };
      expect(v.adminFieldValueText(selectField, 'gentle')).toBe('温顺');
      expect(v.adminFieldValueText(selectField, 'unknown')).toBe('unknown');
      const multi = { dataType: 'multiselect', options: [{ code: 'a', label: '甲' }, { code: 'b', label: '乙' }] };
      expect(v.adminFieldValueText(multi, ['a', 'b'])).toBe('甲、乙');
      expect(v.adminFieldValueText({ dataType: 'boolean' }, true)).toBe('是');
      expect(v.adminFieldValueText({ dataType: 'boolean' }, false)).toBe('否');
      expect(v.adminFieldValueText({ dataType: 'text' }, null)).toBe('');
    });

    it('dynamicFieldsHTML：渲染 showInAdmin 的动态字段并跳过固定区字段', () => {
      const schema = {
        types: [{ id: 1, code: 'cat', name: '猫猫', icon: '🐱' }],
        fields: [
          { id: 'f1', key: 'location', label: '常出没地点', dataType: 'text' },
          { id: 'f2', key: 'temper', label: '性格', dataType: 'select', options: [{ code: 'gentle', label: '温顺' }] },
          { id: 'f3', key: 'hidden', label: '隐藏项', dataType: 'text', showInAdmin: false },
        ],
        bindings: [
          { typeId: 1, fieldId: 'f1', sortOrder: 1 },
          { typeId: 1, fieldId: 'f2', sortOrder: 2 },
          { typeId: 1, fieldId: 'f3', sortOrder: 3 },
        ],
      };
      const v = makeViews({ getSchema: () => schema });
      const html = v.dynamicFieldsHTML({ typeId: 1, fields: { temper: 'gentle' } });
      // location 属于固定区跳过；hidden showInAdmin=false 跳过；只有 temper 渲染
      expect(html).toContain('性格');
      expect(html).toContain('温顺');
      expect(html).not.toContain('常出没地点');
      expect(html).not.toContain('隐藏项');
      // 全部为空时返回空字符串
      expect(v.dynamicFieldsHTML({ typeId: 1, fields: {} })).toBe('');
    });

    it('adminSchemaFields：按类型绑定展开字段并应用必填覆盖与排序', () => {
      const v = makeViews();
      const schema = {
        types: [{ id: 1, code: 'cat', name: '猫猫' }],
        fields: [
          { id: 'f1', key: 'loc', label: '地点', dataType: 'text', sortOrder: 30 },
          { id: 'f2', key: 'temper', label: '性格', dataType: 'select', sortOrder: 10 },
        ],
        bindings: [
          { typeId: 1, fieldId: 'f2', sortOrder: 1, requiredOverride: true },
          { typeId: 1, fieldId: 'f1', sortOrder: 2, requiredOverride: false },
        ],
      };
      const fields = v.adminSchemaFields(schema, 1);
      expect(fields.map((f) => f.key)).toEqual(['temper', 'loc']);
      expect(fields[0].required).toBe(true);
      expect(fields[1].required).toBe(false);
      expect(v.adminSchemaFields(schema, 999)).toEqual([]);
    });
  });

  describe('投稿卡片', () => {
    it('subCard：状态徽章、投稿人、图片与批量选择框', () => {
      const v = makeViews();
      const html = v.subCard({
        id: 's1', name: '小白', status: 'pending', category: '猫猫',
        location: '图书馆', appearance: '白毛', personality: '粘人', description: '很乖',
        images: ['https://a.com/x.jpg'],
        contributor: { username: 'alice', avatarUrl: 'https://a.com/a.png' },
        createdAt: '2026-08-12 03:00:00',
      });
      expect(html).toContain('data-check-id="s1"');
      expect(html).toContain('badge pending');
      expect(html).toContain('@alice');
      expect(html).toContain('data-lightbox="https://a.com/x.jpg"');
      expect(html).toContain('#s1');
    });

    it('subActions：pending 显示通过/拒绝，deleted 显示恢复/彻底删除', () => {
      const v = makeViews();
      const pendingActions = v.subActions({ id: 's1', status: 'pending' });
      expect(pendingActions).toContain('data-action="approve"');
      expect(pendingActions).toContain('data-action="reject"');
      const deletedActions = v.subActions({ id: 's2', status: 'deleted' });
      expect(deletedActions).toContain('data-action="restore"');
      expect(deletedActions).toContain('data-action="purge"');
      expect(deletedActions).not.toContain('data-action="approve"');
      const normal = v.subActions({ id: 's3', status: 'approved' });
      expect(normal).toContain('data-action="edit"');
      expect(normal).toContain('data-action="softdelete"');
    });

    it('subActions：普通管理员不可审核 needsSuperadminReview 的投稿', () => {
      const v = makeViews({ isSuper: () => false });
      const html = v.subActions({ id: 's1', status: 'pending', needsSuperadminReview: true });
      expect(html).not.toContain('data-action="approve"');
      expect(html).not.toContain('data-action="reject"');
    });

    it('pendingRevisionQueueHtml：公开稿修改单独进入待审队列，不带批量选择框', () => {
      const v = makeViews();
      const html = v.pendingRevisionQueueHtml([{
        id: 'rev_1', createdAt: '2026-08-12T03:00:00Z', canApprove: true,
        diff: { changes: [{ key: 'name', from: '旧名字', to: '新名字' }], fieldChanges: [], imagesChanged: false },
        candidate: { name: '新名字', category: '猫猫' }, candidateType: { name: '猫猫', icon: '🐱' },
        submission: { id: 'pet_1', name: '旧名字', category: '猫猫' },
        contributor: { username: 'alice', nickname: '', avatarUrl: '' },
      }], { name: '宠物昵称' });
      expect(html).toContain('公开稿修改');
      expect(html).toContain('新名字');
      expect(html).toContain('旧名字');
      expect(html).toContain('宠物昵称');
      expect(html).toContain('查看完整对比并审核');
      expect(html).toContain('data-action="revisions"');
      expect(html).not.toContain('data-check');
      expect(v.pendingRevisionQueueHtml([])).toBe('');
    });

    it('roleBadgeHtml：三种角色徽章', () => {
      const v = makeViews();
      expect(v.roleBadgeHtml('superadmin')).toContain('role-super');
      expect(v.roleBadgeHtml('admin')).toContain('role-admin');
      expect(v.roleBadgeHtml('user')).toContain('badge user');
    });
  });

  describe('分页组件', () => {
    it('paginationHtml：多页输出页码、当前页与每页下拉', () => {
      const v = makeViews();
      const html = v.paginationHtml('pending', 25, 2, 10, '');
      expect(html).toContain('data-nav="pending"');
      expect(html).toContain('page="1"');
      expect(html).toContain('is-active');
      expect(html).toContain('共 25 条');
      expect(html).toContain('第 2 / 3 页');
      expect(html).toContain('pet-pager-size');
      expect(html).toContain('🐾 上一页');
      expect(html).toContain('下一页 🐾');
    });

    it('paginationHtml：空数据也渲染分页条（含每页下拉）', () => {
      const v = makeViews();
      const html = v.paginationHtml('pending', 0, 1, 10, '');
      expect(html).toContain('pager');
      expect(html).toContain('共 0 条');
      expect(html).toContain('第 1 / 1 页');
      expect(html).toContain('pet-pager-size');
    });

    it('pageSizeSelectHtml：按当前值选中并带 data-nav', () => {
      const v = makeViews();
      const html = v.pageSizeSelectHtml('audit', 50, [10, 20, 50, 100]);
      expect(html).toContain('data-nav="audit"');
      expect(html).toContain('value="50" selected');
      expect(html).not.toContain('value="10" selected');
    });
  });

  describe('设置视图', () => {
    it('settingRow：开关行带 data-setting 与选中态', () => {
      const v = makeViews();
      const html = v.settingRow('allowSubmit', '允许投稿', '描述', true);
      expect(html).toContain('data-setting="allowSubmit"');
      expect(html).toContain('checked');
      expect(v.settingRow('allowSubmit', '允许投稿', '描述', false)).not.toContain('checked');
    });

    it('settingNumberRow：数值行受 policy 约束', () => {
      const v = makeViews();
      const html = v.settingNumberRow('maxImages', '最多图片', '描述', 5, { min: 1, max: 9, source: 'database' });
      expect(html).toContain('data-setting-number="maxImages"');
      expect(html).toContain('min="1"');
      expect(html).toContain('max="9"');
      expect(html).toContain('value="5"');
      expect(html).toContain('数据库即时生效');
    });

    it('settingsRuntimeHtml：部署与内容模型状态只读展示', () => {
      const v = makeViews();
      const html = v.settingsRuntimeHtml({
        environment: { mainSiteUrl: 'https://pets.example.com', oauthConfigured: true, lskyConfigured: false, maxImagesPerSubmission: 3 },
        contentModel: { mode: 'direct', updatedAt: '2026-09-07T03:00:00Z' },
      });
      expect(html).toContain('主站 / 后台');
      expect(html).toContain('https://pets.example.com');
      expect(html).toContain('OAuth 已配置');
      expect(html).toContain('图床：未配置');
      expect(html).toContain('配置已生效');
      expect(html).toContain('最近修改');
      expect(html).not.toContain('待发布草稿');
    });

    it('settingsHistoryHtml：修订记录表格与空态', () => {
      const v = makeViews();
      const html = v.settingsHistoryHtml({
        items: [{ revision: 3, changedKeys: ['maxImages'], before: { maxImages: 3 }, after: { maxImages: 5 }, actorUsername: 'boss', createdAt: '2026-08-12 03:00:00' }],
        total: 1, totalPages: 1,
      });
      expect(html).toContain('r3');
      expect(html).toContain('maxImages');
      expect(html).toContain('@boss'.replace('@', '')); // actorUsername 直接展示
      expect(html).toContain('maxImages: 3');
      expect(html).toContain('maxImages: 5');
      expect(v.settingsHistoryHtml({ items: [], total: 0 })).toContain('暂无设置修订记录');
    });

    it('backupExportHtml：可下载任务提供下载按钮，运行中提供取消', () => {
      const v = makeViews();
      const html = v.backupExportHtml([
        { id: 'b1', status: 'ready', sizeBytes: 2 * 1024 * 1024, createdAt: '2026-08-12 03:00:00' },
        { id: 'b2', status: 'running', progress: 40, stage: 'encrypt', createdAt: '2026-08-12 03:00:00' },
      ]);
      expect(html).toContain('data-backup-id="b1"');
      expect(html).toContain('下载');
      expect(html).toContain('data-backup-id="b2"');
      expect(html).toContain('取消');
      expect(html).toContain('2.0 MB');
      expect(html).toContain('40%');
      expect(v.backupExportHtml([])).toContain('暂无备份任务');
    });
  });

  describe('内容模型', () => {
    it('modelStatusBadge：激活/归档样式', () => {
      const v = makeViews();
      expect(v.modelStatusBadge(true, '显示', '隐藏')).toContain('badge approved');
      expect(v.modelStatusBadge(false, '显示', '隐藏')).toContain('badge deleted');
    });

    it('退役的草稿、差异和版本工作台不再导出', () => {
      const v = makeViews();
      for (const name of ['pendingDiffBadge', 'diffTotal', 'diffSummaryChip', 'diffItemRow', 'versionDiffBlocks', 'renderDraftRevisionView']) expect(v[name]).toBeUndefined();
    });

    it('历史只读字段及已移除选项保留显示，不自动赋值', () => {
      const v = makeViews();
      const html = v.adminFieldControl({ key: 'coat', label: '毛色', dataType: 'select', archivedNow: true, options: [{ code: 'white', label: '白色', activeNow: false }] }, 'white');
      expect(html).toContain('disabled');
      expect(html).toContain('白色（已停用）');
      expect(html).toContain('仅保留历史值');
      expect(v.adminFieldControl({ key: 'coat', dataType: 'select', options: [] }, 'lost')).toContain('已移除：lost');
    });

    it('modelCheck：复选框渲染', () => {
      const v = makeViews();
      const html = v.modelCheck('mf-required', '必填', true);
      expect(html).toContain('data-mf-required');
      expect(html).toContain('checked');
      expect(html).toContain('必填');
    });
  });

  describe('审计视图', () => {
    it('auditTaskStatusText：状态文案映射', () => {
      const v = makeViews();
      expect(v.auditTaskStatusText('running')).toBe('清理中');
      expect(v.auditTaskStatusText('completed')).toBe('已完成');
      expect(v.auditTaskStatusText('nope')).toBe('nope');
    });

    it('auditArchiveActionsHtml：有归档路径才输出下载/校验', () => {
      const v = makeViews();
      const html = v.auditArchiveActionsHtml({ id: 't1', archivePath: '/data/a.jsonl' });
      expect(html).toContain('data-action="auditcleanup-download"');
      expect(html).toContain('data-action="auditcleanup-verify"');
      expect(v.auditArchiveActionsHtml({ id: 't1' })).toBe('');
    });

    it('auditCleanupTasksHtml：任务进度与错误态', () => {
      const v = makeViews();
      const html = v.auditCleanupTasksHtml([{ id: 't1', status: 'running', progress: 0.5, matchedCount: 100, deletedCount: 50, skippedCount: 10, failedCount: 0, missingCount: 0 }], '');
      expect(html).toContain('清理中');
      expect(html).toContain('50%');
      expect(html).toContain('匹配 100');
      expect(html).toContain('已删 50');
      expect(v.auditCleanupTasksHtml([], '')).toContain('暂无清理任务');
      expect(v.auditCleanupTasksHtml([], 'boom')).toContain('boom');
    });

    it('auditCleanupPanelHtml：包含任务区与清理按钮', () => {
      const v = makeViews();
      const html = v.auditCleanupPanelHtml([], '', '', 180);
      expect(html).toContain('data-action="auditretention"');
      expect(html).toContain('清理 180 天前普通日志');
      expect(html).toContain('id="audit-cleanup-tasks"');
    });

    it('auditCleanupTaskPagerHtml：多任务分页与单页空态', () => {
      const v = makeViews({ getAuditCleanupTaskState: () => ({ page: 2, pageSize: 8, total: 20 }) });
      const html = v.auditCleanupTaskPagerHtml();
      expect(html).toContain('data-action="auditcleanup-page"');
      expect(html).toContain('共 20 个任务');
      const single = makeViews({ getAuditCleanupTaskState: () => ({ page: 1, pageSize: 8, total: 5 }) });
      expect(single.auditCleanupTaskPagerHtml()).toBe('');
    });
  });

  describe('媒体视图', () => {
    it('mediaStatusText / mediaStatusClass：状态映射', () => {
      const v = makeViews();
      expect(v.mediaStatusText('orphan')).toBe('孤儿资源');
      expect(v.mediaStatusClass('orphan')).toBe('review');
      expect(v.mediaStatusClass('active')).toBe('approved');
      expect(v.mediaStatusClass('weird')).toBe('user');
    });

    it('safeMediaSrc：过滤非 http/相对路径的可疑协议', () => {
      const v = makeViews();
      expect(v.safeMediaSrc('https://a.com/x.jpg')).toBe('https://a.com/x.jpg');
      expect(v.safeMediaSrc('/uploads/x.jpg')).toBe('/uploads/x.jpg');
      expect(v.safeMediaSrc('uploads/x.jpg')).toBe('/uploads/x.jpg');
      expect(v.safeMediaSrc('javascript:alert(1)')).toBe('');
    });
  });

  describe('登录与外壳', () => {
    it('mainSiteHint：非主站 origin 时给出引导提示', () => {
      const v = makeViews();
      const html = v.mainSiteHint();
      if (typeof window !== 'undefined' && window.location.origin === 'https://pets.example.com') {
        expect(html).toBe('');
      } else {
        expect(html).toContain('login-hint-warn');
        expect(html).toContain('pets.example.com');
      }
    });

    it('loginHTML：渲染 OAuth 登录按钮与主站提示', () => {
      const v = makeViews();
      const html = v.loginHTML(['github', 'gitee']);
      expect(html).toContain('login-card');
      expect(html).toContain('window.__oauth(\'github\')');
      expect(html).toContain('window.__oauth(\'gitee\')');
      expect(html).toContain('宠物投稿管理后台');
    });

    it('forbiddenHTML：白名单外提示', () => {
      const v = makeViews();
      const html = v.forbiddenHTML({ username: 'hacker' });
      expect(html).toContain('@hacker');
      expect(html).toContain('ADMIN_PROVIDER_IDS');
    });

    it('navItem：当前视图高亮与计数', () => {
      const v = makeViews();
      const active = v.navItem('pending', '待审核', I.inbox, 3, true);
      expect(active).toContain('nav-item active');
      expect(active).toContain('aria-current="page"');
      expect(active).toContain('nav-count warn');
      expect(active).toContain('>3<');
      const inactive = v.navItem('users', '用户', I.users, 0, false);
      expect(inactive).not.toContain('active');
      expect(inactive).not.toContain('nav-count');
    });

    it('dashboardHTML：站长侧边栏含全部视图，普通管理员隐藏站长专属', () => {
      const v = makeViews();
      const html = v.dashboardHTML();
      expect(html).toContain('sidebar');
      expect(html).toContain('data-view="pending"');
      expect(html).toContain('data-view="audit"');
      expect(html).toContain('nav-count warn');
      expect(html).toContain('@boss');

      const adminV = makeViews({ getMe: () => ({ role: 'admin', username: 'admin2' }), isSuper: () => false });
      const adminHtml = adminV.dashboardHTML();
      expect(adminHtml).not.toContain('data-view="audit"');
      expect(adminHtml).not.toContain('data-view="media"');
      expect(adminHtml).toContain('data-view="users"');
    });
  });
});
