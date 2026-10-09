"use strict";

const crypto = require("node:crypto");

const CURRENT_RULESET_VERSION = "hangzhou-v2-sector-cautious";

const BOARD = [
  { type: "start", name: "我的公寓", next: [1] },
  { type: "property", name: "龙井茶园", next: [2], price: 120, rent: 28, group: "文旅" },
  { type: "property", visual: "landmark", name: "断桥文旅", next: [3], price: 140, rent: 34, group: "文旅" },
  { type: "property", name: "河坊街铺", next: [4], price: 150, rent: 36, group: "生活" },
  { type: "opportunity", name: "城市机遇卡", next: [5] },
  { type: "property", name: "南宋食坊", next: [6], price: 170, rent: 42, group: "生活" },
  { type: "daily", name: "杭城日常", next: [7] },
  { type: "property", visual: "landmark", name: "大莲花场馆", next: [8], price: 240, rent: 66, group: "文体" },
  { type: "property", name: "城市阳台", next: [9], price: 260, rent: 72, group: "钱塘" },
  { type: "landmark", name: "钱塘潮", next: [10] },
  { type: "transit", name: "地铁换乘", next: [{ to: 11, label: "外环·钱塘线" }, { to: 37, label: "地铁快线" }] },
  { type: "property", name: "钱江创意港", next: [12], price: 230, rent: 62, group: "钱塘" },
  { type: "opportunity", name: "创业机遇卡", next: [13] },
  { type: "property", name: "未来创业营", next: [14], price: 300, rent: 90, group: "科技" },
  { type: "review", name: "项目验收", next: [15] },
  { type: "property", visual: "landmark", name: "良渚文创园", next: [16], price: 220, rent: 58, group: "文旅" },
  { type: "property", name: "良渚陶艺村", next: [17], price: 220, rent: 58, group: "文旅" },
  { type: "vote", name: "城市公投", next: [18] },
  { type: "property", name: "云栖工坊", next: [19], price: 250, rent: 68, group: "科技" },
  { type: "opportunity", name: "人才机遇卡", next: [20] },
  { type: "property", name: "西溪营地", next: [21], price: 210, rent: 54, group: "生态" },
  { type: "park", name: "城市公园", next: [22] },
  { type: "property", name: "运河夜游", next: [23], price: 200, rent: 52, group: "文旅" },
  { type: "property", visual: "landmark", name: "武林夜市", next: [{ to: 24, label: "外环·运河线" }, { to: 28, label: "水上巴士线" }], price: 200, rent: 52, group: "生活" },
  { type: "property", name: "小河市集", next: [25], price: 180, rent: 46, group: "生活" },
  { type: "daily", name: "杭城日常", next: [26] },
  { type: "property", name: "桥西生活馆", next: [27], price: 190, rent: 50, group: "生活" },
  { type: "supply", name: "道具补给站", next: [0] },
  { type: "transit", name: "武林门码头", next: [29], inner: "water", x: 20, y: 28 },
  { type: "property", name: "运河文创", next: [30], price: 200, rent: 54, group: "文旅", inner: "water", x: 34, y: 28 },
  { type: "daily", name: "香积寺晨市", next: [31], inner: "water", x: 40, y: 36 },
  { type: "transit", name: "水上巴士", next: [32], inner: "water", x: 46, y: 44 },
  { type: "opportunity", name: "运河机遇卡", next: [33], inner: "water", x: 46, y: 52 },
  { type: "property", name: "桥西文创园", next: [34], price: 210, rent: 56, group: "文旅", inner: "water", x: 43, y: 60 },
  { type: "transit", name: "拱宸桥码头", next: [35], inner: "water", x: 39, y: 68 },
  { type: "daily", name: "运河灯会", next: [36], inner: "water", x: 35, y: 76 },
  { type: "transit", name: "西湖接驳", next: [2], inner: "water", x: 31, y: 84 },
  { type: "transit", name: "市民中心站", next: [38], inner: "metro", x: 82, y: 58 },
  { type: "property", name: "滨江数创园", next: [39], price: 270, rent: 76, group: "科技", inner: "metro", x: 74, y: 52 },
  { type: "daily", name: "钱江新城", next: [40], inner: "metro", x: 66, y: 46 },
  { type: "transit", name: "地铁快线", next: [41], inner: "metro", x: 60, y: 40 },
  { type: "property", name: "文三数字街", next: [42], price: 240, rent: 66, group: "科技", inner: "metro", x: 58, y: 34 },
  { type: "supply", name: "地铁补给站", next: [43], inner: "metro", x: 60, y: 28 },
  { type: "property", name: "未来路演厅", next: [44], price: 280, rent: 82, group: "科技", inner: "metro", x: 64, y: 22 },
  { type: "transit", name: "未来科技城", next: [17], inner: "metro", x: 60, y: 16 }
];

