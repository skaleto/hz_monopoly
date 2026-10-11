"use strict";

/**
 * 棋盘布局生成器 —— 矩形主环 + 圆弧/贝塞尔双支线，一套数据源同时输出：
 *   1. 主环 26 个节点的坐标（矩形轨道，横向 6 格、纵向 9 格）
 *   2. 水线/地铁各 5 个内部节点（按弧长等距采样，端点锚定在主环节点）
 *   3. 约束自检报告：任意两节点最小间距、支线-主环间距、支线间间距
 *
 * 坐标系：先在规范画布 364×508（390×844 视口下的真实棋盘像素）内计算，
 * 再换算成百分比写入 board 数据（客户端按百分比定位）。
 *
 * 用法：node scripts/generate-board-layout.js           # 打印报告 + JSON
 *       node scripts/generate-board-layout.js --write   # 直接改写 sims/board-layout.json
 */

const CANVAS = { width: 364, height: 564 };   // 规范棋盘像素（390×844 M4 实际地图区域）
const TILE = 52;                               // M4 项目节点渲染尺寸（含描边）
const RING_COUNT = 26;
const TRACK_MARGIN = 27;                       // 52px 项目节点留 1px 安全边距

function buildRectRing(width, height, margin, horizontalCount = 6, verticalCount = 9) {
  const left = margin, right = width - margin, top = margin, bottom = height - margin;
  const points = [];
  for (let index = 0; index < horizontalCount; index += 1) points.push({ x: left + (right - left) * index / (horizontalCount - 1), y: bottom });
  for (let index = 1; index < verticalCount - 1; index += 1) points.push({ x: right, y: bottom - (bottom - top) * index / (verticalCount - 1) });
  for (let index = 0; index < horizontalCount; index += 1) points.push({ x: right - (right - left) * index / (horizontalCount - 1), y: top });
  for (let index = 1; index < verticalCount - 1; index += 1) points.push({ x: left, y: top + (bottom - top) * index / (verticalCount - 1) });
  return points;
}

// —— 支线：圆弧（常曲率）。任意两点间等弧长 ⇒ 等弦长，节点间距天然均匀 ——
function sampleArcEvenly(entry, exit, targetLength, interiorCount, bulgeToward) {
  const chord = Math.hypot(exit.x - entry.x, exit.y - entry.y);
  if (targetLength <= chord) throw new Error(`target arc ${targetLength} <= chord ${chord}`);
  // 解 θ: chord/arc = 2sin(θ/2)/θ，在 (0, π) 上单调下降，二分求根
  const ratio = chord / targetLength;
  let lo = 0.05, hi = 3.0;
  const g = t => 2 * Math.sin(t / 2) / t;
  if (!(g(lo) > ratio && g(hi) < ratio)) throw new Error(`arc ratio ${ratio.toFixed(3)} unsolvable for chord ${chord.toFixed(0)} arc ${targetLength}`);
  for (let iter = 0; iter < 80; iter += 1) {
    const mid = (lo + hi) / 2;
    if (g(mid) > ratio) lo = mid; else hi = mid;
  }
  const theta = (lo + hi) / 2;
  const radius = targetLength / theta;
  // 圆心在弦的垂直平分线上，偏向 bulgeToward 的反侧
  const chordMid = { x: (entry.x + exit.x) / 2, y: (entry.y + exit.y) / 2 };
  const chordDir = { x: (exit.x - entry.x) / chord, y: (exit.y - entry.y) / chord };
  const perp = { x: -chordDir.y, y: chordDir.x };
  const toBulge = { x: bulgeToward.x - chordMid.x, y: bulgeToward.y - chordMid.y };
  const side = perp.x * toBulge.x + perp.y * toBulge.y >= 0 ? 1 : -1;
  const centerDist = Math.sqrt(Math.max(0, radius ** 2 - (chord / 2) ** 2));
  const center = { x: chordMid.x - side * perp.x * centerDist, y: chordMid.y - side * perp.y * centerDist };
  const startAngle = Math.atan2(entry.y - center.y, entry.x - center.x);
  const endAngle = Math.atan2(exit.y - center.y, exit.x - center.x);
  let delta = endAngle - startAngle;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  if (Math.abs(delta) < 0.01) throw new Error("degenerate arc");
  const interior = Array.from({ length: interiorCount }, (_, index) => {
    const angle = startAngle + delta * (index + 1) / (interiorCount + 1);
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
  });
  return { interior, length: targetLength, radius, theta, sagitta: radius - centerDist };
}

function cubicPoint(start, control1, control2, end, t) {
  const mt = 1 - t;
  return {
    x: mt ** 3 * start.x + 3 * mt ** 2 * t * control1.x + 3 * mt * t ** 2 * control2.x + t ** 3 * end.x,
    y: mt ** 3 * start.y + 3 * mt ** 2 * t * control1.y + 3 * mt * t ** 2 * control2.y + t ** 3 * end.y
  };
}

