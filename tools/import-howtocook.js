#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'packages', 'chef', 'data', 'generated');
const PACKAGE_DIR = path.join(PROJECT_ROOT, 'packages', 'chef');
const MAX_PACKAGE_BYTES = 1.8 * 1024 * 1024;

const CATEGORY_ORDER = [
  'meat_dish', 'vegetable_dish', 'aquatic', 'breakfast', 'staple',
  'soup', 'dessert', 'drink', 'condiment', 'semi-finished'
];

const CATEGORY_LABELS = {
  meat_dish: '荤菜',
  vegetable_dish: '素菜',
  aquatic: '水产',
  breakfast: '早餐',
  staple: '主食',
  soup: '汤羹',
  dessert: '甜点',
  drink: '饮品',
  condiment: '调味料',
  'semi-finished': '半成品'
};

const CUISINE_RULES = [
  ['川味', /(川菜|川味|四川|成都|重庆)/],
  ['粤味', /(粤菜|粤式|广东|广式|潮汕)/],
  ['湘味', /(湘菜|湘味|湖南)/],
  ['鲁味', /(鲁菜|山东)/],
  ['苏味', /(苏菜|淮扬|江苏)/],
  ['浙味', /(浙菜|浙江|杭州)/],
  ['闽味', /(闽菜|福建|福州|厦门)/],
  ['徽味', /(徽菜|安徽)/]
];

const TOOL_PATTERN = /(锅|刀|砧板|案板|烤箱|空气炸锅|微波炉|电饭煲|料理机|破壁机|打蛋器|滤网|漏勺|擀面杖|模具|烤盘|蒸箱|高压锅|压力锅|剪刀|保鲜膜|牙签|温度计|电子秤|裱花袋|筷子|勺子|汤勺|锅铲|碗|盆)$/;
const SEASONING_PATTERN = /(盐|糖|冰糖|白糖|红糖|生抽|老抽|酱油|醋|料酒|蚝油|香油|麻油|芝麻油|食用油|植物油|橄榄油|淀粉|胡椒|胡椒粉|辣椒粉|花椒|花椒粉|味精|鸡精|豆瓣酱|甜面酱|番茄酱|辣椒酱|孜然|孜然粉|咖喱粉|五香粉|十三香|香料|椒盐|小苏打|泡打粉|酵母|油|酱)$/;
const CONTRIBUTION_PATTERN = /(如果您遵循本指南|如有问题或可以改进|请提出 Issue|Pull request)/i;

function parseArgs(argv) {
  const result = {
    source: path.resolve(PROJECT_ROOT, '..', 'HowToCook'),
    check: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') result.check = true;
    if (arg === '--source' && argv[index + 1]) {
      result.source = path.resolve(argv[index + 1]);
      index += 1;
    }
  }
  return result;
}

function walkMarkdown(root) {
  const files = [];
  function walk(current) {
    fs.readdirSync(current, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
      .forEach((entry) => {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) walk(fullPath);
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) files.push(fullPath);
      });
  }
  walk(root);
  return files;
}

function cleanInline(value) {
  return String(value || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_`~]/g, '')
    .replace(/^>\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSectionLines(lines) {
  const result = [];
  let inFence = false;
  lines.forEach((rawLine) => {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('```')) {
      inFence = !inFence;
      return;
    }
    if (/^!\[[^\]]*\]\([^)]*\)\s*$/.test(trimmed)) return;
    if (CONTRIBUTION_PATTERN.test(trimmed)) return;
    if (/^\|?\s*:?-{3,}/.test(trimmed)) return;
    if (trimmed.startsWith('|')) {
      const cells = trimmed.split('|').map(cleanInline).filter(Boolean);
      if (cells.length) result.push(cells.join(' · '));
      return;
    }
    const cleaned = cleanInline(rawLine);
    if (cleaned || inFence) result.push(cleaned);
    else result.push('');
  });
  return result;
}

function splitSections(markdown) {
  const lines = markdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n');
  const sections = { intro: [] };
  let current = 'intro';
  lines.forEach((line) => {
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) {
      current = cleanInline(match[1]);
      if (!sections[current]) sections[current] = [];
      return;
    }
    sections[current].push(line);
  });
  return { lines, sections };
}

function sectionLines(sections, name) {
  return cleanSectionLines(sections[name] || []);
}

function classifyItem(name) {
  const compact = name.replace(/[（(].*?[）)]/g, '').trim();
  if (TOOL_PATTERN.test(compact)) return 't';
  if (SEASONING_PATTERN.test(compact)) return 's';
  return 'f';
}

