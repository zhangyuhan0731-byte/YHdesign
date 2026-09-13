// utils/ledger.js - 记账本共享数据层（主页面与统计页共用）
// 所有数据仅保存在手机本地，不上传任何服务器。
const { getStorage, setStorage, today, formatDate, genId } = require('./util');

const STORAGE_KEY = 'ledger_bills';
const BUDGET_KEY = 'ledger_budget';
const CUSTOM_EXPENSE_KEY = 'ledger_categories_expense';
const CUSTOM_INCOME_KEY = 'ledger_categories_income';
// 被用户删除的内置分类（恢复默认时清空，让内置分类可以找回）
const HIDDEN_EXPENSE_KEY = 'ledger_hidden_builtin_expense';
const HIDDEN_INCOME_KEY = 'ledger_hidden_builtin_income';

// 滚动加载：每次上拉追加的账单条数（按分组边界向上取整）
const PAGE_SIZE = 20;

const TYPES = [
  { key: 'expense', name: '支出' },
  { key: 'income', name: '收入' }
];
const EXPENSE_CATEGORIES = ['餐饮', '购物', '交通', '娱乐', '学习', '生活', '其他'];
const INCOME_CATEGORIES = ['工资', '兼职', '红包', '其他'];
const CATEGORY_META = {
  餐饮: { icon: '食', color: '#f06f38', bg: '#fff1e8' },
  购物: { icon: '购', color: '#e66a7a', bg: '#fff0f2' },
  交通: { icon: '行', color: '#2d7dd2', bg: '#edf5ff' },
  娱乐: { icon: '乐', color: '#7866d6', bg: '#f3f0ff' },
  学习: { icon: '学', color: '#25a974', bg: '#eefbf4' },
  生活: { icon: '家', color: '#f4a62a', bg: '#fff5df' },
  其他: { icon: '记', color: '#8c94a3', bg: '#f0f4f6' },
  工资: { icon: '薪', color: '#25a974', bg: '#eefbf4' },
  兼职: { icon: '兼', color: '#2d7dd2', bg: '#edf5ff' },
  红包: { icon: '红', color: '#e66a7a', bg: '#fff0f2' }
};

// 自定义分类的备选配色（与默认分类风格一致）
const CUSTOM_PALETTE = [
  { color: '#2d7dd2', bg: '#edf5ff' },
  { color: '#25a974', bg: '#eefbf4' },
  { color: '#f06f38', bg: '#fff1e8' },
  { color: '#e66a7a', bg: '#fff0f2' },
  { color: '#7866d6', bg: '#f3f0ff' },
  { color: '#f4a62a', bg: '#fff5df' },
  { color: '#3a9bd6', bg: '#e8f6ff' },
  { color: '#9b6bd3', bg: '#f6f0ff' },
  { color: '#e25d5d', bg: '#fdecea' },
  { color: '#4caf7d', bg: '#e8f5ed' }
];

// 评价四档（支出：消费观），从"超值"到"亏损"，颜色按情感语义
const EVALUATION_OPTIONS = [
  { key: 'great',   name: '超值消费', sub: '物超所值', color: '#25a974', bg: '#eefbf4' },
  { key: 'worth',   name: '合理消费', sub: '物有所值', color: '#2d7dd2', bg: '#edf5ff' },
  { key: 'impulse', name: '冲动消费', sub: '可有可无', color: '#f4a62a', bg: '#fff5df' },
  { key: 'loss',    name: '亏损消费', sub: '不太值得', color: '#e25d5d', bg: '#fdecea' }
];

// 评价四档（收入：来历），与支出分开，按账单类型解析
const INCOME_EVALUATION_OPTIONS = [
  { key: 'earned',   name: '辛勤所得', sub: '付出换来回报', color: '#25a974', bg: '#eefbf4' },
  { key: 'extra',    name: '意外之财', sub: '计划之外的收入', color: '#f4a62a', bg: '#fff5df' },
  { key: 'passive',  name: '被动收入', sub: '躺着也有进账', color: '#2d7dd2', bg: '#edf5ff' },
  { key: 'social',   name: '人情往来', sub: '红包礼金回血', color: '#e66a7a', bg: '#fff0f2' }
];

