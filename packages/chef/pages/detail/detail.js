const { getRecipe } = require('../../data/index');

Page({
  data: {
    loading: true,
    recipe: null
  },

  onLoad(options) {
    const recipe = getRecipe(options.id || '');
    if (recipe) {
      wx.setNavigationBarTitle({ title: recipe.name });
      this.setData({ loading: false, recipe });
      return;
    }
    this.setData({ loading: false, recipe: null });
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.redirectTo({ url: '/packages/chef/pages/index/index' });
  }
});
