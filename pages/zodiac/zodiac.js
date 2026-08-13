// pages/zodiac/zodiac.js - 生肖匹配
const { computeMatch, ZODIAC } = require('../../utils/zodiacData');

const LEVEL_LABEL = { high: '天作之合', good: '佳偶一对', mid: '尚需磨合', low: '多加包容' };
const LEVEL_COLOR = { high: '#2fae6b', good: '#3a9bd6', mid: '#f0a93b', low: '#e8756b' };

Page({
  data: {
    idxA: 0,
    idxB: 1,
    zA: ZODIAC[0],
    zB: ZODIAC[1],
    zodiacs: ZODIAC,
    result: null
  },
  onLoad() { this.compute(); },

  // 选择生肖
  onPickA(e) {
    const i = Number(e.detail.value);
    this.setData({ zA: ZODIAC[i], idxA: i }, () => this.compute());
  },
  onPickB(e) {
    const i = Number(e.detail.value);
    this.setData({ zB: ZODIAC[i], idxB: i }, () => this.compute());
  },

  compute() {
    const zA = this.data.zA;
    const zB = this.data.zB;
    const [a, b] = [zA, zB].sort();
    const m = computeMatch(a, b);
    this.setData({
      result: Object.assign({}, m, { levelLabel: LEVEL_LABEL[m.level], levelColor: LEVEL_COLOR[m.level] })
    });
  },

  onShareAppMessage() {
    return {
      title: '日常琐事，交给这个小工具集就对了',
      imageUrl: '/images/share-cover.png',
      path: '/pages/zodiac/zodiac'
    };
  },

  onShareTimeline() {
    return {
      title: '日常琐事，交给这个小工具集就对了',
      imageUrl: '/images/share-cover.png'
    };
  }
});