function parseRequirements(rawLines) {
  const items = [];
  let group = '必备';
  rawLines.forEach((rawLine, index) => {
    const heading = rawLine.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      group = cleanInline(heading[1]);
      return;
    }
    const bullet = rawLine.match(/^(\s*)[-*+]\s+(.+?)\s*$/);
    if (!bullet) return;
    const indent = bullet[1].replace(/\t/g, '  ').length;
    const nextBullet = (rawLines[index + 1] || '').match(/^(\s*)[-*+]\s+/);
    if (nextBullet && nextBullet[1].replace(/\t/g, '  ').length > indent) {
      group = cleanInline(bullet[2]);
      return;
    }
    const name = cleanInline(bullet[2]);
    if (!name) return;
    const optional = /可选|按需|任选/.test(group + name) ? 1 : 0;
    items.push([group, name, classifyItem(name), optional]);
  });
  return items;
}

function parseAmountLine(value) {
  const cleaned = cleanInline(value).replace(/[；;。]$/, '').trim();
  const equalIndex = cleaned.indexOf('=');
  if (equalIndex > 0) {
    return [cleaned.slice(0, equalIndex).trim(), cleaned.slice(equalIndex + 1).trim()];
  }
  const match = cleaned.match(/^(.+?)\s+(约?\s*[\d一二三四五六七八九十半少适若几两]+.*)$/);
  if (match) return [match[1].trim(), match[2].trim()];
  return [cleaned, ''];
}

function parseAmounts(rawLines) {
  const groups = [];
  let group = '参考用量';
  let currentItems = [];
  let currentNotes = [];
  let tableHeaders = null;
  function flush() {
    if (currentItems.length || currentNotes.length) groups.push([group, currentItems, unique(currentNotes)]);
    currentItems = [];
    currentNotes = [];
    tableHeaders = null;
  }
  for (let index = 0; index < rawLines.length; index += 1) {
    const rawLine = rawLines[index];
    const trimmed = rawLine.trim();
    const heading = rawLine.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      flush();
      group = cleanInline(heading[1]);
      continue;
    }
    if (/^\|?\s*:?-{3,}/.test(trimmed) || trimmed === '---' || /^!\[/.test(trimmed)) continue;
    if (trimmed.startsWith('|')) {
      const cells = trimmed.split('|').map(cleanInline).filter(Boolean);
      if (!cells.length) continue;
      if (!tableHeaders) {
        tableHeaders = cells;
      } else {
        const amountText = cells.slice(1).map(function (cell, cellIndex) {
          return `${tableHeaders[cellIndex + 1] || `规格${cellIndex + 1}`}：${cell}`;
        }).join('；');
        currentItems.push([cells[0], amountText, classifyItem(cells[0])]);
      }
      continue;
    }
    const bullet = rawLine.match(/^(\s*)[-*+]\s+(.+?)\s*$/);
    if (!bullet) {
      const note = cleanInline(rawLine);
      if (note && !CONTRIBUTION_PATTERN.test(note)) currentNotes.push(note);
      continue;
    }
    const indent = bullet[1].replace(/\t/g, '  ').length;
    const next = rawLines[index + 1] || '';
    const nextBullet = next.match(/^(\s*)[-*+]\s+/);
    if (nextBullet && nextBullet[1].replace(/\t/g, '  ').length > indent) {
      flush();
      group = cleanInline(bullet[2]);
      continue;
    }
    const pair = parseAmountLine(bullet[2]);
    if (pair[0]) currentItems.push([pair[0], pair[1], classifyItem(pair[0])]);
  }
  flush();
  return groups;
}

function parseStepGroups(rawLines) {
  const groups = [];
  let title = '制作步骤';
  let steps = [];
  function flush() {
    if (steps.length) groups.push([title, steps]);
    steps = [];
  }
  rawLines.forEach((rawLine) => {
    const heading = rawLine.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      flush();
      title = cleanInline(heading[1]);
      return;
    }
    if (/^#{4,}\s+/.test(rawLine)) {
      const subtitle = cleanInline(rawLine.replace(/^#{4,}\s+/, ''));
      if (subtitle) steps.push(subtitle);
      return;
    }
    let text = rawLine.replace(/^\s*\d+[.)、]\s*/, '').replace(/^\s*[-*+]\s+/, '');
    text = cleanInline(text);
    if (text && !CONTRIBUTION_PATTERN.test(text)) steps.push(text);
  });
  flush();
  return groups;
}

