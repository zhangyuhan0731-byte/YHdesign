const { getCatalog, getMeta } = require('../../data/index');

const PAGE_SIZE = 20;
const allRecipes = getCatalog();
const meta = getMeta();

function normalizedKeyword(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

Page({
  data: {
    total: meta.total,
    categories: [{ key: '', label: '全部', count: meta.total }].concat(meta.categories),
    keyword: '',
    activeCategory: '',
    activeCategoryLabel: '全部菜谱',
    resultCount: meta.total,
    visibleRecipes: allRecipes.slice(0, PAGE_SIZE),
    hasMore: allRecipes.length > PAGE_SIZE,
    sourceVersion: meta.version,
    sourceName: meta.source
  },

  onUnload() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  },

  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.applyFilters(), 180);
  },

  clearSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.setData({ keyword: '' }, () => this.applyFilters());
  },

  chooseCategory(e) {
    const key = e.currentTarget.dataset.key || '';
    const selected = this.data.categories.find(function (item) { return item.key === key; });
    this.setData({
      activeCategory: key,
      activeCategoryLabel: key && selected ? selected.label : '全部菜谱'
    }, () => this.applyFilters(() => this.scrollListToTop()));
  },

  scrollListToTop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 220 });
  },

  showAll() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.setData({
      keyword: '',
      activeCategory: '',
      activeCategoryLabel: '全部菜谱'
    }, () => this.applyFilters(() => this.scrollListToTop()));
  },

  applyFilters(callback) {
    const keyword = normalizedKeyword(this.data.keyword);
    const category = this.data.activeCategory;
    const matches = allRecipes.filter(function (recipe) {
      if (category && recipe.category !== category) return false;
      return !keyword || recipe.keywords.indexOf(keyword) >= 0;
    });
    this.filteredRecipes = matches;
    this.setData({
      resultCount: matches.length,
      visibleRecipes: matches.slice(0, PAGE_SIZE),
      hasMore: matches.length > PAGE_SIZE
    }, callback);
  },

  onReachBottom() {
    if (!this.data.hasMore) return;
    const source = this.filteredRecipes || allRecipes;
    const nextLength = Math.min(this.data.visibleRecipes.length + PAGE_SIZE, source.length);
    this.setData({
      visibleRecipes: source.slice(0, nextLength),
      hasMore: nextLength < source.length
    });
  },

  openRecipe(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/packages/chef/pages/detail/detail?id=${id}` });
  }
});
