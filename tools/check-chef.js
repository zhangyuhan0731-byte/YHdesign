#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { getCatalog, getMeta, getRecipe } = require('../packages/chef/data');
const { recommend } = require('../packages/chef/utils/matcher');

const projectRoot = path.resolve(__dirname, '..');
const catalog = getCatalog();
const meta = getMeta();

assert.strictEqual(catalog.length, 368, '当前 HowToCook 快照应生成 368 道菜');
assert.strictEqual(meta.total, catalog.length, '元数据总数与目录不一致');
assert.strictEqual(meta.categories.reduce((sum, item) => sum + item.count, 0), catalog.length, '分类计数不一致');
assert.strictEqual(new Set(catalog.map((item) => item.id)).size, catalog.length, '菜谱 ID 不唯一');
assert(meta.tags.some((item) => item.key === '川味' && item.count > 0), '缺少川味筛选数据');

const detailProblems = [];
catalog.forEach((summary) => {
  const recipe = getRecipe(summary.id);
  if (!recipe) detailProblems.push(`${summary.name}: 无法读取详情`);
  else if (!recipe.requirementGroups.length) detailProblems.push(`${summary.name}: 缺少准备清单`);
  else if (!recipe.amountGroups.length) detailProblems.push(`${summary.name}: 缺少份量说明`);
  else if (!recipe.stepGroups.length) detailProblems.push(`${summary.name}: 缺少制作步骤`);
});
assert.deepStrictEqual(detailProblems, [], detailProblems.slice(0, 10).join('\n'));

function filter(options) {
  const keyword = String(options.keyword || '').toLowerCase();
  return catalog.filter((recipe) => {
    if (options.category && recipe.category !== options.category) return false;
    if (options.level && recipe.level !== options.level) return false;
    if (options.tag && recipe.tags.indexOf(options.tag) < 0) return false;
    return !keyword || recipe.keywords.indexOf(keyword) >= 0;
  });
}

assert(filter({ keyword: '鸡蛋' }).length > 0, '食材搜索没有结果');
assert(filter({ category: 'vegetable_dish' }).length === 63, '素菜筛选数量错误');
assert(filter({ category: 'breakfast' }).length === 25, '早餐筛选数量错误');
assert(filter({ level: 'simple' }).every((item) => item.difficulty <= 2), '简单菜筛选错误');
assert(filter({ tag: '川味' }).every((item) => item.tags.indexOf('川味') >= 0), '川味筛选错误');
assert(filter({ category: 'vegetable_dish', level: 'simple' }).length > 0, '组合筛选没有结果');

const pantryResults = recommend(catalog, {
  foods: '鸡蛋、番茄',
  seasonings: '盐、生抽',
  tools: '炒锅'
}, 20);
assert(pantryResults.length > 0, '我的食材没有生成推荐');
assert(pantryResults.some((item) => /番茄|西红柿/.test(item.name)), '番茄同义词匹配失败');
assert(pantryResults.every((item) => catalog.some((recipe) => recipe.id === item.id)), '推荐包含未知菜谱');

[
  'packages/chef/pages/today/today.js',
  'packages/chef/pages/pantry/pantry.js',
  'packages/chef/pages/detail/detail.js'
].forEach((relativePath) => {
  assert(fs.existsSync(path.join(projectRoot, relativePath)), `缺少页面文件: ${relativePath}`);
});

const generatedRoot = path.join(projectRoot, 'packages', 'chef', 'data', 'generated');
const generatedText = fs.readdirSync(generatedRoot)
  .filter((name) => name.endsWith('.js'))
  .map((name) => fs.readFileSync(path.join(generatedRoot, name), 'utf8'))
  .join('\n');
assert(!/!\[[^\]]*\]\(/.test(generatedText), '生成数据残留 Markdown 图片');
assert(!/如果您遵循本指南|请提出 Issue|Pull request/i.test(generatedText), '生成数据残留贡献模板');

console.log(`厨神校验通过：${catalog.length} 道菜，${meta.categories.length} 个类型，${meta.tags.length} 个特色标签`);
