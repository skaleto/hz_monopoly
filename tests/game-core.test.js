"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { CURRENT_RULESET_VERSION, BOARD, CITY_EVENTS, ITEM_CARDS, createGame, migrateGameState, applyCommand, getBotCommand, getTimeoutCommand, getRent, getUpgradeCost, cityScore, stateHash } = require("../game-core");
const { fiveSectorsOfFive } = require("../sims/profiles");

const players = [
  { id: "u1", nickname: "桃桃", kind: "human" },
  { id: "u2", nickname: "青团", kind: "human" },
  { id: "b1", nickname: "小蓝", kind: "bot" }
];

test("only supports 2 to 4 total seats", () => {
  assert.throws(() => createGame([players[0]]), /PLAYER_COUNT_OUT_OF_RANGE/);
  assert.equal(createGame(players).players.length, 3);
  assert.throws(() => createGame([...players, players[0], players[1]]), /PLAYER_COUNT_OUT_OF_RANGE/);
});

test("new games stamp the single current ruleset version", () => {
  assert.equal(CURRENT_RULESET_VERSION, "hangzhou-v3-city-events");
  assert.equal(createGame(players).rulesetVersion, CURRENT_RULESET_VERSION);
});

test("new games preserve and announce the randomized turn order", () => {
  const game = createGame(players, { firstSeat: 2 });
  assert.equal(game.firstSeat, 2);
  assert.equal(game.currentSeat, 2);
  assert.deepEqual(game.turnOrder, ["b1", "u1", "u2"]);
  assert.equal(game.log[0].text, "本局行动顺序：1.小蓝 → 2.桃桃 → 3.青团");
  assert.deepEqual(migrateGameState({ ...game, turnOrder: undefined }).turnOrder, game.turnOrder);
});

test("balance profiles are explicit while the default M1 behavior stays unchanged", () => {
  const defaultGame = createGame(players.slice(0, 2));
  assert.deepEqual(defaultGame.players.map(player => player.cash), [1500, 1600]);
  defaultGame.board[1].ownerId = "u1";
  defaultGame.board[1].level = 2;
  assert.equal(getRent(defaultGame, defaultGame.board[1]), 49);
  assert.equal(getUpgradeCost(defaultGame, defaultGame.board[1]), 120);

  const candidate = createGame(players.slice(0, 2), { balance: {
    startingCashByTurn: [1400, 1500, 1600, 1700],
    rentMultiplierByLevel: [0, 1, 2, 4],
    completeGroupRentMultiplier: 1,
    upgrade: { costMode: "ratio", ratioByCurrentLevel: { 1: 0.5, 2: 0.8 }, level3RequiresCompleteGroup: true }
  } });
  assert.deepEqual(candidate.players.map(player => player.cash), [1400, 1500]);
  candidate.board[1].ownerId = "u1";
  candidate.board[1].level = 2;
  assert.equal(getRent(candidate, candidate.board[1]), 56);
  assert.equal(getUpgradeCost(candidate, candidate.board[1]), 96);
});

test("candidate balance can require a complete group before level three", () => {
  let game = createGame(players.slice(0, 2), { balance: {
    upgrade: { costMode: "ratio", ratioByCurrentLevel: { 1: 0.5, 2: 0.8 }, level3RequiresCompleteGroup: true }
  } });
  const groupTiles = game.board.filter(tile => tile.type === "property" && tile.group === "钱塘");
  assert.equal(groupTiles.length, 2);
  groupTiles[0].ownerId = "u1";
  groupTiles[0].level = 2;
  game.players[0].properties.push(groupTiles[0].index);
  assert.throws(() => applyCommand(game, "u1", "UPGRADE_PROPERTY", { tileIndex: groupTiles[0].index }), /COMPLETE_GROUP_REQUIRED/);
  groupTiles[1].ownerId = "u1";
  game.players[0].properties.push(groupTiles[1].index);
  game.players[0].cash = 1000;
  const upgraded = applyCommand(game, "u1", "UPGRADE_PROPERTY", { tileIndex: groupTiles[0].index });
  assert.equal(upgraded.state.board[groupTiles[0].index].level, 3);
});

