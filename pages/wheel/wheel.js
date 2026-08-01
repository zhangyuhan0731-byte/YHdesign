// pages/wheel/wheel.js - 幸运转盘（conic-gradient 实现，参考小决定）
const wheel = require('../../utils/wheel');
const sound = require('../../utils/sound');
const { getStorage, setStorage, genId } = require('../../utils/util');

const ANIMATION_DURATION = 4000;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 12;
const LAST_OPTIONS_KEY = 'wheel_last_options';
const CUSTOM_TPL_KEY = 'wheel_custom_templates';
const HIDDEN_BUILTIN_KEY = 'wheel_hidden_builtins';

const BUILTIN_TEMPLATES = [
  { id: '_food', name: '吃什么', items: ['火锅', '烧烤', '奶茶', '日料', '沙拉', '家常菜', '外卖', '轻食'] },
  { id: '_weekend', name: '周末去哪', items: ['公园', '商场', '电影院', '书店', '爬山', '在家躺', '咖啡馆', '博物馆'] },
  { id: '_do', name: '做不做', items: ['立刻做', '再等等', '看心情', '问朋友', '明天再说'] },
  { id: '_fortune', name: '运势签', items: ['大吉', '中吉', '小吉', '吉', '末吉', '凶', '小凶', '大凶'] }
];

