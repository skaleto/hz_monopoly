"use strict";

const { BOARD } = require("../game-core");

const convertedProjects = {
  武林门码头: { price: 180, rent: 46 },
  水上巴士: { price: 190, rent: 50 },
  市民中心站: { price: 260, rent: 72 },
  地铁快线: { price: 250, rent: 68 }
};

const sectorByProject = new Map(Object.entries({
  龙井茶园: "文旅消费", 断桥文旅: "文旅消费", 良渚文创园: "文旅消费", 运河夜游: "文旅消费", 桥西文创园: "文旅消费",
  未来创业营: "数字科技", 云栖工坊: "数字科技", 滨江数创园: "数字科技", 文三数字街: "数字科技", 未来路演厅: "数字科技",
  河坊街铺: "城市生活", 南宋食坊: "城市生活", 武林夜市: "城市生活", 小河市集: "城市生活", 桥西生活馆: "城市生活",
  城市阳台: "钱塘发展", 钱江创意港: "钱塘发展", 大莲花场馆: "钱塘发展", 市民中心站: "钱塘发展", 地铁快线: "钱塘发展",
  良渚陶艺村: "生态文体", 西溪营地: "生态文体", 运河文创: "生态文体", 武林门码头: "生态文体", 水上巴士: "生态文体"
}));

function fiveSectorsOfFive() {
  const board = BOARD.map(tile => {
    const converted = convertedProjects[tile.name];
    const candidate = converted ? { ...tile, type: "property", visual: "transit", ...converted } : { ...tile };
    const group = sectorByProject.get(candidate.name);
    return group ? { ...candidate, group } : candidate;
  });
  const projects = board.filter(tile => tile.type === "property");
  const counts = new Map();
  for (const tile of projects) counts.set(tile.group, (counts.get(tile.group) || 0) + 1);
  if (projects.length !== 25 || counts.size !== 5 || [...counts.values()].some(count => count !== 5)) throw new Error("INVALID_FIVE_SECTOR_BOARD");
  return board;
}

const sharedCandidate = {
  completeGroupRentMultiplier: 1,
  sectorBonuses: {
    enabled: true,
    rentMinProjects: 2,
    rentMultiplier: 1.15,
    flagshipMinProjects: 3,
    scoreMinProjects: 4,
    scoreBonus: 3
  },
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
    botPolicy: { partnershipRate: 0, upgradeEnabled: false, upgradeAfterRound: 99, maxUpgradesPerPlayer: 0, reserveCash: 400 }
  },
  cautious: {
    label: "M2 sector cautious",
    rulesetVersion: "hangzhou-v2-sector-cautious",
    board: fiveSectorsOfFive(),
    balance: {
      ...sharedCandidate,
      startingCashByTurn: [1500, 1500, 1500, 1500],
      sectorBonuses: { ...sharedCandidate.sectorBonuses, rentMultiplier: 1.1 },
      rentMultiplierByLevel: [0, 1, 1.75, 3],
      upgrade: { costMode: "ratio", ratioByCurrentLevel: { 1: 0.45, 2: 0.7 }, level3RequiresCompleteGroup: true }
    },
    botPolicy: { partnershipRate: 0.2, upgradeEnabled: true, upgradeAfterRound: 6, maxUpgradesPerPlayer: 2, reserveCash: 425 }
  },
  target: {
    label: "M2 sector target",
    rulesetVersion: "hangzhou-v2-sector-target",
    board: fiveSectorsOfFive(),
    balance: {
      ...sharedCandidate,
      startingCashByTurn: [1500, 1500, 1500, 1500],
      rentMultiplierByLevel: [0, 1, 2, 4],
      upgrade: { costMode: "ratio", ratioByCurrentLevel: { 1: 0.5, 2: 0.8 }, level3RequiresCompleteGroup: true }
    },
    botPolicy: { partnershipRate: 0.3, upgradeEnabled: true, upgradeAfterRound: 5, maxUpgradesPerPlayer: 3, reserveCash: 375 }
  },
  aggressive: {
    label: "M2 sector aggressive",
    rulesetVersion: "hangzhou-v2-sector-aggressive",
    board: fiveSectorsOfFive(),
    balance: {
      ...sharedCandidate,
      startingCashByTurn: [1500, 1500, 1500, 1500],
      startIncomeByRound: [
        { through: 4, amount: 180 },
        { through: 9, amount: 120 },
        { through: 12, amount: 80 }
      ],
      sectorBonuses: { ...sharedCandidate.sectorBonuses, rentMultiplier: 1.2 },
      rentMultiplierByLevel: [0, 1, 2.25, 5],
      upgrade: { costMode: "ratio", ratioByCurrentLevel: { 1: 0.55, 2: 0.9 }, level3RequiresCompleteGroup: true }
    },
    botPolicy: { partnershipRate: 0.4, upgradeEnabled: true, upgradeAfterRound: 4, maxUpgradesPerPlayer: 3, reserveCash: 325 }
  }
};

module.exports = { profiles, fiveSectorsOfFive };