test("sector bonuses unlock by project count without requiring the whole sector", () => {
  let game = createGame(players.slice(0, 2), {
    board: fiveSectorsOfFive(),
    balance: {
      completeGroupRentMultiplier: 1,
      sectorBonuses: { enabled: true, rentMinProjects: 2, rentMultiplier: 1.15, flagshipMinProjects: 3, scoreMinProjects: 4, scoreBonus: 3 },
      upgrade: { costMode: "ratio", ratioByCurrentLevel: { 1: 0.5, 2: 0.8 }, level3RequiresCompleteGroup: true }
    }
  });
  const sector = game.board.filter(tile => tile.type === "property" && tile.group === "文旅消费");
  assert.equal(sector.length, 5);
  sector[0].ownerId = "u1";
  sector[1].partnerId = "u1";
  assert.equal(getRent(game, sector[0]), Math.round(sector[0].rent * 1.15));
  sector[0].level = 2;
  assert.throws(() => applyCommand(game, "u1", "UPGRADE_PROPERTY", { tileIndex: sector[0].index }), /COMPLETE_GROUP_REQUIRED/);
  sector[2].ownerId = "u1";
  game.players[0].cash = 1000;
  const upgraded = applyCommand(game, "u1", "UPGRADE_PROPERTY", { tileIndex: sector[0].index });
  assert.equal(upgraded.state.board[sector[0].index].level, 3);
});

test("sector unlock events state the concrete benefit", () => {
  const game = createGame(players.slice(0, 2), {
    board: fiveSectorsOfFive(),
    balance: { sectorBonuses: { enabled: true, rentMinProjects: 2, rentMultiplier: 1.1, flagshipMinProjects: 3, scoreMinProjects: 4, scoreBonus: 3 } }
  });
  const sector = game.board.filter(tile => tile.type === "property" && tile.group === "文旅消费");
  sector[0].ownerId = "u1";
  sector[0].level = 1;
  game.players[0].properties.push(sector[0].index);
  game.phase = "decision";
  game.pending = { type: "property", actorId: "u1", tileIndex: sector[1].index };
  const result = applyCommand(game, "u1", "BUY_PROPERTY");
  const unlocked = result.events.find(event => event.type === "SECTOR_TIER_UNLOCKED");
  assert.equal(unlocked.payload.benefit, "本板块到访分红 +10%");
  assert.match(unlocked.payload.text, /文旅消费达到 2\/5：本板块到访分红 \+10%/);
});

test("server decides dice and rejects non-current player", () => {
  const game = createGame(players);
  assert.throws(() => applyCommand(game, "u2", "ROLL_DICE", {}, { random: () => 0 }), /NOT_YOUR_TURN/);
  const result = applyCommand(game, "u1", "ROLL_DICE", {}, { random: () => 0, nowMs: 1 });
  assert.equal(result.events[0].type, "DICE_ROLLED");
  assert.equal(result.events[0].payload.value, 1);
  assert.equal(result.state.players[0].position, 1);
  assert.equal(result.state.pending.type, "property");
});

test("purchase is authoritative and advances to next seat", () => {
  let game = createGame(players);
  game = applyCommand(game, "u1", "ROLL_DICE", {}, { nowMs: 1, forcedDice: 1 }).state;
  const before = game.players[0].cash;
  const result = applyCommand(game, "u1", "BUY_PROPERTY", {}, { nowMs: 2 });
  assert.equal(result.state.board[1].ownerId, "u1");
  assert.equal(result.state.players[0].cash, before - 120);
  assert.equal(result.state.currentSeat, 1);
});

test("investment is the core board loop and landmark projects keep varied visuals", () => {
  assert.ok(BOARD.filter(tile => tile.type === "property").length >= 21);
  assert.equal(BOARD.filter(tile => tile.type === "property" && tile.visual === "landmark").length, 4);
  const landmark = BOARD.find(tile => tile.type === "landmark");
  assert.equal(landmark.name, "钱塘潮");
});

