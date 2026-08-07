const { getStorage, setStorage, today, genId } = require('../../utils/util');

const STORAGE_KEY = 'weight_records';
const RANGE_OPTIONS = [
  { key: '7', label: '7天' },
  { key: '30', label: '30天' },
  { key: 'all', label: '全部' }
];

function buildRangeOptions(activeKey) {
  return RANGE_OPTIONS.map((item) => ({
    key: item.key,
    label: item.label,
    className: item.key === activeKey ? 'active' : ''
  }));
}

function pad(n) {
  return ('0' + n).slice(-2);
}

function nowTime() {
  const d = new Date();
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function normalizeWeight(v) {
  const n = Number(v);
  return Math.round(n * 100) / 100;
}

function formatWeight(v) {
  if (v === '' || v === null || v === undefined || Number.isNaN(Number(v))) return '--';
  return Number(v).toFixed(1).replace(/\.0$/, '.0');
}

function formatDateText(date) {
  return String(date || '').replace(/-/g, '/');
}

function readRecords() {
  const raw = getStorage(STORAGE_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && item.date && Number(item.weight) > 0)
    .map((item) => ({
      id: item.id || genId(),
      date: item.date,
      dateText: formatDateText(item.date),
      time: item.time || '00:00',
      weight: normalizeWeight(item.weight),
      createdAt: item.createdAt || Date.now(),
      updatedAt: item.updatedAt || item.createdAt || Date.now()
    }))
    .sort(compareRecordDesc);
}

function compareRecordDesc(a, b) {
  const at = a.date + ' ' + (a.time || '00:00');
  const bt = b.date + ' ' + (b.time || '00:00');
  if (at === bt) return (b.updatedAt || 0) - (a.updatedAt || 0);
  return bt > at ? 1 : -1;
}

function compareRecordAsc(a, b) {
  const at = a.date + ' ' + (a.time || '00:00');
  const bt = b.date + ' ' + (b.time || '00:00');
  if (at === bt) return (a.updatedAt || 0) - (b.updatedAt || 0);
  return at > bt ? 1 : -1;
}

function isInLastDays(date, days) {
  const now = new Date(today().replace(/-/g, '/'));
  const d = new Date(date.replace(/-/g, '/'));
  const diff = Math.floor((now - d) / 86400000);
  return diff >= 0 && diff < days;
}

function getTrendRecords(records, range) {
  const asc = records.slice().sort(compareRecordAsc);
  if (range === 'all') return asc;
  const days = range === '30' ? 30 : 7;
  const filtered = asc.filter((item) => isInLastDays(item.date, days));
  return filtered.length ? filtered : asc.slice(-Math.min(days, 7));
}

function buildChart(records) {
  if (!records.length) return { hasData: false, records: [], minText: '--', maxText: '--' };

  const weights = records.map((item) => Number(item.weight));
  const min = Math.min.apply(null, weights);
  const max = Math.max.apply(null, weights);
  return {
    hasData: true,
    records: records.map((item) => ({
      id: item.id,
      dateLabel: item.date.slice(5).replace('-', '/'),
      weight: Number(item.weight),
      weightText: formatWeight(item.weight)
    })),
    minText: formatWeight(min),
    maxText: formatWeight(max)
  };
}

function buildStats(records) {
  if (!records.length) return null;
  const asc = records.slice().sort(compareRecordAsc);
  const latest = records[0];
  const first = asc[0];
  const weights = records.map((item) => Number(item.weight));
  const highest = Math.max.apply(null, weights);
  const lowest = Math.min.apply(null, weights);
  const total = normalizeWeight(Number(latest.weight) - Number(first.weight));
  return {
    latest: formatWeight(latest.weight),
    initial: formatWeight(first.weight),
    highest: formatWeight(highest),
    lowest: formatWeight(lowest),
    totalChange: (total > 0 ? '+' : '') + formatWeight(total)
  };
}

function buildChangeText(records) {
  const asc = records.slice().sort(compareRecordAsc);
  if (asc.length < 2) return { type: 'flat', text: '至少记录两次后显示变化' };
  const latest = asc[asc.length - 1];
  const prev = asc[asc.length - 2];
  const diff = normalizeWeight(Number(latest.weight) - Number(prev.weight));
  if (Math.abs(diff) < 0.01) return { type: 'flat', text: '相比上次保持不变' };
  return {
    type: diff > 0 ? 'up' : 'down',
    text: '相比上次' + (diff > 0 ? '上升' : '下降') + ' ' + formatWeight(Math.abs(diff)) + ' kg'
  };
}

Page({
  data: {
    records: [],
    todayRecord: null,
    todayText: '--',
    formWeight: '',
    formDate: '',
    editingId: '',
    formTitle: '记录体重',
    rangeOptions: buildRangeOptions('7'),
    range: '7',
    chart: buildChart([]),
    stats: null,
    change: { type: 'flat', text: '至少记录两次后显示变化' }
  },

  onLoad() {
    this.loadRecords();
  },

  onReady() {
    this.drawTrendChart();
  },

  loadRecords() {
    const records = readRecords();
    const todayKey = today();
    const todayRecord = records.find((item) => item.date === todayKey) || null;
    this.setData({
      records,
      todayRecord,
      todayText: todayRecord ? formatWeight(todayRecord.weight) : '--',
      formDate: todayKey,
      formWeight: todayRecord ? formatWeight(todayRecord.weight) : '',
      editingId: todayRecord ? todayRecord.id : '',
      formTitle: todayRecord ? '修改记录' : '记录体重'
    });
    this.refreshDerived();
  },

  onWeightInput(e) {
    this.setData({ formWeight: e.detail.value });
  },

  onDateChange(e) {
    const date = e.detail.value;
    const existing = this.data.records.find((item) => item.date === date);
    this.setData({
      formDate: date,
      formWeight: existing ? formatWeight(existing.weight) : '',
      editingId: existing ? existing.id : '',
      formTitle: existing ? '修改记录' : '记录体重'
    });
  },

  switchRange(e) {
    const range = e.currentTarget.dataset.range || '7';
    this.setData({ range, rangeOptions: buildRangeOptions(range) });
    this.refreshDerived();
  },

  saveRecord() {
    const weightText = String(this.data.formWeight || '').trim();
    if (!weightText) {
      wx.showToast({ title: '请输入体重', icon: 'none' });
      return;
    }
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(weightText)) {
      wx.showToast({ title: '体重格式不正确', icon: 'none' });
      return;
    }
    const weight = normalizeWeight(weightText);
    if (weight < 20 || weight > 300) {
      wx.showToast({ title: '请输入合理体重', icon: 'none' });
      return;
    }
    const date = this.data.formDate || today();
    const existing = this.data.records.find((item) => item.date === date);
    if (existing && existing.id !== this.data.editingId) {
      wx.showModal({
        title: '更新记录',
        content: '这一天已有体重记录，是否更新原记录？',
        confirmColor: '#2d7dd2',
        success: (res) => {
          if (res.confirm) this.upsertRecord(existing.id, date, weight);
        }
      });
      return;
    }
    this.upsertRecord(this.data.editingId, date, weight);
  },

  upsertRecord(id, date, weight) {
    const now = Date.now();
    const records = this.data.records.slice();
    const index = records.findIndex((item) => item.id === id || item.date === date);
    const next = {
      id: index >= 0 ? records[index].id : genId(),
      date,
      dateText: formatDateText(date),
      time: nowTime(),
      weight,
      createdAt: index >= 0 ? records[index].createdAt : now,
      updatedAt: now
    };
    if (index >= 0) records[index] = next;
    else records.push(next);
    this.persist(records, '已保存');
    this.setData({ formWeight: formatWeight(weight), formDate: date, editingId: next.id, formTitle: '修改记录' });
  },

  editRecord(e) {
    const id = e.currentTarget.dataset.id;
    const record = this.data.records.find((item) => item.id === id);
    if (!record) return;
    this.setData({
      formWeight: formatWeight(record.weight),
      formDate: record.date,
      editingId: record.id,
      formTitle: '修改记录'
    });
    wx.showToast({ title: '已填入编辑区', icon: 'none' });
  },

  editToday() {
    if (!this.data.todayRecord) return;
    this.editRecord({ currentTarget: { dataset: { id: this.data.todayRecord.id } } });
  },

  deleteRecord(e) {
    const id = e.currentTarget.dataset.id;
    const record = this.data.records.find((item) => item.id === id);
    if (!record) return;
    wx.showModal({
      title: '删除记录',
      content: '确定删除 ' + record.date + ' 的体重记录吗？',
      confirmText: '删除',
      confirmColor: '#e25d5d',
      success: (res) => {
        if (!res.confirm) return;
        const records = this.data.records.filter((item) => item.id !== id);
        this.persist(records, '已删除');
        if (this.data.editingId === id) {
          this.setData({ formWeight: '', formDate: today(), editingId: '', formTitle: '记录体重' });
        }
      }
    });
  },

  deleteToday() {
    if (!this.data.todayRecord) return;
    this.deleteRecord({ currentTarget: { dataset: { id: this.data.todayRecord.id } } });
  },

  persist(records, toastTitle) {
    const sorted = records.slice().sort(compareRecordDesc);
    try {
      setStorage(STORAGE_KEY, sorted);
      const todayRecord = sorted.find((item) => item.date === today()) || null;
      this.setData({
        records: sorted,
        todayRecord,
        todayText: todayRecord ? formatWeight(todayRecord.weight) : '--'
      });
      this.refreshDerived();
      wx.showToast({ title: toastTitle, icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  refreshDerived() {
    const trendRecords = getTrendRecords(this.data.records, this.data.range);
    this.setData({
      chart: buildChart(trendRecords),
      stats: buildStats(this.data.records),
      change: buildChangeText(trendRecords)
    });
    this.queueDrawTrendChart();
  },

  queueDrawTrendChart() {
    if (!this.data.chart.hasData) return;
    setTimeout(() => this.drawTrendChart(), 30);
  },

  drawTrendChart() {
    const chart = this.data.chart;
    if (!chart.hasData || !chart.records.length || !wx.createCanvasContext) return;
    wx.createSelectorQuery()
      .in(this)
      .select('.chart-canvas')
      .boundingClientRect((rect) => {
        if (!rect || !rect.width || !rect.height) return;
        const ctx = wx.createCanvasContext('weightTrendCanvas', this);
        const w = rect.width;
        const h = rect.height;
        const left = 42;
        const right = 26;
        const top = 32;
        const bottom = 42;
        const plotW = Math.max(w - left - right, 1);
        const plotH = Math.max(h - top - bottom, 1);
        const records = chart.records;
        const weights = records.map((item) => item.weight);
        const min = Math.min.apply(null, weights);
        const max = Math.max.apply(null, weights);
        const span = Math.max(max - min, 0.1);
        const points = records.map((item, index) => {
          const x = records.length === 1 ? left + plotW / 2 : left + (index * plotW) / (records.length - 1);
          const y = top + plotH - ((item.weight - min) / span) * plotH;
          return Object.assign({}, item, { x, y });
        });

        ctx.clearRect(0, 0, w, h);
        ctx.setFillStyle('#f8fbff');
        ctx.fillRect(0, 0, w, h);

        ctx.setStrokeStyle('rgba(45,125,210,0.08)');
        ctx.setLineWidth(1);
        [top + plotH * 0.32, top + plotH * 0.64].forEach((y) => {
          ctx.beginPath();
          ctx.moveTo(left, y);
          ctx.lineTo(w - right, y);
          ctx.stroke();
        });

        ctx.setFillStyle('#8c94a3');
        ctx.setFontSize(11);
        ctx.fillText(chart.maxText, 10, top + 5);
        ctx.fillText(chart.minText, 10, top + plotH + 4);

        if (points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
          ctx.setStrokeStyle('#38aaa1');
          ctx.setLineWidth(3);
          ctx.setLineCap('round');
          ctx.setLineJoin('round');
          ctx.stroke();
        }

        points.forEach((point, index) => {
          ctx.beginPath();
          ctx.setFillStyle('#2d7dd2');
          ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.setStrokeStyle('#ffffff');
          ctx.setLineWidth(2);
          ctx.stroke();

          ctx.setFillStyle('#586274');
          ctx.setFontSize(11);
          const weightX = Math.min(Math.max(point.x - 12, left), w - right - 28);
          ctx.fillText(point.weightText, weightX, Math.max(point.y - 10, top + 12));

          if (points.length <= 4 || index === 0 || index === points.length - 1 || index === Math.floor((points.length - 1) / 2)) {
            const labelX = Math.min(Math.max(point.x - 14, left), w - right - 28);
            ctx.fillText(point.dateLabel, labelX, h - 16);
          }
        });
        ctx.draw();
      })
      .exec();
  }
});
