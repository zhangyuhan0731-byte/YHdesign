// 厨神模块 · 菜品收藏
// 使用本地缓存持久化收藏的菜品 id，跨页面、跨会话保留。

const STORAGE_KEY = 'chef_favorites';

function getFavorites() {
  try {
    const list = wx.getStorageSync(STORAGE_KEY);
    if (!Array.isArray(list)) return [];
    // 去重：防止缓存里出现重复 id 导致收藏数被虚高（例如同一道菜被记两次，
    // 会让「我的收藏」入口在只收藏 1 道菜时也误显示）
    const seen = {};
    const result = [];
    for (let i = 0; i < list.length; i++) {
      const id = list[i];
      if (!seen[id]) { seen[id] = 1; result.push(id); }
    }
    return result;
  } catch (e) {
    return [];
  }
}

function isFavorite(id) {
  return getFavorites().indexOf(id) >= 0;
}

function setFavorites(list) {
  try {
    // 写入前同样去重，保证缓存始终干净
    const seen = {};
    const result = [];
    (list || []).forEach(function (id) {
      if (!seen[id]) { seen[id] = 1; result.push(id); }
    });
    wx.setStorageSync(STORAGE_KEY, result);
  } catch (e) { /* 忽略写入异常 */ }
}

// 切换收藏状态，返回切换后的最新状态（true=已收藏）
function toggleFavorite(id) {
  if (!id) return false;
  const list = getFavorites();
  const idx = list.indexOf(id);
  let nowFav;
  if (idx >= 0) {
    list.splice(idx, 1);
    nowFav = false;
  } else {
    list.push(id);
    nowFav = true;
  }
  setFavorites(list);
  return nowFav;
}

// 根据完整目录，把收藏 id 还原成菜品对象（最近收藏的排在最前）
function getFavoriteRecipes(catalog) {
  const list = getFavorites();
  const byId = {};
  catalog.forEach(function (item) { byId[item.id] = item; });
  return list
    .map(function (id) { return byId[id]; })
    .filter(function (r) { return !!r; })
    .reverse();
}

module.exports = {
  STORAGE_KEY: STORAGE_KEY,
  getFavorites: getFavorites,
  isFavorite: isFavorite,
  toggleFavorite: toggleFavorite,
  getFavoriteRecipes: getFavoriteRecipes
};
