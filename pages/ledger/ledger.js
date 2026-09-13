// pages/ledger/ledger.js - 记账本（本地存储）
const { today, genId } = require('../../utils/util');
const {
  TYPES, EXPENSE_CATEGORIES, EVALUATION_OPTIONS, INCOME_EVALUATION_OPTIONS,
  loadBills, saveBills, loadBudget, saveBudget, getCurrentBalance,
  loadCustomCategories, saveCustomCategories,
  loadEvalCustom, saveEvalCustom,
  loadHiddenCategories, saveHiddenCategories,
  getCategories, isBuiltinCategory,
  getEvalMeta, getCategoryMeta, money, moneyFmt, normalizeAmount,
  monthKey, currentMonth, shiftMonth, formatMonthText, formatDayLabel,
  summarize, billMatchesKeyword, paginateGroups
} = require('../../utils/ledger');

function buildManageList(type) {
  return getCategories(type).map((name) => ({
    name,
    isBuiltin: isBuiltinCategory(type, name),
    meta: getCategoryMeta(name)
  }));
}

// 当前类型的自定义评价（视图：文本即 key，配色稳定生成）
function buildEvalCustomList(type) {
  return loadEvalCustom(type).map((name) => getEvalMeta(name, type)).filter(Boolean);
}

Page({
  data: {
    renderedGroups: [],
    renderedCount: 0,
    hasMore: false,
    stats: { income: '0.00', expense: '0.00', balance: '0.00', incomeCount: 0, expenseCount: 0, count: 0 },
    viewMonth: '',
    monthText: '',
    maxMonth: '',
    canPrev: true,
    canNext: false,
    filterType: 'all',
    searchOpen: false,
    keyword: '',
    budget: 0,
    budgetText: '0.00',
    budgetLeftText: '0.00',
    budgetPct: 0,
    budgetOver: false,
    balanceOn: false,
    balanceText: '0.00',
    balanceNeg: false,
    showSheet: false,
    showCateSheet: false,
    showEvalSheet: false,
    kbHeight: 0,
    editingId: '',
    formTitle: '添加账单',
    saveText: '保存账单',
    typeIndex: 0,
    types: TYPES,
    categories: EXPENSE_CATEGORIES,
    evaluationOptions: [],
    customEvals: [],
    evalMeta: null,
    form: {
      amount: '',
      type: 'expense',
      category: EXPENSE_CATEGORIES[0],
      date: '',
      note: '',
      remark: ''
    },
    cateForm: {
      type: 'expense',
      name: ''
    },
    manageCategories: [],
    usedMap: {}
  },

  // 当前月的完整视图模型与分组结果（仅内存，不进 setData）
  _monthBills: [],
  _allGroups: [],

  onLoad() {
    const month = currentMonth();
    this.setData({
      viewMonth: month,
      monthText: formatMonthText(month),
      maxMonth: month,
      evaluationOptions: EVALUATION_OPTIONS,
      customEvals: buildEvalCustomList('expense')
    });
  },

  onShow() {
    this.refresh();
  },

  // 触底追加下一页（滚动加载）
  onReachBottom() {
    if (!this.data.hasMore) return;
    const page = (this._page || 1) + 1;
    const result = paginateGroups(this._allGroups, page);
    const appended = result.groups.slice(this.data.renderedGroups.length);
    if (!appended.length) {
      this.setData({ hasMore: false });
      return;
    }
    this._page = page;
    this.setData({
      renderedGroups: this.data.renderedGroups.concat(appended),
      renderedCount: this.data.renderedCount + appended.reduce((s, g) => s + g.items.length, 0),
      hasMore: result.hasMore
    });
  },

  onKbFocus(e) {
    this.setData({ kbHeight: e.detail.height || 0 });
  },

  // Android 上 focus 事件的 height 常为 0，键盘高度以 keyboardheightchange 为准
  onKbChange(e) {
    this.setData({ kbHeight: e.detail.height || 0 });
  },

  onKbBlur() {
    this.setData({ kbHeight: 0 });
  },

  // 读存储 -> 视图模型 -> 当月汇总，然后交给 applyView 渲染
  refresh() {
    const viewMonth = this.data.viewMonth || currentMonth();

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
        const evalMeta = getEvalMeta(bill.note, bill.type);
        return Object.assign({}, bill, {
          typeName,
          amountText: sign + money(bill.amount),
          cls: bill.type === 'income' ? 'income' : 'expense',
          cateIcon: meta.icon,
          cateColor: meta.color,
          cateBg: meta.bg,
          evalLabel: evalMeta ? evalMeta.name : '',
          evalColor: evalMeta ? evalMeta.color : '',
          evalBg: evalMeta ? evalMeta.bg : '',
          evalSub: evalMeta ? evalMeta.sub : '',
          remarkText: bill.remark || ''
        });
      });

    // 全量账单的分类占用（删除自定义分类前校验用）
    const usedMap = {};
    bills.forEach((bill) => { usedMap[bill.type + '::' + bill.category] = true; });

    // 当前浏览月份的账单与汇总
    this._monthBills = bills.filter((bill) => monthKey(bill.date) === viewMonth);
    const sum = summarize(this._monthBills);

    // 月预算进度 + 钱包余额（右上角胶囊入口）
    const budget = loadBudget();
    const used = sum.expense;
    const budgetPct = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 0;
    const balanceValue = getCurrentBalance(bills);

    const cur = currentMonth();
    this.setData({
      monthText: formatMonthText(viewMonth),
      canPrev: viewMonth > '2000-01',
      canNext: viewMonth < cur,
      stats: {
        income: moneyFmt(sum.income),
        expense: moneyFmt(sum.expense),
        balance: moneyFmt(sum.income - sum.expense),
        incomeCount: sum.incomeCount,
        expenseCount: sum.expenseCount,
        count: sum.incomeCount + sum.expenseCount
      },
      budget,
      budgetText: moneyFmt(budget),
      budgetLeftText: moneyFmt(Math.abs(budget - used)),
      budgetPct,
      budgetOver: budget > 0 && used > budget,
      balanceOn: balanceValue !== null,
      balanceText: balanceValue === null ? '0.00' : moneyFmt(balanceValue),
      balanceNeg: balanceValue !== null && balanceValue < 0,
      usedMap
    });
    this.applyView(true);
  },

  // 类型筛选 + 搜索 -> 分组 -> 分页渲染（resetPage 为 true 时回到第一页）
  applyView(resetPage) {
    const { filterType, keyword } = this.data;
    let list = this._monthBills;
    if (filterType !== 'all') list = list.filter((bill) => bill.type === filterType);
    if (String(keyword || '').trim()) list = list.filter((bill) => billMatchesKeyword(bill, keyword));

    const groupMap = {};
    const groupOrder = [];
    list.forEach((bill) => {
      if (!groupMap[bill.date]) {
        groupMap[bill.date] = [];
        groupOrder.push(bill.date);
      }
      groupMap[bill.date].push(bill);
    });
    this._allGroups = groupOrder.map((date) => {
      const daySum = summarize(groupMap[date]);
      const parts = [];
      if (daySum.expense > 0) parts.push(`支出 ¥${money(daySum.expense)}`);
      if (daySum.income > 0) parts.push(`收入 ¥${money(daySum.income)}`);
      return {
        date,
        label: formatDayLabel(date),
        sumText: parts.join(' · '),
        items: groupMap[date]
      };
    });

    if (resetPage) this._page = 1;
    const result = paginateGroups(this._allGroups, this._page);
    this.setData({
      renderedGroups: result.groups,
      renderedCount: result.groups.reduce((s, g) => s + g.items.length, 0),
      hasMore: result.hasMore
    });
  },

  // ---------- 月份切换与筛选 ----------
  prevMonth() {
    if (!this.data.canPrev) return;
    this.setData({ viewMonth: shiftMonth(this.data.viewMonth, -1) });
    this.refresh();
  },

  nextMonth() {
    if (!this.data.canNext) return;
    this.setData({ viewMonth: shiftMonth(this.data.viewMonth, 1) });
    this.refresh();
  },

  onMonthChange(e) {
    this.setData({ viewMonth: e.detail.value });
    this.refresh();
  },

  setFilter(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.filterType) return;
    this.setData({ filterType: type });
    this.applyView(true);
  },

  // ---------- 搜索 ----------
  openSearch() {
    this.setData({ searchOpen: true });
  },

  closeSearch() {
    if (!this.data.keyword) {
      this.setData({ searchOpen: false });
      return;
    }
    this.setData({ keyword: '', searchOpen: false });
    this.applyView(true);
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
    this.applyView(true);
  },

  clearKeyword() {
    if (!this.data.keyword) return;
    this.setData({ keyword: '' });
    this.applyView(true);
  },

  // ---------- 预算 ----------
  openBudgetSetting() {
    wx.showModal({
      title: '月预算',
      editable: true,
      placeholderText: '输入每月支出预算，如 2000',
      content: this.data.budget > 0 ? String(this.data.budget) : '',
      confirmColor: '#2d7dd2',
      success: (res) => {
        if (!res.confirm) return;
        const value = normalizeAmount(res.content);
        saveBudget(value);
        this.refresh();
        wx.showToast({
          title: value > 0 ? '预算已更新' : '已清除预算',
          icon: 'success',
          duration: 800
        });
      }
    });
  },

  goBalance() {
    wx.navigateTo({ url: '/pages/ledger-balance/ledger-balance' });
  },

  goStats() {
    wx.navigateTo({ url: `/pages/ledger-stats/ledger-stats?month=${this.data.viewMonth}` });
  },

  // ---------- 添加 / 编辑 ----------
  openAdd() {
    const categories = getCategories('expense');
    this.setData({
      showSheet: true,
      kbHeight: 0,
      typeIndex: 0,
      categories,
      evaluationOptions: EVALUATION_OPTIONS,
      customEvals: buildEvalCustomList('expense'),
      evalMeta: null,
      editingId: '',
      formTitle: '添加账单',
      saveText: '保存账单',
      form: {
        amount: '',
        type: 'expense',
        category: categories[0],
        date: today(),
        note: '',
        remark: ''
      }
    });
  },

  // 点击账单卡片 -> 编辑该笔
  onBillTap(e) {
    const id = e.currentTarget.dataset.id;
    const bill = loadBills().find((item) => item.id === id);
    if (!bill) {
      wx.showToast({ title: '账单不存在', icon: 'none' });
      return;
    }
    let categories = getCategories(bill.type);
    if (!categories.includes(bill.category)) categories = categories.concat([bill.category]);
    this.setData({
      showSheet: true,
      kbHeight: 0,
      typeIndex: bill.type === 'income' ? 1 : 0,
      categories,
      evaluationOptions: bill.type === 'income' ? INCOME_EVALUATION_OPTIONS : EVALUATION_OPTIONS,
      customEvals: buildEvalCustomList(bill.type),
      evalMeta: getEvalMeta(bill.note, bill.type),
      editingId: bill.id,
      formTitle: '编辑账单',
      saveText: '保存修改',
      form: {
        amount: String(bill.amount),
        type: bill.type,
        category: bill.category,
        date: bill.date,
        note: bill.note || '',
        remark: bill.remark || ''
      }
    });
  },

  closeSheet() {
    this.setData({ showSheet: false, kbHeight: 0 });
  },

  // ---------- 评价 ----------
  openEvalPicker() {
    this.setData({ showEvalSheet: true });
  },

  closeEvalSheet() {
    this.setData({ showEvalSheet: false });
  },

  onEvalPick(e) {
    const key = e.currentTarget.dataset.key;
    const meta = getEvalMeta(key, this.data.form.type);
    this.setData({
      'form.note': meta ? key : '',
      evalMeta: meta,
      showEvalSheet: false
    });
  },

  // 清除已选评价
  clearEval() {
    this.setData({
      'form.note': '',
      evalMeta: null,
      showEvalSheet: false
    });
  },

  // ---------- 自定义评价 ----------
  addEval() {
    const type = this.data.form.type;
    wx.showModal({
      title: '新增评价',
      editable: true,
      placeholderText: '输入标签名，最多6个字',
      confirmColor: '#2d7dd2',
      success: (res) => {
        if (!res.confirm) return;
        const name = String(res.content || '').trim();
        if (!name) {
          wx.showToast({ title: '请输入评价名称', icon: 'none' });
          return;
        }
        if (name.length > 6) {
          wx.showToast({ title: '评价名称最多6个字', icon: 'none' });
          return;
        }
        // 与预设（key 和名称）及已有自定义去重
        const presets = type === 'income' ? INCOME_EVALUATION_OPTIONS : EVALUATION_OPTIONS;
        const taken = presets.some((opt) => opt.key === name || opt.name === name);
        const list = loadEvalCustom(type);
        if (taken || list.includes(name)) {
          wx.showToast({ title: '该评价已存在', icon: 'none' });
          return;
        }
        if (list.length >= 8) {
          wx.showToast({ title: '最多添加 8 个自定义评价', icon: 'none' });
          return;
        }
        list.push(name);
        saveEvalCustom(type, list);
        this.setData({ customEvals: buildEvalCustomList(type) });
        wx.showToast({ title: '已添加', icon: 'success' });
      }
    });
  },

  // 删除自定义评价（只影响以后可选，已使用的账单标签照常显示）
  deleteEval(e) {
    const name = e.currentTarget.dataset.name;
    const type = this.data.form.type;
    const list = loadEvalCustom(type).filter((item) => item !== name);
    saveEvalCustom(type, list);
    const update = { customEvals: buildEvalCustomList(type) };
    // 若当前选中的正是被删的评价，一并清除
    if (this.data.form.note === name) {
      update['form.note'] = '';
      update.evalMeta = null;
    }
    this.setData(update);
    wx.showToast({ title: '已删除', icon: 'none', duration: 800 });
  },

  onTypePick(e) {
    const index = Number(e.currentTarget.dataset.index);
    const type = TYPES[index].key;
    if (type === this.data.form.type) return;
    const categories = getCategories(type);
    const update = {
      typeIndex: index,
      categories,
      evaluationOptions: type === 'income' ? INCOME_EVALUATION_OPTIONS : EVALUATION_OPTIONS,
      customEvals: buildEvalCustomList(type),
      // 收支方向变了，原来的评价语义不再适用
      'form.type': type,
      'form.category': categories[0],
      'form.note': '',
      evalMeta: null
    };
    this.setData(update);
  },

  onCategoryPick(e) {
    this.setData({ 'form.category': e.currentTarget.dataset.category });
  },

  onAmountInput(e) {
    this.setData({ 'form.amount': e.detail.value });
  },

  onRemarkInput(e) {
    this.setData({ 'form.remark': e.detail.value });
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
    const editingId = this.data.editingId;
    const date = form.date || today();
    const note = (form.note || '').trim();
    const remark = (form.remark || '').trim();

    if (editingId) {
      const index = list.findIndex((item) => item.id === editingId);
      if (index < 0) {
        wx.showToast({ title: '账单不存在', icon: 'none' });
        return;
      }
      list[index] = Object.assign({}, list[index], {
        type: form.type,
        category: form.category,
        amount,
        date,
        note,
        remark,
        updatedAt: now
      });
    } else {
      list.push({
        id: genId(),
        type: form.type,
        category: form.category,
        amount,
        date,
        note,
        remark,
        createdAt: now,
        updatedAt: now
      });
    }
    saveBills(list);
    this.setData({ showSheet: false, kbHeight: 0 });

    // 账单不在当前浏览月份时，直接切到账单所在月份，避免「记完看不见」
    const billMonth = monthKey(date);
    if (billMonth !== this.data.viewMonth) this.setData({ viewMonth: billMonth });
    this.refresh();
    wx.showToast({ title: editingId ? '已保存' : '已记一笔', icon: 'success' });
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

    // 直接追加到自定义列表（允许顶替被删除的同名内置分类）
    const customs = loadCustomCategories(type);
    if (customs.indexOf(trimmed) < 0) customs.push(trimmed);
    saveCustomCategories(type, customs);

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

  // 删除分类：内置与自定义规则一致——已被账单使用的不可删，未使用的可删
  deleteCustomCategory(e) {
    const name = e.currentTarget.dataset.name;
    const type = this.data.cateForm.type;

    if (this.data.usedMap[type + '::' + name]) {
      wx.showToast({ title: '该分类已被账单使用，无法删除', icon: 'none' });
      return;
    }

    const isBuiltin = isBuiltinCategory(type, name);
    wx.showModal({
      title: '删除分类',
      content: `确定删除分类「${name}」吗？${isBuiltin ? '之后可通过「恢复默认」找回。' : ''}`,
      confirmColor: '#e25d5d',
      success: (res) => {
        if (!res.confirm) return;

        // 内置与自定义都从两侧列表清干净（覆盖同名自定义顶替内置的情况）
        saveCustomCategories(type, loadCustomCategories(type).filter((c) => c !== name));
        if (isBuiltin) {
          const hidden = loadHiddenCategories(type);
          if (hidden.indexOf(name) < 0) hidden.push(name);
          saveHiddenCategories(type, hidden);
        }

        const categories = getCategories(type);
        const update = {
          manageCategories: buildManageList(type)
        };
        if (this.data.form.type === type) {
          update.categories = categories;
          if (this.data.form.category === name) {
            update['form.category'] = categories[0];
          }
        }
        this.setData(update);
        wx.showToast({ title: '已删除', icon: 'success' });
      }
    });
  },

  // 恢复默认：只找回被删除的默认分类，自定义分类完全不动（仅能由用户手动删除）
  resetCategories() {
    const type = this.data.cateForm.type;
    const hiddenBuiltins = loadHiddenCategories(type);
    if (hiddenBuiltins.length === 0) {
      wx.showToast({ title: '没有已删除的默认分类', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '恢复默认分类',
      content: `将找回 ${hiddenBuiltins.length} 个被删除的默认分类，你的自定义分类不受影响。`,
      confirmColor: '#2d7dd2',
      success: (res) => {
        if (!res.confirm) return;
        saveHiddenCategories(type, []);

        const categories = getCategories(type);
        const update = {
          manageCategories: buildManageList(type)
        };
        if (this.data.form.type === type) {
          update.categories = categories;
          if (!categories.includes(this.data.form.category)) {
            update['form.category'] = categories[0];
          }
        }
        this.setData(update);
        wx.showToast({ title: '已恢复默认分类', icon: 'success' });
      }
    });
  },

  stopPropagation() {},

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
