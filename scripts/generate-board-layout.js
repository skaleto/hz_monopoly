"use strict";

/**
 * 棋盘布局生成器 —— 主环弧长均匀 + 双支线贝塞尔，一套数据源同时输出：
 *   1. 主环 28 个节点的坐标（圆角矩形轨道，弧长等距，起点=我的公寓，方向：底边→右边→顶边→左边）
 *   2. 水线/地铁各 4 个内部节点（圆弧等距采样，端点锚定在主环节点）
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
const MIN_GAP = TILE + 2;                      // 同向相邻节点最小中心距（直线段防重叠）
const MIN_CROSS_GAP = TILE + 4;                // 支线与主环 / 支线之间的最小间距
const RING_COUNT = 28;
const TRACK_MARGIN = 27;                       // 52px 项目节点留 1px 安全边距
const CORNER_RADIUS = 48;

// —— 主环轨道：圆角矩形，按弧长参数化 ——
function buildRoundedRectTrack(width, height, margin, radius) {
  const left = margin, right = width - margin, top = margin, bottom = height - margin;
  const segments = [
    // 底边：左→右
    { kind: "line", from: { x: left + radius, y: bottom }, to: { x: right - radius, y: bottom }, length: right - radius - (left + radius) },
    // 右下角弧
    { kind: "arc", center: { x: right - radius, y: bottom - radius }, radius, fromAngle: Math.PI / 2, toAngle: 0, length: radius * Math.PI / 2 },
    // 右边：下→上
    { kind: "line", from: { x: right, y: bottom - radius }, to: { x: right, y: top + radius }, length: bottom - radius - (top + radius) },
    // 右上角弧
    { kind: "arc", center: { x: right - radius, y: top + radius }, radius, fromAngle: 0, toAngle: -Math.PI / 2, length: radius * Math.PI / 2 },
    // 顶边：右→左
    { kind: "line", from: { x: right - radius, y: top }, to: { x: left + radius, y: top }, length: right - radius - (left + radius) },
    // 左上角弧
    { kind: "arc", center: { x: left + radius, y: top + radius }, radius, fromAngle: -Math.PI / 2, toAngle: -Math.PI, length: radius * Math.PI / 2 },
    // 左边：上→下
    { kind: "line", from: { x: left, y: top + radius }, to: { x: left, y: bottom - radius }, length: bottom - radius - (top + radius) },
    // 左下角弧
    { kind: "arc", center: { x: left + radius, y: bottom - radius }, radius, fromAngle: Math.PI, toAngle: Math.PI / 2, length: radius * Math.PI / 2 }
  ];
  let acc = 0;
  for (const segment of segments) { segment.startAt = acc; acc += segment.length; }
  return { segments, total: acc };
}

function pointOnTrack(track, distance) {
  const d = ((distance % track.total) + track.total) % track.total;
  for (const segment of track.segments) {
    if (d <= segment.startAt + segment.length) {
      const t = (d - segment.startAt) / segment.length;
      if (segment.kind === "line") {
        return { x: segment.from.x + (segment.to.x - segment.from.x) * t, y: segment.from.y + (segment.to.y - segment.from.y) * t };
      }
      const angle = segment.fromAngle + (segment.toAngle - segment.fromAngle) * t;
      return { x: segment.center.x + segment.radius * Math.cos(angle), y: segment.center.y + segment.radius * Math.sin(angle) };
    }
  }
  return { ...track.segments.at(-1).to };
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

// —— 生成 ——
function generateLayout() {
  const track = buildRoundedRectTrack(CANVAS.width, CANVAS.height, TRACK_MARGIN, CORNER_RADIUS);
  // 起点=我的公寓，放在底边左端弧结束处（左下角圆弧结束、底边直线开始的位置）
  const ringGap = track.total / RING_COUNT;

  // M4 重排后，主环在候选棋盘中占 0..26。
  const ringOrder = Array.from({ length: RING_COUNT }, (_, index) => index);
  if (ringOrder.length !== RING_COUNT) throw new Error(`ring order has ${ringOrder.length} nodes, expected ${RING_COUNT}`);

  const ring = ringOrder.map((index, position) => ({ index, ...pointOnTrack(track, position * ringGap) }));

  const byIndex = new Map(ring.map(node => [node.index, node]));

  // 支线路标（规范画布像素）：端点=主环节点锚点，弓向棋盘中部
  // 水线：21(运河夜游) → 2(断桥文旅)；地铁：11(运河运动公园) → 16(良渚文创园)。
  const waterEntry = byIndex.get(21), waterExit = byIndex.get(2);
  const metroEntry = byIndex.get(11), metroExit = byIndex.get(16);
  if (!waterEntry || !waterExit || !metroEntry || !metroExit) throw new Error("missing branch anchor on ring");

  const water = sampleArcEvenly(waterEntry, waterExit, 435, 4, { x: 182, y: 294 });
  const metro = sampleArcEvenly(metroEntry, metroExit, 300, 4, { x: 250, y: 190 });

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

  return { ring, water, metro, minPair, worst, ringGap, track: track.total };
}

function toPercent(point) {
  return { x: Number((point.x / CANVAS.width * 100).toFixed(2)), y: Number((point.y / CANVAS.height * 100).toFixed(2)) };
}

function main() {
  const layout = generateLayout();
  const waterOrder = [28, 29, 30, 31];
  const metroOrder = [32, 33, 34, 35];
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
