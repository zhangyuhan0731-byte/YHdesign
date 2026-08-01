// pages/memo/memo.js - 备忘录（本地存储）
const { getStorage, setStorage, genId } = require('../../utils/util');

const CATEGORIES = ['工作', '生活', '灵感', '待办', '其他'];
const CAT_COLORS = { 工作: '#3a9bd6', 生活: '#7bc4a0', 灵感: '#9b8ed4', 待办: '#f0a93b', 其他: '#93a9ba' };
const CAT_BG_COLORS = { 工作: '#eaf4fc', 生活: '#edf8f2', 灵感: '#f1eefb', 待办: '#fff5df', 其他: '#f0f4f6' };
const CUSTOM_CATEGORIES_KEY = 'memo_custom_categories';

function load() { return getStorage('memos', []); }
function save(list) { setStorage('memos', list); }
function loadCategories() {
  const custom = getStorage(CUSTOM_CATEGORIES_KEY, []);
  const merged = CATEGORIES.concat(Array.isArray(custom) ? custom : []);
  return Array.from(new Set(merged.filter(Boolean)));
}
function pad(n) { return n < 10 ? '0' + n : n; }
function fmtDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseDate(dateStr) {
  if (!dateStr) return Date.now();
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

Page({
  data: {
    memos: [],
    keyword: '',
    activeCat: '全部',
    cats: ['全部'].concat(loadCategories()),
    categories: loadCategories(),
    showSheet: false,
    editingId: '',
    kbHeight: 0,
    form: { title: '', content: '', category: '其他', remindDate: '' }
  },

  onShow() { this.refresh(); },

  // 键盘高度跟踪：弹层随键盘上移，保证输入框完整可见
  onKbFocus(e) { this.setData({ kbHeight: e.detail.height || 0 }); },
  onKbBlur() { this.setData({ kbHeight: 0 }); },

  refresh() {
    const now = Date.now();
    const memos = load().sort((a, b) => b.updatedAt - a.updatedAt)
      .map((m) => {
        const remindAt = m.remindAt;
        let remindText = '';
        if (remindAt) {
          const d = new Date(remindAt);
          remindText = `⏰ ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        }
        return Object.assign({}, m, {
          accent: CAT_COLORS[m.category] || '#93a9ba',
          accentBg: CAT_BG_COLORS[m.category] || '#f0f4f6',
          remindText
        });
      });
    this.allMemos = memos;
    const categories = loadCategories();
    const set = new Set(['全部'].concat(categories).concat(memos.map((m) => m.category)));
    this.setData({ cats: Array.from(set), categories });
    this.applyFilter();
  },

  applyFilter() {
    const kw = this.data.keyword.trim().toLowerCase();
    const cat = this.data.activeCat;
    let list = this.allMemos || [];
    if (cat !== '全部') list = list.filter((m) => m.category === cat);
    if (kw) {
      list = list.filter((m) =>
        (m.title + ' ' + m.content).toLowerCase().includes(kw)
      );
    }
    this.setData({ memos: list });
  },

  onSearch(e) { this.setData({ keyword: e.detail.value }, () => this.applyFilter()); },
  onCat(e) { this.setData({ activeCat: e.currentTarget.dataset.cat }, () => this.applyFilter()); },

  openAdd() {
    const now = Date.now();
    this.setData({
      showSheet: true,
      editingId: '',
      form: {
        title: '',
        content: '',
        category: '其他',
        remindDate: fmtDate(now)
      }
    });
  },

  openEdit(e) {
    const id = e.currentTarget.dataset.id;
    const m = (this.allMemos || []).find((x) => x.id === id);
    if (!m) return;
    const remindAt = m.remindAt || Date.now();
    this.setData({
      showSheet: true,
      editingId: id,
      form: {
        title: m.title,
        content: m.content,
        category: m.category,
        remindDate: fmtDate(remindAt)
      }
    });
  },

  closeSheet() { this.setData({ showSheet: false }); },

  onField(e) {
    const f = e.currentTarget.dataset.field;
    this.setData({ ['form.' + f]: e.detail.value });
  },

  onCatPick(e) { this.setData({ 'form.category': e.currentTarget.dataset.cat }); },

  onDateChange(e) {
    this.setData({ 'form.remindDate': e.detail.value });
  },

  addTemplate() {
    wx.showModal({
      title: '新增模板',
      content: '',
      editable: true,
      placeholderText: '输入模板分类名称，如：健身 / 旅行',
      confirmColor: '#3a9bd6',
      success: (res) => {
        if (res.confirm && res.content.trim()) {
          const name = res.content.trim();
          if (this.data.categories.includes(name)) {
            wx.showToast({ title: '该分类已存在', icon: 'none' });
            return;
          }
          const custom = getStorage(CUSTOM_CATEGORIES_KEY, []);
          const nextCustom = Array.from(new Set((Array.isArray(custom) ? custom : []).concat(name)));
          setStorage(CUSTOM_CATEGORIES_KEY, nextCustom);
          const categories = loadCategories();
          this.setData({ categories, 'form.category': name });
          wx.showToast({ title: '已添加模板', icon: 'success' });
        }
      }
    });
  },

  save() {
    const f = this.data.form;
    if (!f.title.trim() && !f.content.trim()) {
      wx.showToast({ title: '写点什么吧', icon: 'none' });
      return;
    }
    const category = (f.category || '其他').trim();
    const remindAt = parseDate(f.remindDate);
    const now = Date.now();
    let list = load();
    if (this.data.editingId) {
      const i = list.findIndex((x) => x.id === this.data.editingId);
      if (i >= 0) {
        list[i] = Object.assign({}, list[i], {
          title: f.title.trim(),
          content: f.content.trim(),
          category,
          remindAt,
          updatedAt: now
        });
      }
    } else {
      list.push({
        id: genId(),
        title: f.title.trim(),
        content: f.content.trim(),
        category,
        remindAt,
        createdAt: now,
        updatedAt: now
      });
    }
    save(list);
    this.setData({ showSheet: false });
    this.refresh();
    wx.showToast({ title: '已保存', icon: 'success' });
  },

  remove(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除备忘',
      content: '确定删除这条备忘？',
      confirmColor: '#e8756b',
      success: (res) => {
        if (res.confirm) {
          save(load().filter((x) => x.id !== id));
          this.refresh();
        }
      }
    });
  }
});
