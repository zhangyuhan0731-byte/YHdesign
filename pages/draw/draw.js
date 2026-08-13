// pages/draw/draw.js - 每日抽签（含洗签动画）
const { today, getStorage, setStorage, seededInt } = require('../../utils/util');
const sound = require('../../utils/sound');

const LOTS = [
  { level: '上上签', cls: 'good', poem: '天开地辟结良缘，日吉时良万物全。', advice: '诸事顺遂，正是乘势而上、大胆行动的好时机。' },
  { level: '上签', cls: 'good', poem: '宝剑出匣耀光明，在匣全然不惹尘。', advice: '才华将得到赏识，把握展示自我的机会。' },
  { level: '上签', cls: 'good', poem: '花开结子一半枯，看看喜笑见充盈。', advice: '努力渐有回报，守好自己的节奏即可。' },
  { level: '中上签', cls: 'mid', poem: '锦上添花色更鲜，运逢加倍喜安然。', advice: '平稳向上，宜主动联络、推进合作。' },
  { level: '中签', cls: 'mid', poem: '雾里看花未分明，且待清风一夕生。', advice: '时机未全熟，先沉淀积累、静观其变。' },
  { level: '中签', cls: 'mid', poem: '欲求胜事可非常，争奈姻亲只暂忙。', advice: '事有波折但终可成，多一点耐心沟通。' },
  { level: '中下签', cls: 'mid', poem: '月出光辉本无私，逢屯且守静为宜。', advice: '低调行事更稳妥，避免正面冲突。' },
  { level: '下签', cls: 'low', poem: '劝君耐守旧生涯，把定身心莫起歹。', advice: '宜守不宜攻，先稳住当下再图发展。' },
  { level: '下签', cls: 'low', poem: '前途阻隔未通津，只恐劳心反误身。', advice: '暂缓重大决定，先解决眼前小问题。' },
  { level: '下下签', cls: 'low', poem: '风骤雨狂莫前行，守得云开见月明。', advice: '近期宜避锋芒，养精蓄锐方为上策。' },
  { level: '中上签', cls: 'mid', poem: '忽然一夜清香发，散作乾坤万里春。', advice: '转机将至，保持开放心态迎接变化。' },
  { level: '上签', cls: 'good', poem: '一纸官书火急催，平地登云步九垓。', advice: '有贵人相助，关键事可放手一搏。' }
];

Page({
  data: {
    dateStr: '',
    lots: LOTS,
    display: LOTS[0],
    drawing: false,
    drawnToday: false,
    muted: false
  },

  onLoad() {
    this.setData({ muted: sound.isMuted() });
    const t = today();
    const saved = getStorage('draw_' + t, null);
    if (saved !== null && saved >= 0 && saved < LOTS.length) {
      this.setData({ dateStr: t, display: LOTS[saved], drawnToday: true });
    } else {
      this.setData({ dateStr: t, display: LOTS[0], drawnToday: false });
    }
  },

  draw() {
    if (this.data.drawing) return;
    const t = today();
    // 每日按「日期 + 生日」确定性出签（同人同日固定）
    const profile = getStorage('profile', null);
    const salt = (profile && profile.birthday) || '';
    const finalIdx = seededInt(t + '|' + salt + '|draw', 0, LOTS.length - 1);

    this.setData({ drawing: true });
    let ticks = 0;
    const total = 1400;
    const stepMs = 70;
    this._timer = setInterval(() => {
      ticks += stepMs;
      const idx = Math.floor(Math.random() * LOTS.length);
      this.setData({ display: LOTS[idx] });
      if (ticks >= total) {
        clearInterval(this._timer);
        this._timer = null;
        this.setData({ drawing: false, display: LOTS[finalIdx], drawnToday: true });
        setStorage('draw_' + t, finalIdx);
        sound.play('draw');
      }
    }, stepMs);
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer);
  },

  // 声音开关（与木鱼页一致）
  toggleMute() {
    const muted = !this.data.muted;
    sound.setMuted(muted);
    this.setData({ muted });
  },

  onShareAppMessage() {
    return {
      title: '日常琐事，交给这个小工具集就对了',
      imageUrl: '/images/share-cover.jpg',
      path: '/pages/draw/draw'
    };
  },

  onShareTimeline() {
    return {
      title: '日常琐事，交给这个小工具集就对了',
      imageUrl: '/images/share-cover.jpg'
    };
  }
});
