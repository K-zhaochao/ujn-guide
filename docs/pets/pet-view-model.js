/*
 * Pure view-model helpers for the pet catalogue.
 * UMD keeps the MkDocs script loading model while allowing Vitest to import it.
 */
(function (root, factory) {
  const viewModel = factory();
  if (typeof module === 'object' && module.exports) module.exports = viewModel;
  if (root) root.UJNGuidePetViewModel = viewModel;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  const DEFAULT_MAX_IMAGES = 5;
  const LEGACY_PUBLIC_FIELDS = [
    { key: 'location', label: '常出没地点', dataType: 'location' },
    { key: 'appearance', label: '外貌特征', dataType: 'textarea' },
    { key: 'personality', label: '性格特点', dataType: 'textarea' },
    { key: 'description', label: '补充描述', dataType: 'textarea' },
  ];
  const DEFAULT_FIELD_ICONS = {
    location: '📍', appearance: '🎨', personality: '💕', description: '📝',
  };

  function projectContentSchema(config, schema, defaultMaxImages) {
    const fallbackMaxImages = defaultMaxImages === undefined ? DEFAULT_MAX_IMAGES : defaultMaxImages;
    const source = schema && Array.isArray(schema.types) ? schema : (config || {});
    if (!source || !Array.isArray(source.types)) return null;

    const contentSchema = {
      schemaVersion: source.schemaVersion || (config && config.schemaVersion) || null,
      types: source.types || [],
      fields: source.fields || [],
      bindings: source.bindings || [],
      constraints: source.constraints || { maxImages: fallbackMaxImages },
    };
    const mapType = type => ({
      id: type.id,
      code: type.code,
      key: type.name,
      emoji: type.icon || '🐾',
      acceptSubmission: type.acceptSubmission !== false,
      metadata: type.metadata && typeof type.metadata === 'object' ? type.metadata : {},
    });
    const activeTypes = type => !type.archived && !type.archivedAt;
    const bySortOrder = (left, right) => (left.sortOrder || 0) - (right.sortOrder || 0);

    return {
      contentSchema,
      maxImagesLimit: Math.max(1, Number(contentSchema.constraints.maxImages) || fallbackMaxImages),
      categories: contentSchema.types
        .filter(type => type.visible !== false && activeTypes(type))
        .sort(bySortOrder)
        .map(mapType),
      submissionTypes: contentSchema.types
        .filter(type => type.acceptSubmission !== false && activeTypes(type))
        .sort(bySortOrder)
        .map(mapType),
      categoryEmoji: Object.fromEntries(contentSchema.types.map(type => [type.name, type.icon || '🐾'])),
    };
  }

  function typeForPet(pet, categories) {
    if (!pet) return null;
    const raw = pet.type || {};
    return (categories || []).find(type =>
      (raw.id != null && String(type.id) === String(raw.id)) ||
      (raw.code && type.code === raw.code) ||
      type.key === (raw.name || pet.category)
    ) || null;
  }

  function petEmoji(pet, categories, categoryEmoji) {
    return (pet && pet.type && pet.type.icon) ||
      (typeForPet(pet, categories) || {}).emoji ||
      (categoryEmoji || {})[pet && pet.category] ||
      '🐾';
  }

  function fieldKey(field) {
    return field && (field.key || field.fieldKey) || '';
  }

  function fieldIcon(field) {
    return (field && field.icon) || DEFAULT_FIELD_ICONS[fieldKey(field)] || '•';
  }

  function fieldDisplayValue(field, value) {
    if (value === undefined || value === null || value === '') return '';
    const options = Array.isArray(field && field.options) ? field.options : [];
    const labels = new Map(options.map(option => [
      String(option.code || option.optionCode), option.label || option.code || option.optionCode,
    ]));
    const mapOption = item => labels.get(String(item)) || String(item);
    if (Array.isArray(value)) return value.map(mapOption).join('、');
    if ((field && field.dataType) === 'boolean' || typeof value === 'boolean') return value ? '是' : '否';
    if ((field && field.dataType) === 'select') return mapOption(value);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function legacyPublicDefinitions(pet, context) {
    return LEGACY_PUBLIC_FIELDS.filter(field =>
      pet && Object.prototype.hasOwnProperty.call(pet, field.key) && (context !== 'card' || field.key === 'location')
    );
  }

  function publicFieldEntries(pet, context) {
    const definitions = Array.isArray(pet && pet.fieldDefinitions) && pet.fieldDefinitions.length
      ? pet.fieldDefinitions
      : legacyPublicDefinitions(pet, context);
    const values = Object.assign({}, pet || {}, pet && pet.fields && typeof pet.fields === 'object' ? pet.fields : {});
    return definitions.map(field => ({ field, value: values[fieldKey(field)] }));
  }

  function buildPetListQuery({
    searchQuery = '', currentFilter = '全部', categories = [], sortMode = 'latest', currentPage = 1, pageSize = 24,
  } = {}) {
    const query = {};
    if (searchQuery) query.q = searchQuery;
    if (currentFilter !== '全部') {
      const selectedType = categories.find(category => category.key === currentFilter);
      if (selectedType && selectedType.id != null) query.typeId = selectedType.id;
      else query.category = currentFilter;
    }
    query.sort = sortMode;
    query.page = currentPage;
    query.pageSize = pageSize;
    return query;
  }

  function paginationPages(totalPages, currentPage) {
    const pages = [];
    const push = page => { if (!pages.includes(page)) pages.push(page); };
    for (let page = 1; page <= totalPages; page++) {
      if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2) push(page);
    }
    return pages;
  }

  return {
    DEFAULT_MAX_IMAGES,
    buildPetListQuery,
    fieldDisplayValue,
    fieldIcon,
    fieldKey,
    legacyPublicDefinitions,
    paginationPages,
    petEmoji,
    projectContentSchema,
    publicFieldEntries,
    typeForPet,
  };
}));
