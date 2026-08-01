// pages/countdown/countdown.js - 倒数日记
const { getStorage, setStorage, today, diffDays, genId } = require('../../utils/util');

function load() { return getStorage('countdowns', []); }
function save(list) { setStorage('countdowns', list); }

function decorate(list) {
  const td = today();
  return list.map((e) => {
    const d = diffDays(td, e.date);
    let statusText;
    let cls;
    if (d > 0) { statusText = '还剩 ' + d + ' 天'; cls = 'future'; }
    else if (d < 0) { statusText = '已过去 ' + (-d) + ' 天'; cls = 'past'; }
    else { statusText = '就是今天'; cls = 'today'; }
    return Object.assign({}, e, { days: d, num: Math.abs(d), statusText, cls });
  }).sort((a, b) => (a.date < b.date ? -1 : 1));
}

Page({
  data: {
    events: [],
    showSheet: false,
    editingId: '',
    kbHeight: 0,
    form: { title: '', date: '', note: '' }
  },

  onShow() { this.refresh(); },

  // 键盘高度跟踪：弹层随键盘上移，保证输入框完整可见
  onKbFocus(e) { this.setData({ kbHeight: e.detail.height || 0 }); },
  onKbBlur() { this.setData({ kbHeight: 0 }); },

  refresh() { this.setData({ events: decorate(load()) }); },

  openAdd() {
    this.setData({
      showSheet: true,
      editingId: '',
      form: { title: '', date: today(), note: '' }
    });
  },

  openEdit(e) {
    const id = e.currentTarget.dataset.id;
    const m = load().find((x) => x.id === id);
    if (!m) return;
    this.setData({
      showSheet: true,
      editingId: id,
      form: { title: m.title, date: m.date, note: m.note || '' }
    });
  },

  closeSheet() { this.setData({ showSheet: false }); },

  onField(e) {
    const f = e.currentTarget.dataset.field;
    this.setData({ ['form.' + f]: e.detail.value });
  },
  onDate(e) { this.setData({ 'form.date': e.detail.value }); },

  save() {
    const f = this.data.form;
    if (!f.title.trim()) {
      wx.showToast({ title: '起个名字吧', icon: 'none' });
      return;
    }
    let list = load();
    if (this.data.editingId) {
      const i = list.findIndex((x) => x.id === this.data.editingId);
      if (i >= 0) {
        list[i] = Object.assign({}, list[i], { title: f.title.trim(), date: f.date, note: f.note.trim() });
      }
    } else {
      list.push({ id: genId(), title: f.title.trim(), date: f.date, note: f.note.trim() });
    }
    save(list);
    this.setData({ showSheet: false });
    this.refresh();
  },

  remove(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除',
      content: '确定删除这个倒数？',
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
