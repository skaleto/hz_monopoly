"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { profiles, fiveSectorsOfFive } = require("../game-core/profiles");
const { simulateProfile, assertHardGates } = require("../sims/run");

test("M2 candidate board contains five sectors of five projects", () => {
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
  assert.deepEqual(board[38].next, [47]);
  assert.deepEqual(board[42].next, [48]);
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
});
