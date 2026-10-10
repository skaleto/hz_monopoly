"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { profiles, fiveSectorsOfFive } = require("../sims/profiles");
const { simulateProfile, assertHardGates, assertCandidateGates } = require("../sims/run");

test("M3 board keeps five sectors and limits both shortcut branches to six nodes", () => {
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
  assert.deepEqual(board[45].next, [31]);
  assert.deepEqual(board[31].next, [33]);
  assert.deepEqual(board[33].next, [36]);
  assert.equal(board.filter(tile => tile.inner === "water").length, 6);
  assert.equal(board.filter(tile => tile.inner === "metro").length, 6);
  assert.deepEqual([37,38,48,39,41,44].map(index => board[index].name), ["市民中心站","滨江数创园","大运河艺术馆","钱江新城","文三数字街","未来科技城"]);
  assert.deepEqual(board[38].next, [48]);
  assert.deepEqual(board[48].next, [39]);
  assert.deepEqual(board[39].next, [41]);
  assert.deepEqual(board[41].next, [44]);
  const outerInsertions=[[0,34,1],[2,47,3],[5,32,6],[8,46,9],[13,42,14],[15,35,16],[19,30,20],[24,43,25],[26,40,27]];
  assert.equal(outerInsertions.every(([before,moved,after]) => board[before].next[0] === moved && board[moved].next[0] === after && !board[moved].inner), true);
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
