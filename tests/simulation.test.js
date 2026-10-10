"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { profiles, fiveSectorsOfFive } = require("../sims/profiles");
const { simulateProfile, assertHardGates, assertCandidateGates } = require("../sims/run");

test("M3 board keeps five sectors and balances both branches at nine nodes", () => {
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
  assert.equal(board.filter(tile => tile.inner === "water").length, 9);
  assert.equal(board.filter(tile => tile.inner === "metro").length, 9);
  assert.deepEqual([37,38,48,39,30,40,41,34,44].map(index => board[index].name), ["市民中心站","滨江数创园","大运河艺术馆","钱江新城","香积寺晨市","地铁快线","文三数字街","拱宸桥码头","未来科技城"]);
  assert.deepEqual(board[38].next, [48]);
  assert.deepEqual(board[48].next, [39]);
  assert.deepEqual(board[39].next, [30]);
  assert.deepEqual(board[30].next, [40]);
  assert.deepEqual(board[41].next, [34]);
  assert.deepEqual(board[34].next, [44]);
  assert.deepEqual([[2,47],[13,42],[24,43]].map(([from,to]) => board[from].next[0] === to), [true,true,true]);
  assert.equal([42,43,47].every(index => !board[index].inner), true);
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