const DAILY_EVENTS = [
  { text: "消费券到账", cash: 80, influence: 0 },
  { text: "梅雨设备维护", cash: -50, influence: 0 },
  { text: "邻里互助", cash: 40, influence: 1 },
  { text: "城市志愿活动", cash: 0, influence: 2 }
];

const ITEM_CARDS = [
  { id: "coffee", name: "龙井咖啡", copy: "使用后下一次掷骰额外前进 2 格", effect: "dice_bonus" },
  { id: "coupon", name: "城市消费券", copy: "使用后立即获得 120 金币", effect: "cash" },
  { id: "pass", name: "城市通行券", copy: "使用后下一次支付到访分红时减半", effect: "rent_shield" }
];

const DEFAULT_BALANCE = Object.freeze({
  startingCashByTurn: [1500, 1600, 1700, 1800],
  maxRounds: 12,
  startIncomeByRound: [{ through: 12, amount: 200 }],
  rentMultiplierByLevel: [0, 1, 1.75, 2.5],
  completeGroupRentMultiplier: 1.5,
  completeGroupScore: 5,
  sectorBonuses: {
    enabled: false,
    rentMinProjects: 2,
    rentMultiplier: 1.15,
    flagshipMinProjects: 3,
    scoreMinProjects: 4,
    scoreBonus: 3
  },
  ownedProjectScore: 2,
  partneredProjectScore: 1,
  partnershipScore: 1,
  cashScoreDivisor: 300,
  cashScoreCap: 6,
  restructureCash: 200,
  restructureInfluencePenalty: 2,
  overflowItemCash: 60,
  upgrade: {
    costMode: "fixed",
    fixedByCurrentLevel: { 1: 90, 2: 120 },
    ratioByCurrentLevel: { 1: 0.5, 2: 0.8 },
    level3RequiresCompleteGroup: false
  },
  opportunity: {
    safeCash: 40,
    riskCost: 100,
    successChance: 0.6,
    successPayout: 240,
    successInfluence: 1,
    failureInfluence: 0
  },
  reviewCost: 80,
  voteInfluence: 2,
  voteCash: 60
});

function clone(value) { return structuredClone(value); }
function randomInt(random, max) { return Math.floor(random() * max); }
function optionToObject(option, board) { return typeof option === "number" ? { to: option, label: board[option].name } : option; }
function normalizeBalance(input = {}) {
  return {
    ...clone(DEFAULT_BALANCE),
    ...clone(input),
    upgrade: { ...clone(DEFAULT_BALANCE.upgrade), ...clone(input.upgrade || {}) },
    sectorBonuses: { ...clone(DEFAULT_BALANCE.sectorBonuses), ...clone(input.sectorBonuses || {}) },
    opportunity: { ...clone(DEFAULT_BALANCE.opportunity), ...clone(input.opportunity || {}) }
  };
}
function balanceOf(state) { return state.balance || DEFAULT_BALANCE; }
function startIncomeForRound(state) {
  const schedule = balanceOf(state).startIncomeByRound || DEFAULT_BALANCE.startIncomeByRound;
  return (schedule.find(item => item.through == null || state.round <= item.through) || schedule.at(-1) || { amount: 0 }).amount;
}

function migrateGameState(inputState) {
  const state = clone(inputState);
  state.players = (state.players || []).map((player, seat) => ({
    ...player,
    seat: Number.isInteger(player.seat) ? player.seat : seat,
    cash: Number(player.cash ?? 0),
    position: Number.isInteger(player.position) ? player.position : 0,
    influence: Number(player.influence ?? 0),
    properties: Array.isArray(player.properties) ? player.properties : [],
    items: Array.isArray(player.items) ? player.items : [],
    diceBonus: Number(player.diceBonus ?? 0),
    rentShield: Boolean(player.rentShield),
    reviewTurns: Number(player.reviewTurns ?? 0),
    lastUpgradeRound: Number(player.lastUpgradeRound ?? 0),
    trustee: Boolean(player.trustee)
  }));
  state.log = Array.isArray(state.log) ? state.log : [];
  state.pending = state.pending || null;
  state.movement = state.movement || null;
  state.version = Number(state.version || 0);
  state.balance = normalizeBalance(state.balance);
  return state;
}

