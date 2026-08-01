// utils/constellationData.js - 星座元素契合算法
const { seededRandom, clamp } = require('./util');

// 12 星座基础信息（元素：火/土/风/水）
const CONSTELLATIONS = {
  白羊座: { element: '火', range: '3.21-4.19' },
  金牛座: { element: '土', range: '4.20-5.20' },
  双子座: { element: '风', range: '5.21-6.21' },
  巨蟹座: { element: '水', range: '6.22-7.22' },
  狮子座: { element: '火', range: '7.23-8.22' },
  处女座: { element: '土', range: '8.23-9.22' },
  天秤座: { element: '风', range: '9.23-10.23' },
  天蝎座: { element: '水', range: '10.24-11.22' },
  射手座: { element: '火', range: '11.23-12.21' },
  摩羯座: { element: '土', range: '12.22-1.19' },
  水瓶座: { element: '风', range: '1.20-2.18' },
  双鱼座: { element: '水', range: '2.19-3.20' }
};

// 元素间契合基础分
function elementBase(e1, e2) {
  if (e1 === e2) return 95;
  const pair = [e1, e2].sort().join('');
  const table = {
    火风: 88,
    土水: 90,
    火土: 76,
    风水: 74,
    土风: 70,
    火水: 60
  };
  return table[pair] !== undefined ? table[pair] : 78;
}

function getElementRelation(e1, e2) {
  if (e1 === e2) return '同频';
  const pair = [e1, e2].sort().join('');
  if (pair === '火风' || pair === '土水') return '相生';
  if (pair === '火水') return '相克';
  return '调和';
}

const COMMENTS = {
  high: [
    '天作之合，在一起格外舒服，少有摩擦。',
    '气场同频，越相处越上头。',
    '默契度拉满，很多事一个眼神就懂了。'
  ],
  good: [
    '互补型组合，互相成就彼此。',
    '相处轻松，是能一起变好的关系。',
    '有火花也有包容，值得好好经营。'
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

// 同一对生日结果固定
function computeMatch(c1, c2) {
  const a = CONSTELLATIONS[c1];
  const b = CONSTELLATIONS[c2];
  const base = elementBase(a.element, b.element);
  const r = seededRandom(c1 + '|' + c2);
  const perturb = Math.floor(r() * 9) - 4; // -4 ~ +4
  const score = clamp(base + perturb, 55, 99);

  let level = 'mid';
  if (score >= 90) level = 'high';
  else if (score >= 80) level = 'good';
  else if (score < 70) level = 'low';

  const comment = COMMENTS[level][Math.floor(r() * COMMENTS[level].length)];
  return {
    score,
    level,
    relation: getElementRelation(a.element, b.element),
    element1: a.element,
    element2: b.element,
    comment
  };
}

module.exports = { CONSTELLATIONS, computeMatch };
