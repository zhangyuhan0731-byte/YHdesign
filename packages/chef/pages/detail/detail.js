const { getRecipe } = require('../../data/index');
const favorite = require('../../utils/favorite');

Page({
  data: {
    loading: true,
    recipe: null,
    favorited: false
  },

  onLoad(options) {
    const recipe = getRecipe(options.id || '');
    if (recipe) {
      wx.setNavigationBarTitle({ title: recipe.name });
      this.setData({ loading: false, recipe, favorited: favorite.isFavorite(recipe.id) });
      return;
    }
    this.setData({ loading: false, recipe: null });
  },

  // 从收藏列表返回时，保证收藏状态最新
  onShow() {
    if (this.data.recipe) {
      this.setData({ favorited: favorite.isFavorite(this.data.recipe.id) });
    }
  },

  toggleFavorite() {
    if (!this.data.recipe) return;
    const id = this.data.recipe.id;
    const nowFav = favorite.toggleFavorite(id);
    this.setData({ favorited: nowFav });
    wx.showToast({ title: nowFav ? '已收藏' : '已取消收藏', icon: 'none', duration: 800 });
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.redirectTo({ url: '/packages/chef/pages/index/index' });
  },

  onShareAppMessage() {
    var recipe = this.data.recipe;
    return {
      title: '日常琐事，交给这个小工具集就对了',
      path: '/packages/chef/pages/detail/detail?id=' + (recipe ? recipe.id : ''),
      imageUrl: '/images/share-cover.jpg'
    };
  },

  onShareTimeline() {
    var recipe = this.data.recipe;
    return { title: '日常琐事，交给这个小工具集就对了', imageUrl: '/images/share-cover.jpg' };
  }
});
