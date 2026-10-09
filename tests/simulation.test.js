"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { profiles, sevenGroupsOfThree } = require("../sims/profiles");
const { simulateProfile, assertHardGates } = require("../sims/run");

test("M2 candidate board contains seven explicit groups of three projects", () => {
  const counts = new Map();
  for (const tile of sevenGroupsOfThree().filter(tile => tile.type === "property")) {
    counts.set(tile.group, (counts.get(tile.group) || 0) + 1);
  }
  assert.equal(counts.size, 7);
  assert.deepEqual([...counts.values()], [3, 3, 3, 3, 3, 3, 3]);
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
