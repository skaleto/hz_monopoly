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
  const sourceBoard = BOARD.map(tile => ({ ...tile, next: tile.next.map(value => typeof value === "object" ? { ...value } : value) }));
  const newProjects = [
    { type: "property", visual: "project_expo", name: "钱塘会展中心", next: [31], price: 280, rent: 78, group: "钱塘发展" },
    { type: "property", visual: "project_sports", name: "运河运动公园", next: [35], price: 230, rent: 62, group: "生态文体" },
    { type: "property", visual: "project_community", name: "滨江国际社区", next: [3], price: 270, rent: 74, group: "钱塘发展" },
    { type: "property", visual: "project_art", name: "大运河艺术馆", next: [39], price: 220, rent: 58, group: "生态文体" }
  ];
  sourceBoard.push(...newProjects);

  // M4 删除 13 个无独立效果的纯路线节点，保留全部 25 项目、8 事件、2 补给与起点。
  // 新棋盘为 27 节点主环 + 水线 4 节点 + 地铁 5 节点，共 36 个有效节点。
  const layout = require("./board-layout.json");
  const RING_SOURCE = [0, 1, 2, 47, 3, 4, 5, 32, 6, 7, 8, 46, 11, 12, 13, 15, 16, 18, 19, 20, 22, 23, 24, 43, 26, 42, 27];
  const WATER_SOURCE = [29, 45, 33, 25];
  const METRO_SOURCE = [38, 48, 39, 41, 14];
  const sourceOrder = [...RING_SOURCE, ...WATER_SOURCE, ...METRO_SOURCE];
  const newIndex = new Map(sourceOrder.map((sourceIndex, index) => [sourceIndex, index]));
  const eventIndices = new Set([4, 6, 12, 14, 19, 25, 32, 39]);
  const candidateBoard = sourceOrder.map((sourceIndex, index) => {
    const tile = sourceBoard[sourceIndex];
    const activeType = tile.type === "property" ? "property" : tile.type === "supply" ? "supply" : eventIndices.has(sourceIndex) ? "event" : "route";
    const candidate = {
      ...tile,
      type: activeType,
      next: [],
      name: tile.name.replace("杭城日常", "杭城事件").replace("机遇卡", "事件"),
      ...(tile.type === "review" ? { eventId: "project_review" } : {})
    };
    delete candidate.inner;
    const group = sectorByProject.get(candidate.name);
    const positioned = group ? { ...candidate, group } : candidate;
    if (index < RING_SOURCE.length) Object.assign(positioned, layout.ring[index]);
    else if (index < RING_SOURCE.length + WATER_SOURCE.length) Object.assign(positioned, layout.water[index], { inner: "water" });
    else Object.assign(positioned, layout.metro[index], { inner: "metro" });
    return positioned;
  });

  const ringIndexes = RING_SOURCE.map(sourceIndex => newIndex.get(sourceIndex));
  ringIndexes.forEach((index, position) => { candidateBoard[index].next = [ringIndexes[(position + 1) % ringIndexes.length]]; });
  const waterIndexes = WATER_SOURCE.map(sourceIndex => newIndex.get(sourceIndex));
  const metroIndexes = METRO_SOURCE.map(sourceIndex => newIndex.get(sourceIndex));
  const waterEntry = newIndex.get(22), waterExit = newIndex.get(2), metroEntry = newIndex.get(46), metroExit = newIndex.get(18);
  candidateBoard[waterEntry].next = [{ to: candidateBoard[waterEntry].next[0], label: "外环·运河线" }, { to: waterIndexes[0], label: "水上巴士线" }];
  candidateBoard[metroEntry].next = [{ to: candidateBoard[metroEntry].next[0], label: "外环·钱塘线" }, { to: metroIndexes[0], label: "地铁快线" }];
  waterIndexes.forEach((index, position) => { candidateBoard[index].next = [position === waterIndexes.length - 1 ? waterExit : waterIndexes[position + 1]]; });
  metroIndexes.forEach((index, position) => { candidateBoard[index].next = [position === metroIndexes.length - 1 ? metroExit : metroIndexes[position + 1]]; });

  const projects = candidateBoard.filter(tile => tile.type === "property");
  const counts = new Map();
  for (const tile of projects) counts.set(tile.group, (counts.get(tile.group) || 0) + 1);
  const typeCounts = new Map();
  for (const tile of candidateBoard) typeCounts.set(tile.type, (typeCounts.get(tile.type) || 0) + 1);
  if (candidateBoard.length !== 36 || projects.length !== 25 || counts.size !== 5 || [...counts.values()].some(count => count !== 5)) throw new Error("INVALID_FIVE_SECTOR_BOARD");
  if (typeCounts.size !== 4 || typeCounts.get("event") !== 8 || typeCounts.get("supply") !== 2 || typeCounts.get("route") !== 1) throw new Error("INVALID_FOCUSED_NODE_TYPES");
  return candidateBoard;
}

const sharedCandidate = {
  maxRounds: 30,
  completeGroupRentMultiplier: 1,
  sectorBonuses: {
    enabled: true,
    rentMinProjects: 2,
    rentMultiplier: 1.15,
    flagshipMinProjects: 3,
    monopolyMinProjects: 5,
    monopolyRentMultiplier: 1.25
  },
  startIncomeByRound: [
    { through: 10, amount: 160 },
    { through: 25, amount: 120 },
    { through: 30, amount: 80 }
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
    label: "M4 focused 30-round loop",
    rulesetVersion: "hangzhou-v5-focused-loop",
    board: fiveSectorsOfFive(),
    balance: {
      ...sharedCandidate,
      startingCashByTurn: [1880, 1980, 2180, 2230],
      startIncomeByRound: [{ through: 10, amount: 300 }, { through: 25, amount: 260 }, { through: 30, amount: 220 }],
      sectorBonuses: { ...sharedCandidate.sectorBonuses, rentMultiplier: 1.06 },
      rentMultiplierByLevel: [0, 1, 1.4, 1.8],
      upgrade: { costMode: "ratio", ratioByCurrentLevel: { 1: 0.45, 2: 0.7 }, level3RequiresCompleteGroup: true }
      ,botPolicy: { partnershipRate: 0.2, upgradeEnabled: true, upgradeAfterRound: 8, maxUpgradesPerPlayer: 8, reserveCash: 700 }
    },
    botPolicy: { partnershipRate: 0.2, upgradeEnabled: true, upgradeAfterRound: 8, maxUpgradesPerPlayer: 8, reserveCash: 700 }
  },
  target: {
    label: "M2 sector target",
    rulesetVersion: "hangzhou-v2-sector-target",
    board: fiveSectorsOfFive(),
    balance: {
      ...sharedCandidate,
      maxRounds: 12,
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
      maxRounds: 12,
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