function sampleCubicEvenly(start, control1, control2, end, interiorCount) {
  const samples = [{ t: 0, point: start, distance: 0 }];
  for (let index = 1; index <= 1200; index += 1) {
    const t = index / 1200, point = cubicPoint(start, control1, control2, end, t), previous = samples.at(-1);
    samples.push({ t, point, distance: previous.distance + Math.hypot(point.x - previous.point.x, point.y - previous.point.y) });
  }
  const length = samples.at(-1).distance;
  const interior = Array.from({ length: interiorCount }, (_, index) => {
    const target = length * (index + 1) / (interiorCount + 1);
    const upperIndex = samples.findIndex(sample => sample.distance >= target), upper = samples[upperIndex], lower = samples[Math.max(0, upperIndex - 1)];
    const ratio = upper.distance === lower.distance ? 0 : (target - lower.distance) / (upper.distance - lower.distance);
    return { x: lower.point.x + (upper.point.x - lower.point.x) * ratio, y: lower.point.y + (upper.point.y - lower.point.y) * ratio };
  });
  return { interior, length };
}

// —— 生成 ——
function generateLayout() {
  // M4 重排后，主环在候选棋盘中占 0..25：横向 6 格、纵向 9 格。
  const ringOrder = Array.from({ length: RING_COUNT }, (_, index) => index);
  if (ringOrder.length !== RING_COUNT) throw new Error(`ring order has ${ringOrder.length} nodes, expected ${RING_COUNT}`);
  const ringPoints = buildRectRing(CANVAS.width, CANVAS.height, TRACK_MARGIN);
  if (ringPoints.length !== RING_COUNT) throw new Error(`rect ring has ${ringPoints.length} nodes, expected ${RING_COUNT}`);
  const ring = ringOrder.map((index, position) => ({ index, ...ringPoints[position] }));
  const ringGap = Math.min(...ring.map((point, index) => {
    const next = ring[(index + 1) % ring.length];
    return Math.hypot(point.x - next.x, point.y - next.y);
  }));

  const byIndex = new Map(ring.map(node => [node.index, node]));

  // 支线路标（规范画布像素）：端点=主环节点锚点，弓向棋盘中部
  // 水线：19(运河夜游) → 2(断桥文旅)；地铁：10(运河运动公园) → 14(良渚文创园)。
  const waterEntry = byIndex.get(19), waterExit = byIndex.get(2);
  const metroEntry = byIndex.get(10), metroExit = byIndex.get(14);
  if (!waterEntry || !waterExit || !metroEntry || !metroExit) throw new Error("missing branch anchor on ring");

  const water = sampleArcEvenly(waterEntry, waterExit, 500, 5, { x: 182, y: 294 });
  const metro = sampleCubicEvenly(metroEntry, { x: 150, y: 360 }, { x: 184, y: 138 }, metroExit, 5);

  // 全局最小间距自检（含主环、两支线全体 36 节点）
  const all = [
    ...ring,
    ...water.interior.map((p, i) => ({ index: `w${i}`, ...p })),
    ...metro.interior.map((p, i) => ({ index: `m${i}`, ...p }))
  ];
  let minPair = Infinity, worst = null;
  for (let i = 0; i < all.length; i += 1) {
    for (let j = i + 1; j < all.length; j += 1) {
      const d = Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y);
      if (d < minPair) { minPair = d; worst = [all[i].index, all[j].index]; }
    }
  }

  return { ring, water, metro, minPair, worst, ringGap };
}

function toPercent(point) {
  return { x: Number((point.x / CANVAS.width * 100).toFixed(2)), y: Number((point.y / CANVAS.height * 100).toFixed(2)) };
}

function main() {
  const layout = generateLayout();
  const waterOrder = [26, 27, 28, 29, 30];
  const metroOrder = [31, 32, 33, 34, 35];
  const data = {
    ring: Object.fromEntries(layout.ring.map(node => [node.index, toPercent(node)])),
    water: Object.fromEntries(waterOrder.map((index, i) => [index, toPercent(layout.water.interior[i])])),
    metro: Object.fromEntries(metroOrder.map((index, i) => [index, toPercent(layout.metro.interior[i])])),
    report: {
      ringGapPx: Number(layout.ringGap.toFixed(1)),
      minPairDistancePx: Number(layout.minPair.toFixed(1)),
      worstPair: layout.worst,
      waterLengthPx: Number(layout.water.length.toFixed(1)),
      metroLengthPx: Number(layout.metro.length.toFixed(1))
    }
  };
  const json = JSON.stringify(data, null, 2);
  if (process.argv.includes("--write")) {
    require("node:fs").writeFileSync(require("node:path").join(__dirname, "../sims/board-layout.json"), json + "\n");
    console.log("written sims/board-layout.json");
  }
  console.log(json);
}

main();
