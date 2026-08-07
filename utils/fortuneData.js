// utils/fortuneData.js - 今日运势文案库与生成逻辑
// 替换 generateFortune 即可接入真实运势 API（保持返回结构一致即可）。

const { seededRandom, seededInt, seededPick, clamp } = require('./util');

const DIMENSIONS = ['综合', '事业', '爱情', '健康', '财运'];

const DIM_TEXTS = {
  综合: [
    '整体气场平稳，适合把计划落到实处。',
    '今天是收敛心神、整理状态的好日子。',
    '诸事顺遂，贵人运藏在细节里。',
    '略有波动，但大局可控，别慌。',
    '状态在线，抓住机会就能更进一步。'
  ],
  事业: [
    '思路清晰，推进项目事半功倍。',
    '适合沟通协作，团队配合默契。',
    '细节处易出小错，多检查一遍。',
    '有新契机出现，主动一点更好。',
    '宜沉住气，厚积薄发终有成。'
  ],
  爱情: [
    '暧昧升温，说出口的话会被温柔接住。',
    '平淡之中见真情，陪伴最踏实。',
    '少一点猜疑，多一点坦诚。',
    '桃花运不错，但别急着下结论。',
    '今日宜独处充电，感情也需要呼吸。'
  ],
  健康: [
    '精力充沛，适合出门走走。',
    '注意作息，早睡是最好的养生。',
    '饮食宜清淡，少熬夜少油腻。',
    '肩颈易紧绷，记得拉伸放松。',
    '心态平和，身体也会跟着轻盈。'
  ],
  财运: [
    '正财稳定，开销记得量入为出。',
    '有意外小惊喜，但别冲动消费。',
    '适合复盘账目，理清收支。',
    '投资宜保守，观望更稳妥。',
    '今日偏财一般，捂紧钱包为妙。'
  ]
};

const LUCKY_COLORS = [
  { name: '天蓝', hex: '#bfe3f2' },
  { name: '薄荷绿', hex: '#a8e6cf' },
  { name: '奶白', hex: '#fdfdfd' },
  { name: '蜜桃粉', hex: '#ffd3c4' },
  { name: '鹅黄', hex: '#ffe9a8' },
  { name: '雾紫', hex: '#cdbbf0' },
  { name: '珊瑚橙', hex: '#ffb38a' },
  { name: '湖水青', hex: '#9fe0d8' }
];

const YI_LIST = ['表白', '社交', '学习', '打扫', '运动', '购物', '出行', '规划', '复盘', '午睡', '约会', '读书'];
const JI_LIST = ['熬夜', '冲动消费', '拖延', '争吵', '暴饮暴食', '过度纠结', '孤军奋战', '勉强自己'];

const POEMS = [
  '云开见月明，心静自然成。',
  '行到水穷处，坐看云起时。',
  '好事多磨终有果，清风明月伴君行。',
  '莫愁前路无知己，天下谁人不识君。',
  '长风破浪会有时，直挂云帆济沧海。',
  '闲看庭前花开花落，漫随天外云卷云舒。',
  '心想事成皆顺遂，平安喜乐度今朝。',
  '守得云开见日出的，岁月温柔待有心人。',
  '一念放下，万般自在；从容前行，自有光明。',
  '今日宜微笑，好运自会悄悄来到。'
];

// 确定性生成：同一天结果固定；salt 可传入生日，使运势与个人绑定
function generateFortune(dateStr, salt) {
  const base = dateStr + '|' + (salt || '');
  const dims = DIMENSIONS.map((name) => {
    const r = seededRandom(base + '|' + name);
    const stars = 1 + Math.floor(r() * 5); // 1~5
    const texts = DIM_TEXTS[name];
    return { name, stars, text: texts[Math.floor(r() * texts.length)] };
  });

  const color = seededPick(base + '|color', LUCKY_COLORS);
  const number = seededInt(base + '|num', 1, 9);
  const yi = seededPick(base + '|yi', YI_LIST);
  const ji = seededPick(base + '|ji', JI_LIST);
  const poem = seededPick(base + '|poem', POEMS);

  return { date: dateStr, dims, color, number, yi, ji, poem };
}

// 换一签：随机刷新（不依赖日期），用于「换一签」按钮
function drawNewLot() {
  const yi = randomPick(YI_LIST);
  let ji = randomPick(JI_LIST);
  if (ji === yi) ji = randomPick(JI_LIST);
  return { yi, ji, poem: randomPick(POEMS) };
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = { DIMENSIONS, generateFortune, drawNewLot, LUCKY_COLORS };
