// pages/about/about.js - 我的信息（可编辑，运势/抽签据此生成）
const { getStorage, setStorage, getConstellation, getZodiac, today } = require('../../utils/util');

const GENDERS = ['男', '女', '保密'];

function parseBirthday(str) {
  if (!str) return null;
  const p = String(str).split('-').map(Number);
  if (p.length < 3 || !p[0] || !p[1] || !p[2]) return null;
  return { y: p[0], m: p[1], d: p[2] };
}

function derive(birthday) {
  const b = parseBirthday(birthday);
  if (!b) return { constellation: '', zodiac: '' };
  return {
    constellation: getConstellation(b.m, b.d),
    zodiac: getZodiac(b.y)
  };
}

Page({
  data: {
    nickname: '',
    genderIndex: 2,
    genders: GENDERS,
    birthday: '',
    endDate: '',
    constellation: '',
    zodiac: '',
    avatar: '',
    saved: false
  },

  onLoad() {
    this.setData({ endDate: today() });
    this.setData({ avatar: getStorage('avatar', '') });
    const p = getStorage('profile', null);
    if (p) {
      const d = derive(p.birthday);
      const gi = GENDERS.indexOf(p.gender);
      this.setData({
        nickname: p.nickname || '',
        genderIndex: gi >= 0 ? gi : 2,
        birthday: p.birthday || '',
        constellation: d.constellation,
        zodiac: d.zodiac
      });
    }
  },

  onNick(e) {
    this.setData({ nickname: e.detail.value });
  },

  onGender(e) {
    this.setData({ genderIndex: Number(e.detail.value) });
  },

  onBirth(e) {
    const birthday = e.detail.value;
    const d = derive(birthday);
    this.setData({ birthday, constellation: d.constellation, zodiac: d.zodiac });
  },

  save() {
    const profile = {
      nickname: (this.data.nickname || '').trim(),
      gender: this.data.genders[this.data.genderIndex],
      birthday: this.data.birthday
    };
    setStorage('profile', profile);
    wx.showToast({ title: '已保存', icon: 'success' });
    this.setData({ saved: true });
  },

  // 选择并保存头像（仅存本机，不上传服务器）
  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const temp = res.tempFiles[0].tempFilePath;
        const fs = wx.getFileSystemManager();
        fs.saveFile({
          tempFilePath: temp,
          success: (r) => {
            const saved = r.savedFilePath;
            const old = getStorage('avatar', '');
            if (old && old !== saved) {
              try { fs.removeSavedFile({ filePath: old }); } catch (e) {}
            }
            setStorage('avatar', saved);
            this.setData({ avatar: saved });
          },
          fail: () => {
            // 保存失败则退回临时路径
            setStorage('avatar', temp);
            this.setData({ avatar: temp });
          }
        });
      }
    });
  }
});
