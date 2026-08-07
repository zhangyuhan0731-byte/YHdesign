// utils/zodiacData.js - 生肖六合/三合/相冲匹配
const { seededRandom, clamp } = require('./util');

// 生肖顺序（与 util.ZODIAC_NAMES 对应：鼠=0 ... 猪=11）
const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

// 六合：彼此最合拍的一对（传统「六合」配对）
const SIX_HE = [
  ['鼠', '牛'], ['虎', '猪'], ['兔', '狗'],
  ['龙', '鸡'], ['蛇', '猴'], ['马', '羊']
];

// 三合：三者为一组，同组彼此和谐
const THREE_HE = [
  ['猴', '鼠', '龙'],
  ['猪', '兔', '羊'],
  ['虎', '马', '狗'],
  ['蛇', '鸡', '牛']
];

// 相冲：彼此对立，相差六年，需要更多包容（传统「六冲」）
const SIX_CHONG = [
  ['鼠', '马'], ['牛', '羊'], ['虎', '猴'],
  ['兔', '鸡'], ['龙', '狗'], ['蛇', '猪']
];

function inPair(group, a, b) {
  return group.some(pair => pair.includes(a) && pair.includes(b));
}

function inGroup(groups, a, b) {
  return groups.some(g => g.includes(a) && g.includes(b));
}

// 关系定性
function getRelation(z1, z2) {
  if (z1 === z2) return '本命';
  if (inPair(SIX_HE, z1, z2)) return '六合';
  if (inGroup(THREE_HE, z1, z2)) return '三合';
  if (inPair(SIX_CHONG, z1, z2)) return '相冲';
  return '一般';
}

// 关系基础分
function relationBase(relation) {
  switch (relation) {
    case '本命': return 88;
    case '六合': return 95;
    case '三合': return 84;
    case '相冲': return 58;
    default: return 73;
  }
}

const COMMENTS = {
  high: [
    '天造地设的一对，相处起来格外顺心。',
    '气场太合了，很多事不谋而合。',
    '默契满满，是能长久走下去的组合。'
  ],
  good: [
    '同气相求，互相成就彼此。',
    '三观很搭，越处越舒服。',
    '有共同语言，是能一起变好的关系。'
  ],
  mid: [
    '需要一点磨合，磨合好了也挺甜。',
    '性格有差异，多沟通就能避雷。',
    '平淡里藏着稳定，细水长流也不错。'
  ],
  low: [
    '性格有点冲，建议多给彼此空间。',
    '节奏不太一样，别急着下定义。',
    '需要多一点耐心，缘分才稳得住。'
  ]
};

// 同一对生肖结果固定
function computeMatch(z1, z2) {
  const relation = getRelation(z1, z2);
  const base = relationBase(relation);
  const r = seededRandom(z1 + '|' + z2);
  const perturb = Math.floor(r() * 9) - 4; // -4 ~ +4
  const score = clamp(base + perturb, 55, 99);

  let level = 'mid';
  if (score >= 90) level = 'high';
  else if (score >= 80) level = 'good';
  else if (score < 70) level = 'low';

  const comment = COMMENTS[level][Math.floor(r() * COMMENTS[level].length)];
  return { score, level, relation, comment };
}

module.exports = { ZODIAC, SIX_HE, THREE_HE, SIX_CHONG, getRelation, computeMatch };