test("the remaining city landmark grants a meaningful reward", () => {
  let game = createGame(players.slice(0, 2));
  game.players[0].position = 8;
  const before = { cash: game.players[0].cash, influence: game.players[0].influence };
  const result = applyCommand(game, "u1", "ROLL_DICE", {}, { nowMs: 1, forcedDice: 1 });
  assert.equal(result.state.players[0].cash, before.cash + 100);
  assert.equal(result.state.players[0].influence, before.influence + 2);
  assert.ok(result.events.some(event => event.type === "LANDMARK_VISITED"));
});

test("daily events state their exact cash and influence changes", () => {
  const game = createGame(players.slice(0, 2));
  game.players[0].position = 5;
  const before = game.players[0].cash;
  const result = applyCommand(game, "u1", "ROLL_DICE", {}, { nowMs: 1, forcedDice: 1, random: () => 0.26 });
  const daily = result.events.find(event => event.type === "DAILY_RESOLVED");
  assert.equal(result.state.players[0].cash, before - 50);
  assert.equal(daily.payload.text, "桃桃 遇到梅雨季设备检修：金币 -50");
});

test("current board unifies daily and opportunity nodes into one city event deck", () => {
  const board = fiveSectorsOfFive();
  assert.equal(board.filter(tile => tile.type === "event").length, 9);
  assert.equal(board.filter(tile => ["daily", "opportunity"].includes(tile.type)).length, 0);
  assert.equal(CITY_EVENTS.length, 12);
  assert.equal(new Set(CITY_EVENTS.map(item => item.effect)).size >= 7, true);
});

test("city events support meaningful loss, global impact and a risk choice", () => {
  let game = createGame(players.slice(0, 2), { board: fiveSectorsOfFive() });
  game.players[0].position = 3;
  const before = game.players[0].cash;
  let result = applyCommand(game, "u1", "ROLL_DICE", {}, { nowMs: 1, forcedDice: 1, forcedCityEventId: "rain_repair" });
  assert.equal(result.state.players[0].cash, before - 180);
  assert.match(result.events.find(event => event.type === "CITY_EVENT_RESOLVED").payload.text, /梅雨抢修/);

  game = createGame(players.slice(0, 2), { board: fiveSectorsOfFive() });
  game.players[0].position = 3;
  result = applyCommand(game, "u1", "ROLL_DICE", {}, { nowMs: 1, forcedDice: 1, forcedCityEventId: "venture_window" });
  assert.equal(result.state.pending.type, "city_event");
  const resolved = applyCommand(result.state, "u1", "CHOOSE_CITY_EVENT", { choice: "safe" }, { nowMs: 2, random: () => 0 });
  assert.equal(resolved.state.players[0].cash, 1560);
  assert.ok(resolved.events.some(event => event.type === "CITY_EVENT_RESOLVED"));
});

test("project review requires an even roll to leave and then moves by that roll", () => {
  let game = createGame(players.slice(0, 2), { board: fiveSectorsOfFive() });
  game.players[0].position = 13;
  game = applyCommand(game, "u1", "ROLL_DICE", {}, { nowMs: 1, forcedDice: 1 }).state;
  assert.equal(game.players[0].reviewDetained, true);
  game.currentSeat = 0; game.phase = "roll";
  let attempt = applyCommand(game, "u1", "ROLL_DICE", {}, { nowMs: 2, forcedDice: 3 });
  assert.equal(attempt.state.players[0].position, 14);
  assert.equal(attempt.state.players[0].reviewDetained, true);
  assert.ok(attempt.events.some(event => event.type === "REVIEW_HELD"));
  attempt.state.currentSeat = 0; attempt.state.phase = "roll";
  const released = applyCommand(attempt.state, "u1", "ROLL_DICE", {}, { nowMs: 3, forcedDice: 4 });
  assert.equal(released.state.players[0].reviewDetained, false);
  assert.notEqual(released.state.players[0].position, 14);
  assert.ok(released.events.some(event => event.type === "REVIEW_RELEASED"));
});