Page({
  data: {
    // 初始即填充默认模板，避免进入页面时转盘空白/延迟出现
    options: BUILTIN_TEMPLATES[0].items.slice(),
    rotation: 0,
    sectorAngle: 360 / BUILTIN_TEMPLATES[0].items.length,
    gradient: wheel.buildGradient(BUILTIN_TEMPLATES[0].items.length),
    colors: BUILTIN_TEMPLATES[0].items.map((_, i) => wheel.getColor(i)),
    spinning: false,
    showResult: false,
    resultText: '',
    resultColor: '',
    newOption: '',
    activeTpl: BUILTIN_TEMPLATES[0].name,
    templates: BUILTIN_TEMPLATES.slice(),
    hiddenBuiltins: [],
    showTplSheet: false,
    tplName: '',
    tplItems: '',
    kbHeight: 0,
    muted: false
  },

  onLoad() {
    this.setData({ muted: sound.isMuted() });
    let options = getStorage(LAST_OPTIONS_KEY, null);
    if (!Array.isArray(options) || options.length < MIN_OPTIONS) {
      options = BUILTIN_TEMPLATES[0].items.slice();
      this.setData({ activeTpl: BUILTIN_TEMPLATES[0].name });
    }
    this.setData({ options }, () => this.updateWheelData());
    this.loadTemplates();
  },

  onHide() {
    this.persistOptions();
  },

  onUnload() {
    this.persistOptions();
    sound.stopTickLoop();
  },

  persistOptions() {
    if (this.data.options.length >= MIN_OPTIONS) {
      setStorage(LAST_OPTIONS_KEY, this.data.options);
    }
  },

  loadTemplates() {
    const hidden = getStorage(HIDDEN_BUILTIN_KEY, []);
    const list = getStorage(CUSTOM_TPL_KEY, []);
    const builtins = BUILTIN_TEMPLATES.filter((t) => hidden.indexOf(t.id) === -1);
    this.setData({ templates: builtins.concat(list), hiddenBuiltins: hidden });
  },

  updateWheelData() {
    const count = this.data.options.length;
    if (count < 1) {
      this.setData({ gradient: '', sectorAngle: 0, colors: [] });
      return;
    }
    this.setData({
      sectorAngle: 360 / count,
      gradient: wheel.buildGradient(count),
      colors: this.data.options.map((_, i) => wheel.getColor(i))
    });
  },

  // ==================== 转盘逻辑 ====================

  spin() {
    if (this.data.spinning) return;
    if (this.data.options.length < MIN_OPTIONS) {
      wx.showToast({ title: '至少 2 个选项', icon: 'none' });
      return;
    }

    const count = this.data.options.length;
    const selectedIndex = wheel.getRandomIndex(count);
    const newRotation = wheel.calculateRotation(selectedIndex, count, this.data.rotation);

    sound.startTickLoop(ANIMATION_DURATION);
    this.setData({ spinning: true, showResult: false, rotation: newRotation });

    setTimeout(() => {
      sound.stopTickLoop();
      sound.play('result');
      const result = this.data.options[selectedIndex];
      this.setData({
        spinning: false,
        showResult: true,
        resultText: result,
        resultColor: wheel.getColor(selectedIndex)
      });
    }, ANIMATION_DURATION + 100);
  },

  closeResult() {
    this.setData({ showResult: false });
  },

  drawAgain() {
    this.setData({ showResult: false });
    setTimeout(() => this.spin(), 300);
  },

  stopPropagation() {},

  // 键盘高度跟踪：模板弹层随键盘上移，保证输入框完整可见
  onKbFocus(e) { this.setData({ kbHeight: e.detail.height || 0 }); },
  onKbBlur() { this.setData({ kbHeight: 0 }); },

  // 声音开关（与木鱼页一致）
  toggleMute() {
    const muted = !this.data.muted;
    sound.setMuted(muted);
    this.setData({ muted });
  },

  // ==================== 选项管理 ====================

  onNewOptionInput(e) {
    this.setData({ newOption: e.detail.value });
  },

  addOption() {
    if (this.data.spinning) return;
    const value = (this.data.newOption || '').trim();
    if (!value) {
      wx.showToast({ title: '请输入选项内容', icon: 'none' });
      return;
    }
    if (this.data.options.length >= MAX_OPTIONS) {
      wx.showToast({ title: '最多 12 个选项', icon: 'none' });
      return;
    }
    const options = this.data.options.concat(value);
    this.setData({ options, newOption: '', activeTpl: '' }, () => {
      this.updateWheelData();
      this.persistOptions();
    });
  },

  removeOption(e) {
    if (this.data.spinning) return;
    const index = e.currentTarget.dataset.index;
    if (this.data.options.length <= MIN_OPTIONS) {
      wx.showToast({ title: '至少保留 2 个选项', icon: 'none' });
      return;
    }
    const text = this.data.options[index];
    wx.showModal({
      title: '删除选项',
      content: `确定删除「${text}」吗？`,
      confirmColor: '#e8756b',
      success: (res) => {
        if (!res.confirm) return;
        const options = this.data.options.slice();
        options.splice(index, 1);
        this.setData({ options, activeTpl: '' }, () => {
          this.updateWheelData();
          this.persistOptions();
        });
      }
    });
  },

  // ==================== 模板 ====================

  applyTemplate(e) {
    if (this.data.spinning) return;
    const id = e.currentTarget.dataset.id;
    const tpl = this.data.templates.find((t) => t.id === id);
    if (!tpl || !Array.isArray(tpl.items)) return;
    this.setData({
      options: tpl.items.slice(),
      activeTpl: tpl.name,
      rotation: 0,
      showResult: false
    }, () => {
      this.updateWheelData();
      this.persistOptions();
    });
  },

  openTplSheet() {
    this.setData({ showTplSheet: true, tplName: '', tplItems: '' });
  },

  closeTplSheet() {
    this.setData({ showTplSheet: false });
  },

  onTplNameInput(e) {
    this.setData({ tplName: e.detail.value });
  },

  onTplItemsInput(e) {
    this.setData({ tplItems: e.detail.value });
  },

  saveCustomTemplate() {
    const name = (this.data.tplName || '').trim();
    const raw = (this.data.tplItems || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入模板名称', icon: 'none' });
      return;
    }
    const items = raw
      .split(/[\n,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length < MIN_OPTIONS) {
      wx.showToast({ title: `至少 ${MIN_OPTIONS} 个选项`, icon: 'none' });
      return;
    }
    if (items.length > MAX_OPTIONS) {
      wx.showToast({ title: `最多 ${MAX_OPTIONS} 个选项`, icon: 'none' });
      return;
    }

    const list = getStorage(CUSTOM_TPL_KEY, []);
    const item = {
      id: 'custom_' + genId(),
      name,
      items,
      custom: true,
      createTime: Date.now()
    };
    list.unshift(item);
    if (list.length > 30) list.length = 30;
    setStorage(CUSTOM_TPL_KEY, list);
    const hidden = getStorage(HIDDEN_BUILTIN_KEY, []);
    const builtins = BUILTIN_TEMPLATES.filter((t) => hidden.indexOf(t.id) === -1);

    this.setData({
      templates: builtins.concat(list),
      hiddenBuiltins: hidden,
      showTplSheet: false,
      options: items.slice(),
      activeTpl: name,
      rotation: 0,
      showResult: false
    }, () => {
      this.updateWheelData();
      this.persistOptions();
      wx.showToast({ title: '模板已保存并应用', icon: 'none' });
    });
  },

  deleteTemplate(e) {
    const id = e.currentTarget.dataset.id;
    const tpl = this.data.templates.find((t) => t.id === id);
    if (!tpl) return;
    wx.showModal({
      title: '删除模板',
      content: `确定删除快捷模板「${tpl.name}」吗？`,
      confirmColor: '#e8756b',
      success: (res) => {
        if (!res.confirm) return;
        let list = getStorage(CUSTOM_TPL_KEY, []);
        let hidden = this.data.hiddenBuiltins.slice();

        if (tpl.custom) {
          list = list.filter((t) => t.id !== id);
          setStorage(CUSTOM_TPL_KEY, list);
        } else {
          if (hidden.indexOf(id) === -1) hidden.push(id);
          setStorage(HIDDEN_BUILTIN_KEY, hidden);
        }

        const builtins = BUILTIN_TEMPLATES.filter((t) => hidden.indexOf(t.id) === -1);
        this.setData({ templates: builtins.concat(list), hiddenBuiltins: hidden }, () => {
          if (this.data.activeTpl && !this.data.templates.find((t) => t.name === this.data.activeTpl)) {
            this.setData({ activeTpl: '' });
          }
        });
      }
    });
  },

  resetTemplates() {
    wx.showModal({
      title: '恢复默认模板',
      content: '确定恢复所有默认快捷模板吗？',
      confirmColor: '#3a9bd6',
      success: (res) => {
        if (!res.confirm) return;
        setStorage(HIDDEN_BUILTIN_KEY, []);
        const list = getStorage(CUSTOM_TPL_KEY, []);
        this.setData({ templates: BUILTIN_TEMPLATES.concat(list), hiddenBuiltins: [] });
      }
    });
  }
});
