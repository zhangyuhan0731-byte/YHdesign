const { getCatalog, getRecipe } = require('../../data/index');
const { today, seededInt } = require('../../../../utils/util');

const recipes = getCatalog();

function buildView(summary) {
  const detail = getRecipe(summary.id);
  const previewSteps = [];
  detail.stepGroups.forEach(function (group) {
    group.steps.forEach(function (step) {
      if (previewSteps.length < 3) previewSteps.push(step);
    });
  });
  return Object.assign({}, detail, { previewSteps });
}

Page({
  data: {
    recipeIndex: 0,
    recipe: null,
    total: recipes.length
  },

  onLoad() {
    const index = seededInt(`${today()}|chef-today`, 0, recipes.length - 1);
    this.showRecipe(index);
  },

  showRecipe(index) {
    this.setData({ recipeIndex: index, recipe: buildView(recipes[index]) });
  },

  changeRecipe() {
    let next = Math.floor(Math.random() * recipes.length);
    if (next === this.data.recipeIndex) next = (next + 1) % recipes.length;
    this.showRecipe(next);
  },

  openDetail() {
    if (!this.data.recipe) return;
    wx.navigateTo({ url: `/packages/chef/pages/detail/detail?id=${this.data.recipe.id}` });
  },

  openCooking() {
    if (!this.data.recipe) return;
    wx.navigateTo({ url: `/packages/chef/pages/cooking/cooking?id=${this.data.recipe.id}` });
  },

  onShareAppMessage() {
    return {
      title: '今日菜谱 - 从368道菜里推荐',
      path: '/packages/chef/pages/today/today'
    };
  },

  onShareTimeline() {
    return { title: '今日菜谱 - 从368道菜里推荐' };
  }
});
