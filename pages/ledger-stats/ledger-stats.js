// pages/ledger-stats/ledger-stats.js - 收支统计（月账单 / 年账单）
const {
  loadBills, moneyFmt,
  monthKey, currentMonth, shiftMonth, formatMonthText, summarize,
  buildMonthBars, buildYearBars, buildDailyBars, buildWeeklyBars, buildBreakdown
} = require('../../utils/ledger');

// 柱顶金额用短格式，避免挤压柱宽
function compactMoney(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 10000) {
    const w = Math.round((v / 10000) * 10) / 10;
    return `${w % 1 === 0 ? w.toFixed(0) : w.toFixed(1)}万`;
  }
  return Math.round(v).toString();
}

// 已过的天数（当月截到今天，历史月为整月）
function elapsedDays(month) {
  const parts = month.split('-').map(Number);
  const now = new Date();
  const isCurrent = now.getFullYear() === parts[0] && now.getMonth() + 1 === parts[1];
  if (isCurrent) return now.getDate();
  return new Date(parts[0], parts[1], 0).getDate();
}

// 年份规范化：必须是 2000~当前年 的整数，非法回退（防止 "2024"+1 拼接出 20249 之类畸形值）
function normalizeYear(value, fallback) {
  const n = Number(value);
  const max = Number(currentMonth().slice(0, 4));
  if (Number.isInteger(n) && n >= 2000 && n <= max) return String(n);
  return String(fallback);
}

