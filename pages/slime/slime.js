const { getStorage, setStorage, clamp } = require('../../utils/util');

const SOUND_KEY = 'slime_sound_on';
const CUSTOM_KEY = 'slime_custom';

const PRESETS = [
  { id: 'mint', name: '薄荷云朵', color: '#7bdcb5', shape: 'blob', texture: 'cloud', textureName: '云朵', shine: '#dffbf0' },
  { id: 'sky', name: '蓝莓透泥', color: '#75b8ff', shape: 'round', texture: 'clear', textureName: '透亮', shine: '#e3f2ff' },
  { id: 'peach', name: '桃桃黄油', color: '#ff9aa7', shape: 'squircle', texture: 'butter', textureName: '黄油', shine: '#ffe4e7' },
  { id: 'grape', name: '葡萄泡泡', color: '#a98bff', shape: 'blob', texture: 'crunchy', textureName: '起泡', shine: '#eee7ff' }
];

const COLORS = [
  { name: '浅蓝', value: '#75b8ff', shine: '#e3f2ff' },
  { name: '薄荷', value: '#7bdcb5', shine: '#dffbf0' },
  { name: '蜜桃', value: '#ff9aa7', shine: '#ffe4e7' },
  { name: '葡萄', value: '#a98bff', shine: '#eee7ff' },
  { name: '奶黄', value: '#ffd36e', shine: '#fff2bf' }
];

const SHAPES = [
  { id: 'blob', name: '云朵' },
  { id: 'round', name: '圆饼' },
  { id: 'squircle', name: '方团' }
];

const TEXTURES = [
  { id: 'cloud', name: '云朵' },
  { id: 'clear', name: '透亮' },
  { id: 'butter', name: '黄油' },
  { id: 'crunchy', name: '起泡' }
];

function buildSlimeStyle(slime, press) {
  const stretchBoost = press.mode === 'stretch' ? 0.2 : 0;
  const holdBoost = press.mode === 'hold' ? 0.1 : 0;
  const scaleX = 1 + press.power * (0.22 + stretchBoost);
  const scaleY = 1 - press.power * (0.22 - holdBoost);
  const rotate = press.dx * 0.04;
  const radiusShift = press.power * 20;
  return [
    `--slime-color:${slime.color}`,
    `--slime-shine:${slime.shine}`,
    `--press-x:${press.x}%`,
    `--press-y:${press.y}%`,
    `--squish:${radiusShift.toFixed(1)}rpx`,
    `transform:translate(${press.dx}rpx, ${press.dy}rpx) scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)}) rotate(${rotate.toFixed(2)}deg)`
  ].join(';');
}

