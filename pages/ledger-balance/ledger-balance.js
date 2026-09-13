// pages/ledger-balance/ledger-balance.js - 钱包余额（调整 + 明细流水）
const { today } = require('../../utils/util');
const {
  loadBills, loadBalanceAdjustments, addBalanceAdjustment, clearBalance,
  getCurrentBalance, buildBalanceFlow, moneyFmt, parseBalanceInput
} = require('../../utils/ledger');

const PAGE_SIZE = 30;

Page({
  data: {
    opened: false,
    balanceText: '0.00',
    balanceNeg: false,
    todayNetText: '',
    todayNetCls: '',
    rendered: [],
    totalCount: 0,
    hasMore: false,
    showAdjust: false,
    adjustTitle: '开启余额',
    adjustAmount: ''
  },

  _flow: [],
  _page: 1,

  onShow() {
    this.rebuild();
  },

  rebuild() {
    const bills = loadBills();
    const adjustments = loadBalanceAdjustments();
    if (!adjustments.length) {
      this._flow = [];
      this.setData({
        opened: false,
        rendered: [],
        totalCount: 0,
        hasMore: false,
        todayNetText: ''
      });
      return;
    }

    const current = getCurrentBalance(bills);

    // 今日净变动：今天记的账（且在最后一次校准之后）让余额变了多少；无变动不显示
    const todayStr = today();
    const lastAdjust = adjustments[adjustments.length - 1];
    let todayNet = 0;
    bills.forEach((bill) => {
      if (bill.date !== todayStr) return;
      if ((Number(bill.createdAt) || 0) <= lastAdjust.at) return;
      const amount = Number(bill.amount) || 0;
      todayNet += bill.type === 'income' ? amount : -amount;
    });
    todayNet = Math.round(todayNet * 100) / 100;

    this._flow = buildBalanceFlow(bills);
    this._page = 1;
    const rendered = this._flow.slice(0, PAGE_SIZE);

    this.setData({
      opened: true,
      balanceText: moneyFmt(current),
      balanceNeg: current < 0,
      todayNetText: todayNet === 0 ? '' : `今日 ${todayNet > 0 ? '+' : '-'}¥${moneyFmt(Math.abs(todayNet))}`,
      todayNetCls: todayNet > 0 ? 'up' : 'down',
      rendered,
      totalCount: this._flow.length,
      hasMore: this._flow.length > rendered.length
    });
  },

  onReachBottom() {
    if (!this.data.hasMore) return;
    this._page += 1;
    const rendered = this._flow.slice(0, this._page * PAGE_SIZE);
    this.setData({
      rendered,
      hasMore: this._flow.length > rendered.length
    });
  },

  // 开启 / 调整共用：输入当前实际余额，作为新的校准点追加到历史
  showAdjustDialog() {
    const opening = !this.data.opened;
    this.setData({
      showAdjust: true,
      adjustTitle: opening ? '开启余额' : '调整余额',
      adjustAmount: opening ? '' : this.data.balanceText.replace(/,/g, '')
    });
  },

  onAdjustInput(e) {
    this.setData({ adjustAmount: e.detail.value });
  },

  cancelAdjust() {
    this.setData({ showAdjust: false });
  },

  confirmAdjust() {
    const text = String(this.data.adjustAmount || '').trim();
    if (!text) {
      wx.showToast({ title: '请输入余额', icon: 'none' });
      return;
    }
    const value = parseBalanceInput(text);
    if (value === 0 && !/^[-0.]+$/.test(text)) {
      wx.showToast({ title: '余额格式不正确', icon: 'none' });
      return;
    }
    const opening = !this.data.opened;
    addBalanceAdjustment(value);
    this.setData({ showAdjust: false });
    this.rebuild();
    wx.showToast({ title: opening ? '余额已开启' : '余额已校准', icon: 'success', duration: 800 });
  },

  closeBalance() {
    wx.showModal({
      title: '关闭余额',
      content: '关闭后将清除余额和校准历史，仅保留账单统计。确定关闭吗？',
      confirmColor: '#e25d5d',
      success: (res) => {
        if (!res.confirm) return;
        clearBalance();
        this.rebuild();
        wx.showToast({ title: '已关闭余额', icon: 'none', duration: 800 });
      }
    });
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
