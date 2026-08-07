function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s()（）【】\[\]·.。]/g, '')
    .replace(/西红柿/g, '番茄')
    .replace(/马铃薯/g, '土豆')
    .replace(/鸡胸脯/g, '鸡胸')
    .replace(/生抽酱油/g, '生抽')
    .replace(/老抽酱油/g, '老抽');
}

function parseOwned(value) {
  const seen = {};
  return String(value || '')
    .split(/[\s,，、;；+＋\n]+/)
    .map(function (item) { return item.trim(); })
    .filter(function (item) {
      const key = normalizeText(item);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
}

function includesOwned(owned, requiredName) {
  const target = normalizeText(requiredName);
  return owned.some(function (item) {
    const value = normalizeText(item);
    return value && (target.indexOf(value) >= 0 || value.indexOf(target) >= 0);
  });
}

function matchedItems(required, owned) {
  return (required || []).filter(function (name) { return includesOwned(owned, name); });
}

function recommend(catalog, input, limit) {
  const foods = parseOwned(input.foods);
  const seasonings = parseOwned(input.seasonings);
  const tools = parseOwned(input.tools);
  if (!foods.length) return [];

  return catalog.map(function (recipe) {
    const requiredFoods = recipe.match.foods || [];
    const foodHave = matchedItems(requiredFoods, foods);
    const missingFoods = requiredFoods.filter(function (name) { return !includesOwned(foods, name); });
    const optionalHits = matchedItems(recipe.match.optionalFoods || [], foods);
    const seasoningHave = matchedItems(recipe.match.seasonings || [], seasonings);
    const toolHave = matchedItems(recipe.match.tools || [], tools);
    const foodCoverage = foodHave.length / Math.max(requiredFoods.length, 1);
    const seasoningCoverage = seasoningHave.length / Math.max((recipe.match.seasonings || []).length, 1);
    const toolCoverage = toolHave.length / Math.max((recipe.match.tools || []).length, 1);
    let rankScore = foodCoverage * 80 + Math.min(optionalHits.length * 2, 6);
    if (seasonings.length) rankScore += seasoningCoverage * 12;
    if (tools.length) rankScore += toolCoverage * 8;
    return {
      recipe,
      foodHave,
      missingFoods,
      optionalHits,
      seasoningHave,
      toolHave,
      rankScore,
      matchPercent: Math.round(foodCoverage * 100)
    };
  }).filter(function (item) {
    return item.foodHave.length > 0;
  }).sort(function (a, b) {
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
    if (a.missingFoods.length !== b.missingFoods.length) return a.missingFoods.length - b.missingFoods.length;
    return a.recipe.difficulty - b.recipe.difficulty;
  }).slice(0, limit || 20).map(function (item) {
    const recipe = item.recipe;
    return {
      id: recipe.id,
      name: recipe.name,
      categoryLabel: recipe.categoryLabel,
      difficultyText: recipe.difficultyText,
      levelLabel: recipe.levelLabel,
      calories: recipe.calories,
      matchPercent: item.matchPercent,
      haveText: item.foodHave.concat(item.optionalHits).join('、') || '暂无',
      missingText: item.missingFoods.join('、') || '主要食材已齐',
      seasoningText: seasonings.length
        ? `${item.seasoningHave.length}/${(recipe.match.seasonings || []).length} 项匹配`
        : '未参与匹配',
      toolText: tools.length
        ? `${item.toolHave.length}/${(recipe.match.tools || []).length} 项匹配`
        : '未参与匹配'
    };
  });
}

module.exports = { parseOwned, includesOwned, recommend };