test("human partnership requires target acceptance", () => {
  let game = createGame(players.slice(0, 2));
  game = applyCommand(game, "u1", "ROLL_DICE", {}, { nowMs: 1, forcedDice: 1 }).state;
  game = applyCommand(game, "u1", "INVITE_PARTNER", { targetPlayerId: "u2" }, { nowMs: 2 }).state;
  assert.equal(game.phase, "partner_response");
  const result = applyCommand(game, "u2", "ACCEPT_PARTNER", {}, { nowMs: 3 });
  assert.equal(result.state.board[1].ownerId, "u1");
  assert.equal(result.state.board[1].partnerId, "u2");
});

test("route decision reaches the selected inner line", () => {
  let game = createGame(players.slice(0, 2));
  game.players[0].position = 23;
  game = applyCommand(game, "u1", "ROLL_DICE", {}, { nowMs: 1, forcedDice: 1 }).state;
  assert.equal(game.pending.type, "route");
  const result = applyCommand(game, "u1", "CHOOSE_ROUTE", { to: 28 }, { nowMs: 2 });
  assert.equal(result.state.players[0].position, 28);
});

test("passing apartment grants monthly income", () => {
  let game = createGame(players.slice(0, 2));
  game.players[0].position = 27;
  const before = game.players[0].cash;
  const result = applyCommand(game, "u1", "ROLL_DICE", {}, { nowMs: 1, forcedDice: 2 });
  assert.equal(result.state.players[0].cash, before + 200);
  assert.ok(result.events.some(event => event.type === "START_PASSED"));
});

test("bot command chooses a legal action", () => {
  let game = createGame([{ id: "u1", nickname: "桃桃", kind: "human" }, { id: "b1", nickname: "青团", kind: "bot" }]);
  game.currentSeat = 1;
  const command = getBotCommand(game, "b1", () => 0);
  assert.equal(command.command, "ROLL_DICE");
});

test("bot resolves an opportunity card and returns control instead of stalling", () => {
  let game = createGame([{ id: "u1", nickname: "桃桃", kind: "human" }, { id: "b1", nickname: "青团", kind: "bot" }]);
  game.currentSeat = 1;
  game.players[1].position = 3;
  game = applyCommand(game, "b1", "ROLL_DICE", {}, { nowMs: 1, forcedDice: 1, random: () => 0 }).state;
  assert.equal(game.pending.type, "opportunity");
  const choice = getBotCommand(game, "b1", () => 0);
  assert.equal(choice.command, "CHOOSE_OPPORTUNITY");
  const resolved = applyCommand(game, "b1", choice.command, choice.payload, { nowMs: 2, random: () => 0 });
  assert.equal(resolved.state.pending, null);
  assert.equal(resolved.state.phase, "roll");
  assert.equal(resolved.state.currentSeat, 0);
  assert.ok(resolved.events.some(event => event.type === "OPPORTUNITY_RESOLVED"));
});

test("supply node grants a usable item card without consuming the next roll", () => {
  let game = createGame(players.slice(0, 2));
  game.players[0].position = 26;
  game = applyCommand(game, "u1", "ROLL_DICE", {}, { nowMs: 1, forcedDice: 1, random: () => 0 }).state;
  assert.equal(game.players[0].items[0], "coffee");
  assert.equal(game.currentSeat, 1);

  game.currentSeat = 0;
  game.phase = "roll";
  game = applyCommand(game, "u1", "USE_ITEM", { itemId: "coffee" }, { nowMs: 2 }).state;
  assert.equal(game.players[0].items.length, 0);
  assert.equal(game.players[0].diceBonus, 2);
  assert.equal(game.phase, "roll");
  const moved = applyCommand(game, "u1", "ROLL_DICE", {}, { nowMs: 3, forcedDice: 1 });
  assert.equal(moved.events.find(event => event.type === "DICE_ROLLED").payload.value, 3);
});

