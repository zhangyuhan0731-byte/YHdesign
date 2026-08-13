// pages/constellation/constellation.js - 星座匹配
const { CONSTELLATIONS, computeMatch } = require('../../utils/constellationData');

const LEVEL_LABEL = { high: '天作之合', good: '佳偶一对', mid: '尚需磨合', low: '多加包容' };
const LEVEL_COLOR = { high: '#2fae6b', good: '#3a9bd6', mid: '#f0a93b', low: '#e8756b' };

const CONSTELLATION_LIST = Object.keys(CONSTELLATIONS); // 白羊座 ... 双鱼座

Page({
  data: {
    idxA: 0,
    idxB: 1,
    consA: CONSTELLATION_LIST[0],
    consB: CONSTELLATION_LIST[1],
    constellations: CONSTELLATION_LIST,
    result: null
  },
  onLoad() { this.compute(); },

  // 选择星座
  onPickA(e) {
    const i = Number(e.detail.value);
    this.setData({ consA: CONSTELLATION_LIST[i], idxA: i }, () => this.compute());
  },
  onPickB(e) {
    const i = Number(e.detail.value);
    this.setData({ consB: CONSTELLATION_LIST[i], idxB: i }, () => this.compute());
  },

  compute() {
    const consA = this.data.consA;
    const consB = this.data.consB;
    const [a, b] = [consA, consB].sort();
    const m = computeMatch(a, b);
    this.setData({
      result: Object.assign({}, m, {
        levelLabel: LEVEL_LABEL[m.level],
        levelColor: LEVEL_COLOR[m.level],
        element1: CONSTELLATIONS[consA].element,
        element2: CONSTELLATIONS[consB].element
      })
    });
  },

  onShareAppMessage() {
    return {
      title: '日常琐事，交给这个小工具集就对了',
      imageUrl: '/images/share-cover.jpg',
      path: '/pages/constellation/constellation'
    };
  },

  onShareTimeline() {
    return {
      title: '日常琐事，交给这个小工具集就对了',
      imageUrl: '/images/share-cover.jpg'
    };
  }
});
