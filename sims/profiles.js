"use strict";

const { BOARD } = require("../game-core");

const sectorByProject = new Map(Object.entries({
  龙井茶园: "文旅消费", 断桥文旅: "文旅消费", 良渚文创园: "文旅消费", 运河夜游: "文旅消费", 桥西文创园: "文旅消费",
  未来创业营: "数字科技", 云栖工坊: "数字科技", 滨江数创园: "数字科技", 文三数字街: "数字科技", 未来路演厅: "数字科技",
  河坊街铺: "城市生活", 南宋食坊: "城市生活", 武林夜市: "城市生活", 小河市集: "城市生活", 桥西生活馆: "城市生活",
  城市阳台: "钱塘发展", 钱江创意港: "钱塘发展", 大莲花场馆: "钱塘发展", 钱塘会展中心: "钱塘发展", 滨江国际社区: "钱塘发展",
  良渚陶艺村: "生态文体", 西溪营地: "生态文体", 运河文创: "生态文体", 运河运动公园: "生态文体", 大运河艺术馆: "生态文体"
}));

function cubicPoint(start, controlA, controlB, end, progress) {
  const remaining = 1 - progress;
  return {
    x: remaining ** 3 * start.x + 3 * remaining ** 2 * progress * controlA.x + 3 * remaining * progress ** 2 * controlB.x + progress ** 3 * end.x,
    y: remaining ** 3 * start.y + 3 * remaining ** 2 * progress * controlA.y + 3 * remaining * progress ** 2 * controlB.y + progress ** 3 * end.y
  };
}

function equallySpacedCurve(start, controlA, controlB, end, count) {
  const samples = [{ progress: 0, point: start, distance: 0 }];
  let previous = start, total = 0;
  for (let step = 1; step <= 500; step += 1) {
    const progress = step / 500, point = cubicPoint(start, controlA, controlB, end, progress);
    total += Math.hypot(point.x - previous.x, point.y - previous.y);
    samples.push({ progress, point, distance: total });
    previous = point;
  }
  return Array.from({ length: count }, (_, index) => {
    const target = total * (index + 1) / (count + 1);
    const upperIndex = samples.findIndex(sample => sample.distance >= target);
    const lower = samples[upperIndex - 1], upper = samples[upperIndex];
    const ratio = (target - lower.distance) / Math.max(Number.EPSILON, upper.distance - lower.distance);
    const progress = lower.progress + (upper.progress - lower.progress) * ratio;
    const point = cubicPoint(start, controlA, controlB, end, progress);
    return { x: Number(point.x.toFixed(2)), y: Number(point.y.toFixed(2)) };
  });
}

function fiveSectorsOfFive() {
  const board = BOARD.map(tile => ({ ...tile, next: tile.next.map(value => typeof value === "object" ? { ...value } : value) }));
  const newProjects = [
    { type: "property", visual: "project_expo", name: "钱塘会展中心", next: [31], price: 280, rent: 78, group: "钱塘发展" },
    { type: "property", visual: "project_sports", name: "运河运动公园", next: [35], price: 230, rent: 62, group: "生态文体" },
    { type: "property", visual: "project_community", name: "滨江国际社区", next: [3], price: 270, rent: 74, group: "钱塘发展" },
    { type: "property", visual: "project_art", name: "大运河艺术馆", next: [39], price: 220, rent: 58, group: "生态文体" }
  ];
  board.push(...newProjects);
  board[29].next = [45];
  board[33].next = [46];
  board[38].next = [48];
  board[39].next = [30];
  board[30].next = [40];
  board[41].next = [34];
  board[34].next = [44];
  board[2].next = [47];
  board[13].next = [42]; board[42].next = [14];
  board[24].next = [43]; board[43].next = [25];
  const routeDefinitions = [
    { inner: "water", indexes: [28,29,45,31,32,33,46,35,36], points: equallySpacedCurve({x:8,y:32},{x:32,y:18},{x:74,y:64},{x:32,y:92},9) },
    { inner: "metro", indexes: [37,38,48,39,30,40,41,34,44], points: equallySpacedCurve({x:92,y:56},{x:78,y:68},{x:47,y:48},{x:56,y:8},9) }
  ];
  for (const route of routeDefinitions) route.indexes.forEach((index, offset) => Object.assign(board[index], { inner: route.inner, ...route.points[offset] }));
  for (const [index, [x,y]] of Object.entries({ 42:[86,14],43:[14,50],47:[38,86] })) { Object.assign(board[Number(index)], { x, y }); delete board[Number(index)].inner; }
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
    rulesetVersion: "hangzhou-v3-city-events",
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