Page({
  data: {
    mode: 'month',           // month | year
    type: 'expense',         // expense | income
    dim: 'month',            // 图表维度 day | week | month（仅月账单生效）
    typeName: '支出',
    chartTitle: '',
    chartSub: '',
    isPair: false,
    legendCur: '',
    legendPrev: '',
    viewMonth: '',
    viewYear: '',
    monthText: '',
    maxMonth: '',
    maxYear: '',
    canPrev: true,
    canNext: false,
    amountText: '0.00',
    countText: '0',
    avgText: '',
    trendText: '',
    trendCls: '',
    incomeText: '0.00',
    balanceSign: '',
    balanceAbsText: '0.00',
    balanceCls: 'pos',
    bars: [],
    hasBars: false,
    breakdown: []
  },

  onLoad(options) {
    let month = String(options.month || '');
    if (!/^\d{4}-\d{2}$/.test(month)) month = currentMonth();
    const cur = currentMonth();
    if (month > cur) month = cur;
    this.setData({
      viewMonth: month,
      viewYear: month.slice(0, 4),
      maxMonth: cur,
      maxYear: cur.slice(0, 4)
    });
    this.recompute();
  },

  onShow() {
    this.recompute();
  },

  recompute() {
    // 纵深防御：修正畸形年月（如历史字符串拼接产生的 "20249-12"）
    const fallbackMonth = this.data.maxMonth || currentMonth();
    if (!/^\d{4}-\d{2}$/.test(this.data.viewMonth) || this.data.viewMonth > fallbackMonth) {
      this.setData({ viewMonth: fallbackMonth });
    }
    const safeYear = normalizeYear(this.data.viewYear, fallbackMonth.slice(0, 4));
    if (safeYear !== String(this.data.viewYear)) {
      this.setData({ viewYear: safeYear });
    }

    const { mode, type } = this.data;
    const bills = loadBills();
    const typeName = type === 'expense' ? '支出' : '收入';

    // 当前统计范围与对比范围
    let scopeBills;
    let prevBills;
    if (mode === 'month') {
      const month = this.data.viewMonth;
      scopeBills = bills.filter((b) => monthKey(b.date) === month);
      prevBills = bills.filter((b) => monthKey(b.date) === shiftMonth(month, -1));
    } else {
      const year = String(this.data.viewYear);
      scopeBills = bills.filter((b) => monthKey(b.date).slice(0, 4) === year);
      prevBills = bills.filter((b) => monthKey(b.date).slice(0, 4) === String(year - 1));
    }

    const sum = summarize(scopeBills);
    const prevSum = summarize(prevBills);
    const value = type === 'expense' ? sum.expense : sum.income;
    const prevValue = type === 'expense' ? prevSum.expense : prevSum.income;
    const count = type === 'expense' ? sum.expenseCount : sum.incomeCount;

    // 环比：对比期无数据时不显示
    let trendText = '';
    let trendCls = '';
    if (prevValue > 0 && value > 0) {
      const pct = Math.round(((value - prevValue) / prevValue) * 100);
      if (pct !== 0) {
        const up = pct > 0;
        trendText = `较${mode === 'month' ? '上月' : '上年'}${up ? '+' : ''}${pct}%`;
        // 支出增长/收入减少视为不利
        const bad = type === 'expense' ? up : !up;
        trendCls = bad ? 'bad' : 'good';
      }
    }

    // 日均（仅月模式且有账单）
    let avgText = '';
    if (mode === 'month' && value > 0) {
      avgText = ` · 日均 ¥${(Math.round((value / elapsedDays(this.data.viewMonth)) * 100) / 100).toFixed(2)}`;
    }

    // 柱状图：年模式 = 当年 vs 上年双柱；月模式 = 按日 / 按周 / 近6个月
    const pickValue = (bar) => (type === 'expense' ? bar.expense : bar.income);
    const cur = currentMonth();
    let bars = [];
    let hasBars = false;
    let chartTitle = '';
    let chartSub = '';
    let chartEmptyTip = '';
    let isPair = false;
    const viewMonth = this.data.viewMonth;
    const viewYear = String(this.data.viewYear);

    if (mode === 'year') {
      const curBars = buildYearBars(bills, viewYear);
      const prevBars = buildYearBars(bills, String(Number(viewYear) - 1));
      const curValues = curBars.map(pickValue);
      const prevValues = prevBars.map(pickValue);
      const max = Math.max.apply(null, curValues.concat(prevValues).concat([0]));
      const maxIndex = curValues.indexOf(Math.max.apply(null, curValues));
      bars = curBars.map((b, i) => ({
        key: 'y-' + b.month,
        label: b.label,
        amountText: compactMoney(curValues[i]),
        heightPct: curValues[i] > 0 ? Math.max(6, Math.round((curValues[i] / max) * 100)) : 0,
        prevPct: prevValues[i] > 0 ? Math.max(6, Math.round((prevValues[i] / max) * 100)) : 0,
        active: max > 0 && i === maxIndex,
        future: b.month > cur,
        month: b.month
      }));
      hasBars = curValues.some((v) => v > 0) || prevValues.some((v) => v > 0);
      isPair = true;
      chartTitle = `月度${typeName}对比`;
      chartSub = `${viewYear}年 vs ${Number(viewYear) - 1}年 · 深色为${viewYear}年`;
      chartEmptyTip = `${viewYear}年`;
    } else if (this.data.dim === 'day') {
      const raw = buildDailyBars(bills, viewMonth);
      const values = raw.map(pickValue);
      const max = Math.max.apply(null, values.concat([0]));
      const todayDay = viewMonth === cur ? Number(new Date().getDate()) : -1;
      bars = raw.map((b, i) => ({
        key: 'd-' + b.day,
        label: b.label,
        amountText: compactMoney(values[i]),
        heightPct: values[i] > 0 ? Math.max(5, Math.round((values[i] / max) * 100)) : 0,
        active: i + 1 === todayDay,
        future: false,
        month: `${viewMonth}-${String(i + 1).padStart(2, '0')}`
      }));
      hasBars = values.some((v) => v > 0);
      chartTitle = `${Number(viewMonth.slice(5))}月每日${typeName}`;
      chartSub = '一天一柱，今天高亮';
      chartEmptyTip = `${Number(viewMonth.slice(5))}月`;
    } else if (this.data.dim === 'week') {
      const raw = buildWeeklyBars(bills, viewMonth);
      const values = raw.map(pickValue);
      const max = Math.max.apply(null, values.concat([0]));
      const maxIndex = values.indexOf(max);
      bars = raw.map((b, i) => ({
        key: 'w-' + b.label,
        label: b.label,
        amountText: compactMoney(values[i]),
        heightPct: values[i] > 0 ? Math.max(6, Math.round((values[i] / max) * 100)) : 0,
        active: max > 0 && i === maxIndex,
        future: false,
        month: viewMonth
      }));
      hasBars = values.some((v) => v > 0);
      chartTitle = `${Number(viewMonth.slice(5))}月每周${typeName}`;
      chartSub = '按每 7 天一段，最高一段高亮';
      chartEmptyTip = `${Number(viewMonth.slice(5))}月`;
    } else {
      const raw = buildMonthBars(bills, viewMonth, 6);
      const values = raw.map(pickValue);
      const max = Math.max.apply(null, values.concat([0]));
      const viewYearStr = viewMonth.slice(0, 4);
      const crossYear = raw.some((b) => b.month.slice(0, 4) !== viewYearStr);
      bars = raw.map((b, i) => {
        let label = b.label;
        if (crossYear) label = (b.month.slice(0, 4) === viewYearStr ? '今年' : '去年') + b.label;
        return {
          key: 'm-' + b.month,
          label,
          amountText: compactMoney(values[i]),
          heightPct: values[i] > 0 ? Math.max(6, Math.round((values[i] / max) * 100)) : 0,
          active: b.month === viewMonth,
          future: b.month > cur,
          month: b.month
        };
      });
      hasBars = values.some((v) => v > 0);
      chartTitle = `近6个月${typeName}对比`;
      chartSub = '点击柱子可查看该月账单';
      chartEmptyTip = '近6个月';
    }

    const balance = sum.income - sum.expense;
    this.setData({
      typeName,
      monthText: formatMonthText(this.data.viewMonth),
      amountText: moneyFmt(value),
      countText: String(count),
      avgText,
      trendText,
      trendCls,
      incomeText: moneyFmt(sum.income),
      balanceSign: balance < 0 ? '-' : '',
      balanceAbsText: moneyFmt(Math.abs(balance)),
      balanceCls: balance >= 0 ? 'pos' : 'neg',
      bars,
      hasBars,
      chartTitle,
      chartSub,
      chartEmptyTip,
      isPair,
      legendCur: viewYear,
      legendPrev: String(Number(viewYear) - 1),
      canPrev: mode === 'month' ? this.data.viewMonth > '2000-01' : this.data.viewYear > 2000,
      canNext: mode === 'month'
        ? this.data.viewMonth < this.data.maxMonth
        : this.data.viewYear < Number(this.data.maxYear),
      breakdown: buildBreakdown(scopeBills, type)
    });
  },

  setMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.mode) return;
    // 切换月/年账单时回到当前时间（本月 / 本年），再由用户自行翻历史
    const update = { mode };
    if (mode === 'year') {
      update.viewYear = this.data.maxYear;
    } else {
      update.viewMonth = this.data.maxMonth;
    }
    this.setData(update);
    this.recompute();
  },

  setType(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.type) return;
    this.setData({ type });
    this.recompute();
  },

  // 图表维度切换（仅月账单模式生效：按日 / 按周 / 按月）
  setDim(e) {
    const dim = e.currentTarget.dataset.dim;
    if (dim === this.data.dim || this.data.mode !== 'month') return;
    this.setData({ dim });
    this.recompute();
  },

  prev() {
    if (!this.data.canPrev) return;
    if (this.data.mode === 'month') {
      this.setData({ viewMonth: shiftMonth(this.data.viewMonth, -1) });
    } else {
      const year = Number(normalizeYear(this.data.viewYear, this.data.maxYear));
      this.setData({ viewYear: String(year - 1) });
    }
    this.recompute();
  },

  next() {
    if (!this.data.canNext) return;
    if (this.data.mode === 'month') {
      this.setData({ viewMonth: shiftMonth(this.data.viewMonth, 1) });
    } else {
      const year = Number(normalizeYear(this.data.viewYear, this.data.maxYear));
      this.setData({ viewYear: String(year + 1) });
    }
    this.recompute();
  },

  onTimeChange(e) {
    if (this.data.mode === 'month') {
      const value = String(e.detail.value || '');
      if (!/^\d{4}-\d{2}$/.test(value)) return;
      this.setData({ viewMonth: value });
    } else {
      this.setData({ viewYear: normalizeYear(e.detail.value, this.data.viewYear) });
    }
    this.recompute();
  },

  // 点击柱子切换到对应月份（仅月账单 + 按月维度）
  onBarTap(e) {
    if (this.data.mode !== 'month' || this.data.dim !== 'month') return;
    const month = e.currentTarget.dataset.month;
    if (!month || month.length !== 7 || month === this.data.viewMonth || month > this.data.maxMonth) return;
    this.setData({ viewMonth: month });
    this.recompute();
  },

  onShareAppMessage() {
    return {
      title: '日常琐事，交给这个小工具集就对了',
      path: '/pages/ledger/ledger',
      imageUrl: '/images/share-cover.jpg'
    };
  },

  onShareTimeline() {
    return { title: '日常琐事，交给这个小工具集就对了', imageUrl: '/images/share-cover.jpg' };
  }
});