function createGame(playerInputs, options = {}) {
  if (!Array.isArray(playerInputs) || playerInputs.length < 2 || playerInputs.length > 4) throw new Error("PLAYER_COUNT_OUT_OF_RANGE");
  const balance = normalizeBalance(options.balance);
  const players = playerInputs.map((player, seat) => ({
    id: player.id,
    nickname: player.nickname,
    kind: player.kind || "human",
    seat,
    cash: balance.startingCashByTurn[seat],
    position: 0,
    influence: 0,
    properties: [],
    items: [],
    diceBonus: 0,
    rentShield: false,
    reviewTurns: 0,
    lastUpgradeRound: 0,
    trustee: false
  }));
  return {
    rulesetVersion: options.rulesetVersion || CURRENT_RULESET_VERSION,
    balance,
    version: 0,
    round: 1,
    maxRounds: options.maxRounds || balance.maxRounds,
    currentSeat: Number.isInteger(options.firstSeat) ? options.firstSeat : 0,
    phase: "roll",
    pending: null,
    movement: null,
    finished: false,
    winnerId: null,
    players,
    board: (options.board || BOARD).map((tile, index) => ({ ...tile, index, ownerId: null, partnerId: null, level: 0 })),
    log: [{ type: "GAME_STARTED", text: `${players[Number.isInteger(options.firstSeat) ? options.firstSeat : 0].nickname} 先手` }]
  };
}

function currentPlayer(state) { return state.players[state.currentSeat]; }
function addEvent(events, type, payload = {}) { events.push({ type, payload }); }
function log(state, events, type, text, payload = {}) {
  state.log.unshift({ type, text, ...payload });
  state.log = state.log.slice(0, 50);
  addEvent(events, type, { text, ...payload });
}

function getRent(state, tile) {
  const balance = balanceOf(state);
  let rent = tile.rent * (balance.rentMultiplierByLevel[tile.level] || 1);
  if (balance.sectorBonuses.enabled) {
    const ownerProjects = tile.ownerId ? sectorProjectCount(state, tile.ownerId, tile.group) : 0;
    const partnerProjects = tile.partnerId ? sectorProjectCount(state, tile.partnerId, tile.group) : 0;
    if (Math.max(ownerProjects, partnerProjects) >= balance.sectorBonuses.rentMinProjects) rent *= balance.sectorBonuses.rentMultiplier;
  } else {
    if (tile.ownerId && hasCompleteGroup(state, tile.ownerId, tile.group)) rent *= balance.completeGroupRentMultiplier;
    if (tile.partnerId && hasCompleteGroup(state, tile.partnerId, tile.group)) rent *= balance.completeGroupRentMultiplier;
  }
  return Math.round(rent);
}

function hasCompleteGroup(state, playerId, group) {
  const groupTiles = state.board.filter(tile => tile.type === "property" && tile.group === group);
  return groupTiles.length > 1 && groupTiles.every(tile => tile.ownerId === playerId || tile.partnerId === playerId);
}

function sectorProjectCount(state, playerId, group) {
  return state.board.filter(tile => tile.type === "property" && tile.group === group && (tile.ownerId === playerId || tile.partnerId === playerId)).length;
}

function getUpgradeCost(state, tile) {
  const upgrade = balanceOf(state).upgrade;
  if (upgrade.costMode === "ratio") return Math.ceil(tile.price * Number(upgrade.ratioByCurrentLevel[tile.level] || 0));
  return Number(upgrade.fixedByCurrentLevel[tile.level] || 0);
}

function cityScore(state, player) {
  const balance = balanceOf(state);
  const owned = state.board.filter(tile => tile.type === "property" && (tile.ownerId === player.id || tile.partnerId === player.id));
  const project = owned.reduce((sum, tile) => sum + (tile.partnerId ? balance.partneredProjectScore : balance.ownedProjectScore) + Math.max(0, tile.level - 1), 0);
  const groups = new Set(owned.map(tile => tile.group).filter(group => balance.sectorBonuses.enabled
    ? sectorProjectCount(state, player.id, group) >= balance.sectorBonuses.scoreMinProjects
    : hasCompleteGroup(state, player.id, group))).size;
  const partnerships = owned.filter(tile => tile.partnerId).length;
  const groupScore = balance.sectorBonuses.enabled ? balance.sectorBonuses.scoreBonus : balance.completeGroupScore;
  return player.influence + project + groups * groupScore + partnerships * balance.partnershipScore + Math.min(balance.cashScoreCap, Math.floor(player.cash / balance.cashScoreDivisor));
}

function rankings(state) {
  return [...state.players].sort((a, b) => cityScore(state, b) - cityScore(state, a) || b.cash - a.cash);
}

