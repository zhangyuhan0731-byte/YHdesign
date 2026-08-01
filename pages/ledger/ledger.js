// pages/ledger/ledger.js - 记账本（本地存储）
const { getStorage, setStorage, today, genId } = require('../../utils/util');

const STORAGE_KEY = 'ledger_bills';
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

function loadBills() {
  const list = getStorage(STORAGE_KEY, []);
  return Array.isArray(list) ? list : [];
}

function saveBills(list) {
  setStorage(STORAGE_KEY, list);
}

function money(n) {
  const value = Number(n) || 0;
  return value.toFixed(2);
}

function monthKey(dateStr) {
  return String(dateStr || '').slice(0, 7);
}

function currentMonth() {
  return today().slice(0, 7);
}

function normalizeAmount(value) {
  const amount = Number(String(value).replace(/[^\d.]/g, ''));
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

Page({
  data: {
    bills: [],
    stats: { income: '0.00', expense: '0.00', balance: '0.00' },
    monthText: '',
    showSheet: false,
    kbHeight: 0,
    typeIndex: 0,
    types: TYPES,
    categories: EXPENSE_CATEGORIES,
    form: {
      amount: '',
      type: 'expense',
      category: EXPENSE_CATEGORIES[0],
      date: '',
      note: ''
    }
  },

  onShow() {
    this.refresh();
  },

  onKbFocus(e) {
    this.setData({ kbHeight: e.detail.height || 0 });
  },

  onKbBlur() {
    this.setData({ kbHeight: 0 });
  },

  refresh() {
    const bills = loadBills()
      .slice()
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      })
      .map((bill) => {
        const meta = CATEGORY_META[bill.category] || CATEGORY_META.其他;
        const typeName = bill.type === 'income' ? '收入' : '支出';
        const sign = bill.type === 'income' ? '+' : '-';
        return Object.assign({}, bill, {
          typeName,
          amountText: sign + money(bill.amount),
          cls: bill.type === 'income' ? 'income' : 'expense',
          cateIcon: meta.icon,
          cateColor: meta.color,
          cateBg: meta.bg
        });
      });

    const month = currentMonth();
    let income = 0;
    let expense = 0;
    bills.forEach((bill) => {
      if (monthKey(bill.date) !== month) return;
      if (bill.type === 'income') income += Number(bill.amount) || 0;
      else expense += Number(bill.amount) || 0;
    });

    this.setData({
      bills,
      monthText: month.replace('-', '年') + '月',
      stats: {
        income: money(income),
        expense: money(expense),
        balance: money(income - expense)
      }
    });
  },

  openAdd() {
    this.setData({
      showSheet: true,
      kbHeight: 0,
      typeIndex: 0,
      categories: EXPENSE_CATEGORIES,
      form: {
        amount: '',
        type: 'expense',
        category: EXPENSE_CATEGORIES[0],
        date: today(),
        note: ''
      }
    });
  },

  closeSheet() {
    this.setData({ showSheet: false, kbHeight: 0 });
  },

  onTypePick(e) {
    const index = Number(e.currentTarget.dataset.index);
    const type = TYPES[index].key;
    const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    this.setData({
      typeIndex: index,
      categories,
      'form.type': type,
      'form.category': categories[0]
    });
  },

  onCategoryPick(e) {
    this.setData({ 'form.category': e.currentTarget.dataset.category });
  },

  onAmountInput(e) {
    this.setData({ 'form.amount': e.detail.value });
  },

  onNoteInput(e) {
    this.setData({ 'form.note': e.detail.value });
  },

  onDateChange(e) {
    this.setData({ 'form.date': e.detail.value });
  },

  saveBill() {
    const form = this.data.form;
    const amount = normalizeAmount(form.amount);
    if (amount <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' });
      return;
    }

    const now = Date.now();
    const list = loadBills();
    list.push({
      id: genId(),
      type: form.type,
      category: form.category,
      amount,
      date: form.date || today(),
      note: (form.note || '').trim(),
      createdAt: now,
      updatedAt: now
    });
    saveBills(list);
    this.setData({ showSheet: false, kbHeight: 0 });
    this.refresh();
    wx.showToast({ title: '已记一笔', icon: 'success' });
  },

  removeBill(e) {
    const id = e.currentTarget.dataset.id;
    const bill = loadBills().find((item) => item.id === id);
    if (!bill) return;
    wx.showModal({
      title: '删除账单',
      content: `确定删除「${bill.category} ${money(bill.amount)}」这条记录吗？`,
      confirmColor: '#e25d5d',
      success: (res) => {
        if (!res.confirm) return;
        saveBills(loadBills().filter((item) => item.id !== id));
        this.refresh();
      }
    });
  },

  stopPropagation() {}
});