// 自定义评价标签（按收支分开存，数组元素即标签文本，最多 8 个）
const EVAL_CUSTOM_EXPENSE_KEY = 'ledger_eval_custom_expense';
const EVAL_CUSTOM_INCOME_KEY = 'ledger_eval_custom_income';

function loadEvalCustom(type) {
  const key = type === 'income' ? EVAL_CUSTOM_INCOME_KEY : EVAL_CUSTOM_EXPENSE_KEY;
  const list = getStorage(key, []);
  if (!Array.isArray(list)) return [];
  const seen = {};
  const out = [];
  list.forEach((item) => {
    const name = String(item || '').trim().slice(0, 6);
    if (!name || seen[name]) return;
    seen[name] = true;
    out.push(name);
  });
  return out.slice(0, 8);
}

function saveEvalCustom(type, list) {
  const key = type === 'income' ? EVAL_CUSTOM_INCOME_KEY : EVAL_CUSTOM_EXPENSE_KEY;
  setStorage(key, Array.isArray(list) ? list.slice(0, 8) : []);
}

/* ---------------- 基础读写 ---------------- */

function isRealDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.getFullYear() === parts[0] && d.getMonth() + 1 === parts[1] && d.getDate() === parts[2];
}

// 清洗脏数据：坏金额/坏日期剔除，缺字段补齐，重复 id 重发。
// 返回 { list, dirty }，dirty 表示需要回存修复。
function sanitizeBills(raw) {
  if (!Array.isArray(raw)) return { list: [], dirty: false };
  let dirty = false;
  const seenIds = {};
  const out = [];

  raw.forEach((bill) => {
    if (!bill || typeof bill !== 'object') { dirty = true; return; }

    const amount = Number(bill.amount);
    if (!Number.isFinite(amount) || amount <= 0) { dirty = true; return; }

    let date = String(bill.date || '');
    if (!isRealDate(date)) {
      const created = Number(bill.createdAt);
      date = Number.isFinite(created) && created > 0 ? formatDate(new Date(created)) : '';
      if (!isRealDate(date)) { dirty = true; return; }
    }

    let id = String(bill.id || '');
    if (!id || seenIds[id]) { id = genId(); }
    seenIds[id] = true;

    const fixed = {
      id,
      type: bill.type === 'income' ? 'income' : 'expense',
      category: String(bill.category || '').trim().slice(0, 20) || '其他',
      amount: Math.round(amount * 100) / 100,
      date,
      note: typeof bill.note === 'string' ? bill.note.slice(0, 20) : '',
      remark: typeof bill.remark === 'string' ? bill.remark.slice(0, 50) : '',
      createdAt: Number(bill.createdAt) || Date.now(),
      updatedAt: Number(bill.updatedAt) || Number(bill.createdAt) || Date.now()
    };

    ['id', 'type', 'category', 'amount', 'date', 'note', 'remark', 'createdAt', 'updatedAt'].forEach((key) => {
      if (bill[key] !== fixed[key]) dirty = true;
    });
    out.push(fixed);
  });

  return { list: out, dirty };
}

function loadBills() {
  const result = sanitizeBills(getStorage(STORAGE_KEY, []));
  if (result.dirty) saveBills(result.list); // 一次性修复并回存
  return result.list;
}

function saveBills(list) {
  setStorage(STORAGE_KEY, Array.isArray(list) ? list : []);
}

// 月度总预算（全局一个值，0 表示未设置）
function loadBudget() {
  const value = Number(getStorage(BUDGET_KEY, 0));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : 0;
}

function saveBudget(amount) {
  const value = Number(amount) || 0;
  setStorage(BUDGET_KEY, value > 0 ? Math.round(value * 100) / 100 : 0);
}

/* ---------------- 钱包余额 ---------------- */

// 校准历史（升序）：[{ value, date, at }]。当前余额 = 最后一次校准值 + 其后新账单净额。
// 余额明细按统一时间轴（账单 createdAt / 校准 at）串联，校准是显式跳变点。
const BALANCE_ADJUST_KEY = 'ledger_balance_adjustments';
// 旧版单值模型（{ base, since, adjustAt }），读取时自动迁移为校准历史后清除
const BALANCE_LEGACY_KEY = 'ledger_balance';