function restructure(state, player, events) {
  if (player.cash >= 0) return;
  const balance = balanceOf(state);
  player.cash = balance.restructureCash;
  player.influence = Math.max(0, player.influence - balance.restructureInfluencePenalty);
  log(state, events, "PLAYER_RESTRUCTURED", `${player.nickname} 启动城市重组，获得 ${balance.restructureCash} 保底金币`, { playerId: player.id });
}

function resolveTile(state, player, events, random, nowMs) {
  const tile = state.board[player.position];
  log(state, events, "PLAYER_LANDED", `${player.nickname} 来到 ${tile.name}`, { playerId: player.id, tileIndex: tile.index });
  if (tile.type === "property") {
    if (!tile.ownerId && player.cash >= tile.price) {
      state.phase = "decision";
      state.pending = { type: "property", actorId: player.id, tileIndex: tile.index, expiresAt: nowMs + 15000 };
      addEvent(events, "PROPERTY_OFFERED", { playerId: player.id, tileIndex: tile.index, price: tile.price, rent: tile.rent });
      return;
    }
    if (tile.ownerId && tile.ownerId !== player.id && tile.partnerId !== player.id) {
      const baseRent = getRent(state, tile);
      const rent = player.rentShield ? Math.ceil(baseRent / 2) : baseRent;
      const shieldUsed = player.rentShield;
      player.rentShield = false;
      player.cash -= rent;
      if (tile.partnerId) {
        const owner = state.players.find(item => item.id === tile.ownerId);
        const partner = state.players.find(item => item.id === tile.partnerId);
        owner.cash += Math.ceil(rent / 2);
        partner.cash += Math.floor(rent / 2);
      } else state.players.find(item => item.id === tile.ownerId).cash += rent;
      log(state, events, "RENT_PAID", `${player.nickname} 支付到访分红 ${rent}${shieldUsed ? "（通行券减半）" : ""}`, { playerId: player.id, ownerId: tile.ownerId, partnerId: tile.partnerId, tileIndex: tile.index, amount: rent, baseAmount: baseRent, shieldUsed });
      restructure(state, player, events);
    }
  } else if (tile.type === "opportunity") {
    state.phase = "decision";
    state.pending = { type: "opportunity", actorId: player.id, tileIndex: tile.index, expiresAt: nowMs + 15000 };
    addEvent(events, "OPPORTUNITY_OFFERED", { playerId: player.id, tileIndex: tile.index });
    return;
  } else if (tile.type === "review") {
    state.phase = "decision";
    state.pending = { type: "review", actorId: player.id, tileIndex: tile.index, expiresAt: nowMs + 15000 };
    addEvent(events, "REVIEW_OFFERED", { playerId: player.id, tileIndex: tile.index });
    return;
  } else if (tile.type === "vote") {
    state.phase = "decision";
    state.pending = { type: "vote", actorId: player.id, tileIndex: tile.index, expiresAt: nowMs + 15000 };
    addEvent(events, "VOTE_OFFERED", { playerId: player.id, tileIndex: tile.index });
    return;
  } else if (tile.type === "daily") {
    const item = DAILY_EVENTS[randomInt(random, DAILY_EVENTS.length)];
    player.cash += item.cash;
    player.influence += item.influence;
    log(state, events, "DAILY_RESOLVED", `${player.nickname}：${item.text}`, { playerId: player.id, ...item });
    restructure(state, player, events);
  } else if (tile.type === "supply") {
    const card = ITEM_CARDS[randomInt(random, ITEM_CARDS.length)];
    if (player.items.length >= 3) {
      const cash = balanceOf(state).overflowItemCash;
      player.cash += cash;
      log(state, events, "ITEM_CARD_EXCHANGED", `${player.nickname} 的道具栏已满，${card.name} 兑换为 ${cash} 金币`, { playerId: player.id, item: card, cash });
    } else {
      player.items.push(card.id);
      log(state, events, "ITEM_CARD_DRAWN", `${player.nickname} 获得道具卡：${card.name}`, { playerId: player.id, item: card });
    }
  } else if (["landmark", "park", "transit"].includes(tile.type)) {
    const influence = tile.type === "park" || tile.type === "landmark" ? 2 : 1;
    const cash = tile.type === "landmark" ? 100 : tile.type === "park" ? 80 : 40;
    player.cash += cash;
    player.influence += influence;
    const eventType = tile.type === "transit" ? "TRANSIT_VISITED" : tile.type === "park" ? "PARK_VISITED" : "LANDMARK_VISITED";
    const label = tile.type === "transit" ? "交通联运奖励" : tile.type === "park" ? "城市公园奖励" : "城市打卡大奖";
    log(state, events, eventType, `${player.nickname} ${label}：金币 +${cash}，影响力 +${influence}`, { playerId: player.id, tileIndex: tile.index, cash, influence });
  }
  state.phase = "turn_end";
}

