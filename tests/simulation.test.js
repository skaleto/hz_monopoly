"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { profiles, fiveSectorsOfFive } = require("../sims/profiles");
const { simulateProfile, assertHardGates, assertCandidateGates } = require("../sims/run");

test("M4 board keeps all playable content on a 26-node ring plus 5+5 branch lines", () => {
  const board = fiveSectorsOfFive();
  const counts = new Map();
  for (const tile of board.filter(tile => tile.type === "property")) {
    counts.set(tile.group, (counts.get(tile.group) || 0) + 1);
  }
  assert.equal(board.length, 36);
  assert.equal(counts.size, 5);
  assert.deepEqual([...counts.values()], [5, 5, 5, 5, 5]);
  assert.deepEqual([...new Set(board.map(tile => tile.type))].sort(), ["event", "property", "route", "supply"]);
  assert.equal(board.filter(tile => tile.type === "event").length, 8);
  const to = next => typeof next === "object" ? next.to : next;
  for (const [route, expectedCount] of [["water", 5], ["metro", 5]]) {
    const chain = board.map((tile, index) => ({ tile, index })).filter(item => item.tile.inner === route).map(item => item.index);
    assert.equal(chain.length, expectedCount);
    const entry = board.findIndex(tile => tile.next.some(next => to(next) === chain[0]));
    assert.ok(entry >= 0);
    assert.equal(board[entry].next.length, 2);
    assert.deepEqual(chain.slice(0, -1).map((index, position) => to(board[index].next[0])), chain.slice(1));
    assert.equal(board[to(board[chain.at(-1)].next[0])].inner, undefined);
  }
  const ring = [];
  let current = 0;
  do { ring.push(current); current = to(board[current].next[0]); } while (current !== 0 && ring.length < 40);
  assert.equal(ring.length, 26);
  assert.equal(new Set(ring).size, 26);
  assert.equal(ring.every(index => !board[index].inner), true);
});

test("M4 focused 30-round loop passes cash tension and pacing gates", () => {
  const report = simulateProfile("cautious", profiles.cautious, { games: 200, seed: 20261010 });
  assert.doesNotThrow(() => assertHardGates(report));
  assert.doesNotThrow(() => assertCandidateGates(report));
  assert.equal(profiles.cautious.balance.maxRounds, 30);
  assert.ok(report.gameplay.upgradesPerGame >= 18);
  assert.ok(report.gameplay.cityEventsPerGame <= 32);
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
