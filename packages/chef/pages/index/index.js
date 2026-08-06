const { getCatalog, getMeta } = require('../../data/index');
const favorite = require('../../utils/favorite');

const PAGE_SIZE = 20;
const allRecipes = getCatalog();
const meta = getMeta();

function normalizedKeyword(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Fisher-Yates 洗牌：返回一个新的随机排列数组
function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

// 给菜品附加 favorited 标记，供列表渲染收藏角标
function tagFavorited(list, favIds) {
  return list.map(function (item) {
    return Object.assign({}, item, { favorited: favIds.indexOf(item.id) >= 0 });
  });
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
    sourceName: meta.source,
    // 收藏相关
    favorites: [],
    favoriteRecipes: [],
    favoriteCount: 0,
    viewMode: 'browse' // 'browse' | 'favorites'
  },

  onLoad() {
    this.applyFilters();
  },

  onShow() {
    this.syncFavorites();
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
      viewMode: 'browse',
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
      viewMode: 'browse',
      keyword: '',
      activeCategory: '',
      activeCategoryLabel: '全部菜谱'
    }, () => this.applyFilters(() => this.scrollListToTop()));
  },

  // 列表切换（分类/搜索/清空）都会重新随机排序，符合"每次切换都随机"需求
  applyFilters(callback) {
    const keyword = normalizedKeyword(this.data.keyword);
    const category = this.data.activeCategory;
    const matches = allRecipes.filter(function (recipe) {
      if (category && recipe.category !== category) return false;
      return !keyword || recipe.keywords.indexOf(keyword) >= 0;
    });
    const shuffled = shuffle(matches);
    this.filteredRecipes = shuffled;
    const favIds = favorite.getFavorites();
    this.setData({
      resultCount: matches.length,
      visibleRecipes: tagFavorited(shuffled.slice(0, PAGE_SIZE), favIds),
      hasMore: shuffled.length > PAGE_SIZE
    }, callback);
  },

  // 「换一批」：对当前筛选结果重新随机（停留在同一分类/搜索下）
  shuffleCurrent() {
    if (!this.filteredRecipes) return;
    const shuffled = shuffle(this.filteredRecipes);
    this.filteredRecipes = shuffled;
    const favIds = favorite.getFavorites();
    this.setData({
      visibleRecipes: tagFavorited(shuffled.slice(0, PAGE_SIZE), favIds),
      hasMore: shuffled.length > PAGE_SIZE
    }, () => this.scrollListToTop());
    wx.showToast({ title: '已换一批', icon: 'none', duration: 600 });
  },

  onReachBottom() {
    if (this.data.viewMode === 'favorites') return;
    if (!this.data.hasMore) return;
    const source = this.filteredRecipes || allRecipes;
    const nextLength = Math.min(this.data.visibleRecipes.length + PAGE_SIZE, source.length);
    const favIds = favorite.getFavorites();
    this.setData({
      visibleRecipes: tagFavorited(source.slice(0, nextLength), favIds),
      hasMore: nextLength < source.length
    });
  },

  // 进入收藏列表（「我的收藏」入口始终显示，不受收藏数量限制）
  chooseFavorites() {
    this.setData({ viewMode: 'favorites' }, () => this.scrollListToTop());
  },

  backToBrowse() {
    this.setData({ viewMode: 'browse' }, () => this.applyFilters(() => this.scrollListToTop()));
  },

  openRecipe(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/packages/chef/pages/detail/detail?id=${id}` });
  },

  goTips() {
    wx.navigateTo({ url: '/packages/chef/pages/tips/tips' });
  },

  // 在列表卡片上直接收藏/取消（不进入详情）
  toggleFavOnCard(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const nowFav = favorite.toggleFavorite(id);
    this.syncFavorites();
    wx.showToast({ title: nowFav ? '已收藏' : '已取消收藏', icon: 'none', duration: 700 });
  },

  // 同步收藏状态到页面：保持当前浏览顺序，只更新收藏标记 / 收藏列表
  // 「我的收藏」入口始终显示，因此收藏视图随时可进入（含 0 收藏的空状态）
  syncFavorites() {
    const favIds = favorite.getFavorites();
    const favRecipes = favorite.getFavoriteRecipes(allRecipes);
    const favoriteCount = favRecipes.length;

    if (this.data.viewMode === 'favorites') {
      this.setData({
        favorites: favIds,
        favoriteRecipes: favRecipes,
        favoriteCount
      });
      return;
    }

    const patch = {
      favorites: favIds,
      favoriteRecipes: favRecipes,
      favoriteCount
    };
    if (this.filteredRecipes) {
      const len = this.data.visibleRecipes.length;
      patch.visibleRecipes = tagFavorited(this.filteredRecipes.slice(0, len), favIds);
    }
    this.setData(patch);
  }
});
