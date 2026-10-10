"use strict";

const { BOARD } = require("../game-core");

const sectorByProject = new Map(Object.entries({
  龙井茶园: "文旅消费", 断桥文旅: "文旅消费", 良渚文创园: "文旅消费", 运河夜游: "文旅消费", 桥西文创园: "文旅消费",
  未来创业营: "数字科技", 云栖工坊: "数字科技", 滨江数创园: "数字科技", 文三数字街: "数字科技", 未来路演厅: "数字科技",
  河坊街铺: "城市生活", 南宋食坊: "城市生活", 武林夜市: "城市生活", 小河市集: "城市生活", 桥西生活馆: "城市生活",
  城市阳台: "钱塘发展", 钱江创意港: "钱塘发展", 大莲花场馆: "钱塘发展", 钱塘会展中心: "钱塘发展", 滨江国际社区: "钱塘发展",
  良渚陶艺村: "生态文体", 西溪营地: "生态文体", 运河文创: "生态文体", 运河运动公园: "生态文体", 大运河艺术馆: "生态文体"
}));

function fiveSectorsOfFive() {
  const board = BOARD.map(tile => ({ ...tile, next: tile.next.map(value => typeof value === "object" ? { ...value } : value) }));
  const newProjects = [
    { type: "property", visual: "project_expo", name: "钱塘会展中心", next: [31], price: 280, rent: 78, group: "钱塘发展" },
    { type: "property", visual: "project_sports", name: "运河运动公园", next: [35], price: 230, rent: 62, group: "生态文体" },
    { type: "property", visual: "project_community", name: "滨江国际社区", next: [3], price: 270, rent: 74, group: "钱塘发展" },
    { type: "property", visual: "project_art", name: "大运河艺术馆", next: [39], price: 220, rent: 58, group: "生态文体" }
  ];
  board.push(...newProjects);

  // 布局与拓扑由 scripts/generate-board-layout.js 生成（sims/board-layout.json）：
  // 主环 34 节点弧长均匀；水线 8 节点（22 入 → 2 出）、地铁 7 节点（10 入 → 17 出），端点锚定主环。
  const layout = require("./board-layout.json");
  const RING_ORDER = [0, 1, 2, 47, 3, 4, 5, 32, 6, 7, 8, 46, 9, 10, 11, 12, 13, 14,
    15, 35, 16, 17, 18, 19, 20, 21, 22, 23, 24, 43, 25, 26, 42, 27];
  const WATER_ORDER = [28, 29, 30, 45, 31, 33, 34, 36];
  const METRO_ORDER = [37, 38, 48, 39, 41, 40, 44];
  if (RING_ORDER.length !== Object.keys(layout.ring).length
    || WATER_ORDER.length !== Object.keys(layout.water).length
    || METRO_ORDER.length !== Object.keys(layout.metro).length) throw new Error("BOARD_LAYOUT_MISMATCH");

  RING_ORDER.forEach((index, position) => {
    board[index].next = [RING_ORDER[(position + 1) % RING_ORDER.length]];
    Object.assign(board[index], layout.ring[index]);
    delete board[index].inner;
  });
  // 两个岔路入口
  board[22].next = [{ to: 23, label: "外环·运河线" }, { to: 28, label: "水上巴士线" }];
  board[10].next = [{ to: 11, label: "外环·钱塘线" }, { to: 37, label: "地铁快线" }];

  WATER_ORDER.forEach((index, position) => {
    board[index].next = [position === WATER_ORDER.length - 1 ? 2 : WATER_ORDER[position + 1]];
    Object.assign(board[index], layout.water[index], { inner: "water" });
  });
  METRO_ORDER.forEach((index, position) => {
    board[index].next = [position === METRO_ORDER.length - 1 ? 17 : METRO_ORDER[position + 1]];
    Object.assign(board[index], layout.metro[index], { inner: "metro" });
  });

  const candidateBoard = board.map(tile => {
    const candidate = ["daily", "opportunity"].includes(tile.type)
      ? { ...tile, type: "event", name: tile.name.replace("杭城日常", "杭城事件").replace("机遇卡", "事件") }
      : { ...tile };
    const group = sectorByProject.get(candidate.name);
    return group ? { ...candidate, group } : candidate;
  });
  const projects = candidateBoard.filter(tile => tile.type === "property");
  const counts = new Map();
  for (const tile of projects) counts.set(tile.group, (counts.get(tile.group) || 0) + 1);
  if (candidateBoard.length !== 49 || projects.length !== 25 || counts.size !== 5 || [...counts.values()].some(count => count !== 5)) throw new Error("INVALID_FIVE_SECTOR_BOARD");
  return candidateBoard;
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
    label: "M3 city events candidate",
    rulesetVersion: "hangzhou-v4-sector-board",
    board: fiveSectorsOfFive(),
    balance: {
      ...sharedCandidate,
      startingCashByTurn: [1200, 1200, 1200, 1200],
      startIncomeByRound: [
        { through: 4, amount: 140 },
        { through: 9, amount: 90 },
        { through: 12, amount: 40 }
      ],
      sectorBonuses: { ...sharedCandidate.sectorBonuses, rentMultiplier: 1.1 },
      rentMultiplierByLevel: [0, 1, 1.75, 3],
      upgrade: { costMode: "ratio", ratioByCurrentLevel: { 1: 0.45, 2: 0.7 }, level3RequiresCompleteGroup: true }
      ,botPolicy: { partnershipRate: 0.2, upgradeEnabled: true, upgradeAfterRound: 6, maxUpgradesPerPlayer: 2, reserveCash: 250 }
    },
    botPolicy: { partnershipRate: 0.2, upgradeEnabled: true, upgradeAfterRound: 6, maxUpgradesPerPlayer: 2, reserveCash: 250 }
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