function continueMovement(state, events, random, nowMs, chosenNext = null) {
  const player = currentPlayer(state);
  let choice = chosenNext;
  while (state.movement.remaining > 0) {
    const options = state.board[player.position].next.map(item => optionToObject(item, state.board));
    if (options.length > 1 && choice === null) {
      if (state.movement.path.length > 1) {
        addEvent(events, "PLAYER_MOVED", { playerId: player.id, path: state.movement.path });
        state.movement.path = [player.position];
      }
      state.phase = "decision";
      state.pending = { type: "route", actorId: player.id, choices: options, remaining: state.movement.remaining, expiresAt: nowMs + 15000 };
      addEvent(events, "ROUTE_OFFERED", { playerId: player.id, tileIndex: player.position, choices: options });
      return;
    }
    const next = options.length > 1 ? choice : options[0].to;
    choice = null;
    player.position = next;
    state.movement.remaining -= 1;
    state.movement.path.push(next);
    if (next === 0) {
      const amount = startIncomeForRound(state);
      player.cash += amount;
      log(state, events, "START_PASSED", `${player.nickname} 经过我的公寓，月度收入 +${amount}`, { playerId: player.id, amount });
    }
  }
  addEvent(events, "PLAYER_MOVED", { playerId: player.id, path: state.movement.path });
  state.movement = null;
  resolveTile(state, player, events, random, nowMs);
}

function advanceTurn(state, events) {
  state.currentSeat = (state.currentSeat + 1) % state.players.length;
  if (state.currentSeat === 0) state.round += 1;
  if (state.round > state.maxRounds) {
    state.finished = true;
    state.phase = "finished";
    state.finalRanking = rankings(state).map(player => ({ playerId: player.id, score: cityScore(state, player), cash: player.cash }));
    state.winnerId = state.finalRanking[0]?.playerId || null;
    addEvent(events, "GAME_FINISHED", { winnerId: state.winnerId, ranking: state.finalRanking });
  } else {
    state.phase = "roll";
    state.pending = null;
    addEvent(events, "TURN_STARTED", { playerId: currentPlayer(state).id, round: state.round });
  }
}

