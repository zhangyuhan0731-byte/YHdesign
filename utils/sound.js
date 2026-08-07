// utils/sound.js - 统一音效播放（包内 wav，无需后端）
const { getStorage, setStorage } = require('./util');

const MUTE_KEY = 'muted';
const contexts = {};
let tickTimer = null;
let tickStartTime = 0;

function ensureCtx(name) {
  if (contexts[name]) return contexts[name];
  const ctx = wx.createInnerAudioContext();
  ctx.src = `/audio/${name}.wav`;
  // 玩具类音效：即便手机静音模式也播放，除非用户主动静音
  try { ctx.obeyMuteSwitch = false; } catch (e) {}
  ctx.onError(() => {});
  contexts[name] = ctx;
  return ctx;
}

function isMuted() {
  return !!getStorage(MUTE_KEY, false);
}

function setMuted(v) {
  setStorage(MUTE_KEY, !!v);
}

function play(name) {
  if (isMuted()) return;
  try {
    const ctx = ensureCtx(name);
    ctx.stop();
    ctx.seek(0);
    ctx.play();
  } catch (e) {}
}

/**
 * 转盘滴答循环 —— 模拟指针划过扇区隔板的声音，频率由快到慢
 * @param {number} duration 转盘动画时长（毫秒）
 */
function startTickLoop(duration) {
  stopTickLoop();
  duration = duration || 4000;
  tickStartTime = Date.now();
  const startInterval = 60;
  const endInterval = 240;

  function scheduleNext() {
    const elapsed = Date.now() - tickStartTime;
    if (elapsed >= duration) return;
    const progress = elapsed / duration;
    const interval = startInterval + (endInterval - startInterval) * progress;
    play('tick');
    tickTimer = setTimeout(scheduleNext, interval);
  }

  play('tick');
  tickTimer = setTimeout(scheduleNext, startInterval);
}

function stopTickLoop() {
  if (tickTimer) {
    clearTimeout(tickTimer);
    tickTimer = null;
  }
}

module.exports = { play, isMuted, setMuted, startTickLoop, stopTickLoop };