Page({
  data: {
    presets: PRESETS,
    colors: COLORS,
    shapes: SHAPES,
    textures: TEXTURES,
    selectedId: 'mint',
    slime: PRESETS[0],
    soundOn: true,
    pressing: false,
    pressMode: 'poke',
    pressMarks: [],
    stretchLines: [],
    bubbles: [
      { x: 20, y: 28, s: 26 }, { x: 74, y: 30, s: 18 }, { x: 34, y: 72, s: 16 },
      { x: 63, y: 67, s: 22 }, { x: 47, y: 20, s: 12 }, { x: 82, y: 52, s: 14 }
    ],
    slimeStyle: '',
    custom: {
      colorIndex: 0,
      shapeIndex: 0,
      textureIndex: 0
    }
  },

  onLoad() {
    const custom = getStorage(CUSTOM_KEY, this.data.custom);
    const soundOn = getStorage(SOUND_KEY, true);
    this.audio = null;
    this.setData({ custom, soundOn });
    this.selectPreset({ currentTarget: { dataset: { id: this.data.selectedId } } });
  },

  onUnload() {
    this.stopSound();
    if (this.audio) {
      this.audio.destroy();
      this.audio = null;
    }
  },

  selectPreset(e) {
    const id = e.currentTarget.dataset.id;
    const slime = PRESETS.find((item) => item.id === id) || PRESETS[0];
    this.applySlime(slime, id);
  },

  chooseColor(e) {
    this.setData({ 'custom.colorIndex': Number(e.currentTarget.dataset.index) });
  },

  chooseShape(e) {
    this.setData({ 'custom.shapeIndex': Number(e.currentTarget.dataset.index) });
  },

  chooseTexture(e) {
    this.setData({ 'custom.textureIndex': Number(e.currentTarget.dataset.index) });
  },

  makeCustom() {
    const color = COLORS[this.data.custom.colorIndex] || COLORS[0];
    const shape = SHAPES[this.data.custom.shapeIndex] || SHAPES[0];
    const texture = TEXTURES[this.data.custom.textureIndex] || TEXTURES[0];
    const slime = {
      id: 'custom',
      name: '我的彩泥',
      color: color.value,
      shape: shape.id,
      texture: texture.id,
      textureName: texture.name,
      shine: color.shine
    };
    setStorage(CUSTOM_KEY, this.data.custom);
    this.applySlime(slime, 'custom');
    wx.showToast({ title: '已生成专属彩泥', icon: 'none' });
  },

  toggleSound() {
    const soundOn = !this.data.soundOn;
    setStorage(SOUND_KEY, soundOn);
    this.setData({ soundOn });
    if (!soundOn) this.stopSound();
  },

  pressStart(e) {
    const point = this.getPressPoint(e);
    this.lastPoint = point;
    this.pressFromPoint(point, 0.78, 'poke');
  },

  pressMove(e) {
    const point = this.getPressPoint(e);
    this.addStretchLine(this.lastPoint || point, point);
    this.lastPoint = point;
    this.pressFromPoint(point, 0.92, 'stretch');
  },

  pressHold(e) {
    const point = this.getPressPoint(e);
    this.pressFromPoint(point, 1.08, 'hold');
  },

  pressEnd() {
    this.lastPoint = null;
    this.setData({
      pressing: false,
      pressMode: 'release',
      slimeStyle: buildSlimeStyle(this.data.slime, { x: 50, y: 54, dx: 0, dy: 0, power: 0, mode: 'release' })
    });
  },

  pressTap(e) {
    this.pressFromPoint(this.getPressPoint(e), 1, 'pop');
    setTimeout(() => this.pressEnd(), 160);
  },

  getPressPoint(e) {
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || {};
    const x = clamp(Math.round(((touch.x || 180) / 360) * 100), 12, 88);
    const y = clamp(Math.round(((touch.y || 260) / 520) * 100), 14, 86);
    return { x, y };
  },

  pressFromPoint(point, power, mode) {
    const x = point.x;
    const y = point.y;
    const dx = Math.round((x - 50) * 0.9);
    const dy = Math.round((y - 54) * 0.45);
    const mark = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      x,
      y,
      size: Math.round(86 + power * 54),
      mode
    };

    this.setData({
      pressing: true,
      pressMode: mode,
      slimeStyle: buildSlimeStyle(this.data.slime, { x, y, dx, dy, power, mode }),
      pressMarks: this.data.pressMarks.concat(mark).slice(-8)
    });
    this.playSound(mode);

    setTimeout(() => {
      this.setData({ pressMarks: this.data.pressMarks.filter((item) => item.id !== mark.id) });
    }, 520);
  },

  addStretchLine(from, to) {
    if (!from || Math.abs(from.x - to.x) + Math.abs(from.y - to.y) < 5) return;
    const line = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      x: Math.round((from.x + to.x) / 2),
      y: Math.round((from.y + to.y) / 2),
      w: clamp(Math.abs(to.x - from.x) * 9, 60, 220),
      r: Math.round((to.y - from.y) * 1.4)
    };
    this.setData({ stretchLines: this.data.stretchLines.concat(line).slice(-6) });
    setTimeout(() => {
      this.setData({ stretchLines: this.data.stretchLines.filter((item) => item.id !== line.id) });
    }, 460);
  },

  applySlime(slime, selectedId) {
    this.setData({
      selectedId,
      slime,
      pressing: false,
      pressMode: 'release',
      slimeStyle: buildSlimeStyle(slime, { x: 50, y: 54, dx: 0, dy: 0, power: 0, mode: 'release' })
    });
  },

  ensureAudio() {
    if (this.audio) return this.audio;
    const audio = wx.createInnerAudioContext();
    audio.src = '/audio/slime.wav';
    try { audio.obeyMuteSwitch = false; } catch (e) {}
    audio.onError(() => {});
    this.audio = audio;
    return audio;
  },

  playSound(mode) {
    if (!this.data.soundOn) return;
    const now = Date.now();
    if (this.lastSoundAt && now - this.lastSoundAt < 72) return;
    this.lastSoundAt = now;
    try {
      const audio = this.ensureAudio();
      if (audio.playbackRate !== undefined) {
        audio.playbackRate = mode === 'stretch' ? 0.82 : mode === 'pop' ? 1.12 : 0.96;
      }
      audio.stop();
      audio.seek(0);
      audio.play();
    } catch (e) {}
  },

  stopSound() {
    if (!this.audio) return;
    try { this.audio.stop(); } catch (e) {}
  }
});
