// pages/ledger/ledger.js - 记账本（本地存储）
const { getStorage, setStorage, today, genId } = require('../../utils/util');

const STORAGE_KEY = 'ledger_bills';
const CUSTOM_EXPENSE_KEY = 'ledger_categories_expense';
const CUSTOM_INCOME_KEY = 'ledger_categories_income';
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

function loadBills() {
  const list = getStorage(STORAGE_KEY, []);
  return Array.isArray(list) ? list : [];
}

function saveBills(list) {
  setStorage(STORAGE_KEY, list);
}

function loadCustomCategories(type) {
  const key = type === 'income' ? CUSTOM_INCOME_KEY : CUSTOM_EXPENSE_KEY;
  const list = getStorage(key, []);
  return Array.isArray(list) ? list.filter((item) => typeof item === 'string' && item.trim()) : [];
}

function saveCustomCategories(type, list) {
  const key = type === 'income' ? CUSTOM_INCOME_KEY : CUSTOM_EXPENSE_KEY;
  setStorage(key, list);
}

function getCategories(type) {
  const defaults = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const customs = loadCustomCategories(type);
  // 去重并保持默认在前
  const set = new Set(defaults);
  customs.forEach((c) => set.add(c));
  return Array.from(set);
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

function buildManageList(type) {
  return getCategories(type).map((name) => ({
    name,
    isBuiltin: isBuiltinCategory(type, name),
    meta: getCategoryMeta(name)
  }));
}

Page({
  data: {
    bills: [],
    stats: { income: '0.00', expense: '0.00', balance: '0.00' },
    monthText: '',
    showSheet: false,
    showCateSheet: false,
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
    },
    cateForm: {
      type: 'expense',
      name: ''
    },
    manageCategories: [],
    usedMap: {}
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
        const meta = getCategoryMeta(bill.category);
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

    const usedMap = {};
    bills.forEach((bill) => { usedMap[bill.type + '::' + bill.category] = true; });

    this.setData({
      bills,
      monthText: month.replace('-', '年') + '月',
      stats: {
        income: money(income),
        expense: money(expense),
        balance: money(income - expense)
      },
      usedMap
    });
  },

  openAdd() {
    const categories = getCategories('expense');
    this.setData({
      showSheet: true,
      kbHeight: 0,
      typeIndex: 0,
      categories,
      form: {
        amount: '',
        type: 'expense',
        category: categories[0],
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
    const categories = getCategories(type);
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

  // ---------- 分类管理 ----------
  openCateManage() {
    const type = this.data.form.type;
    this.setData({
      showCateSheet: true,
      kbHeight: 0,
      'cateForm.type': type,
      'cateForm.name': '',
      manageCategories: buildManageList(type)
    });
  },

  closeCateSheet() {
    this.setData({ showCateSheet: false, kbHeight: 0 });
  },

  onCateTypePick(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      'cateForm.type': type,
      'cateForm.name': '',
      manageCategories: buildManageList(type)
    });
  },

  onCateNameInput(e) {
    this.setData({ 'cateForm.name': e.detail.value });
  },

  addCustomCategory() {
    const { type, name } = this.data.cateForm;
    const trimmed = (name || '').trim();
    if (!trimmed) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' });
      return;
    }
    if (trimmed.length > 6) {
      wx.showToast({ title: '分类名称最多6个字', icon: 'none' });
      return;
    }

    const categories = getCategories(type);
    if (categories.includes(trimmed)) {
      wx.showToast({ title: '该分类已存在', icon: 'none' });
      return;
    }

    categories.push(trimmed);
    saveCustomCategories(type, categories.filter((c) => !isBuiltinCategory(type, c)));

    // 如果当前正在添加账单且类型一致，刷新分类列表并选中新分类
    const update = {
      'cateForm.name': '',
      manageCategories: buildManageList(type)
    };
    if (this.data.form.type === type) {
      update.categories = getCategories(type);
      update['form.category'] = trimmed;
    }
    this.setData(update);
    wx.showToast({ title: '已添加', icon: 'success' });
  },

  deleteCustomCategory(e) {
    const name = e.currentTarget.dataset.name;
    const type = this.data.cateForm.type;
    if (isBuiltinCategory(type, name)) {
      wx.showToast({ title: '默认分类不能删除', icon: 'none' });
      return;
    }

    if (this.data.usedMap[type + '::' + name]) {
      wx.showToast({ title: '该分类已被账单使用，无法删除', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '删除分类',
      content: `确定删除自定义分类「${name}」吗？`,
      confirmColor: '#e25d5d',
      success: (res) => {
        if (!res.confirm) return;
        const categories = getCategories(type).filter((c) => c !== name);
        saveCustomCategories(type, categories.filter((c) => !isBuiltinCategory(type, c)));

        const update = {
          manageCategories: buildManageList(type)
        };
        if (this.data.form.type === type) {
          update.categories = getCategories(type);
          if (this.data.form.category === name) {
            update['form.category'] = getCategories(type)[0];
          }
        }
        this.setData(update);
      }
    });
  },

  resetCategories() {
    const type = this.data.cateForm.type;
    const allCustoms = loadCustomCategories(type);
    if (allCustoms.length === 0) {
      wx.showToast({ title: '当前已是默认分类', icon: 'none' });
      return;
    }

    const kept = allCustoms.filter((name) => this.data.usedMap[type + '::' + name]);
    const removedCount = allCustoms.length - kept.length;

    if (removedCount === 0) {
      wx.showToast({ title: '自定义分类正在使用中，无法恢复默认', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '恢复默认分类',
      content: kept.length > 0
        ? `将删除 ${removedCount} 个未使用的自定义分类；${kept.length} 个正在使用中的分类会被保留。`
        : `确定删除所有自定义分类，恢复为默认分类吗？`,
      confirmColor: '#e25d5d',
      success: (res) => {
        if (!res.confirm) return;
        saveCustomCategories(type, kept);

        const categories = getCategories(type);
        const update = {
          'cateForm.name': '',
          manageCategories: buildManageList(type)
        };
        if (this.data.form.type === type) {
          update.categories = categories;
          if (!categories.includes(this.data.form.category)) {
            update['form.category'] = categories[0];
          }
        }
        this.setData(update);
        wx.showToast({ title: `已删除 ${removedCount} 个分类`, icon: 'success' });
      }
    });
  },

  stopPropagation() {}
});

function isBuiltinCategory(type, name) {
  const defaults = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return defaults.includes(name);
}
