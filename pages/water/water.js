const { getStorage, setStorage, today, genId } = require('../../utils/util');

const RECORD_KEY = 'water_records';
const SETTING_KEY = 'water_settings';

const DEFAULT_SETTINGS = {
  targetCups: 8,
  cupMl: 200,
  remindOn: false,
  startTime: '08:00',
  endTime: '22:00',
  intervalHours: 2
};

function pad(n) {
  return ('0' + n).slice(-2);
}

function nowTime() {
  const d = new Date();
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function toMinutes(time) {
  const parts = String(time || '00:00').split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function formatDateOffset(offset) {
  const d = new Date(today().replace(/-/g, '/'));
  d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function readRecords() {
  const raw = getStorage(RECORD_KEY, {});
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function readSettings() {
  const raw = getStorage(SETTING_KEY, DEFAULT_SETTINGS);
  const settings = Object.assign({}, DEFAULT_SETTINGS, raw && typeof raw === 'object' ? raw : {});
  settings.targetCups = Math.max(1, Math.min(30, Number(settings.targetCups) || DEFAULT_SETTINGS.targetCups));
  settings.cupMl = Math.max(50, Math.min(1000, Number(settings.cupMl) || DEFAULT_SETTINGS.cupMl));
  settings.intervalHours = Math.max(1, Math.min(8, Number(settings.intervalHours) || DEFAULT_SETTINGS.intervalHours));
  settings.remindOn = !!settings.remindOn;
  return settings;
}

function sortLogs(logs) {
  return (Array.isArray(logs) ? logs : []).slice().sort((a, b) => (a.time > b.time ? 1 : -1));
}

function withDisplayCup(logs) {
  return sortLogs(logs).map((item, index) => Object.assign({}, item, { cup: index + 1 }));
}

Page({
  data: {
    date: '',
    records: {},
    settings: DEFAULT_SETTINGS,
    todayLogs: [],
    todayCups: 0,
    todayMl: 0,
    targetMl: 1600,
    percent: 0,
    waterStyle: 'height:0%;',
    done: false,
    history: [],
    selectedHistory: { date: '', logs: [] },
    selectedHistoryVisible: false,
    nextTip: '提醒未开启',
    targetInput: '8',
    cupInput: '200',
    intervalInput: '2'
  },

  onLoad() {
    this.loadAll();
  },

  onShow() {
    this.refreshReminderTip(true);
  },

  loadAll() {
    const records = readRecords();
    const settings = readSettings();
    this.setData({
      date: today(),
      records,
      settings,
      targetInput: String(settings.targetCups),
      cupInput: String(settings.cupMl),
      intervalInput: String(settings.intervalHours)
    });
    this.refreshAll();
  },

  getTodayLogs() {
    return sortLogs(this.data.records[this.data.date] || []);
  },

  refreshAll() {
    const logs = withDisplayCup(this.getTodayLogs());
    const targetMl = this.data.settings.targetCups * this.data.settings.cupMl;
    const todayCups = logs.length;
    const todayMl = todayCups * this.data.settings.cupMl;
    const percent = Math.min(100, Math.round((todayMl / Math.max(targetMl, 1)) * 100));
    this.setData({
      todayLogs: logs,
      todayCups,
      todayMl,
      targetMl,
      percent,
      waterStyle: 'height:' + percent + '%;',
      done: todayCups >= this.data.settings.targetCups,
      history: this.buildHistory()
    });
    this.refreshReminderTip(false);
  },

  buildHistory() {
    const list = [];
    for (let i = 0; i > -7; i--) {
      const date = formatDateOffset(i);
      const logs = withDisplayCup(this.data.records[date] || []);
      const cups = logs.length;
      const ml = cups * this.data.settings.cupMl;
      const percent = Math.min(100, Math.round((cups / Math.max(this.data.settings.targetCups, 1)) * 100));
      list.push({
        date,
        cups,
        ml,
        percent,
        barStyle: 'width:' + percent + '%;',
        doneText: cups >= this.data.settings.targetCups ? '已达成' : '未达成',
        logs
      });
    }
    return list;
  },

  drinkOne() {
    const records = Object.assign({}, this.data.records);
    const logs = sortLogs(records[this.data.date] || []);
    logs.push({
      id: genId(),
      time: nowTime(),
      cup: logs.length + 1,
      ml: this.data.settings.cupMl,
      createdAt: Date.now()
    });
    records[this.data.date] = logs;
    setStorage(RECORD_KEY, records);
    this.setData({ records });
    this.refreshAll();
    wx.showToast({ title: logs.length >= this.data.settings.targetCups ? '今日目标完成' : '已记录一杯', icon: 'none' });
  },

  undoLast() {
    const records = Object.assign({}, this.data.records);
    const logs = sortLogs(records[this.data.date] || []);
    if (!logs.length) {
      wx.showToast({ title: '今天还没有记录', icon: 'none' });
      return;
    }
    logs.pop();
    records[this.data.date] = logs;
    setStorage(RECORD_KEY, records);
    this.setData({ records });
    this.refreshAll();
    wx.showToast({ title: '已撤销上一杯', icon: 'none' });
  },

  deleteLog(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除记录',
      content: '确定删除这次喝水记录吗？',
      confirmText: '删除',
      confirmColor: '#e25d5d',
      success: (res) => {
        if (!res.confirm) return;
        const records = Object.assign({}, this.data.records);
        records[this.data.date] = sortLogs(records[this.data.date] || []).filter((item) => item.id !== id);
        setStorage(RECORD_KEY, records);
        this.setData({ records });
        this.refreshAll();
        wx.showToast({ title: '已删除', icon: 'none' });
      }
    });
  },

  onTargetInput(e) { this.setData({ targetInput: e.detail.value }); },
  onCupInput(e) { this.setData({ cupInput: e.detail.value }); },
  onIntervalInput(e) { this.setData({ intervalInput: e.detail.value }); },

  saveSettings() {
    const targetCups = Number(this.data.targetInput);
    const cupMl = Number(this.data.cupInput);
    const intervalHours = Number(this.data.intervalInput);
    if (!isFinite(targetCups) || targetCups < 1 || targetCups > 30) {
      wx.showToast({ title: '目标杯数需为1-30', icon: 'none' });
      return;
    }
    if (!isFinite(cupMl) || cupMl < 50 || cupMl > 1000) {
      wx.showToast({ title: '每杯容量需为50-1000ml', icon: 'none' });
      return;
    }
    if (!isFinite(intervalHours) || intervalHours < 1 || intervalHours > 8) {
      wx.showToast({ title: '提醒间隔需为1-8小时', icon: 'none' });
      return;
    }
    const settings = Object.assign({}, this.data.settings, {
      targetCups: Math.round(targetCups),
      cupMl: Math.round(cupMl),
      intervalHours: Math.round(intervalHours)
    });
    setStorage(SETTING_KEY, settings);
    this.setData({ settings });
    this.refreshAll();
    wx.showToast({ title: '设置已保存', icon: 'none' });
  },

  toggleRemind(e) {
    const settings = Object.assign({}, this.data.settings, { remindOn: e.detail.value });
    setStorage(SETTING_KEY, settings);
    this.setData({ settings });
    this.refreshReminderTip(false);
  },

  onStartChange(e) {
    this.updateReminder({ startTime: e.detail.value });
  },

  onEndChange(e) {
    this.updateReminder({ endTime: e.detail.value });
  },

  updateReminder(partial) {
    const settings = Object.assign({}, this.data.settings, partial);
    if (toMinutes(settings.startTime) >= toMinutes(settings.endTime)) {
      wx.showToast({ title: '结束时间需晚于开始时间', icon: 'none' });
      return;
    }
    setStorage(SETTING_KEY, settings);
    this.setData({ settings });
    this.refreshReminderTip(false);
  },

  refreshReminderTip(showPrompt) {
    const s = this.data.settings;
    if (!s.remindOn) {
      this.setData({ nextTip: '提醒未开启' });
      return;
    }
    const logs = this.getTodayLogs();
    const last = logs.length ? logs[logs.length - 1].time : s.startTime;
    const nextMin = toMinutes(last) + s.intervalHours * 60;
    const endMin = toMinutes(s.endTime);
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin < toMinutes(s.startTime)) {
      this.setData({ nextTip: '今天 ' + s.startTime + ' 开始提醒' });
      return;
    }
    if (nowMin > endMin) {
      this.setData({ nextTip: '今天提醒时段已结束' });
      return;
    }
    if (nowMin >= nextMin && showPrompt) {
      wx.showToast({ title: '可以喝水啦', icon: 'none' });
      try { wx.vibrateShort({ type: 'light' }); } catch (e) {}
    }
    const next = Math.min(nextMin, endMin);
    this.setData({ nextTip: '下次提醒约 ' + pad(Math.floor(next / 60)) + ':' + pad(next % 60) });
  },

  showHistory(e) {
    const date = e.currentTarget.dataset.date;
    const item = this.data.history.find((h) => h.date === date);
    this.setData({ selectedHistory: item || { date: '', logs: [] }, selectedHistoryVisible: true });
  },

  closeHistory() {
    this.setData({ selectedHistoryVisible: false });
  }
});
