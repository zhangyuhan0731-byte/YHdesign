// pages/home/home.js - 首页宫格
const tools = [
  { key: 'chef',          name: '厨神',     icon: 'ic-chef',          desc: '368道菜照着做',     tone: 'orange', path: '/packages/chef/pages/index/index' },
  { key: 'pantry',        name: '我的食材', icon: 'ic-pantry',        desc: '看看现有食材能做什么', tone: 'mint', path: '/packages/chef/pages/pantry/pantry' },
  { key: 'ledger',        name: '记账本',   icon: 'ic-ledger',        desc: '收入支出轻松记',   tone: 'sky',    path: '/pages/ledger/ledger' },
  { key: 'memo',          name: '备忘录',   icon: 'ic-memo',          desc: '随手保存小事情',   tone: 'ink',    path: '/pages/memo/memo' },
  { key: 'countdown',     name: '倒数日记', icon: 'ic-countdown',     desc: '重要日子不忘记',   tone: 'orange', path: '/pages/countdown/countdown' },
  { key: 'wheel',         name: '幸运转盘', icon: 'ic-wheel',         desc: '选择困难时转一下', tone: 'blue',   path: '/pages/wheel/wheel' },
  { key: 'mood',          name: '心情日记', icon: 'ic-mood',          desc: '每天记一句心情',   tone: 'sky',    path: '/pages/mood/mood' },
  { key: 'weight',        name: '体重记录', icon: 'ic-weight',        desc: '记录近期变化',     tone: 'leaf',   path: '/pages/weight/weight' },
  { key: 'water',         name: '喝水提醒', icon: 'ic-water',         desc: '今天喝了几杯',     tone: 'blue',   path: '/pages/water/water' },
  { key: 'recipe',        name: '今日菜谱', icon: 'ic-recipe',        desc: '从368道菜里推荐',   tone: 'leaf',   path: '/packages/chef/pages/today/today' },
  { key: 'draw',          name: '每日抽签', icon: 'ic-draw',          desc: '抽一支今日灵感签', tone: 'rose',   path: '/pages/draw/draw' },
  { key: 'constellation', name: '星座匹配', icon: 'ic-constellation', desc: '看看两人的契合度', tone: 'violet', path: '/pages/constellation/constellation' },
  { key: 'zodiac',        name: '生肖匹配', icon: 'ic-zodiac',        desc: '属相关系轻松查',   tone: 'mint',   path: '/pages/zodiac/zodiac' },
  { key: 'woodfish',      name: '敲木鱼',   icon: 'ic-woodfish',      desc: '安静敲一敲木鱼',   tone: 'dark',   path: '/pages/woodfish/woodfish' }
];

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早安';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

Page({
  data: { tools, greet: greeting() },
  onTap(e) {
    const path = e.currentTarget.dataset.path;
    wx.navigateTo({ url: path });
  }
});
