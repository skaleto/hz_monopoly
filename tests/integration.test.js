"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { WebSocket } = require("ws");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hangzhou-mp-"));
process.env.DB_FILE = path.join(tempDir, "test.db");
process.env.APP_SECRET = "integration-test-secret";
process.env.SMS_MODE = "dev";
process.env.DEV_SMS_CODE = "123456";
process.env.RECONNECT_GRACE_MS = "100";
process.env.BASE_PATH = "/hangzhou-partners";

const { server, store, close } = require("../server/server");

let baseUrl;
const basePath = "/hangzhou-partners";

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${basePath}${pathname}`, {
    method: options.method || "GET",
    headers: { "content-type": "application/json", ...(options.cookie ? { cookie: options.cookie } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const body = await response.json();
  return { status: response.status, body, cookie: response.headers.get("set-cookie")?.split(";")[0] || options.cookie };
}

async function register(phone, nickname) {
  assert.equal((await request("/api/auth/sms/send", { method: "POST", body: { phone } })).status, 200);
  const result = await request("/api/auth/verify", { method: "POST", body: { phone, nickname, code: "123456" } });
  assert.equal(result.status, 200);
  assert.ok(result.cookie?.startsWith("hc_session="));
  return { user: result.body.user, cookie: result.cookie };
}

function openSocket(roomId, cookie) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${baseUrl.replace("http", "ws")}${basePath}/socket?roomId=${roomId}`, { headers: { cookie } });
    const timer = setTimeout(() => reject(new Error("socket timeout")), 3000);
    ws.once("error", reject);
    ws.once("message", data => {
      clearTimeout(timer);
      resolve({ ws, first: JSON.parse(data.toString()) });
    });
  });
}

function waitForMessage(ws, predicate, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.off("message", onMessage); reject(new Error("message timeout")); }, timeoutMs);
    function onMessage(data) {
      const message = JSON.parse(data.toString());
      if (!predicate(message)) return;
      clearTimeout(timer);
      ws.off("message", onMessage);
      resolve(message);
    }
    ws.on("message", onMessage);
  });
}

