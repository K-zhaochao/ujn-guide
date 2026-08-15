import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const viewModel = require('../../docs/pets/pet-view-model.js');

describe('宠物前端视图模型', () => {
  it('按 schema 投影可见分类、可投稿类型、图片上限和分类图标', () => {
    expect(window.UJNGuidePetViewModel).toBe(viewModel);
    const config = { schemaVersion: 'config-v1', types: [] };
    const schema = {
      schemaVersion: 'schema-v2',
      constraints: { maxImages: 8, maxImageBytes: 3 * 1024 * 1024 },
      types: [
        { id: 2, code: 'dog', name: '狗狗', icon: '🐶', sortOrder: 20 },
        { id: 1, code: 'cat', name: '猫猫', icon: '🐱', sortOrder: 10 },
        { id: 3, code: 'bird', name: '鸟类', visible: false, sortOrder: 5 },
        { id: 4, code: 'old', name: '旧分类', archived: true, sortOrder: 1 },
        { id: 5, code: 'read-only', name: '只读分类', acceptSubmission: false, sortOrder: 15 },
      ],
      fields: [{ key: 'temper' }],
    };

    const projection = viewModel.projectContentSchema(config, schema, 5);

    expect(projection.contentSchema.schemaVersion).toBe('schema-v2');
    expect(projection.maxImagesLimit).toBe(8);
    expect(projection.maxImageBytesLimit).toBe(3 * 1024 * 1024);
    expect(projection.categories.map(type => type.key)).toEqual(['猫猫', '只读分类', '狗狗']);
    // 隐藏类型不出现在公开导航，但仍可作为后台可投稿类型。
    expect(projection.submissionTypes.map(type => type.key)).toEqual(['鸟类', '猫猫', '狗狗']);
    expect(projection.categoryEmoji).toMatchObject({ 猫猫: '🐱', 鸟类: '🐾', 旧分类: '🐾' });
    expect(viewModel.projectContentSchema({}, null)).toBeNull();
  });

  it('优先用稳定类型标识查找宠物，并为历史分类保留显示回退', () => {
    const categories = [
      { id: 7, code: 'cat', key: '猫猫', emoji: '🐱' },
      { id: 8, code: 'dog', key: '狗狗', emoji: '🐶' },
    ];

    expect(viewModel.typeForPet({ category: '旧名称', type: { id: '7', code: 'dog' } }, categories)).toMatchObject({ key: '猫猫' });
    expect(viewModel.typeForPet({ category: '旧名称', type: { code: 'dog' } }, categories)).toMatchObject({ key: '狗狗' });
    expect(viewModel.typeForPet({ category: '猫猫' }, categories)).toMatchObject({ key: '猫猫' });
    expect(viewModel.petEmoji({ category: '已归档' }, categories, { 已归档: '🐾' })).toBe('🐾');
    expect(viewModel.petEmoji({ type: { icon: '⭐' } }, categories, {})).toBe('⭐');
  });

  it('格式化动态字段，并在历史投稿没有 fieldDefinitions 时回退到旧字段', () => {
    const selectField = {
      key: 'temper', dataType: 'select', options: [
        { code: 'gentle', label: '温顺' }, { optionCode: 'shy', label: '怕生' },
      ],
    };
    const historicalPet = {
      location: '图书馆',
      appearance: '橘白',
      fields: { location: '新校区', personality: '亲人' },
    };
    const dynamicPet = {
      fieldDefinitions: [selectField, { fieldKey: 'adopted', dataType: 'boolean' }],
      fields: { temper: ['gentle', 'shy'], adopted: false },
    };

    expect(viewModel.fieldDisplayValue(selectField, ['gentle', 'shy'])).toBe('温顺、怕生');
    expect(viewModel.fieldDisplayValue({ dataType: 'boolean' }, true)).toBe('是');
    expect(viewModel.fieldIcon({ key: 'location' })).toBe('📍');
    expect(viewModel.fieldIcon({ key: 'other', icon: '🔖' })).toBe('🔖');
    expect(viewModel.publicFieldEntries(historicalPet, 'card')).toEqual([
      { field: { key: 'location', label: '常出没地点', dataType: 'location' }, value: '新校区' },
    ]);
    expect(viewModel.publicFieldEntries(dynamicPet)).toEqual([
      { field: selectField, value: ['gentle', 'shy'] },
      { field: { fieldKey: 'adopted', dataType: 'boolean' }, value: false },
    ]);
  });

  it('将搜索、类型、排序和分页转换为稳定的公开列表参数', () => {
    const categories = [{ id: 12, key: '猫猫' }];

    expect(viewModel.buildPetListQuery({
      searchQuery: '图书馆', currentFilter: '猫猫', categories, sortMode: 'likes', currentPage: 3, pageSize: 12,
    })).toEqual({ q: '图书馆', typeId: 12, sort: 'likes', page: 3, pageSize: 12 });
    expect(viewModel.buildPetListQuery({ currentFilter: '历史分类' })).toEqual({
      category: '历史分类', sort: 'latest', page: 1, pageSize: 24,
    });
    expect(viewModel.buildPetListQuery()).toEqual({ sort: 'latest', page: 1, pageSize: 24 });
  });

  it('将我的投稿的唯一状态按钮状态与其他筛选转换为请求参数', () => {
    expect(viewModel.buildMineListQuery({
      query: '图书馆', status: 'approved', category: '12', start: '2026-08-01', end: '2026-08-10',
      sort: 'updated', page: 2, pageSize: 10,
    })).toEqual({
      q: '图书馆', status: 'approved', typeId: '12', start: '2026-08-01', end: '2026-08-10',
      sort: 'updated', page: 2, pageSize: 10,
    });
    expect(viewModel.buildMineListQuery({ category: '历史分类' })).toEqual({
      category: '历史分类', type: '历史分类', sort: 'updated', page: 1, pageSize: 10,
    });
  });

  it('只保留当前页附近及首尾页，供页码控件插入省略号', () => {
    expect(viewModel.paginationPages(1, 1)).toEqual([1]);
    expect(viewModel.paginationPages(10, 5)).toEqual([1, 3, 4, 5, 6, 7, 10]);
    expect(viewModel.paginationPages(10, 1)).toEqual([1, 2, 3, 10]);
    expect(viewModel.paginationPages(10, 10)).toEqual([1, 8, 9, 10]);
  });
});
