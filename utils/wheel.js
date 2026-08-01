// utils/wheel.js - 转盘核心算法：配色、锥形渐变、随机抽取、角度计算
// 参考小决定的实现：用 CSS conic-gradient 替代 canvas，避免绘制错位和卡顿

// 柔和浅蓝治愈系配色（与 app 主色协调，深色文字清晰可读）
const COLORS = [
  '#5B9BD5', // 主蓝
  '#7BC4A0', // 薄荷绿
  '#F2B36A', // 暖橘
  '#E8839B', // 柔粉
  '#9B8ED4', // 雾紫
  '#5DC5C5', // 青绿
  '#E8A87C', // 奶茶
  '#93C06A', // 抹茶
  '#6FA8DC', // 浅蓝
  '#E6B85C', // 蜂蜜黄
  '#C98BA0', // 莓粉
  '#6F9FD6'  // 灰蓝
];

/**
 * 构建锥形渐变 CSS 字符串（含白色扇区分隔线）
 * @param {number} count 选项数量
 * @returns {string} conic-gradient(...)
 */
function buildGradient(count) {
  if (count < 1) return '';
  const sectorAngle = 360 / count;
  const gap = Math.min(2, sectorAngle * 0.05);
  const stops = [];
  for (let i = 0; i < count; i++) {
    const start = i * sectorAngle;
    const sepStart = (i + 1) * sectorAngle - gap;
    const end = (i + 1) * sectorAngle;
    const color = COLORS[i % COLORS.length];
    stops.push(`${color} ${start.toFixed(4)}deg ${sepStart.toFixed(4)}deg`);
    stops.push(`#ffffff ${sepStart.toFixed(4)}deg ${end.toFixed(4)}deg`);
  }
  return `conic-gradient(from 0deg, ${stops.join(', ')})`;
}

/**
 * 获取随机选中的索引（等概率）
 * @param {number} count
 * @returns {number}
 */
function getRandomIndex(count) {
  return Math.floor(Math.random() * count);
}

/**
 * 计算转盘最终旋转角度
 * 指针固定在顶部（0°），转盘顺时针旋转；
 * 让选中扇区中心对准顶部指针，并至少多转 5 圈。
 * @param {number} selectedIndex 选中的扇区索引
 * @param {number} count 选项总数
 * @param {number} currentRotation 当前累计旋转角度
 * @returns {number} 最终旋转角度
 */
function calculateRotation(selectedIndex, count, currentRotation) {
  const sectorAngle = 360 / count;
  const sectorCenter = selectedIndex * sectorAngle + sectorAngle / 2;
  const adjustment = ((360 - sectorCenter) - (currentRotation % 360) + 360) % 360;
  return currentRotation + 360 * 5 + adjustment;
}

function getColor(index) {
  return COLORS[index % COLORS.length];
}

module.exports = { COLORS, buildGradient, getRandomIndex, calculateRotation, getColor };
