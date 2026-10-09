"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { BOARD, createGame, migrateGameState, applyCommand, getBotCommand, getTimeoutCommand, cityScore, stateHash } = require("../game-core");

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
