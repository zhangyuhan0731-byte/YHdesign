// pages/woodfish/woodfish.js - 电子木鱼（黑底白鱼，参考图风格）
const { getStorage, setStorage, today, genId } = require('../../utils/util');
const sound = require('../../utils/sound');

Page({
  data: {
    total: 0,
    todayCount: 0,
    muted: false,
    knocking: false,
    floaters: []
  },

  onLoad() {
    const todayStr = today();
    let t = getStorage('woodfish_today', { date: '', count: 0 });
    if (t.date !== todayStr) t = { date: todayStr, count: 0 };
    const total = getStorage('woodfish_total', 0) || 0;
    const muted = sound.isMuted();
    this.setData({ total, todayCount: t.count, muted });
  },

  knock() {
    const todayStr = today();
    let t = getStorage('woodfish_today', { date: '', count: 0 });
    if (t.date !== todayStr) t = { date: todayStr, count: 0 };
    t.count += 1;
    setStorage('woodfish_today', t);

    const total = (getStorage('woodfish_total', 0) || 0) + 1;
    setStorage('woodfish_total', total);

    const fid = genId();
    // 功德 +1 从木鱼顶部附近飘出，带随机左右偏移
    const dx = Math.floor(Math.random() * 70) - 35;
    this.setData({
      total,
      todayCount: t.count,
      knocking: true,
      floaters: this.data.floaters.concat({ id: fid, dx })
    });

    setTimeout(() => this.setData({ knocking: false }), 120);

    if (!this.data.muted) sound.play('woodfish');

    setTimeout(() => {
      this.setData({ floaters: this.data.floaters.filter((f) => f.id !== fid) });
    }, 900);
  },

  toggleMute() {
    const muted = !this.data.muted;
    sound.setMuted(muted);
    this.setData({ muted });
  },

  reset() {
    wx.showModal({
      title: '重置功德',
      content: '将清空总功德与今日记录，确定？',
      confirmColor: '#e8756b',
      success: (res) => {
        if (res.confirm) {
          setStorage('woodfish_total', 0);
          setStorage('woodfish_today', { date: today(), count: 0 });
          this.setData({ total: 0, todayCount: 0 });
        }
      }
    });
  },

  onShareAppMessage() {
    return {
      title: '日常琐事，交给这个小工具集就对了',
      imageUrl: '/images/share-cover.png',
      path: '/pages/woodfish/woodfish'
    };
  },

  onShareTimeline() {
    return {
      title: '日常琐事，交给这个小工具集就对了',
      imageUrl: '/images/share-cover.png'
    };
  }
});
