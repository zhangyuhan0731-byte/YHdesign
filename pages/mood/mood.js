const { getStorage, setStorage, today } = require('../../utils/util');

const STORAGE_KEY = 'mood_entries';

const MOODS = [
  { id: 'happy', name: '开心', color: '#ffbd78', soft: '#fff1dd' },
  { id: 'calm', name: '平静', color: '#a8df95', soft: '#edf9e9' },
  { id: 'normal', name: '心动', color: '#f3a1b4', soft: '#fff0f4' },
  { id: 'tired', name: '疲惫', color: '#c7b7a3', soft: '#f3eee8' },
  { id: 'sad', name: '难过', color: '#a9cdf7', soft: '#eaf4ff' },
  { id: 'angry', name: '生气', color: '#ee876e', soft: '#ffebe5' }
];

function pad(n) {
  return ('0' + n).slice(-2);
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseKey(key) {
  const parts = String(key || today()).split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function monthTitle(year, month) {
  return `${year}年${month + 1}月`;
}

function findMood(id) {
  return MOODS.find((item) => item.id === id) || MOODS[0];
}

function readEntries() {
  const entries = getStorage(STORAGE_KEY, {});
  return entries && typeof entries === 'object' && !Array.isArray(entries) ? entries : {};
}

Page({
  data: {
    moods: MOODS,
    entries: {},
    todayKey: '',
    selectedDate: '',
    selectedMood: MOODS[0],
    note: '',
    currentYear: 0,
    currentMonth: 0,
    monthText: '',
    weekHeads: ['日', '一', '二', '三', '四', '五', '六'],
    calendarDays: [],
    selectedEntry: null,
    isToday: true
  },

  onLoad() {
    const now = new Date();
    const todayKey = today();
    const entries = readEntries();
    const entry = entries[todayKey] || {};
    const selectedMood = findMood(entry.moodId || MOODS[0].id);
    this.setData({
      entries,
      todayKey,
      selectedDate: todayKey,
      selectedMood,
      note: entry.note || '',
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth(),
      isToday: true
    });
    this.refreshCalendar();
    this.refreshSelectedEntry(todayKey);
  },

  chooseMood(e) {
    if (!this.data.isToday) return;
    const mood = findMood(e.currentTarget.dataset.id);
    this.setData({ selectedMood: mood });
  },

  onNoteInput(e) {
    if (!this.data.isToday) return;
    this.setData({ note: e.detail.value || '' });
  },

  saveToday() {
    if (!this.data.isToday) {
      wx.showToast({ title: '仅当天可保存', icon: 'none' });
      return;
    }
    const note = String(this.data.note || '').trim();
    const mood = this.data.selectedMood || MOODS[0];
    const entries = Object.assign({}, this.data.entries);
    entries[this.data.todayKey] = {
      date: this.data.todayKey,
      moodId: mood.id,
      moodName: mood.name,
      moodColor: mood.color,
      note,
      updatedAt: Date.now()
    };

    try {
      setStorage(STORAGE_KEY, entries);
      this.setData({ entries });
      this.refreshCalendar();
      this.refreshSelectedEntry(this.data.selectedDate || this.data.todayKey);
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  prevMonth() {
    this.shiftMonth(-1);
  },

  nextMonth() {
    this.shiftMonth(1);
  },

  shiftMonth(delta) {
    const date = new Date(this.data.currentYear, this.data.currentMonth + delta, 1);
    this.setData({
      currentYear: date.getFullYear(),
      currentMonth: date.getMonth()
    });
    this.refreshCalendar();
  },

  tapDay(e) {
    const key = e.currentTarget.dataset.date;
    if (!key) return;
    const isToday = key === this.data.todayKey;
    const entry = this.data.entries[key] || {};
    this.setData({
      selectedDate: key,
      isToday,
      selectedMood: findMood(entry.moodId || (isToday ? this.data.selectedMood.id : MOODS[0].id)),
      note: entry.note || ''
    });
    this.refreshCalendar();
    this.refreshSelectedEntry(key);
  },

  backToday() {
    const now = parseKey(this.data.todayKey);
    const entry = this.data.entries[this.data.todayKey] || {};
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth(),
      selectedDate: this.data.todayKey,
      isToday: true,
      selectedMood: findMood(entry.moodId || MOODS[0].id),
      note: entry.note || ''
    });
    this.refreshCalendar();
    this.refreshSelectedEntry(this.data.todayKey);
  },

  refreshSelectedEntry(key) {
    const entry = this.data.entries[key] || null;
    const mood = entry ? findMood(entry.moodId) : null;
    this.setData({
      selectedEntry: entry ? Object.assign({}, entry, {
        mood,
        noteText: entry.note || '这天只记录了心情'
      }) : null
    });
  },

  refreshCalendar() {
    const year = this.data.currentYear;
    const month = this.data.currentMonth;
    const first = new Date(year, month, 1);
    const startOffset = first.getDay();
    const start = new Date(year, month, 1 - startOffset);
    const days = [];

    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = dateKey(d);
      const entry = this.data.entries[key];
      const mood = entry ? findMood(entry.moodId) : null;
      days.push({
        date: key,
        day: d.getDate(),
        inMonth: d.getMonth() === month,
        isToday: key === this.data.todayKey,
        selected: key === this.data.selectedDate,
        moodId: mood ? mood.id : '',
        moodColor: mood ? mood.color : '',
        moodSoft: mood ? mood.soft : ''
      });
    }

    this.setData({
      monthText: monthTitle(year, month),
      calendarDays: days
    });
  },

  onShareAppMessage() {
    return {
      title: '日常琐事，交给这个小工具集就对了',
      imageUrl: '/images/share-cover.jpg',
      path: '/pages/mood/mood'
    };
  },

  onShareTimeline() {
    return {
      title: '日常琐事，交给这个小工具集就对了',
      imageUrl: '/images/share-cover.jpg'
    };
  }
});
