const TIPS = require('../../data/tips');

// 中文 group → 英文 key（用于 WXSS 类名，避免 WXSS 解析器不识别中文类名）
const GROUP_KEY_MAP = { '准备': 'prepare', '技巧': 'skill', '安全': 'safety' };
const TIPS_WITH_KEY = TIPS.map(function (t) {
  return Object.assign({}, t, { groupKey: GROUP_KEY_MAP[t.group] || 'skill' });
});

Page({
  data: {
    keyword: '',
    expandedId: '',
    list: [],
    total: TIPS_WITH_KEY.length
  },

  onLoad() {
    this.allTips = TIPS_WITH_KEY;
    this.setData({ list: TIPS_WITH_KEY, total: TIPS_WITH_KEY.length });
  },

  onSearchInput(e) {
    const raw = e.detail.value;
    const kw = raw.trim().toLowerCase();
    if (!kw) {
      this.setData({ keyword: raw, list: this.allTips });
      return;
    }
    const filtered = this.allTips.filter(function (t) {
      const haystack = (t.title + ' ' + t.group + ' ' + t.body.join(' ')).toLowerCase();
      return haystack.indexOf(kw) >= 0;
    });
    this.setData({ keyword: raw, list: filtered });
  },

  clearSearch() {
    this.setData({ keyword: '', list: this.allTips, expandedId: '' });
  },

  toggle(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ expandedId: this.data.expandedId === id ? '' : id });
  },

  onShareAppMessage() {
    return {
      title: '日常琐事，交给这个小工具集就对了',
      path: '/packages/chef/pages/tips/tips',
      imageUrl: '/images/share-cover.jpg'
    };
  },

  onShareTimeline() {
    return { title: '日常琐事，交给这个小工具集就对了', imageUrl: '/images/share-cover.jpg' };
  }
});