test("city pass halves the next rent and is consumed", () => {
  let game = createGame(players.slice(0, 2));
  game.board[1].ownerId = "u2";
  game.board[1].level = 1;
  game.players[0].items.push("pass");
  game = applyCommand(game, "u1", "USE_ITEM", { itemId: "pass" }, { nowMs: 1 }).state;
  const before = game.players[0].cash;
  const result = applyCommand(game, "u1", "ROLL_DICE", {}, { nowMs: 2, forcedDice: 1 });
  assert.equal(result.state.players[0].cash, before - 14);
  assert.equal(result.state.players[0].rentShield, false);
  assert.equal(result.events.find(event => event.type === "RENT_PAID").payload.shieldUsed, true);
});

test("new item cards support fixed dice, construction discount and shielded demolition", () => {
  let game = createGame(players.slice(0, 2));
  game.players[0].items.push("exact_dice");
  game = applyCommand(game, "u1", "USE_ITEM", { itemId: "exact_dice", value: 6 }).state;
  const rolled = applyCommand(game, "u1", "ROLL_DICE", {}, { nowMs: 1, forcedDice: 1 });
  assert.equal(rolled.events.find(event => event.type === "DICE_ROLLED").payload.baseValue, 6);

  game = createGame(players.slice(0, 2));
  game.board[1].ownerId = "u1"; game.board[1].level = 1; game.players[0].properties.push(1); game.players[0].items.push("build_coupon");
  game = applyCommand(game, "u1", "USE_ITEM", { itemId: "build_coupon" }).state;
  const before = game.players[0].cash;
  game = applyCommand(game, "u1", "UPGRADE_PROPERTY", { tileIndex: 1 }).state;
  assert.equal(before - game.players[0].cash, 45);

  game.board[2].ownerId = "u2"; game.board[2].level = 2; game.players[1].attackShield = true; game.players[0].items.push("demolition");
  const blocked = applyCommand(game, "u1", "USE_ITEM", { itemId: "demolition", tileIndex: 2 });
  assert.equal(blocked.state.board[2].level, 2);
  assert.equal(blocked.state.players[1].attackShield, false);
  assert.ok(blocked.events.some(event => event.type === "ITEM_ATTACK_BLOCKED"));
});

test("expanded item deck supports investment discount, rent boost, swap and roadblock", () => {
  assert.equal(ITEM_CARDS.length, 11);
  let game = createGame(players.slice(0, 2));
  game.players[0].items.push("invest_coupon");
  game = applyCommand(game, "u1", "USE_ITEM", { itemId: "invest_coupon" }).state;
  game.players[0].position = 0;
  game = applyCommand(game, "u1", "ROLL_DICE", {}, { nowMs: 1, forcedDice: 1 }).state;
  const before = game.players[0].cash;
  game = applyCommand(game, "u1", "BUY_PROPERTY").state;
  assert.equal(before - game.players[0].cash, 60);

  game.currentSeat = 0; game.phase = "roll"; game.players[0].items.push("swap");
  game.players[0].position = 3; game.players[1].position = 9;
  game = applyCommand(game, "u1", "USE_ITEM", { itemId: "swap", targetPlayerId: "u2" }).state;
  assert.deepEqual(game.players.map(player => player.position), [9, 3]);

  game.players[0].items.push("roadblock");
  game = applyCommand(game, "u1", "USE_ITEM", { itemId: "roadblock", targetPlayerId: "u2" }).state;
  game.currentSeat = 1; game.phase = "roll";
  const roadblocked = applyCommand(game, "u2", "ROLL_DICE", {}, { nowMs: 2, forcedDice: 4 });
  assert.equal(roadblocked.events.find(event => event.type === "DICE_ROLLED").payload.value, 2);

  game = createGame(players.slice(0, 2));
  game.players[0].items.push("rent_boost");
  game = applyCommand(game, "u1", "USE_ITEM", { itemId: "rent_boost" }).state;
  game.board[1].ownerId = "u1"; game.board[1].level = 1; game.players[0].properties.push(1);
  game.currentSeat = 1; game.phase = "roll";
  const payerBefore = game.players[1].cash;
  const doubled = applyCommand(game, "u2", "ROLL_DICE", {}, { nowMs: 3, forcedDice: 1 });
  assert.equal(payerBefore - doubled.state.players[1].cash, 56);
  assert.equal(doubled.state.players[0].rentBoost, false);
});

