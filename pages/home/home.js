// pages/home/home.js - 首页宫格 + 自定义顺序
//
// 顺序调整方式：列表 + 上移 / 下移（不再使用拖拽）。
//   - 正常态：两列宫格展示工具，点卡片直接进入对应工具。
//   - 调整顺序：点右上角「调整顺序」切到列表视图，每行有「↑上移 / ↓下移」按钮，
//     点一下就和相邻项交换位置并立即存到本机；首尾项对应的按钮自动禁用。
//   - 点「完成」回到宫格。
const DEFAULT_TOOLS = [
  { key: 'chef',          name: '厨神',     icon: 'ic-chef',          desc: '368道菜照着做',     tone: 'orange', path: '/packages/chef/pages/index/index' },
  { key: 'pantry',        name: '我的食材', icon: 'ic-pantry',        desc: '看看现有食材能做什么', tone: 'mint', path: '/packages/chef/pages/pantry/pantry' },
  { key: 'ledger',        name: '记账本',   icon: 'ic-ledger',        desc: '收入支出轻松记',   tone: 'sky',    path: '/pages/ledger/ledger' },
  { key: 'memo',          name: '备忘录',   icon: 'ic-memo',          desc: '随手保存小事情',   tone: 'ink',    path: '/pages/memo/memo' },
  { key: 'countdown',     name: '倒数日记', icon: 'ic-countdown',     desc: '重要日子不忘记',   tone: 'orange', path: '/pages/countdown/countdown' },
  { key: 'wheel',         name: '幸运转盘', icon: 'ic-wheel',         desc: '选择困难时转一下', tone: 'blue',   path: '/pages/wheel/wheel' },
  { key: 'mood',          name: '心情日记', icon: 'ic-mood',          desc: '每天记一句心情',   tone: 'sky',    path: '/pages/mood/mood' },
  { key: 'weight',        name: '体重记录', icon: 'ic-weight',        desc: '记录近期变化',     tone: 'leaf',   path: '/pages/weight/weight' },
  { key: 'water',         name: '喝水提醒', icon: 'ic-water',         desc: '今天喝了几杯',     tone: 'blue',   path: '/pages/water/water' },
  { key: 'recipe',        name: '今日菜谱', icon: 'ic-recipe',        desc: '从368道菜里推荐',  tone: 'leaf',   path: '/packages/chef/pages/today/today' },
  { key: 'draw',          name: '每日抽签', icon: 'ic-draw',          desc: '抽一支今日灵感签', tone: 'rose',   path: '/pages/draw/draw' },
  { key: 'constellation', name: '星座匹配', icon: 'ic-constellation', desc: '看看两人的契合度', tone: 'violet', path: '/pages/constellation/constellation' },
  { key: 'zodiac',        name: '生肖匹配', icon: 'ic-zodiac',        desc: '属相关系轻松查',   tone: 'mint',   path: '/pages/zodiac/zodiac' },
  { key: 'woodfish',      name: '敲木鱼',   icon: 'ic-woodfish',      desc: '安静敲一敲木鱼',   tone: 'dark',   path: '/pages/woodfish/woodfish' }
];

const STORAGE_KEY = 'home_tool_order';

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早安';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function loadTools() {
  try {
    const saved = wx.getStorageSync(STORAGE_KEY);
    if (Array.isArray(saved) && saved.length === DEFAULT_TOOLS.length) {
      const map = new Map(DEFAULT_TOOLS.map(t => [t.key, t]));
      const arr = saved.map(k => map.get(k)).filter(Boolean);
      if (arr.length === DEFAULT_TOOLS.length) return arr;
    }
  } catch (e) {}
  return DEFAULT_TOOLS.slice();
}

function saveTools(tools) {
  try { wx.setStorageSync(STORAGE_KEY, tools.map(t => t.key)); } catch (e) {}
}

Page({
  data: {
    tools: [],
    greet: greeting(),
    editing: false
  },

  onShow() {
    // 列表里的每次上移/下移都已即时存盘，这里统一从存储回填，保证一致
    this.setData({ tools: loadTools(), greet: greeting() });
  },

  onTap(e) {
    if (this.data.editing) return;
    wx.navigateTo({ url: e.currentTarget.dataset.path });
  },

  toggleEdit() {
    const editing = !this.data.editing;
    this.setData({ editing });
    if (!editing) wx.showToast({ title: '顺序已保存', icon: 'success', duration: 800 });
  },

  // 与相邻项交换位置并即时存盘
  swap(from, to) {
    const tools = this.data.tools;
    if (to < 0 || to >= tools.length || from === to) return;
    const next = tools.slice();
    const tmp = next[from];
    next[from] = next[to];
    next[to] = tmp;
    saveTools(next);
    this.setData({ tools: next });
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
  },

  moveUp(e) {
    const i = e.currentTarget.dataset.index;
    this.swap(i, i - 1);
  },

  moveDown(e) {
    const i = e.currentTarget.dataset.index;
    this.swap(i, i + 1);
  },

  onShareAppMessage() {
    return {
      title: '日常琐事，交给这个小工具集就对了',
      imageUrl: '/images/share-cover.png',
      path: '/pages/home/home',
    };
  },

  onShareTimeline() {
    return {
      title: '日常琐事，交给这个小工具集就对了',
      imageUrl: '/images/share-cover.png'
    };
  }
});
