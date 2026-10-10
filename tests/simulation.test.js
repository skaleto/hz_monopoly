"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { profiles, fiveSectorsOfFive } = require("../sims/profiles");
const { simulateProfile, assertHardGates, assertCandidateGates } = require("../sims/run");

test("M4 board keeps five sectors and geometry while exposing only four active node types", () => {
  const board = fiveSectorsOfFive();
  const counts = new Map();
  for (const tile of board.filter(tile => tile.type === "property")) {
    counts.set(tile.group, (counts.get(tile.group) || 0) + 1);
  }
  assert.equal(board.length, 49);
  assert.equal(counts.size, 5);
  assert.deepEqual([...counts.values()], [5, 5, 5, 5, 5]);
  assert.deepEqual([...new Set(board.map(tile => tile.type))].sort(), ["event", "property", "route", "supply"]);
  assert.equal(board.filter(tile => tile.type === "event").length, 8);
  assert.deepEqual(board.slice(45).map(tile => tile.name), ["钱塘会展中心", "运河运动公园", "滨江国际社区", "大运河艺术馆"]);
  // 水线：22 入口 → 28..36 → 2 出口，共 8 个内部节点
  assert.equal(board.filter(tile => tile.inner === "water").length, 8);
  assert.deepEqual(board[22].next, [{ to: 23, label: "外环·运河线" }, { to: 28, label: "水上巴士线" }]);
  const waterChain = [28, 29, 30, 45, 31, 33, 34, 36];
  assert.deepEqual(waterChain.map((index, offset) => board[index].next[0]), [...waterChain.slice(1), 2]);
  // 地铁：10 入口 → 37..44 → 17 出口，共 7 个内部节点
  assert.equal(board.filter(tile => tile.inner === "metro").length, 7);
  assert.deepEqual(board[10].next, [{ to: 11, label: "外环·钱塘线" }, { to: 37, label: "地铁快线" }]);
  const metroChain = [37, 38, 48, 39, 41, 40, 44];
  assert.deepEqual(metroChain.map((index, offset) => board[index].next[0]), [...metroChain.slice(1), 17]);
  assert.deepEqual(metroChain.map(index => board[index].name), ["市民中心站","滨江数创园","大运河艺术馆","钱江新城","文三数字街","地铁快线","未来科技城"]);
  // 主环 34 节点顺序完整闭合（岔路节点取外环选项），无 inner 残留
  const ringOrder = [0, 1, 2, 47, 3, 4, 5, 32, 6, 7, 8, 46, 9, 10, 11, 12, 13, 14,
    15, 35, 16, 17, 18, 19, 20, 21, 22, 23, 24, 43, 25, 26, 42, 27];
  const ringNext = ringOrder.map(index => { const next = board[index].next[0]; return typeof next === "object" ? next.to : next; });
  assert.deepEqual(ringNext, [...ringOrder.slice(1), 0]);
  assert.equal(ringOrder.every(index => !board[index].inner), true);
});

test("M4 focused 30-round loop passes cash tension and pacing gates", () => {
  const report = simulateProfile("cautious", profiles.cautious, { games: 200, seed: 20261010 });
  assert.doesNotThrow(() => assertHardGates(report));
  assert.doesNotThrow(() => assertCandidateGates(report));
  assert.equal(profiles.cautious.balance.maxRounds, 30);
  assert.ok(report.gameplay.upgradesPerGame >= 18);
  assert.ok(report.gameplay.cityEventsPerGame <= 25);
});

test("fixed seeds reproduce the same simulation report", () => {
  const options = { games: 5, seed: 20261009 };
  const first = simulateProfile("current", profiles.current, options);
  const second = simulateProfile("current", profiles.current, options);
  assert.deepEqual(first, second);
  assert.equal(first.hard.finishRate, 1);
  assert.doesNotThrow(() => assertHardGates(first));
  assert.equal(first.gameplay.partnershipsPerGame, 0);
  assert.equal(first.gameplay.upgradesPerGame, 0);
  assert.equal(typeof first.gameplay.minimumCashP50, "number");
  assert.equal(typeof first.gameplay.gamesWithCashAtOrBelow300Pct, "number");
  assert.equal(typeof first.gameplay.cityEventsPerGame, "number");
  assert.equal(typeof first.gameplay.reviewEntriesPerGame, "number");
});