test.before(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("phone login, 2-4 seats, bots, websocket sync and reconnect", async () => {
  const a = await register("13800000001", "桃桃");
  const b = await register("13800000002", "青团");

  for (const filename of ["board.v3.webp", "node_property.v1.webp", "node_landmark.v1.webp", "node_event.v1.webp", "node_transit.v1.webp", "node_special.v1.webp"]) {
    const asset = await fetch(`${baseUrl}${basePath}/assets/${filename}`, { headers: { cookie: a.cookie } });
    assert.equal(asset.status, 200);
    assert.equal(asset.headers.get("content-type"), "image/webp");
    assert.match(asset.headers.get("cache-control"), /immutable/);
    assert.ok(Number(asset.headers.get("content-length")) < 180_000);
    const etag = asset.headers.get("etag");
    assert.ok(etag);
    const cached = await fetch(`${baseUrl}${basePath}/assets/${filename}`, { headers: { cookie: a.cookie, "if-none-match": etag } });
    assert.equal(cached.status, 304);
  }

  const created = await request("/api/rooms", { method: "POST", cookie: a.cookie, body: { maxPlayers: 4 } });
  assert.equal(created.status, 201);
  const roomId = created.body.room.id;
  const inviteToken = created.body.inviteToken;

  const bot1 = await request(`/api/rooms/${roomId}/bots`, { method: "POST", cookie: a.cookie });
  assert.equal(bot1.status, 201);
  assert.equal(bot1.body.room.players.length, 2);

  const joined = await request("/api/rooms/join", { method: "POST", cookie: b.cookie, body: { inviteToken } });
  assert.equal(joined.status, 200);
  assert.equal(joined.body.room.players.length, 3);

  const bot2 = await request(`/api/rooms/${roomId}/bots`, { method: "POST", cookie: a.cookie });
  assert.equal(bot2.status, 201);
  assert.equal(bot2.body.room.players.length, 4);
  assert.equal((await request(`/api/rooms/${roomId}/bots`, { method: "POST", cookie: a.cookie })).status, 409);

  assert.equal((await request(`/api/rooms/${roomId}/ready`, { method: "POST", cookie: b.cookie, body: { ready: true } })).status, 200);
  const started = await request(`/api/rooms/${roomId}/start`, { method: "POST", cookie: a.cookie });
  assert.equal(started.status, 200);
  assert.equal(started.body.room.status, "playing");
  assert.equal(started.body.room.game.players.length, 4);

  const aSocket = await openSocket(roomId, a.cookie);
  const bSocket = await openSocket(roomId, b.cookie);
  assert.equal(aSocket.first.type, "room.snapshot");
  assert.equal(bSocket.first.type, "room.snapshot");

  const version = aSocket.first.room.game.version;
  const actionId = crypto.randomUUID();
  const command = { type: "game.command", requestId: crypto.randomUUID(), actionId, expectedVersion: version, roomId, gameId: roomId, command: "ROLL_DICE", payload: {} };
  const bEventsPromise = waitForMessage(bSocket.ws, message => message.type === "game.events");
  const ackPromise = waitForMessage(aSocket.ws, message => message.type === "command.ack" && message.actionId === actionId);
  aSocket.ws.send(JSON.stringify(command));
  const [eventsMessage, ack] = await Promise.all([bEventsPromise, ackPromise]);
  assert.ok(eventsMessage.events.some(event => event.type === "DICE_ROLLED"));
  assert.ok(ack.version > version);

  const duplicatePromise = waitForMessage(aSocket.ws, message => message.type === "command.ack" && message.actionId === actionId && message.duplicate === true);
  aSocket.ws.send(JSON.stringify(command));
  assert.equal((await duplicatePromise).duplicate, true);

  aSocket.ws.close();
  await new Promise(resolve => setTimeout(resolve, 50));
  const reconnected = await openSocket(roomId, a.cookie);
  assert.equal(reconnected.first.type, "room.snapshot");
  assert.equal(reconnected.first.room.id, roomId);
  assert.ok(reconnected.first.room.game.version >= ack.version);

  const latestVersion = reconnected.first.room.game.version;
  const rejectedEndId = crypto.randomUUID();
  const rejectedEnd = waitForMessage(bSocket.ws, message => message.type === "command.rejected" && message.actionId === rejectedEndId);
  bSocket.ws.send(JSON.stringify({ type: "game.command", requestId: crypto.randomUUID(), actionId: rejectedEndId, expectedVersion: latestVersion, roomId, gameId: roomId, command: "END_GAME", payload: {} }));
  assert.equal((await rejectedEnd).error, "ONLY_OWNER");

  const endId = crypto.randomUUID();
  const endEvents = waitForMessage(bSocket.ws, message => message.type === "game.events" && message.events.some(event => event.type === "GAME_FINISHED"));
  const endAck = waitForMessage(reconnected.ws, message => message.type === "command.ack" && message.actionId === endId);
  reconnected.ws.send(JSON.stringify({ type: "game.command", requestId: crypto.randomUUID(), actionId: endId, expectedVersion: latestVersion, roomId, gameId: roomId, command: "END_GAME", payload: {} }));
  await Promise.all([endEvents, endAck]);
  assert.equal(store.getRoom(roomId).status, "finished");

  reconnected.ws.close();
  bSocket.ws.close();
});

test("an expired human route choice auto-resolves instead of freezing the room", async () => {
  const owner = await register("13800000004", "小舟");
  const created = await request("/api/rooms", { method: "POST", cookie: owner.cookie, body: { maxPlayers: 2 } });
  const roomId = created.body.room.id;
  assert.equal((await request(`/api/rooms/${roomId}/bots`, { method: "POST", cookie: owner.cookie })).status, 201);
  assert.equal((await request(`/api/rooms/${roomId}/start`, { method: "POST", cookie: owner.cookie })).status, 200);
  const room = store.getRoom(roomId);
  const actor = room.game.players[0];
  actor.position = 23;
  room.game.currentSeat = 0;
  room.game.phase = "decision";
  room.game.movement = { remaining: 2, path: [23] };
  room.game.pending = { type: "route", actorId: actor.id, choices: room.game.board[23].next, remaining: 2, expiresAt: Date.now() - 1 };
  room.game.version += 1;
  store.saveRoom(room, room.inviteTokenHash);
  const connection = await openSocket(roomId, owner.cookie);
  const resolved = await waitForMessage(connection.ws, message => message.type === "game.events" && message.events.some(event => event.type === "ROUTE_CHOSEN"));
  assert.ok(resolved.events.some(event => event.type === "ROUTE_CHOSEN"));
  const latest = store.getRoom(roomId);
  assert.notEqual(latest.game.phase, "decision");
  assert.notEqual(latest.game.pending?.type, "route");
  assert.throws(() => store.saveRoom(room, room.inviteTokenHash), /STALE_ROOM_WRITE/);
  const stable = store.getRoom(roomId), stableSeq = stable.seq, stableEventSeq = store.maxEventSeq(roomId), circular = {};
  circular.self = circular;
  assert.throws(() => store.commitRoomAndEvents(stable, [{ actorId: owner.user.id, actionId: "broken-atomic-write", event: { type: "BROKEN", payload: circular } }]), /circular/i);
  assert.equal(store.getRoom(roomId).seq, stableSeq);
  assert.equal(store.maxEventSeq(roomId), stableEventSeq);
  connection.ws.close();
});

test("closing an older socket cannot trustee an active user and END_GAME is stale-safe idempotent", async () => {
  const owner = await register("13800000005", "小桥");
  const peer = await register("13800000006", "小溪");
  const created = await request("/api/rooms", { method:"POST",cookie:owner.cookie,body:{maxPlayers:2} });
  const roomId = created.body.room.id;
  assert.equal((await request("/api/rooms/join", { method:"POST",cookie:peer.cookie,body:{inviteToken:created.body.inviteToken} })).status, 200);
  assert.equal((await request(`/api/rooms/${roomId}/ready`, { method:"POST",cookie:peer.cookie,body:{ready:true} })).status, 200);
  assert.equal((await request(`/api/rooms/${roomId}/start`, { method:"POST",cookie:owner.cookie })).status, 200);
  const older = await openSocket(roomId, owner.cookie);
  const active = await openSocket(roomId, owner.cookie);
  older.ws.close();
  await new Promise(resolve => setTimeout(resolve, 180));
  const stillActive = store.getRoom(roomId);
  assert.equal(stillActive.players.find(player => player.id === owner.user.id).connected, true);
  assert.equal(stillActive.game.players.find(player => player.id === owner.user.id).trustee, false);
  assert.equal(stillActive.game.version, 0);

  const endId = crypto.randomUUID();
  const ended = waitForMessage(active.ws, message => message.type === "command.ack" && message.actionId === endId);
  active.ws.send(JSON.stringify({ type:"game.command",requestId:crypto.randomUUID(),actionId:endId,expectedVersion:-999,roomId,gameId:roomId,command:"END_GAME",payload:{} }));
  assert.equal((await ended).version, 1);
  assert.equal(store.getRoom(roomId).status, "finished");

  const repeatedId = crypto.randomUUID();
  const repeated = waitForMessage(active.ws, message => message.type === "command.ack" && message.actionId === repeatedId);
  active.ws.send(JSON.stringify({ type:"game.command",requestId:crypto.randomUUID(),actionId:repeatedId,expectedVersion:-999,roomId,gameId:roomId,command:"END_GAME",payload:{} }));
  assert.equal((await repeated).idempotent, true);
  active.ws.close();
});

test("a solo player returning home is not auto-played by trustee mode", async () => {
  const owner = await register("13800000003", "小满");
  const created = await request("/api/rooms", { method: "POST", cookie: owner.cookie, body: { maxPlayers: 4 } });
  const roomId = created.body.room.id;
  for (let index = 0; index < 3; index += 1) {
    assert.equal((await request(`/api/rooms/${roomId}/bots`, { method: "POST", cookie: owner.cookie })).status, 201);
  }
  assert.equal((await request(`/api/rooms/${roomId}/start`, { method: "POST", cookie: owner.cookie })).status, 200);
  const connection = await openSocket(roomId, owner.cookie);
  connection.ws.close();
  await new Promise(resolve => setTimeout(resolve, 220));
  const resumed = await request(`/api/rooms/${roomId}`, { cookie: owner.cookie });
  assert.equal(resumed.status, 200);
  assert.equal(resumed.body.room.game.version, 0);
  assert.equal(resumed.body.room.game.players[0].trustee, false);
  assert.equal(resumed.body.room.game.currentSeat, 0);
});

test("a running room from an older ruleset expires instead of mixing rules", async () => {
  const owner = await register("13800000007", "小城");
  const created = await request("/api/rooms", { method: "POST", cookie: owner.cookie, body: { maxPlayers: 2 } });
  const roomId = created.body.room.id;
  assert.equal((await request(`/api/rooms/${roomId}/bots`, { method: "POST", cookie: owner.cookie })).status, 201);
  assert.equal((await request(`/api/rooms/${roomId}/start`, { method: "POST", cookie: owner.cookie })).status, 200);

  const room = store.getRoom(roomId);
  room.game.rulesetVersion = "hangzhou-obsolete";
  room.game.version += 1;
  store.saveRoom(room, room.inviteTokenHash);

  const home = await request("/api/me", { cookie: owner.cookie });
  assert.equal(home.status, 200);
  assert.equal(home.body.rooms.find(item => item.id === roomId).rulesetExpired, true);
  const resumed = await request(`/api/rooms/${roomId}`, { cookie: owner.cookie });
  assert.equal(resumed.status, 409);
  assert.equal(resumed.body.error, "RULESET_EXPIRED");
  assert.equal(store.getRoom(roomId).game.rulesetVersion, "hangzhou-obsolete");
});