function sanitizeAdjustments(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      value: Math.round((Number(item.value) || 0) * 100) / 100,
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(item.date)) ? String(item.date) : '',
      at: Number(item.at) || 0
    }))
    .filter((item) => item.at > 0)
    .sort((a, b) => a.at - b.at);
}

function loadBalanceAdjustments() {
  const saved = sanitizeAdjustments(getStorage(BALANCE_ADJUST_KEY, []));
  if (saved.length) return saved;

  // 旧单值模型迁移
  const legacy = getStorage(BALANCE_LEGACY_KEY, null);
  if (legacy && typeof legacy === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(String(legacy.since || ''))) {
    const migrated = [{
      value: Math.round((Number(legacy.base) || 0) * 100) / 100,
      date: String(legacy.since),
      at: Number(legacy.adjustAt) || Date.now()
    }];
    setStorage(BALANCE_ADJUST_KEY, migrated);
    setStorage(BALANCE_LEGACY_KEY, null);
    return migrated;
  }
  return [];
}

function saveBalanceAdjustments(list) {
  setStorage(BALANCE_ADJUST_KEY, sanitizeAdjustments(list));
}

function addBalanceAdjustment(value, dateStr) {
  const list = loadBalanceAdjustments();
  list.push({
    value: Math.round((Number(value) || 0) * 100) / 100,
    date: dateStr || today(),
    at: Date.now()
  });
  saveBalanceAdjustments(list);
  return list;
}

function clearBalance() {
  setStorage(BALANCE_ADJUST_KEY, []);
  setStorage(BALANCE_LEGACY_KEY, null);
}

// 当前显示余额；未开启（无校准记录）返回 null
function getCurrentBalance(bills) {
  const adjustments = loadBalanceAdjustments();
  if (!adjustments.length) return null;
  const last = adjustments[adjustments.length - 1];
  let net = 0;
  (bills || []).forEach((bill) => {
    if ((Number(bill.createdAt) || 0) <= last.at) return;
    const amount = Number(bill.amount) || 0;
    net += bill.type === 'income' ? amount : -amount;
  });
  return Math.round((last.value + net) * 100) / 100;
}

// 余额明细流水：校准 + 联动账单按时间正序累计出每步余额，返回时倒序（最新在上）
// entry: { key, kind: 'adjust'|'bill', title, subText, icon, avatarStyle, amountText, cls, afterText }
function buildBalanceFlow(bills) {
  const adjustments = loadBalanceAdjustments();
  if (!adjustments.length) return [];

  const events = [];
  adjustments.forEach((adj) => events.push({ kind: 'adjust', ts: adj.at, data: adj }));
  (bills || []).forEach((bill) => events.push({ kind: 'bill', ts: Number(bill.createdAt) || 0, data: bill }));
  events.sort((a, b) => a.ts - b.ts);

  const firstAdjustIndex = events.findIndex((e) => e.kind === 'adjust');
  if (firstAdjustIndex < 0) return [];

  const flow = [];
  let running = 0;
  for (let i = firstAdjustIndex; i < events.length; i++) {
    const e = events[i];
    if (e.kind === 'adjust') {
      running = e.data.value;
      const day = e.data.date
        ? ` · ${Number(e.data.date.slice(5, 7))}月${Number(e.data.date.slice(8, 10))}日`
        : '';
      flow.push({
        key: 'adj-' + e.data.at,
        kind: 'adjust',
        title: '余额校准',
        subText: '手动设置余额' + day,
        icon: '校',
        avatarStyle: 'color:#2d7dd2;background:#edf5ff;',
        amountText: '设为 ' + moneyFmt(e.data.value),
        cls: 'adjust',
        afterText: moneyFmt(running)
      });
    } else {
      const bill = e.data;
      const amount = Number(bill.amount) || 0;
      const isIncome = bill.type === 'income';
      running = Math.round((running + (isIncome ? amount : -amount)) * 100) / 100;
      const meta = getCategoryMeta(bill.category);
      const remark = bill.remark ? ' · ' + bill.remark : '';
      flow.push({
        key: 'bill-' + bill.id,
        kind: 'bill',
        title: bill.category,
        subText: (isIncome ? '收入' : '支出') + remark,
        icon: meta.icon,
        avatarStyle: `color:${meta.color};background:${meta.bg};`,
        amountText: (isIncome ? '+' : '-') + moneyFmt(amount),
        cls: isIncome ? 'income' : 'expense',
        afterText: moneyFmt(running)
      });
    }
  }
  return flow.reverse();
}