function applyCommand(inputState, actorId, command, payload = {}, context = {}) {
  const state = migrateGameState(inputState);
  const events = [];
  const random = context.random || Math.random;
  const nowMs = context.nowMs || Date.now();
  const player = state.players.find(item => item.id === actorId);
  if (!player) throw new Error("NOT_IN_GAME");
  if (state.finished) throw new Error("GAME_FINISHED");

  if (command === "END_GAME") {
    const ownerId = context.roomOwnerId || state.players[0]?.id;
    if (actorId !== ownerId) throw new Error("ONLY_OWNER");
    state.finished = true;
    state.phase = "finished";
    state.pending = null;
    state.movement = null;
    state.finishReason = "owner_ended";
    const ranking = rankings(state).map(item => ({ playerId: item.id, score: cityScore(state, item), cash: item.cash }));
    state.winnerId = ranking[0]?.playerId || null;
    state.finalRanking = ranking;
    log(state, events, "GAME_ENDED_EARLY", `${player.nickname} 结束本局，按当前城市分结算`, { playerId: actorId });
    addEvent(events, "GAME_FINISHED", { winnerId: state.winnerId, ranking, reason: state.finishReason });
  } else if (command === "ROLL_DICE") {
    if (state.phase !== "roll") throw new Error("INVALID_PHASE");
    if (currentPlayer(state).id !== actorId) throw new Error("NOT_YOUR_TURN");
    if (player.reviewTurns > 0) {
      player.reviewTurns -= 1;
      player.influence += 1;
      log(state, events, "REVIEW_HELD", `${player.nickname} 停留一回合完成验收`, { playerId: player.id });
      state.phase = "turn_end";
      advanceTurn(state, events);
    } else {
      const baseValue = context.forcedDice || randomInt(random, 6) + 1;
      const bonus = player.diceBonus || 0;
      const dice = baseValue + bonus;
      player.diceBonus = 0;
      addEvent(events, "DICE_ROLLED", { playerId: actorId, value: dice, baseValue, bonus });
      state.phase = "moving";
      state.movement = { remaining: dice, path: [player.position] };
      continueMovement(state, events, random, nowMs);
      if (state.phase === "turn_end") advanceTurn(state, events);
    }
  } else if (command === "USE_ITEM") {
    if (state.phase !== "roll" || currentPlayer(state).id !== actorId) throw new Error("INVALID_PHASE");
    const itemIndex = player.items.indexOf(payload.itemId);
    const item = ITEM_CARDS.find(card => card.id === payload.itemId);
    if (itemIndex < 0 || !item) throw new Error("ITEM_NOT_FOUND");
    player.items.splice(itemIndex, 1);
    if (item.effect === "dice_bonus") player.diceBonus = Math.max(player.diceBonus, 2);
    else if (item.effect === "cash") player.cash += 120;
    else if (item.effect === "rent_shield") player.rentShield = true;
    addEvent(events, "ITEM_CARD_USED", { playerId: actorId, item, cash: player.cash, diceBonus: player.diceBonus, rentShield: player.rentShield });
    log(state, events, "ITEM_CARD_USED_LOG", `${player.nickname} 使用 ${item.name}`, { playerId: actorId, itemId: item.id });
  } else if (command === "CHOOSE_ROUTE") {
    if (state.phase !== "decision" || state.pending?.type !== "route" || state.pending.actorId !== actorId) throw new Error("INVALID_PHASE");
    const choices = state.pending.choices?.length ? state.pending.choices : state.board[player.position]?.next?.map(item => optionToObject(item, state.board)) || [];
    const choice = choices.find(item => item.to === payload.to);
    if (!choice) throw new Error("INVALID_ROUTE");
    if (!state.movement) state.movement = { remaining: Math.max(1, Number(state.pending.remaining || 1)), path: [player.position] };
    state.pending = null;
    state.phase = "moving";
    addEvent(events, "ROUTE_CHOSEN", { playerId: actorId, to: choice.to, label: choice.label });
    continueMovement(state, events, random, nowMs, choice.to);
    if (state.phase === "turn_end") advanceTurn(state, events);
  } else if (command === "BUY_PROPERTY") {
    if (state.phase !== "decision" || state.pending?.type !== "property" || state.pending.actorId !== actorId) throw new Error("INVALID_PHASE");
    const tile = state.board[state.pending.tileIndex];
    if (player.cash < tile.price || tile.ownerId) throw new Error("CANNOT_INVEST");
    player.cash -= tile.price;
    player.properties.push(tile.index);
    tile.ownerId = player.id;
    tile.level = 1;
    log(state, events, "PROPERTY_BOUGHT", `${player.nickname} 投资 ${tile.name} 成功`, { playerId: player.id, tileIndex: tile.index, price: tile.price });
    state.pending = null;
    state.phase = "turn_end";
    advanceTurn(state, events);
  } else if (command === "INVITE_PARTNER") {
    if (state.phase !== "decision" || state.pending?.type !== "property" || state.pending.actorId !== actorId) throw new Error("INVALID_PHASE");
    const target = state.players.find(item => item.id === payload.targetPlayerId && item.id !== actorId);
    const tile = state.board[state.pending.tileIndex];
    const share = Math.ceil(tile.price / 2);
    if (!target || player.cash < share || target.cash < share) throw new Error("INVALID_PARTNER");
    state.phase = "partner_response";
    state.pending = { type: "partner", actorId, targetPlayerId: target.id, tileIndex: tile.index, expiresAt: nowMs + 8000 };
    addEvent(events, "PARTNERSHIP_OFFERED", { buyerId: actorId, targetPlayerId: target.id, tileIndex: tile.index, share, expiresAt: state.pending.expiresAt });
  } else if (command === "ACCEPT_PARTNER" || command === "DECLINE_PARTNER") {
    if (state.phase !== "partner_response" || state.pending?.type !== "partner" || state.pending.targetPlayerId !== actorId) throw new Error("INVALID_PHASE");
    const buyer = state.players.find(item => item.id === state.pending.actorId);
    const tile = state.board[state.pending.tileIndex];
    if (command === "ACCEPT_PARTNER") {
      const share = Math.ceil(tile.price / 2);
      if (buyer.cash < share || player.cash < share) throw new Error("CANNOT_PARTNER");
      buyer.cash -= share;
      player.cash -= share;
      buyer.properties.push(tile.index);
      player.properties.push(tile.index);
      tile.ownerId = buyer.id;
      tile.partnerId = player.id;
      tile.level = 1;
      log(state, events, "PARTNERSHIP_ACCEPTED", `${buyer.nickname} 与 ${player.nickname} 合伙建设 ${tile.name}`, { buyerId: buyer.id, partnerId: player.id, tileIndex: tile.index, share });
      state.pending = null;
      state.phase = "turn_end";
      advanceTurn(state, events);
    } else {
      addEvent(events, "PARTNERSHIP_DECLINED", { buyerId: buyer.id, targetPlayerId: player.id, tileIndex: tile.index });
      state.phase = "decision";
      state.pending = { type: "property", actorId: buyer.id, tileIndex: tile.index, partnerDeclined: true, expiresAt: nowMs + 7000 };
    }
  } else if (command === "SKIP_PROPERTY") {
    if (state.phase !== "decision" || state.pending?.type !== "property" || state.pending.actorId !== actorId) throw new Error("INVALID_PHASE");
    state.pending = null;
    state.phase = "turn_end";
    addEvent(events, "PROPERTY_SKIPPED", { playerId: actorId });
    advanceTurn(state, events);
  } else if (command === "UPGRADE_PROPERTY") {
    if (state.phase !== "roll" || currentPlayer(state).id !== actorId) throw new Error("INVALID_PHASE");
    const tile = state.board[payload.tileIndex];
    if (!tile || tile.type !== "property" || ![tile.ownerId, tile.partnerId].includes(actorId) || tile.level >= 3) throw new Error("CANNOT_UPGRADE");
    if (tile.level === 2 && balanceOf(state).upgrade.level3RequiresCompleteGroup) {
      const balance = balanceOf(state);
      const unlocked = balance.sectorBonuses.enabled
        ? sectorProjectCount(state, actorId, tile.group) >= balance.sectorBonuses.flagshipMinProjects
        : hasCompleteGroup(state, actorId, tile.group);
      if (!unlocked) throw new Error("COMPLETE_GROUP_REQUIRED");
    }
    const cost = getUpgradeCost(state, tile);
    if (player.cash < cost) throw new Error("INSUFFICIENT_FUNDS");
    player.cash -= cost;
    tile.level += 1;
    player.lastUpgradeRound = state.round;
    log(state, events, "PROPERTY_UPGRADED", `${player.nickname} 将 ${tile.name} 建设到 ${tile.level} 级`, { playerId: actorId, tileIndex: tile.index, level: tile.level, cost });
  } else if (command === "CHOOSE_OPPORTUNITY") {
    if (state.phase !== "decision" || state.pending?.type !== "opportunity" || state.pending.actorId !== actorId) throw new Error("INVALID_PHASE");
    let outcome;
    const opportunity = balanceOf(state).opportunity;
    if (payload.choice === "risk") {
      player.cash -= opportunity.riskCost;
      if (random() < opportunity.successChance) {
        player.cash += opportunity.successPayout;
        player.influence += opportunity.successInfluence;
        outcome = `冒险成功，净赚 ${opportunity.successPayout - opportunity.riskCost} 金币并获得 ${opportunity.successInfluence} 影响力`;
      } else {
        player.influence = Math.max(0, player.influence + opportunity.failureInfluence);
        outcome = `冒险未达预期，投入 ${opportunity.riskCost} 金币`;
      }
    } else { player.cash += opportunity.safeCash; outcome = `稳妥接单，获得 ${opportunity.safeCash} 金币`; }
    log(state, events, "OPPORTUNITY_RESOLVED", `${player.nickname} 翻开机遇卡：${outcome}`, { playerId: actorId, choice: payload.choice, cash: player.cash, influence: player.influence });
    state.pending = null;
    state.phase = "turn_end";
    restructure(state, player, events);
    advanceTurn(state, events);
  } else if (command === "CHOOSE_REVIEW") {
    if (state.phase !== "decision" || state.pending?.type !== "review" || state.pending.actorId !== actorId) throw new Error("INVALID_PHASE");
    const reviewCost = balanceOf(state).reviewCost;
    if (payload.choice === "pay" && player.cash >= reviewCost) player.cash -= reviewCost;
    else player.reviewTurns = 1;
    addEvent(events, "REVIEW_RESOLVED", { playerId: actorId, choice: payload.choice, reviewTurns: player.reviewTurns });
    state.pending = null;
    state.phase = "turn_end";
    advanceTurn(state, events);
  } else if (command === "CHOOSE_VOTE") {
    if (state.phase !== "decision" || state.pending?.type !== "vote" || state.pending.actorId !== actorId) throw new Error("INVALID_PHASE");
    const balance = balanceOf(state);
    if (payload.choice === "tourism") player.influence += balance.voteInfluence;
    else state.players.forEach(item => { item.cash += balance.voteCash; });
    addEvent(events, "VOTE_RESOLVED", { playerId: actorId, choice: payload.choice });
    state.pending = null;
    state.phase = "turn_end";
    advanceTurn(state, events);
  } else throw new Error("UNKNOWN_COMMAND");

  state.version += 1;
  return { state, events };
}

