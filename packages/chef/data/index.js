const catalogData = require('./generated/catalog');
const metaData = require('./generated/meta');

const CATEGORY_LOADERS = {
  meat_dish: function () { return require('./generated/meat_dish'); },
  vegetable_dish: function () { return require('./generated/vegetable_dish'); },
  aquatic: function () { return require('./generated/aquatic'); },
  breakfast: function () { return require('./generated/breakfast'); },
  staple: function () { return require('./generated/staple'); },
  soup: function () { return require('./generated/soup'); },
  dessert: function () { return require('./generated/dessert'); },
  drink: function () { return require('./generated/drink'); },
  condiment: function () { return require('./generated/condiment'); },
  'semi-finished': function () { return require('./generated/semi-finished'); }
};

const KIND_LABELS = { f: '食材', s: '调料', t: '工具', o: '其他准备' };
const categoryLabels = {};
metaData.categories.forEach(function (item) {
  categoryLabels[item[0]] = item[1];
});

function levelKey(difficulty) {
  if (difficulty <= 2) return 'simple';
  if (difficulty === 3) return 'advanced';
  return 'challenge';
}

function levelLabel(difficulty) {
  if (difficulty <= 2) return '简单';
  if (difficulty === 3) return '进阶';
  return '挑战';
}

function decodeSummary(item) {
  const ingredients = item[6] || [];
  const matchData = item[8] || [ingredients, [], [], [], [], []];
  return {
    id: item[0],
    name: item[1],
    category: item[2],
    categoryLabel: categoryLabels[item[2]] || item[2],
    difficulty: item[3],
    difficultyText: new Array(item[3] + 1).join('★'),
    level: levelKey(item[3]),
    levelLabel: levelLabel(item[3]),
    calories: item[4] || '暂无热量数据',
    tags: item[5] || [],
    ingredients: ingredients,
    ingredientsText: ingredients.length ? ingredients.join('、') : '查看准备清单',
    keywords: item[7] || '',
    match: {
      foods: matchData[0] || [],
      optionalFoods: matchData[1] || [],
      seasonings: matchData[2] || [],
      optionalSeasonings: matchData[3] || [],
      tools: matchData[4] || [],
      optionalTools: matchData[5] || []
    }
  };
}

const catalog = catalogData.map(decodeSummary);
const catalogById = {};
catalog.forEach(function (item) { catalogById[item.id] = item; });

function decodeRequirements(rows) {
  const groups = { f: [], s: [], t: [], o: [] };
  (rows || []).forEach(function (item, index) {
    const kind = groups[item[2]] ? item[2] : 'o';
    groups[kind].push({
      sourceGroup: item[0],
      key: `${kind}-${index}`,
      name: item[1],
      optional: item[3] === 1
    });
  });
  return ['f', 's', 't', 'o'].filter(function (kind) {
    return groups[kind].length > 0;
  }).map(function (kind) {
    return { key: kind, title: KIND_LABELS[kind], items: groups[kind] };
  });
}

function decodeAmountGroups(rows) {
  return (rows || []).map(function (group, groupIndex) {
    return {
      key: `amount-${groupIndex}`,
      title: group[0] || '参考用量',
      notes: group[2] || [],
      items: (group[1] || []).map(function (item, itemIndex) {
        return {
          key: `amount-${groupIndex}-${itemIndex}`,
          name: item[0],
          amount: item[1] || '按需准备',
          kindLabel: KIND_LABELS[item[2]] || KIND_LABELS.o
        };
      })
    };
  }).filter(function (group) { return group.items.length > 0 || group.notes.length > 0; });
}

function decodeStepGroups(rows) {
  return (rows || []).map(function (group, groupIndex) {
    return {
      key: `step-${groupIndex}`,
      title: group[0] || '制作步骤',
      steps: (group[1] || []).map(function (text, stepIndex) {
        return { key: `step-${groupIndex}-${stepIndex}`, number: stepIndex + 1, text: text };
      })
    };
  }).filter(function (group) { return group.steps.length > 0; });
}

function getRecipe(id) {
  const summary = catalogById[id];
  if (!summary) return null;
  const loader = CATEGORY_LOADERS[summary.category];
  if (!loader) return null;
  const raw = loader().find(function (item) { return item[0] === id; });
  if (!raw) return null;
  return Object.assign({}, summary, {
    summary: raw[1] || '',
    requirementGroups: decodeRequirements(raw[2]),
    amountGroups: decodeAmountGroups(raw[3]),
    stepGroups: decodeStepGroups(raw[4]),
    notes: raw[5] || []
  });
}

function getCatalog() {
  return catalog.slice();
}

function getMeta() {
  return {
    source: metaData.source,
    license: metaData.license,
    version: metaData.version,
    total: metaData.total,
    categories: metaData.categories.map(function (item) {
      return { key: item[0], label: item[1], count: item[2] };
    }),
    tags: metaData.tags.map(function (item) {
      return { key: item[0], label: item[0], count: item[1] };
    })
  };
}

module.exports = { getCatalog, getMeta, getRecipe };