// 余额输入解析（支持负数，如 -120.5）
function parseBalanceInput(text) {
  const s = String(text || '').trim();
  const negative = s.indexOf('-') === 0;
  const amount = normalizeAmount(s.replace(/-/g, ''));
  return negative ? -amount : amount;
}

function loadCustomCategories(type) {
  const key = type === 'income' ? CUSTOM_INCOME_KEY : CUSTOM_EXPENSE_KEY;
  const list = getStorage(key, []);
  return Array.isArray(list) ? list.filter((item) => typeof item === 'string' && item.trim()) : [];
}

function saveCustomCategories(type, list) {
  const key = type === 'income' ? CUSTOM_INCOME_KEY : CUSTOM_EXPENSE_KEY;
  setStorage(key, Array.isArray(list) ? list : []);
}

function loadHiddenCategories(type) {
  const key = type === 'income' ? HIDDEN_INCOME_KEY : HIDDEN_EXPENSE_KEY;
  const list = getStorage(key, []);
  return Array.isArray(list) ? list.filter((item) => typeof item === 'string' && item.trim()) : [];
}

function saveHiddenCategories(type, list) {
  const key = type === 'income' ? HIDDEN_INCOME_KEY : HIDDEN_EXPENSE_KEY;
  setStorage(key, Array.isArray(list) ? list : []);
}

function getCategories(type) {
  const defaults = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const hidden = loadHiddenCategories(type);
  const customs = loadCustomCategories(type);
  // 默认分类去掉被删除的，再拼上自定义的，去重保序
  const set = new Set(defaults.filter((c) => hidden.indexOf(c) < 0));
  customs.forEach((c) => set.add(c));
  return Array.from(set);
}

function isBuiltinCategory(type, name) {
  const defaults = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return defaults.includes(name);
}

/* ---------------- 分类/评价元数据 ---------------- */

// 按账单类型解析评价；预设 key 与类型不匹配（如收入存了支出 key）返回 null。
// 非预设 key 的短文本按「自定义评价」处理：文本即标签，配色按名称稳定生成。
function getEvalMeta(note, type) {
  if (!note) return null;
  const list = type === 'income' ? INCOME_EVALUATION_OPTIONS : EVALUATION_OPTIONS;
  const preset = list.find((opt) => opt.key === note);
  if (preset) return preset;
  // 撞上另一类型的预设 key 视为类型错配，不当自定义处理
  const otherList = type === 'income' ? EVALUATION_OPTIONS : INCOME_EVALUATION_OPTIONS;
  if (otherList.some((opt) => opt.key === note)) return null;
  const name = String(note).trim();
  if (name && name.length <= 6) {
    const palette = getCustomMeta(name);
    return { key: name, name, sub: '', color: palette.color, bg: palette.bg, custom: true };
  }
  return null;
}

// 为自定义分类生成稳定的图标/颜色
function getCustomMeta(name) {
  if (CATEGORY_META[name]) return CATEGORY_META[name];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  const palette = CUSTOM_PALETTE[Math.abs(hash) % CUSTOM_PALETTE.length];
  return {
    icon: name.charAt(0),
    color: palette.color,
    bg: palette.bg
  };
}

function getCategoryMeta(name) {
  return CATEGORY_META[name] || getCustomMeta(name);
}

/* ---------------- 金额与日期 ---------------- */

function money(n) {
  const value = Number(n) || 0;
  return value.toFixed(2);
}

