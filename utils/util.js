// utils/util.js - 本地存储封装与通用工具
// 所有数据仅保存在手机本地，不上传任何服务器。

const STORAGE_PREFIX = 'qw_';

/* ---------------- 本地存储 ---------------- */
function getStorage(key, defaultValue) {
  try {
    const val = wx.getStorageSync(STORAGE_PREFIX + key);
    if (val === '' || val === undefined || val === null) return defaultValue;
    return val;
  } catch (e) {
    return defaultValue;
  }
}

function setStorage(key, value) {
  try {
    wx.setStorageSync(STORAGE_PREFIX + key, value);
  } catch (e) {}
}

function removeStorage(key) {
  try {
    wx.removeStorageSync(STORAGE_PREFIX + key);
  } catch (e) {}
}

function clearAll() {
  try {
    wx.clearStorageSync();
  } catch (e) {}
}

/* ---------------- 日期 ---------------- */
function pad(n) { return ('0' + n).slice(-2); }

// Date -> 'yyyy-mm-dd'
function formatDate(date) {
  if (typeof date === 'string') {
    // 兼容 'yyyy-mm-dd' 与 'yyyy/mm/dd'
    const parts = date.split(/[-/]/).map(Number);
    return `${parts[0]}-${pad(parts[1])}-${pad(parts[2])}`;
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function today() {
  return formatDate(new Date());
}

// 两个日期相差天数 = b - a（按自然日）
function diffDays(a, b) {
  const da = new Date(formatDate(a).replace(/-/g, '/'));
  const db = new Date(formatDate(b).replace(/-/g, '/'));
  return Math.round((db - da) / 86400000);
}

/* ---------------- 星座 / 生肖 ---------------- */
// 输入月、日，返回星座中文名
function getConstellation(month, day) {
  const d = month * 100 + day;
  const map = [
    [119, '摩羯座'], [218, '水瓶座'], [320, '双鱼座'], [419, '白羊座'],
    [520, '金牛座'], [621, '双子座'], [722, '巨蟹座'], [822, '狮子座'],
    [922, '处女座'], [1023, '天秤座'], [1122, '天蝎座'], [1221, '射手座'], [1232, '摩羯座']
  ];
  for (let i = 0; i < map.length; i++) {
    if (d <= map[i][0]) return map[i][1];
  }
  return '摩羯座';
}

// 输入年份，返回生肖（鼠=0 ... 猪=11）
const ZODIAC_NAMES = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
function getZodiac(year) {
  return ZODIAC_NAMES[((year - 4) % 12 + 12) % 12];
}

/* ---------------- ID / 随机 ---------------- */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 字符串 -> 整数（确定性）
function randomInt(arr) {
  return Math.floor(Math.random() * arr.length);
}

/* ---------------- 确定性伪随机 ----------------
 * 使用 FNV-1a 哈希 + mulberry32 生成可复现随机数。
 * 相同输入字符串永远得到相同的随机序列，用于运势/匹配分数。
 */
function hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 返回基于字符串种子的可复现随机函数
function seededRandom(str) {
  return mulberry32(hashStr(String(str)));
}

// 基于种子取 [min, max] 整数
function seededInt(str, min, max) {
  const r = seededRandom(str);
  return min + Math.floor(r() * (max - min + 1));
}

// 基于种子从数组取值
function seededPick(str, arr) {
  const r = seededRandom(str);
  return arr[Math.floor(r() * arr.length)];
}

// 限幅
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

module.exports = {
  getStorage,
  setStorage,
  removeStorage,
  clearAll,
  formatDate,
  today,
  diffDays,
  getConstellation,
  getZodiac,
  ZODIAC_NAMES,
  genId,
  randomPick,
  randomInt,
  hashStr,
  mulberry32,
  seededRandom,
  seededInt,
  seededPick,
  clamp
};
