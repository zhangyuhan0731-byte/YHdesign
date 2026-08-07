// pages/fortune/fortune.js - 今日运势
const { today, getStorage } = require('../../utils/util');
const { generateFortune, drawNewLot } = require('../../utils/fortuneData');
const sound = require('../../utils/sound');

Page({
  data: {
    dateStr: '',
    fortune: null,
    lot: null,
    basedOn: false,
    composite: 0,
    revealing: true,
    muted: false
  },

  onLoad() {
    this.setData({ muted: sound.isMuted() });
    const dateStr = today();
    // 接入「我的」生日，使运势与个人绑定
    const profile = getStorage('profile', null);
    const salt = (profile && profile.birthday) || '';
    const fortune = generateFortune(dateStr, salt);
    const composite = Math.round((fortune.dims[0].stars / 5) * 100);
    this.setData({
      dateStr,
      fortune,
      lot: { yi: fortune.yi, ji: fortune.ji, poem: fortune.poem },
      basedOn: !!salt,
      composite,
      revealing: true
    });
    // 揭晓动画
    setTimeout(() => this.setData({ revealing: false }), 450);
  },

  changeLot() {
    if (this.data.revealing) return;
    this.setData({ revealing: true });
    setTimeout(() => {
      this.setData({ lot: drawNewLot(), revealing: false });
      sound.play('draw');
    }, 550);
  },

  // 声音开关（与木鱼页一致）
  toggleMute() {
    const muted = !this.data.muted;
    sound.setMuted(muted);
    this.setData({ muted });
  }
});