// 千分位金额（统计大数字用）
function moneyFmt(n) {
  const value = Number(n) || 0;
  const fixed = value.toFixed(2);
  const [int, dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec ? `${grouped}.${dec}` : grouped;
}

function normalizeAmount(value) {
  const amount = Number(String(value).replace(/[^\d.]/g, ''));
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

function monthKey(dateStr) {
  return String(dateStr || '').slice(0, 7);
}

function currentMonth() {
  return today().slice(0, 7);
}

// 'yyyy-mm' 前后平移 n 个月
function shiftMonth(month, delta) {
  const parts = String(month || '').split('-').map(Number);
  const d = new Date(parts[0], (parts[1] || 1) - 1 + (delta || 0), 1);
  return `${d.getFullYear()}-${('0' + (d.getMonth() + 1)).slice(-2)}`;
}

// '2026-09' -> '2026年9月'
function formatMonthText(month) {
  const parts = String(month || '').split('-');
  return `${parts[0]}年${Number(parts[1])}月`;
}

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

// 账单日期 -> 列表分组标题，如「今天 · 9月13日 星期日」
function formatDayLabel(dateStr, now) {
  const ref = now || new Date();
  const parts = String(dateStr || '').split('-').map(Number);
  if (parts.length < 3 || !parts.every((p) => Number.isFinite(p))) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const base = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const diffDays = Math.round((base - d) / 86400000);
  const md = `${parts[1]}月${parts[2]}日`;
  const week = `星期${WEEK_LABELS[d.getDay()]}`;
  if (diffDays === 0) return `今天 · ${md} ${week}`;
  if (diffDays === 1) return `昨天 · ${md} ${week}`;
  return `${md} ${week}`;
}

/* ---------------- 汇总与统计 ---------------- */

// 一组账单 -> { income, expense, incomeCount, expenseCount }
function summarize(bills) {
  let income = 0;
  let expense = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  (bills || []).forEach((bill) => {
    const amount = Number(bill.amount) || 0;
    if (bill.type === 'income') {
      income += amount;
      incomeCount += 1;
    } else {
      expense += amount;
      expenseCount += 1;
    }
  });
  return { income, expense, incomeCount, expenseCount };
}

// 柱状图数据：endMonth 往前 count 个月（含 endMonth）
function buildMonthBars(bills, endMonth, count) {
  const byMonth = {};
  (bills || []).forEach((bill) => {
    const key = monthKey(bill.date);
    if (!key) return;
    if (!byMonth[key]) byMonth[key] = { expense: 0, income: 0 };
    const amount = Number(bill.amount) || 0;
    if (bill.type === 'income') byMonth[key].income += amount;
    else byMonth[key].expense += amount;
  });

  const total = count || 6;
  const bars = [];
  for (let i = total - 1; i >= 0; i--) {
    const month = shiftMonth(endMonth, -i);
    const m = Number(month.slice(5));
    bars.push({
      month,
      label: `${m}月`,
      expense: byMonth[month] ? byMonth[month].expense : 0,
      income: byMonth[month] ? byMonth[month].income : 0
    });
  }
  return bars;
}

// 年度柱状图：某年 1-12 月
function buildYearBars(bills, year) {
  return buildMonthBars(bills, `${year}-12`, 12);
}

// 当月按日柱状：1 号到月底（label 每 5 天标一次，避免拥挤）
function buildDailyBars(bills, month) {
  const parts = String(month || '').split('-').map(Number);
  if (!parts[0] || !parts[1]) return [];
  const days = new Date(parts[0], parts[1], 0).getDate();
  const byDay = {};
  (bills || []).forEach((bill) => {
    if (monthKey(bill.date) !== month) return;
    const day = Number(String(bill.date).slice(8, 10));
    if (!Number.isFinite(day) || day < 1 || day > days) return;
    if (!byDay[day]) byDay[day] = { expense: 0, income: 0 };
    const amount = Number(bill.amount) || 0;
    if (bill.type === 'income') byDay[day].income += amount;
    else byDay[day].expense += amount;
  });
  const bars = [];
  for (let d = 1; d <= days; d++) {
    bars.push({
      day: d,
      label: d === 1 || d % 5 === 0 ? String(d) : '',
      expense: byDay[d] ? byDay[d].expense : 0,
      income: byDay[d] ? byDay[d].income : 0
    });
  }
  return bars;
}

// 当月按 7 天分段（1-7 / 8-14 / ... / 29-31）
function buildWeeklyBars(bills, month) {
  const daily = buildDailyBars(bills, month);
  const segs = [];
  for (let start = 1; start <= daily.length; start += 7) {
    const end = Math.min(start + 6, daily.length);
    let expense = 0;
    let income = 0;
    for (let d = start; d <= end; d++) {
      expense += daily[d - 1].expense;
      income += daily[d - 1].income;
    }
    segs.push({ label: `${start}-${end}`, expense, income, start, end });
  }
  return segs;
}

// 分类构成（type: 'expense' | 'income'），按金额降序
function buildBreakdown(bills, type) {
  const map = {};
  (bills || []).forEach((bill) => {
    if (bill.type !== type) return;
    const name = bill.category || '其他';
    if (!map[name]) map[name] = { name, amount: 0, count: 0 };
    map[name].amount += Number(bill.amount) || 0;
    map[name].count += 1;
  });

  const list = Object.keys(map).map((name) => {
    const item = map[name];
    const meta = getCategoryMeta(name);
    return {
      name,
      icon: meta.icon,
      color: meta.color,
      bg: meta.bg,
      count: item.count,
      amount: item.amount,
      amountText: moneyFmt(item.amount)
    };
  });
  list.sort((a, b) => b.amount - a.amount);

  const max = list.length ? list[0].amount : 0;
  const total = list.reduce((sum, item) => sum + item.amount, 0);
  let used = 0;
  return list.map((item, index) => {
    const isLast = index === list.length - 1;
    // 最后一项吃掉四舍五入的误差，保证百分比合计为 100
    let percent = total > 0 ? Math.round((item.amount / total) * 100) : 0;
    if (!isLast) used += percent;
    else percent = Math.max(0, 100 - used);
    return Object.assign(item, {
      percent,
      barPct: max > 0 ? Math.max(4, Math.round((item.amount / max) * 100)) : 0
    });
  });
}

/* ---------------- 搜索与分页 ---------------- */

// 视图模型账单的关键词匹配（分类/备注/金额/评价/日期）
function billMatchesKeyword(viewBill, keyword) {
  const kw = String(keyword || '').trim().toLowerCase();
  if (!kw) return true;
  const haystack = [
    viewBill.category,
    viewBill.remarkText,
    viewBill.amountText,
    viewBill.evalLabel,
    viewBill.date,
    viewBill.typeName
  ].join(' ').toLowerCase();
  return haystack.indexOf(kw) >= 0;
}

// 取前 page 页的分组（每页按账单条数累计），返回 { groups, hasMore }
function paginateGroups(groups, page) {
  const list = Array.isArray(groups) ? groups : [];
  const limit = Math.max(1, page) * PAGE_SIZE;
  const out = [];
  let count = 0;
  for (let i = 0; i < list.length; i++) {
    out.push(list[i]);
    count += list[i].items.length;
    if (count >= limit) break;
  }
  return { groups: out, hasMore: out.length < list.length };
}

module.exports = {
  STORAGE_KEY,
  CUSTOM_EXPENSE_KEY,
  CUSTOM_INCOME_KEY,
  TYPES,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  CATEGORY_META,
  CUSTOM_PALETTE,
  EVALUATION_OPTIONS,
  INCOME_EVALUATION_OPTIONS,
  sanitizeBills,
  loadBills,
  saveBills,
  loadBudget,
  saveBudget,
  loadBalanceAdjustments,
  saveBalanceAdjustments,
  addBalanceAdjustment,
  clearBalance,
  getCurrentBalance,
  buildBalanceFlow,
  parseBalanceInput,
  loadCustomCategories,
  saveCustomCategories,
  loadHiddenCategories,
  saveHiddenCategories,
  getCategories,
  isBuiltinCategory,
  loadEvalCustom,
  saveEvalCustom,
  getEvalMeta,
  getCategoryMeta,
  money,
  moneyFmt,
  normalizeAmount,
  monthKey,
  currentMonth,
  shiftMonth,
  formatMonthText,
  formatDayLabel,
  summarize,
  buildMonthBars,
  buildYearBars,
  buildDailyBars,
  buildWeeklyBars,
  buildBreakdown,
  billMatchesKeyword,
  paginateGroups,
  PAGE_SIZE
};
