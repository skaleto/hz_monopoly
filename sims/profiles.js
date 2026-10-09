"use strict";

const { BOARD } = require("../game-core");

function sevenGroupsOfThree() {
  let propertyIndex = 0;
  return BOARD.map(tile => {
    if (tile.type !== "property") return { ...tile };
    const group = `产业组合${Math.floor(propertyIndex / 3) + 1}`;
    propertyIndex += 1;
    return { ...tile, group };
  });
}

const sharedCandidate = {
  startingCashByTurn: [1500, 1600, 1700, 1800],
  completeGroupRentMultiplier: 1,
  startIncomeByRound: [
    { through: 4, amount: 200 },
    { through: 9, amount: 150 },
    { through: 12, amount: 100 }
  ]
};

const profiles = {
  current: {
    label: "M1 current",
    rulesetVersion: "hangzhou-v1.3",
    board: BOARD,
    balance: {},
    botPolicy: { partnershipRate: 0, upgradeEnabled: false, reserveCash: 400 }
  },
  cautious: {
    label: "M2 cautious",
    rulesetVersion: "hangzhou-v2-sim-cautious",
    board: sevenGroupsOfThree(),
    balance: {
      ...sharedCandidate,
      rentMultiplierByLevel: [0, 1, 1.75, 3],
      upgrade: { costMode: "ratio", ratioByCurrentLevel: { 1: 0.45, 2: 0.7 }, level3RequiresCompleteGroup: true }
    },
    botPolicy: { partnershipRate: 0.2, upgradeEnabled: true, reserveCash: 450 }
  },
  target: {
    label: "M2 target",
    rulesetVersion: "hangzhou-v2-sim-target",
    board: sevenGroupsOfThree(),
    balance: {
      ...sharedCandidate,
      rentMultiplierByLevel: [0, 1, 2, 4],
      upgrade: { costMode: "ratio", ratioByCurrentLevel: { 1: 0.5, 2: 0.8 }, level3RequiresCompleteGroup: true }
    },
    botPolicy: { partnershipRate: 0.3, upgradeEnabled: true, reserveCash: 400 }
  },
  aggressive: {
    label: "M2 aggressive",
    rulesetVersion: "hangzhou-v2-sim-aggressive",
    board: sevenGroupsOfThree(),
    balance: {
      ...sharedCandidate,
      startIncomeByRound: [
        { through: 4, amount: 180 },
        { through: 9, amount: 120 },
        { through: 12, amount: 80 }
      ],
      rentMultiplierByLevel: [0, 1, 2.25, 5],
      upgrade: { costMode: "ratio", ratioByCurrentLevel: { 1: 0.55, 2: 0.9 }, level3RequiresCompleteGroup: true }
    },
    botPolicy: { partnershipRate: 0.4, upgradeEnabled: true, reserveCash: 325 }
  }
};

module.exports = { profiles, sevenGroupsOfThree };