function parseNotes(rawLines) {
  return cleanSectionLines(rawLines)
    .map((line) => cleanInline(line.replace(/^#{3,}\s+/, '').replace(/^\s*[-*+]\s+/, '').replace(/^\s*\d+[.)、]\s*/, '')))
    .filter((line) => line && !CONTRIBUTION_PATTERN.test(line));
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function stableId(relativePath) {
  return crypto.createHash('sha1').update(relativePath.replace(/\\/g, '/')).digest('hex').slice(0, 10);
}

function parseRecipe(filePath, dishesRoot) {
  const relativePath = path.relative(dishesRoot, filePath).replace(/\\/g, '/');
  const category = relativePath.split('/')[0];
  const markdown = fs.readFileSync(filePath, 'utf8');
  const { lines, sections } = splitSections(markdown);
  const titleLine = lines.find((line) => /^#\s+/.test(line)) || path.basename(filePath, '.md');
  const name = cleanInline(titleLine.replace(/^#\s+/, '')).replace(/的做法$/, '').trim();
  const difficultyMatch = markdown.match(/预估烹饪难度[：:]\s*([^\r\n]+)/);
  const difficulty = Math.max(1, Math.min(5, ((difficultyMatch && difficultyMatch[1].match(/★/g)) || []).length || 1));
  const caloriesMatch = markdown.match(/预估卡路里[：:]\s*([^\r\n]+)/);
  const calories = caloriesMatch ? cleanInline(caloriesMatch[1]) : '';
  const intro = sectionLines(sections, 'intro')
    .filter((line) => line && !/^#\s+/.test(line) && !/预估(烹饪难度|卡路里)/.test(line))
    .join(' ')
    .trim();
  const requirements = parseRequirements(sections['必备原料和工具'] || []);
  const amountGroups = parseAmounts(sections['计算'] || []);
  const stepGroups = parseStepGroups(sectionLines(sections, '操作'));
  const notes = parseNotes(sections['附加内容'] || []);
  const allText = [name, intro, markdown.slice(0, 1600)].join(' ');
  const tags = CUISINE_RULES.filter((rule) => rule[1].test(allText)).map((rule) => rule[0]);
  const ingredientNames = unique(requirements.filter((item) => item[2] !== 't').map((item) => item[1]));
  const keywords = unique([name].concat(ingredientNames, tags)).join(' ').toLowerCase();

  return {
    id: stableId(relativePath),
    name,
    category,
    difficulty,
    calories,
    tags,
    intro,
    requirements,
    amountGroups,
    stepGroups,
    notes,
    ingredients: ingredientNames,
    keywords,
    relativePath
  };
}

function serializeModule(value) {
  return `// 此文件由 tools/import-howtocook.js 自动生成，请勿手工编辑。\nmodule.exports=${JSON.stringify(value)};\n`;
}

function collectExpectedFiles(recipes, sourceVersion) {
  const output = {};
  const catalog = recipes.map((recipe) => {
    const matchGroups = { f: [[], []], s: [[], []], t: [[], []] };
    recipe.requirements.forEach((item) => {
      const kind = matchGroups[item[2]] ? item[2] : 'f';
      matchGroups[kind][item[3] === 1 ? 1 : 0].push(item[1]);
    });
    return [
      recipe.id,
      recipe.name,
      recipe.category,
      recipe.difficulty,
      recipe.calories,
      recipe.tags,
      recipe.ingredients.slice(0, 4),
      recipe.keywords,
      [
        unique(matchGroups.f[0]), unique(matchGroups.f[1]),
        unique(matchGroups.s[0]), unique(matchGroups.s[1]),
        unique(matchGroups.t[0]), unique(matchGroups.t[1])
      ]
    ];
  });
  output['catalog.js'] = serializeModule(catalog);

  CATEGORY_ORDER.forEach((category) => {
    const records = recipes
      .filter((recipe) => recipe.category === category)
      .map((recipe) => [
        recipe.id,
        recipe.intro,
        recipe.requirements,
        recipe.amountGroups,
        recipe.stepGroups,
        recipe.notes
      ]);
    output[`${category}.js`] = serializeModule(records);
  });

  const categoryMeta = CATEGORY_ORDER.map((key) => [
    key,
    CATEGORY_LABELS[key],
    recipes.filter((recipe) => recipe.category === key).length
  ]);
  const tagMeta = unique(recipes.flatMap((recipe) => recipe.tags)).map((tag) => [
    tag,
    recipes.filter((recipe) => recipe.tags.includes(tag)).length
  ]);
  output['meta.js'] = serializeModule({
    source: 'Anduin2017/HowToCook',
    license: 'Unlicense',
    version: sourceVersion,
    total: recipes.length,
    categories: categoryMeta,
    tags: tagMeta
  });
  return output;
}

function validate(recipes, expectedFiles) {
  const ids = new Set();
  recipes.forEach((recipe) => {
    if (ids.has(recipe.id)) throw new Error(`菜谱 ID 重复: ${recipe.id}`);
    ids.add(recipe.id);
    if (!recipe.name || !recipe.requirements.length || !recipe.stepGroups.length) {
      throw new Error(`菜谱必要内容缺失: ${recipe.relativePath}`);
    }
  });
  const generatedText = Object.values(expectedFiles).join('\n');
  if (/!\[[^\]]*\]\(/.test(generatedText)) throw new Error('生成数据仍包含 Markdown 图片引用');
  if (CONTRIBUTION_PATTERN.test(generatedText)) throw new Error('生成数据仍包含贡献模板文字');
  const unknownCategories = unique(recipes.map((recipe) => recipe.category)).filter((item) => !CATEGORY_ORDER.includes(item));
  if (unknownCategories.length) throw new Error(`发现未知分类: ${unknownCategories.join(', ')}`);
}

function directoryBytes(root, ignoredRoot) {
  if (!fs.existsSync(root)) return 0;
  let total = 0;
  fs.readdirSync(root, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(root, entry.name);
    if (ignoredRoot && path.resolve(fullPath) === path.resolve(ignoredRoot)) return;
    if (entry.isDirectory()) total += directoryBytes(fullPath, ignoredRoot);
    else if (entry.isFile()) total += fs.statSync(fullPath).size;
  });
  return total;
}

function writeOrCheck(expectedFiles, check) {
  if (check) {
    const missingOrChanged = Object.entries(expectedFiles).filter(([name, content]) => {
      const target = path.join(OUTPUT_DIR, name);
      return !fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content;
    });
    const unexpected = fs.existsSync(OUTPUT_DIR)
      ? fs.readdirSync(OUTPUT_DIR).filter((name) => name.endsWith('.js') && !expectedFiles[name])
      : [];
    if (missingOrChanged.length || unexpected.length) {
      throw new Error(`生成数据不是最新状态: ${missingOrChanged.map(([name]) => name).concat(unexpected).join(', ')}`);
    }
    return;
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.readdirSync(OUTPUT_DIR).filter((name) => name.endsWith('.js') && !expectedFiles[name])
    .forEach((name) => fs.unlinkSync(path.join(OUTPUT_DIR, name)));
  Object.entries(expectedFiles).forEach(([name, content]) => {
    const target = path.join(OUTPUT_DIR, name);
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) {
      fs.writeFileSync(target, content, 'utf8');
    }
  });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const dishesRoot = path.join(options.source, 'dishes');
  if (!fs.existsSync(dishesRoot)) throw new Error(`找不到 HowToCook 菜谱目录: ${dishesRoot}`);
  const packageJsonPath = path.join(options.source, 'package.json');
  const sourceVersion = fs.existsSync(packageJsonPath)
    ? String(JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version || '')
    : '';
  const files = walkMarkdown(dishesRoot).filter((filePath) => {
    return path.relative(dishesRoot, filePath).split(path.sep)[0] !== 'template';
  });
  const recipes = files.map((filePath) => parseRecipe(filePath, dishesRoot))
    .sort((a, b) => {
      const categoryDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
      return categoryDiff || a.name.localeCompare(b.name, 'zh-CN');
    });
  const expectedFiles = collectExpectedFiles(recipes, sourceVersion);
  validate(recipes, expectedFiles);
  writeOrCheck(expectedFiles, options.check);

  const expectedDataBytes = Object.values(expectedFiles).reduce((sum, content) => sum + Buffer.byteLength(content), 0);
  const packageBytes = expectedDataBytes + directoryBytes(PACKAGE_DIR, OUTPUT_DIR);
  if (packageBytes > MAX_PACKAGE_BYTES) {
    throw new Error(`厨神分包预计 ${(packageBytes / 1024 / 1024).toFixed(2)}MB，超过 1.8MB 安全线`);
  }
  const counts = CATEGORY_ORDER.map((category) => `${CATEGORY_LABELS[category]} ${recipes.filter((recipe) => recipe.category === category).length}`).join('，');
  console.log(`${options.check ? '校验通过' : '生成完成'}：${recipes.length} 道菜；${counts}`);
  console.log(`生成数据 ${(expectedDataBytes / 1024).toFixed(1)}KB；厨神分包预计 ${(packageBytes / 1024).toFixed(1)}KB`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