function getBotCommand(state, playerId, random = Math.random) {
  const player = state.players.find(item => item.id === playerId);
  if (!player || (player.kind !== "bot" && !player.trustee)) return null;
  if (state.phase === "roll" && currentPlayer(state).id === playerId) {
    if ((player.items || []).length) return { command: "USE_ITEM", payload: { itemId: player.items[0] } };
    const policy = balanceOf(state).botPolicy;
    if (policy?.upgradeEnabled && state.round >= policy.upgradeAfterRound) {
      const upgrades = state.board.filter(tile => [tile.ownerId, tile.partnerId].includes(playerId)).reduce((sum, tile) => sum + Math.max(0, tile.level - 1), 0);
      if (upgrades < policy.maxUpgradesPerPlayer && player.lastUpgradeRound !== state.round) {
        const candidate = state.board.find(tile => tile.type === "property" && [tile.ownerId, tile.partnerId].includes(playerId) && tile.level < 3 && player.cash - getUpgradeCost(state, tile) >= policy.reserveCash && (tile.level < 2 || !state.balance.upgrade.level3RequiresCompleteGroup || sectorProjectCount(state, playerId, tile.group) >= state.balance.sectorBonuses.flagshipMinProjects));
        if (candidate) return { command: "UPGRADE_PROPERTY", payload: { tileIndex: candidate.index } };
      }
    }
    return { command: "ROLL_DICE", payload: {} };
  }
  if (state.pending?.actorId === playerId) {
    if (state.pending.type === "route") return { command: "CHOOSE_ROUTE", payload: { to: state.pending.choices[randomInt(random, state.pending.choices.length)].to } };
    if (state.pending.type === "property") {
      const tile = state.board[state.pending.tileIndex];
      const policy = balanceOf(state).botPolicy;
      if (policy?.partnershipRate && random() < policy.partnershipRate) {
        const share = Math.ceil(tile.price / 2);
        const target = state.players.filter(item => item.id !== playerId && item.cash - share >= policy.reserveCash).sort((a,b)=>b.cash-a.cash)[0];
        if (target && player.cash - share >= policy.reserveCash) return { command: "INVITE_PARTNER", payload: { targetPlayerId: target.id } };
      }
      return player.cash - tile.price >= 400 ? { command: "BUY_PROPERTY", payload: {} } : { command: "SKIP_PROPERTY", payload: {} };
    }
    if (state.pending.type === "opportunity") return { command: "CHOOSE_OPPORTUNITY", payload: { choice: player.cash > 500 ? "risk" : "safe" } };
    if (state.pending.type === "review") return { command: "CHOOSE_REVIEW", payload: { choice: player.cash > 700 ? "pay" : "wait" } };
    if (state.pending.type === "vote") return { command: "CHOOSE_VOTE", payload: { choice: "coupon" } };
  }
  if (state.phase === "partner_response" && state.pending?.targetPlayerId === playerId) {
    const policy = balanceOf(state).botPolicy;
    const tile = state.board[state.pending.tileIndex], share = Math.ceil(tile.price / 2);
    return { command: player.cash - share >= (policy?.reserveCash || 400) ? "ACCEPT_PARTNER" : "DECLINE_PARTNER", payload: {} };
  }
  return null;
}

