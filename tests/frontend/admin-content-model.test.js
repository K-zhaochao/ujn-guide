import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const { createAdminContentModel } = require('../../server/public/admin-content-model.js');

const initial = () => ({
  mode: 'direct', revision: 7, schemaVersion: 3, updatedAt: '2026-09-07T00:00:00Z',
  types: [{ id: 1, code: 'cat', name: '猫', icon: '🐱', visible: true, acceptSubmission: true }, { id: 2, code: 'dog', name: '狗', visible: true, acceptSubmission: true }],
  fields: [{ id: 1, key: 'name', label: '名称', dataType: 'text', protected: true }, { id: 2, key: 'coat', label: '毛色', dataType: 'select', options: [{ code: 'white', label: '白色', active: true }] }],
  bindings: [{ typeId: 1, fieldId: 1, enabled: true }, { typeId: 1, fieldId: 2, enabled: true }, { typeId: 2, fieldId: 1, enabled: true }],
});
const ok = config => ({ ok: true, status: 200, data: { config, changed: true } });
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const $ = selector => document.querySelector(selector);
function harness(config = initial()) {
  document.body.innerHTML = '<div id="view-root"></div>';
  let active = true, current = config;
  const api = vi.fn(async () => ok(current));
  const confirmBox = vi.fn(async () => true);
  const controller = createAdminContentModel({ document, api, isActive: () => active, isSuper: () => true, toast: vi.fn(), fmtTime: value => value, confirmBox, inputBox: vi.fn(), applyTypes: vi.fn() });
  return { controller, api, confirmBox, setConfig: value => { current = value; }, leave: () => { active = false; controller.deactivate(); }, action: (name, dataset = {}) => controller.actions[name]({ dataset }) };
}
function save() { $('[data-cm-form]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }
function input(key, value) { $('[data-cm="' + key + '"]').value = value; }

describe('类型与字段即时设置控制器', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('新字段、有效选项、两个适用类型由一个写请求提交', async () => {
    const h = harness(); await h.controller.load(); h.action('modelfieldnew');
    input('label', '校园区域'); input('key', 'area'); input('dataType', 'select');
    $('[data-cm="dataType"]').dispatchEvent(new Event('change'));
    $('[data-cm="required"]').checked = true;
    $('[data-cm="type-1"]').checked = true; $('[data-cm="type-2"]').checked = true;
    $('[data-cm-option-add]').click();
    $('[data-cm-option-code]').value = 'west'; $('[data-cm-option-label]').value = '西校区';
    save(); await settle();
    const writes = h.api.mock.calls.filter(([, opts]) => opts?.method);
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toBe('/admin/content-model/fields');
    expect(writes[0][1]).toMatchObject({ method: 'POST', headers: { 'X-Content-Model-Mode': 'direct' }, body: { expectedRevision: 7, key: 'area', dataType: 'select', required: true, options: [{ code: 'west', label: '西校区', active: true }] } });
    expect(writes[0][1].body.typeBindings.map(item => item.typeId)).toEqual([1, 2]);
    expect($('.cm-overlay')).toBeNull();
  });

  it('取消不写服务器，未编辑的链接默认提示不制造 metadata 变更', async () => {
    const h = harness(); await h.controller.load(); h.action('modeltypeedit', { id: '1' });
    save(); await settle();
    expect(h.api.mock.calls[1][1].body).not.toHaveProperty('metadata');
    h.action('modeltypeedit', { id: '1' }); input('name', '取消修改'); $('[data-cm-close]').click();
    expect(h.api).toHaveBeenCalledTimes(2);
  });

  it('冲突后保留字段和选项，读取与确认均不重放，只有再次保存才写入', async () => {
    const h = harness(); await h.controller.load(); h.action('modelfieldedit', { id: '2' });
    input('label', '我的毛色输入'); $('[data-cm-option-label]').value = '我的选项输入';
    h.api.mockResolvedValueOnce({ ok: false, status: 409, data: { code: 'CONTENT_MODEL_CONFLICT' } });
    save(); await settle();
    expect($('[data-cm-save]').disabled).toBe(true);
    expect($('[data-cm="label"]').value).toBe('我的毛色输入');
    expect($('[data-cm-option-label]').value).toBe('我的选项输入');
    h.setConfig({ ...initial(), revision: 8 });
    $('[data-cm-compare]').click(); await settle();
    expect(h.api.mock.calls.filter(([, opts]) => opts?.method)).toHaveLength(1);
    $('[data-cm-ack]').click();
    expect(h.api.mock.calls.filter(([, opts]) => opts?.method)).toHaveLength(1);
    expect($('[data-cm="label"]').value).toBe('我的毛色输入');
    save(); await settle();
    expect(h.api.mock.calls.filter(([, opts]) => opts?.method)[1][1].body.expectedRevision).toBe(8);
  });

  it('保存结果不明时先核对：已存在的标识阻止重复创建', async () => {
    const h = harness(); await h.controller.load(); h.action('modeltypenew');
    input('name', '新类型'); input('code', 'new-type');
    h.api.mockResolvedValueOnce({ ok: false, status: 0, data: {} });
    save(); await settle();
    h.setConfig({ ...initial(), revision: 8, types: [...initial().types, { id: 9, code: 'new-type', name: '新类型' }] });
    $('[data-cm-compare]').click(); await settle();
    expect($('[data-cm-latest]').textContent).toContain('此标识已经存在');
    expect($('[data-cm-ack]')).toBeNull();
    save(); expect(h.api.mock.calls.filter(([, opts]) => opts?.method)).toHaveLength(1);
  });

  it('校验失败不关闭表单，明确展示字段错误且没有发布请求', async () => {
    const h = harness(); await h.controller.load(); h.action('modelfieldedit', { id: '2' });
    h.api.mockResolvedValueOnce({ ok: false, status: 422, data: { message: '配置无效', details: { errors: [{ message: '必填选择字段没有有效选项' }] } } });
    save(); await settle();
    expect($('[data-cm-error]').textContent).toContain('必填选择字段没有有效选项');
    expect($('[data-cm-save]').disabled).toBe(false);
    expect(h.api.mock.calls.some(([url]) => url.includes('publish'))).toBe(false);
  });

  it('删除类型保留历史，字段恢复必须重新勾选且不能恢复已删除类型', async () => {
    const config = initial(); config.fields[1].archived = true; config.types[1].archived = true;
    const h = harness(config); await h.controller.load();
    expect($('[data-action="modelfieldrestore"]')).toBeNull();
    h.action('modeldeleted'); h.action('modeltab', { tab: 'fields' });
    expect($('[data-action="modelfieldrestore"]')).not.toBeNull();
    h.action('modelfieldrestore', { id: '2' });
    expect($('[data-cm="type-1"]').checked).toBe(false);
    expect($('[data-cm="type-2"]')).toBeNull();
    save(); await settle();
    expect($('[data-cm-error]').textContent).toContain('至少选择一个适用类型');
    expect(h.api).toHaveBeenCalledTimes(1);
    $('[data-cm="type-1"]').checked = true; save(); await settle();
    expect(h.api.mock.calls[1][0]).toBe('/admin/content-model/fields/2/restore');
  });

  it('已删除类型恢复时不会预先打开分类或投稿开关', async () => {
    const config = initial(); config.types[0].archived = true;
    const h = harness(config); await h.controller.load(); h.action('modeltyperestore', { id: '1' });
    expect($('[data-cm="visible"]').checked).toBe(false);
    expect($('[data-cm="acceptSubmission"]').checked).toBe(false);
  });

  it('未迁移模式只展示只读说明，不给旧草稿隐式发布', async () => {
    const h = harness({ ...initial(), mode: 'legacy', pendingChanges: true }); await h.controller.load();
    expect($('#view-root').textContent).toContain('必须先备份并明确选择');
    h.action('modeltypenew'); expect($('.cm-overlay')).toBeNull();
    expect(h.api).toHaveBeenCalledTimes(1);
  });

  it('零可投稿类型有明确提示，系统保护字段没有删除按钮', async () => {
    const config = initial(); config.types.forEach(type => { type.acceptSubmission = false; });
    const h = harness(config); await h.controller.load();
    expect($('#view-root').textContent).toContain('当前暂无可投稿类型');
    h.action('modeltab', { tab: 'fields' });
    expect($('[data-action="modelfielddelete"][data-id="1"]')).toBeNull();
    expect($('[data-action="modelfielddelete"][data-id="2"]')).not.toBeNull();
  });

  it('离开页面后丢弃晚到读取结果，也不执行迟到的删除确认', async () => {
    const h = harness(); await h.controller.load();
    let confirm; h.confirmBox.mockImplementationOnce(() => new Promise(resolve => { confirm = resolve; }));
    h.action('modeltypedelete', { id: '1' });
    let read; h.api.mockImplementationOnce(() => new Promise(resolve => { read = resolve; }));
    const pending = h.controller.load();
    h.leave(); $('#view-root').textContent = '其他页面';
    confirm(true); read(ok(initial())); await pending; await settle();
    expect($('#view-root').textContent).toBe('其他页面');
    expect(h.api.mock.calls.filter(([, opts]) => opts?.method)).toHaveLength(0);
  });
});