test("state hash and score are deterministic", () => {
  const game = createGame(players.slice(0, 2));
  assert.equal(stateHash(game), stateHash(structuredClone(game)));
  assert.equal(cityScore(game, game.players[0]), 5);
});

test("only the room owner can end a running game and current scores become final", () => {
  const game = createGame(players.slice(0, 2));
  assert.throws(() => applyCommand(game, "u2", "END_GAME", {}, { roomOwnerId: "u1", nowMs: 1 }), /ONLY_OWNER/);
  const result = applyCommand(game, "u1", "END_GAME", {}, { roomOwnerId: "u1", nowMs: 2 });
  assert.equal(result.state.finished, true);
  assert.equal(result.state.phase, "finished");
  assert.equal(result.state.finishReason, "owner_ended");
  assert.equal(result.events[0].type, "GAME_ENDED_EARLY");
  assert.equal(result.events[1].type, "GAME_FINISHED");
  assert.equal(result.events[1].payload.ranking.length, 2);
});

test("route decisions have a safe timeout choice and owner can end mid-route", () => {
  let game = createGame(players.slice(0, 2));
  game.players[0].position = 23;
  game = applyCommand(game, "u1", "ROLL_DICE", {}, { nowMs: 1, forcedDice: 1 }).state;
  assert.equal(game.pending.type, "route");
  assert.ok(game.movement.remaining > 0);
  const fallback = getTimeoutCommand(game);
  assert.equal(fallback.actorId, "u1");
  assert.equal(fallback.command, "CHOOSE_ROUTE");
  assert.equal(fallback.payload.to, game.pending.choices[0].to);
  const ended = applyCommand(game, "u1", "END_GAME", {}, { roomOwnerId: "u1", nowMs: 2 });
  assert.equal(ended.state.finished, true);
  assert.equal(ended.state.pending, null);
  assert.equal(ended.state.movement, null);
  assert.equal(ended.events.at(-1).type, "GAME_FINISHED");
});

test("legacy route snapshots recover missing choices and movement instead of crashing", () => {
  let game = createGame(players.slice(0, 2));
  game.players[0].position = 23;
  game = applyCommand(game, "u1", "ROLL_DICE", {}, { nowMs: 1, forcedDice: 2 }).state;
  const expectedTo = game.board[23].next[0].to;
  game.pending.choices = undefined;
  game.pending.remaining = 2;
  game.movement = null;
  const fallback = getTimeoutCommand(game);
  assert.equal(fallback.payload.to, expectedTo);
  const recovered = applyCommand(game, "u1", fallback.command, fallback.payload, { nowMs: 2 });
  assert.notEqual(recovered.state.phase, "decision");
  assert.ok(recovered.events.some(event => event.type === "ROUTE_CHOSEN"));
});

test("hangzhou-v1.2 players missing item fields migrate before Bot takeover", () => {
  const legacy = createGame([{ id: "u1", nickname: "桃桃", kind: "human" }, { id: "b1", nickname: "小蓝", kind: "bot" }]);
  legacy.rulesetVersion = "hangzhou-v1.2";
  legacy.players.forEach(player => { delete player.items; delete player.diceBonus; delete player.rentShield; delete player.reviewTurns; });
  legacy.currentSeat = 1;
  const migrated = migrateGameState(legacy);
  assert.deepEqual(migrated.players.map(player => player.items), [[], []]);
  assert.equal(getBotCommand(migrated, "b1").command, "ROLL_DICE");
  assert.doesNotThrow(() => applyCommand(legacy, "b1", "ROLL_DICE", {}, { nowMs: 1, forcedDice: 1 }));
});
