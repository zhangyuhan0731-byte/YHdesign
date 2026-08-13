const { getCatalog } = require('../../data/index');
const { recommend, parseOwned } = require('../../utils/matcher');
const { getStorage, setStorage } = require('../../../../utils/util');

const catalog = getCatalog();
const STORAGE_KEY = 'chef_pantry';

const COMMON_OPTIONS = {
  foods: [
    '鸡蛋', '番茄', '土豆', '猪肉', '鸡肉', '牛肉', '豆腐', '茄子',
    '白菜', '青椒', '胡萝卜', '黄瓜', '洋葱', '蘑菇', '虾', '鱼',
    '面条', '米饭', '面粉', '牛奶'
  ],
  seasonings: [
    '盐', '白糖', '生抽', '老抽', '醋', '料酒', '蚝油', '香油',
    '胡椒粉', '淀粉', '豆瓣酱', '辣椒', '葱', '姜', '蒜'
  ],
  tools: [
    '炒锅', '汤锅', '蒸锅', '电饭煲', '烤箱', '空气炸锅',
    '微波炉', '高压锅', '料理机', '平底锅'
  ]
};

function unique(items) {
  const seen = {};
  return (items || []).filter(function (item) {
    const key = String(item || '').trim();
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function optionViews(field, selected) {
  const selectedMap = {};
  selected.forEach(function (item) { selectedMap[item] = true; });
  return COMMON_OPTIONS[field].map(function (label) {
    return { label, selected: Boolean(selectedMap[label]) };
  });
}

function normalizeSaved(saved) {
  const value = saved && typeof saved === 'object' ? saved : {};
  return {
    foods: typeof value.foods === 'string' ? value.foods : '',
    seasonings: typeof value.seasonings === 'string' ? value.seasonings : '',
    tools: typeof value.tools === 'string' ? value.tools : '',
    selectedFoods: unique(value.selectedFoods),
    selectedSeasonings: unique(value.selectedSeasonings),
    selectedTools: unique(value.selectedTools)
  };
}

Page({
  data: {
    foods: '',
    seasonings: '',
    tools: '',
    selectedFoods: [],
    selectedSeasonings: [],
    selectedTools: [],
    foodOptions: optionViews('foods', []),
    seasoningOptions: optionViews('seasonings', []),
    toolOptions: optionViews('tools', []),
    expandedFoods: true,
    expandedSeasonings: false,
    expandedTools: false,
    results: [],
    hasMatched: false
  },

  onLoad() {
    const saved = normalizeSaved(getStorage(STORAGE_KEY, {}));
    this.setData(Object.assign({}, saved, {
      foodOptions: optionViews('foods', saved.selectedFoods),
      seasoningOptions: optionViews('seasonings', saved.selectedSeasonings),
      toolOptions: optionViews('tools', saved.selectedTools)
    }));
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value, hasMatched: false });
  },

  onFieldBlur() {
    this.savePantry();
  },

  onHide() {
    this.savePantry();
  },

  onUnload() {
    this.savePantry();
  },

  toggleSection(e) {
    const field = e.currentTarget.dataset.field;
    const key = `expanded${field.charAt(0).toUpperCase()}${field.slice(1)}`;
    this.setData({ [key]: !this.data[key] });
  },

  toggleOption(e) {
    const field = e.currentTarget.dataset.field;
    const label = e.currentTarget.dataset.label;
    const selectedKey = `selected${field.charAt(0).toUpperCase()}${field.slice(1)}`;
    const optionKey = field === 'foods' ? 'foodOptions' : field === 'seasonings' ? 'seasoningOptions' : 'toolOptions';
    const current = this.data[selectedKey] || [];
    const exists = current.indexOf(label) >= 0;
    const next = exists
      ? current.filter(function (item) { return item !== label; })
      : current.concat(label);
    this.setData({
      [selectedKey]: next,
      [optionKey]: optionViews(field, next),
      hasMatched: false
    });
    this.savePantry();
  },

  buildInput() {
    return {
      foods: unique(this.data.selectedFoods.concat(parseOwned(this.data.foods))).join('、'),
      seasonings: unique(this.data.selectedSeasonings.concat(parseOwned(this.data.seasonings))).join('、'),
      tools: unique(this.data.selectedTools.concat(parseOwned(this.data.tools))).join('、')
    };
  },

  savePantry() {
    setStorage(STORAGE_KEY, {
      foods: this.data.foods,
      seasonings: this.data.seasonings,
      tools: this.data.tools,
      selectedFoods: this.data.selectedFoods,
      selectedSeasonings: this.data.selectedSeasonings,
      selectedTools: this.data.selectedTools
    });
  },

  startMatch() {
    const input = this.buildInput();
    if (!input.foods) {
      wx.showToast({ title: '请至少勾选或输入一种食材', icon: 'none' });
      return;
    }
    this.savePantry();
    const results = recommend(catalog, input, 20);
    this.setData({ results, hasMatched: true });
  },

  clearAll() {
    this.setData({
      foods: '',
      seasonings: '',
      tools: '',
      selectedFoods: [],
      selectedSeasonings: [],
      selectedTools: [],
      foodOptions: optionViews('foods', []),
      seasoningOptions: optionViews('seasonings', []),
      toolOptions: optionViews('tools', []),
      results: [],
      hasMatched: false
    });
    setStorage(STORAGE_KEY, {});
  },

  openRecipe(e) {
    wx.navigateTo({ url: `/packages/chef/pages/detail/detail?id=${e.currentTarget.dataset.id}` });
  },

  onShareAppMessage() {
    return {
      title: '日常琐事，交给这个小工具集就对了',
      imageUrl: '/images/share-cover.png',
      path: '/packages/chef/pages/pantry/pantry'
    };
  },

  onShareTimeline() {
    return {
      title: '日常琐事，交给这个小工具集就对了',
      imageUrl: '/images/share-cover.png'
    };
  }
});
