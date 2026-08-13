// 厨神模块 · 烹饪模式
// 全屏深色背景，逐步引导用户完成菜品步骤；自动识别步骤文本中的时间信息

const { getRecipe } = require('../../data/index');

// 匹配步骤文本中的时长：支持「3 分钟 / 3分钟 / 30 秒 / 30s / 1 小时 / 1h」
// 注意：\b 在中文后不生效（中文不属于 \w），所以用 (?![A-Za-z0-9]) 显式禁止字母数字续接
const TIME_REGEX = /(\d+(?:\.\d+)?)\s*(小时|分钟|秒钟|秒|分|h|min|s)(?![A-Za-z0-9])/gi;

function detectTimer(text) {
  if (!text) return null;
  TIME_REGEX.lastIndex = 0;
  const m = TIME_REGEX.exec(text);
  if (!m) return null;
  const num = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  let seconds;
  if (unit === '小时' || unit === 'h') seconds = num * 3600;
  else if (unit === '分钟' || unit === '分' || unit === 'min') seconds = num * 60;
  else seconds = num; // 秒 / 秒钟 / s
  // 过滤掉不合理的时长（<1s 或 >4h）
  if (seconds < 1 || seconds > 4 * 3600) return null;
  return {
    seconds: Math.round(seconds),
    label: m[0].replace(/\s+/g, '')
  };
}

function flattenSteps(recipe) {
  const flat = [];
  recipe.stepGroups.forEach(function (group) {
    group.steps.forEach(function (step) {
      flat.push({
        key: step.key || ('s-' + flat.length),
        number: flat.length + 1,
        text: step.text,
        timer: detectTimer(step.text)
      });
    });
  });
  return flat;
}

Page({
  data: {
    recipe: null,
    steps: [],
    currentIndex: 0,
    remaining: 0,        // 剩余秒数
    totalTimer: 0,       // 本次初始总时长（用于进度环/比例）
    running: false,
    finished: false,
    hasTimer: false,
    progressPercent: 0,
    ringDeg: 0
  },

  timerHandle: null,

  onLoad(options) {
    const recipe = getRecipe(options.id || '');
    if (!recipe) {
      wx.showToast({ title: '菜谱未找到', icon: 'none' });
      setTimeout(function () { wx.navigateBack(); }, 800);
      return;
    }
    const steps = flattenSteps(recipe);
    if (!steps.length) {
      wx.showToast({ title: '这道菜暂时没有步骤', icon: 'none' });
      setTimeout(function () { wx.navigateBack(); }, 800);
      return;
    }
    wx.setNavigationBarTitle({ title: '烹饪模式' });
    this.setData({
      recipe: { id: recipe.id, name: recipe.name },
      steps: steps,
      currentIndex: 0,
      remaining: 0,
      totalTimer: 0,
      running: false,
      finished: false,
      hasTimer: !!steps[0].timer,
      progressPercent: Math.round(100 / steps.length),
      ringDeg: 0
    });
  },

  onUnload() {
    this.clearTimer();
  },

  // 切换步骤时清理计时器
  resetTimerState() {
    this.clearTimer();
    const step = this.data.steps[this.data.currentIndex];
    this.setData({
      remaining: 0,
      totalTimer: 0,
      running: false,
      finished: false,
      hasTimer: !!step.timer
    });
  },

  clearTimer() {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  },

  startTimer() {
    const step = this.data.steps[this.data.currentIndex];
    if (!step || !step.timer) return;
    let seconds, total;
    if (this.data.remaining > 0 && !this.data.finished) {
      // 暂停后继续：保留原始总时长，只续算剩余秒数
      seconds = this.data.remaining;
      total = this.data.totalTimer || step.timer.seconds;
    } else {
      // 初次启动或重置后启动
      seconds = step.timer.seconds;
      total = step.timer.seconds;
    }
    this.setData({
      remaining: seconds,
      totalTimer: total,
      running: true,
      finished: false,
      ringDeg: Math.round(seconds / total * 360)
    });
    this.timerHandle = setInterval(this.tick.bind(this), 1000);
  },

  pauseTimer() {
    this.clearTimer();
    this.setData({ running: false });
  },

  // 开始 / 暂停 共用一个按钮：由 running 状态决定下一步动作。
  // （WXML 的 bindtap 不支持 {{}} 动态绑定事件名，所以统一走这个方法再分流）
  toggleTimer() {
    if (this.data.running) this.pauseTimer();
    else this.startTimer();
  },

  resetTimer() {
    this.clearTimer();
    this.setData({ remaining: 0, totalTimer: 0, running: false, finished: false, ringDeg: 0 });
  },

  tick() {
    const next = this.data.remaining - 1;
    if (next <= 0) {
      this.clearTimer();
      this.setData({ remaining: 0, running: false, finished: true, ringDeg: 0 });
      this.onTimerDone();
      return;
    }
    const total = this.data.totalTimer || 1;
    this.setData({ remaining: next, ringDeg: Math.round(next / total * 360) });
  },

  onTimerDone() {
    // 震动反馈（iOS/Android 均支持）
    try { wx.vibrateShort({ type: 'medium' }); } catch (e) {}
    // 提示音（用项目自带的 result.wav）
    try {
      const innerAudio = wx.createInnerAudioContext();
      innerAudio.src = '/audio/result.wav';
      innerAudio.onError(function () {});
      innerAudio.play();
      setTimeout(function () { innerAudio.destroy(); }, 4000);
    } catch (e) {}
    wx.showToast({ title: '时间到，进入下一步', icon: 'none', duration: 1200 });
  },

  prev() {
    if (this.data.currentIndex === 0) return;
    this.setData({ currentIndex: this.data.currentIndex - 1, progressPercent: Math.round((this.data.currentIndex) * 100 / this.data.steps.length) });
    this.resetTimerState();
  },

  next() {
    const last = this.data.steps.length - 1;
    if (this.data.currentIndex === last) {
      // 完成烹饪
      this.clearTimer();
      try { wx.vibrateShort({ type: 'heavy' }); } catch (e) {}
      wx.showToast({ title: '烹饪完成，开饭！', icon: 'success', duration: 1500 });
      setTimeout(function () { wx.navigateBack(); }, 1000);
      return;
    }
    this.setData({ currentIndex: this.data.currentIndex + 1, progressPercent: Math.round((this.data.currentIndex + 2) * 100 / this.data.steps.length) });
    this.resetTimerState();
  },

  exit() {
    wx.navigateBack();
  },

  onShareAppMessage() {
    var recipe = this.data.recipe;
    return {
      title: '日常琐事，交给这个小工具集就对了',
      imageUrl: '/images/share-cover.png',
      path: '/packages/chef/pages/cooking/cooking?id=' + (recipe ? recipe.id : '')
    };
  },

  onShareTimeline() {
    var recipe = this.data.recipe;
    return {
      title: '日常琐事，交给这个小工具集就对了',
      imageUrl: '/images/share-cover.png'
    };
  }
});