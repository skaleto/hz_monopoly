"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { profiles, fiveSectorsOfFive } = require("../sims/profiles");
const { simulateProfile, assertHardGates, assertCandidateGates } = require("../sims/run");

test("M3 board keeps five sectors while shortening the metro branch", () => {
  const board = fiveSectorsOfFive();
  const counts = new Map();
  for (const tile of board.filter(tile => tile.type === "property")) {
    counts.set(tile.group, (counts.get(tile.group) || 0) + 1);
  }
  assert.equal(board.length, 49);
  assert.equal(counts.size, 5);
  assert.deepEqual([...counts.values()], [5, 5, 5, 5, 5]);
  assert.deepEqual(board.slice(45).map(tile => tile.name), ["钱塘会展中心", "运河运动公园", "滨江国际社区", "大运河艺术馆"]);
  assert.deepEqual(board[29].next, [45]);
  assert.deepEqual(board[33].next, [46]);
  assert.equal(board.filter(tile => tile.inner === "metro").length, 5);
  assert.deepEqual([37,38,40,41,44].map(index => board[index].name), ["市民中心站","滨江数创园","地铁快线","文三数字街","未来科技城"]);
  assert.deepEqual(board[38].next, [40]);
  assert.deepEqual(board[41].next, [44]);
  assert.deepEqual([[2,47],[8,39],[13,42],[18,48],[24,43]].map(([from,to]) => board[from].next[0] === to), [true,true,true,true,true]);
  assert.equal([39,42,43,47,48].every(index => !board[index].inner), true);
});

test("M3 city event candidate passes cash tension and pacing gates", () => {
  const report = simulateProfile("cautious", profiles.cautious, { games: 200, seed: 20261010 });
  assert.doesNotThrow(() => assertHardGates(report));
  assert.doesNotThrow(() => assertCandidateGates(report));
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