function getTimeoutCommand(state) {
  const pending = state?.pending;
  if (!pending) return null;
  if (pending.type === "route") {
    const actor = state.players?.find(player => player.id === pending.actorId);
    const choices = pending.choices?.length ? pending.choices : state.board?.[actor?.position]?.next?.map(item => optionToObject(item, state.board)) || [];
    return choices.length ? { actorId: pending.actorId, command: "CHOOSE_ROUTE", payload: { to: choices[0].to } } : null;
  }
  if (pending.type === "property") return { actorId: pending.actorId, command: "SKIP_PROPERTY", payload: {} };
  if (pending.type === "opportunity") return { actorId: pending.actorId, command: "CHOOSE_OPPORTUNITY", payload: { choice: "safe" } };
  if (pending.type === "review") return { actorId: pending.actorId, command: "CHOOSE_REVIEW", payload: { choice: "wait" } };
  if (pending.type === "vote") return { actorId: pending.actorId, command: "CHOOSE_VOTE", payload: { choice: "coupon" } };
  if (pending.type === "partner") return { actorId: pending.targetPlayerId, command: "DECLINE_PARTNER", payload: {} };
  return null;
}

function stateHash(state) { return crypto.createHash("sha256").update(JSON.stringify(state)).digest("hex"); }

module.exports = { CURRENT_RULESET_VERSION, DEFAULT_BALANCE, BOARD, DAILY_EVENTS, ITEM_CARDS, createGame, migrateGameState, applyCommand, getBotCommand, getTimeoutCommand, getRent, getUpgradeCost, hasCompleteGroup, sectorProjectCount, cityScore, rankings, stateHash };
