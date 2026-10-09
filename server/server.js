"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { WebSocketServer, WebSocket } = require("ws");
const { Store } = require("./store");
const { CURRENT_RULESET_VERSION, createGame, migrateGameState, applyCommand, getBotCommand, getTimeoutCommand, stateHash } = require("../game-core");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
const DEV_SMS_CODE = process.env.DEV_SMS_CODE || "123456";
const SMS_MODE = process.env.SMS_MODE || "dev";
const DEMO_ACCESS_KEY = process.env.DEMO_ACCESS_KEY || "";
const TEST_DICE = process.env.NODE_ENV === "test" && Number(process.env.TEST_DICE) >= 1 && Number(process.env.TEST_DICE) <= 6 ? Number(process.env.TEST_DICE) : null;
const TEST_DICE_SEQUENCE = process.env.NODE_ENV === "test" ? String(process.env.TEST_DICE_SEQUENCE || "").split(",").map(Number).filter(value => value >= 1 && value <= 6) : [];
let testDiceIndex = 0;
const BASE_PATH = (() => {
  const value = String(process.env.BASE_PATH || "").trim();
  if (!value || value === "/") return "";
  return `/${value.replace(/^\/+|\/+$/g, "")}`;
})();
const publicDir = path.join(__dirname, "..", "public");
const store = new Store();
const otp = new Map();
const socketsByRoom = new Map();
const roomQueues = new Map();
const disconnectTimers = new Map();
const decisionTimers = new Map();
let shuttingDown = false;
const botNames = ["青团", "小蓝", "阿橙", "桂花", "小荷", "云朵"];

function json(res, status, payload, headers = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(JSON.stringify(payload));
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map(item => item.trim()).filter(Boolean).map(item => {
    const index = item.indexOf("=");
    return [decodeURIComponent(item.slice(0, index)), decodeURIComponent(item.slice(index + 1))];
  }));
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function hasDemoAccess(req) {
  return !DEMO_ACCESS_KEY || safeEqual(parseCookies(req.headers.cookie).hc_demo_access, DEMO_ACCESS_KEY);
}

function inviteUrl(token) {
  const url = new URL(`${BASE_PATH}/join/${token}`, PUBLIC_BASE_URL);
  if (DEMO_ACCESS_KEY) url.searchParams.set("access", DEMO_ACCESS_KEY);
  return url.toString();
}

function internalUrl(externalUrl) {
  const url = new URL(externalUrl.toString());
  if (!BASE_PATH) return url;
  if (url.pathname === BASE_PATH) url.pathname = "/";
  else if (url.pathname.startsWith(`${BASE_PATH}/`)) url.pathname = url.pathname.slice(BASE_PATH.length) || "/";
  else return null;
  return url;
}

function sessionUser(req) { return store.getUserBySession(parseCookies(req.headers.cookie).hc_session); }

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw Object.assign(new Error("PAYLOAD_TOO_LARGE"), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("INVALID_JSON"), { status: 400 }); }
}

function validPhone(value) { return /^1[3-9]\d{9}$/.test(String(value || "")); }
function validNickname(value) { return typeof value === "string" && /^[\p{L}\p{N}_\-·]{2,12}$/u.test(value.trim()); }
function sanitizeRoom(room) {
  return {
    id: room.id,
    code: room.code,
    ownerUserId: room.ownerUserId,
    maxPlayers: room.maxPlayers,
    status: room.status,
    players: room.players,
    seq: room.seq || 0,
    game: room.game || null,
    rulesetExpired: isRulesetExpired(room),
    currentRulesetVersion: CURRENT_RULESET_VERSION,
    expiresAt: room.expiresAt
  };
}

function isRulesetExpired(room) {
  return room?.status === "playing" && room.game?.rulesetVersion !== CURRENT_RULESET_VERSION;
}

function generateCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = String(crypto.randomInt(100000, 1000000));
    if (!store.getRoomByCode(code)) return code;
  }
  throw new Error("ROOM_CODE_EXHAUSTED");
}

function findPlayer(room, userId) { return room.players.find(player => player.id === userId); }
function requireUser(req, res) {
  const user = sessionUser(req);
  if (!user) json(res, 401, { error: "UNAUTHENTICATED" });
  return user;
}

function persist(room) { store.saveRoom(room, room.inviteTokenHash); }
function broadcast(roomId, payload) {
  const encoded = JSON.stringify(payload);
  for (const socket of socketsByRoom.get(roomId) || []) if (socket.readyState === WebSocket.OPEN) socket.send(encoded);
}
function hasLiveUserSocket(roomId, userId) { return [...(socketsByRoom.get(roomId) || [])].some(socket => socket.userId === userId && socket.readyState === WebSocket.OPEN); }
function userRef(userId) { return crypto.createHash("sha256").update(String(userId)).digest("hex").slice(0, 10); }
function audit(event, details = {}) { console.log(JSON.stringify({ level:"info",event,...details })); }

function roomSnapshot(room) { return { type: "room.snapshot", room: sanitizeRoom(room), stateHash: room.game ? stateHash(room.game) : null }; }
function publishRoom(room) { broadcast(room.id, roomSnapshot(room)); }

function enqueueRoom(roomId, work) {
  const previous = roomQueues.get(roomId) || Promise.resolve();
  const next = previous.then(work, work).finally(() => { if (roomQueues.get(roomId) === next) roomQueues.delete(roomId); });
  roomQueues.set(roomId, next);
  return next;
}

function applyGameCommand(room, actorId, actionId, command, payload = {}) {
  if (!room.game) throw new Error("GAME_NOT_STARTED");
  if (isRulesetExpired(room)) throw new Error("RULESET_EXPIRED");
  if ((room.processedActionIds || []).includes(actionId)) return [];
  room.game = migrateGameState(room.game);
  const forcedDice = command === "ROLL_DICE" ? (TEST_DICE_SEQUENCE[testDiceIndex++] || TEST_DICE) : null;
  const result = applyCommand(room.game, actorId, command, payload, { nowMs: Date.now(), random: Math.random, forcedDice, roomOwnerId: room.ownerUserId });
  room.game = result.state;
  room.status = room.game.finished ? "finished" : "playing";
  room.processedActionIds = [...(room.processedActionIds || []), actionId].slice(-200);
  return result.events.map(event => ({ event, actorId, actionId }));
}

function commitGameTransition(room, stagedEvents) { return store.commitRoomAndEvents(room, stagedEvents, room.inviteTokenHash); }

function runBots(room) {
  let safety = 0;
  const allEvents = [];
  while (room.game && !room.game.finished && safety < 256) {
    safety += 1;
    let bot = null;
    if (room.game.phase === "partner_response") bot = room.game.players.find(player => player.id === room.game.pending?.targetPlayerId && (player.kind === "bot" || player.trustee));
    else {
      const candidate = room.game.players[room.game.currentSeat];
      bot = candidate && (candidate.kind === "bot" || candidate.trustee) ? candidate : null;
    }
    if (!bot) break;
    const action = getBotCommand(room.game, bot.id, Math.random);
    if (!action) break;
    const actionId = `bot-${crypto.randomUUID()}`;
    allEvents.push(...applyGameCommand(room, bot.id, actionId, action.command, action.payload));
  }
  return allEvents;
}

function scheduleDecisionTimeout(room) {
  clearTimeout(decisionTimers.get(room.id));
  decisionTimers.delete(room.id);
  const pending = room.game?.pending;
  if (room.status !== "playing" || !pending?.expiresAt) return;
  const expected = { expiresAt: pending.expiresAt, type: pending.type, actorId: pending.actorId, version: room.game.version };
  const timer = setTimeout(() => {
    decisionTimers.delete(room.id);
    enqueueRoom(room.id, async () => {
    const latest = store.getRoom(room.id);
    const current = latest?.game?.pending;
    if (!latest || latest.status !== "playing" || !current || current.expiresAt !== expected.expiresAt || current.type !== expected.type || current.actorId !== expected.actorId || latest.game.version !== expected.version) return;
    if (Date.now() < current.expiresAt) return scheduleDecisionTimeout(latest);
    const fallback = getTimeoutCommand(latest.game);
    if (!fallback) {
      console.error(JSON.stringify({ level: "error", roomId: latest.id, error: "UNRESOLVABLE_PENDING_DECISION", pending: current.type }));
      return;
    }
    const stagedEvents = applyGameCommand(latest, fallback.actorId, `timeout-${crypto.randomUUID()}`, fallback.command, fallback.payload);
    stagedEvents.push(...runBots(latest));
    const events = commitGameTransition(latest, stagedEvents);
    broadcast(latest.id, { type: "game.events", events, version: latest.game.version, stateHash: stateHash(latest.game) });
    publishRoom(latest);
      scheduleDecisionTimeout(latest);
    }).catch(error => console.error(JSON.stringify({ level: "error", roomId: room.id, error: error.message })));
  }, Math.max(25, pending.expiresAt - Date.now() + 25));
  decisionTimers.set(room.id, timer);
}

async function api(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") return json(res, 200, { ok: true, now: Date.now(), smsMode: SMS_MODE });

  if (req.method === "POST" && url.pathname === "/api/auth/sms/send") {
    const body = await readJson(req);
    if (!validPhone(body.phone)) return json(res, 400, { error: "INVALID_PHONE" });
    if (SMS_MODE !== "dev") return json(res, 503, { error: "SMS_PROVIDER_NOT_CONFIGURED" });
    otp.set(body.phone, { code: DEV_SMS_CODE, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0, sentAt: Date.now() });
    return json(res, 200, { ok: true, cooldownSeconds: 60, devCode: DEV_SMS_CODE });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/verify") {
    const body = await readJson(req);
    if (!validPhone(body.phone) || !validNickname(body.nickname)) return json(res, 400, { error: "INVALID_PROFILE" });
    const record = otp.get(body.phone);
    if (!record || record.expiresAt < Date.now() || record.attempts >= 5 || String(body.code) !== record.code) {
      if (record) record.attempts += 1;
      return json(res, 401, { error: "INVALID_SMS_CODE" });
    }
    otp.delete(body.phone);
    const user = store.upsertUser(body.phone, body.nickname.trim());
    const session = store.createSession(user.id);
    return json(res, 200, { user: { id: user.id, nickname: user.nickname, phoneMasked: user.phone_masked } }, {
      "set-cookie": `hc_session=${encodeURIComponent(session.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
    });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const token = parseCookies(req.headers.cookie).hc_session;
    store.revokeSession(token);
    return json(res, 200, { ok: true }, { "set-cookie": "hc_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" });
  }

  const user = requireUser(req, res);
  if (!user) return;

  if (req.method === "GET" && url.pathname === "/api/me") {
    return json(res, 200, { user: { id: user.id, nickname: user.nickname, phoneMasked: user.phone_masked }, rooms: store.listUserRooms(user.id).map(sanitizeRoom) });
  }

  if (req.method === "POST" && url.pathname === "/api/rooms") {
    const body = await readJson(req);
    const maxPlayers = Math.max(2, Math.min(4, Number(body.maxPlayers || 4)));
    const token = crypto.randomBytes(18).toString("base64url");
    const room = {
      id: crypto.randomUUID(), code: generateCode(), ownerUserId: user.id, maxPlayers, status: "waiting", seq: 0,
      players: [{ id: user.id, nickname: user.nickname, kind: "human", seat: 0, ready: true, connected: false }],
      game: null, processedActionIds: [], expiresAt: Date.now() + 2 * 60 * 60 * 1000,
      inviteTokenHash: store.hash(`invite:${token}`)
    };
    persist(room);
    return json(res, 201, { room: sanitizeRoom(room), inviteToken: token, inviteUrl: inviteUrl(token) });
  }

  if (req.method === "POST" && url.pathname === "/api/rooms/join") {
    const body = await readJson(req);
    const room = body.inviteToken ? store.getRoomByInviteToken(body.inviteToken) : store.getRoomByCode(String(body.code || ""));
    if (!room) return json(res, 404, { error: "ROOM_NOT_FOUND" });
    if (room.status !== "waiting") return json(res, 409, { error: "ROOM_ALREADY_STARTED" });
    if (!findPlayer(room, user.id) && room.players.length >= room.maxPlayers) return json(res, 409, { error: "ROOM_FULL" });
    if (!findPlayer(room, user.id)) {
      room.players.push({ id: user.id, nickname: user.nickname, kind: "human", seat: room.players.length, ready: false, connected: false });
      persist(room);
      publishRoom(room);
    }
    return json(res, 200, { room: sanitizeRoom(room) });
  }

  const roomMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)(?:\/(.*))?$/);
  if (roomMatch) {
    const room = store.getRoom(roomMatch[1]);
    if (!room || !findPlayer(room, user.id)) return json(res, 404, { error: "ROOM_NOT_FOUND" });
    if (isRulesetExpired(room)) return json(res, 409, { error: "RULESET_EXPIRED", currentRulesetVersion: CURRENT_RULESET_VERSION });
    const tail = roomMatch[2] || "";
    if (req.method === "GET" && !tail) return json(res, 200, { room: sanitizeRoom(room) });
    if (req.method === "POST" && tail === "invite-token") {
      if (room.ownerUserId !== user.id) return json(res, 403, { error: "ONLY_OWNER" });
      const token = crypto.randomBytes(18).toString("base64url");
      room.inviteTokenHash = store.hash(`invite:${token}`);
      persist(room);
      return json(res, 200, { inviteToken: token, inviteUrl: inviteUrl(token) });
    }
    if (req.method === "POST" && tail === "bots") {
      if (room.ownerUserId !== user.id || room.status !== "waiting") return json(res, 403, { error: "ONLY_OWNER" });
      if (room.players.length >= room.maxPlayers) return json(res, 409, { error: "ROOM_FULL" });
      const used = new Set(room.players.map(player => player.nickname));
      const nickname = botNames.find(name => !used.has(name)) || `Bot${room.players.length}`;
      room.players.push({ id: `bot_${crypto.randomUUID()}`, nickname, kind: "bot", seat: room.players.length, ready: true, connected: true });
      persist(room); publishRoom(room);
      return json(res, 201, { room: sanitizeRoom(room) });
    }
    const botMatch = tail.match(/^bots\/(bot_[\w-]+)$/);
    if (req.method === "DELETE" && botMatch) {
      if (room.ownerUserId !== user.id || room.status !== "waiting") return json(res, 403, { error: "ONLY_OWNER" });
      room.players = room.players.filter(player => player.id !== botMatch[1]).map((player, seat) => ({ ...player, seat }));
      persist(room); publishRoom(room);
      return json(res, 200, { room: sanitizeRoom(room) });
    }
    if (req.method === "POST" && tail === "ready") {
      const body = await readJson(req);
      findPlayer(room, user.id).ready = Boolean(body.ready);
      persist(room); publishRoom(room);
      return json(res, 200, { room: sanitizeRoom(room) });
    }
    if (req.method === "POST" && tail === "start") {
      if (room.ownerUserId !== user.id) return json(res, 403, { error: "ONLY_OWNER" });
      if (room.status !== "waiting" || room.players.length < 2 || room.players.length > 4) return json(res, 409, { error: "PLAYER_COUNT_OUT_OF_RANGE" });
      if (room.players.some(player => player.kind === "human" && !player.ready)) return json(res, 409, { error: "PLAYERS_NOT_READY" });
      room.status = "playing";
      room.game = createGame(room.players);
      room.seq = 0;
      room.processedActionIds = [];
      persist(room); publishRoom(room);
      const botEvents = runBots(room);
      if (botEvents.length) { const events=commitGameTransition(room,botEvents);broadcast(room.id,{type:"game.events",events,version:room.game.version,stateHash:stateHash(room.game)});publishRoom(room); }
      scheduleDecisionTimeout(room);
      return json(res, 200, { room: sanitizeRoom(room) });
    }
  }

  return json(res, 404, { error: "NOT_FOUND" });
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".webp": "image/webp", ".ogg": "audio/ogg", ".json": "application/json; charset=utf-8" })[ext] || "application/octet-stream";
}

function serveStatic(req, res, url) {
  let pathname = url.pathname;
  if (pathname.startsWith("/join/") || pathname.startsWith("/room/")) pathname = "/index.html";
  if (pathname === "/") pathname = "/index.html";
  const file = path.resolve(publicDir, `.${pathname}`);
  if (!file.startsWith(publicDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return json(res, 404, { error: "NOT_FOUND" });
  const stat = fs.statSync(file);
  const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const immutable = (pathname.includes("/assets/") || pathname.includes("/audio/")) && /\.v\d+\./.test(pathname);
  const headers = {
    "content-type": contentType(file),
    "last-modified": stat.mtime.toUTCString(),
    etag,
    "cache-control": immutable ? "public, max-age=31536000, immutable" : pathname.includes("/assets/") || pathname.includes("/audio/") ? "public, max-age=86400" : "no-cache"
  };
  if (req.headers["if-none-match"] === etag) { res.writeHead(304, headers); return res.end(); }
  if (pathname === "/index.html") {
    const html = fs.readFileSync(file, "utf8").replaceAll("__BASE_PATH__", BASE_PATH);
    res.writeHead(200, { ...headers, "content-length": Buffer.byteLength(html) });
    return res.end(html);
  }
  res.writeHead(200, { ...headers, "content-length": stat.size });
  return fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const externalUrl = new URL(req.url, PUBLIC_BASE_URL);
  const url = internalUrl(externalUrl);
  try {
    if (!url) {
      if (BASE_PATH && externalUrl.pathname === "/") { res.writeHead(204, { "cache-control": "no-store" }); return res.end(); }
      return json(res, 404, { error: "NOT_FOUND" });
    }
    if (DEMO_ACCESS_KEY && url.pathname !== "/api/health" && !hasDemoAccess(req)) {
      if (safeEqual(externalUrl.searchParams.get("access"), DEMO_ACCESS_KEY)) {
        externalUrl.searchParams.delete("access");
        res.writeHead(302, {
          location: `${externalUrl.pathname}${externalUrl.search}`,
          "set-cookie": `hc_demo_access=${encodeURIComponent(DEMO_ACCESS_KEY)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
        });
        return res.end();
      }
      return json(res, 403, { error: "DEMO_ACCESS_REQUIRED" });
    }
    if (url.pathname.startsWith("/api/")) await api(req, res, url);
    else serveStatic(req, res, url);
  } catch (error) {
    console.error(JSON.stringify({ level: "error", requestId: req.headers["x-request-id"], path: url.pathname, error: error.message }));
    if (!res.headersSent) json(res, error.status || 500, { error: error.message || "INTERNAL_ERROR" });
  }
});

const wss = new WebSocketServer({ noServer: true });
server.on("upgrade", (req, socket, head) => {
  const url = internalUrl(new URL(req.url, PUBLIC_BASE_URL));
  if (!url) return socket.destroy();
  if (url.pathname !== "/socket") return socket.destroy();
  if (!hasDemoAccess(req)) return socket.destroy();
  const user = sessionUser(req);
  const room = store.getRoom(url.searchParams.get("roomId"));
  if (!user || !room || !findPlayer(room, user.id)) return socket.destroy();
  wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws, req, { user, roomId: room.id }));
});

wss.on("connection", (socket, req, context) => {
  const { user, roomId } = context;
  const initialRoom = store.getRoom(roomId);
  if (isRulesetExpired(initialRoom)) {
    socket.send(JSON.stringify({ type: "ruleset.expired", currentRulesetVersion: CURRENT_RULESET_VERSION }));
    socket.close(1008, "RULESET_EXPIRED");
    return;
  }
  socket.userId = user.id;
  socket.connectionId = crypto.randomUUID();
  if (!socketsByRoom.has(roomId)) socketsByRoom.set(roomId, new Set());
  socketsByRoom.get(roomId).add(socket);
  audit("ws_open",{roomId,userRef:userRef(user.id),connectionId:socket.connectionId,activeSockets:[...(socketsByRoom.get(roomId)||[])].filter(item=>item.userId===user.id&&item.readyState===WebSocket.OPEN).length});
  let room = null;
  if(disconnectTimers.has(`${roomId}:${user.id}`))audit("trustee_timer_cancel",{roomId,userRef:userRef(user.id),reason:"socket_open"});
  clearTimeout(disconnectTimers.get(`${roomId}:${user.id}`));
  disconnectTimers.delete(`${roomId}:${user.id}`);
  enqueueRoom(roomId, async () => {
    room = store.getRoom(roomId);
    const membership = room && findPlayer(room, user.id);
    if (!membership) return socket.close(1008, "ROOM_MEMBERSHIP_LOST");
    if (room.game) room.game = migrateGameState(room.game);
    membership.connected = true;
    membership.trustee = false;
    const gamePlayer = room.game?.players.find(player => player.id === user.id);
    if (gamePlayer) gamePlayer.trustee = false;
    persist(room);
    scheduleDecisionTimeout(room);
    socket.send(JSON.stringify(roomSnapshot(room)));
    publishRoom(room);
    if (room.status !== "playing") return;
    setImmediate(() => enqueueRoom(roomId, async () => {
      const latest = store.getRoom(roomId);
      if (!latest || latest.status !== "playing") return;
      const botEvents = runBots(latest);
      if (!botEvents.length) return;
      const events = commitGameTransition(latest, botEvents);
      scheduleDecisionTimeout(latest);
      broadcast(roomId, { type: "game.events", events, version: latest.game.version, stateHash: stateHash(latest.game) });
      publishRoom(latest);
    }).catch(error => console.error(JSON.stringify({ level: "error", roomId, error: error.message }))));
  }).catch(error => console.error(JSON.stringify({ level: "error", roomId, error: error.message })));

  socket.on("message", raw => {
    let message;
    try { message = JSON.parse(raw.toString()); }
    catch { return socket.send(JSON.stringify({ type: "error", error: "INVALID_JSON" })); }
    if (message.type === "ping") return socket.send(JSON.stringify({ type: "pong", now: Date.now() }));
    if (message.type === "resume") {
      room = store.getRoom(roomId);
      const events = store.eventsAfter(roomId, Number(message.lastSeq || 0));
      if (events.length && events.length < 200) socket.send(JSON.stringify({ type: "game.events", events, version: room.game?.version, stateHash: room.game ? stateHash(room.game) : null }));
      else socket.send(JSON.stringify(roomSnapshot(room)));
      return;
    }
    if (message.type !== "game.command") return socket.send(JSON.stringify({ type: "error", error: "UNKNOWN_MESSAGE" }));
    enqueueRoom(roomId, async () => {
      room = store.getRoom(roomId);
      try {
        if (!message.actionId) throw new Error("MISSING_ACTION_ID");
        if ((room.processedActionIds || []).includes(message.actionId)) {
          socket.send(JSON.stringify({ type: "command.ack", requestId: message.requestId, actionId: message.actionId, version: room.game.version, duplicate: true }));
          return;
        }
        if (message.command === "END_GAME" && room.status === "finished") {
          socket.send(JSON.stringify({ type:"command.ack",requestId:message.requestId,actionId:message.actionId,version:room.game?.version,idempotent:true }));
          socket.send(JSON.stringify(roomSnapshot(room)));
          return;
        }
        if (message.command !== "END_GAME" && message.expectedVersion !== room.game?.version) throw new Error("STALE_VERSION");
        const stagedEvents = applyGameCommand(room, user.id, message.actionId, message.command, message.payload || {});
        stagedEvents.push(...runBots(room));
        const events = commitGameTransition(room, stagedEvents);
        scheduleDecisionTimeout(room);
        socket.send(JSON.stringify({ type: "command.ack", requestId: message.requestId, actionId: message.actionId, version: room.game.version }));
        broadcast(roomId, { type: "game.events", events, version: room.game.version, stateHash: stateHash(room.game) });
        publishRoom(room);
      } catch (error) {
        room = store.getRoom(roomId);
        const expectedErrors=new Set(["ONLY_OWNER","INVALID_PHASE","INVALID_ROUTE","STALE_VERSION","NOT_YOUR_TURN","CANNOT_INVEST","INSUFFICIENT_FUNDS","ITEM_NOT_FOUND","GAME_FINISHED","RULESET_EXPIRED","COMPLETE_GROUP_REQUIRED"]);
        if(expectedErrors.has(error.message))audit("command_rejected",{roomId,userRef:userRef(user.id),command:message.command,version:room?.game?.version,error:error.message});else console.error(JSON.stringify({level:"error",roomId,command:message.command,version:room?.game?.version,error:error.message,stack:error.stack}));
        socket.send(JSON.stringify({ type: "command.rejected", requestId: message.requestId, actionId: message.actionId, error: error.message, room: sanitizeRoom(room) }));
      }
    });
  });

  socket.on("close", () => {
    if (shuttingDown) return;
    socketsByRoom.get(roomId)?.delete(socket);
    if (!socketsByRoom.get(roomId)?.size) socketsByRoom.delete(roomId);
    audit("ws_close",{roomId,userRef:userRef(user.id),connectionId:socket.connectionId,activeSockets:[...(socketsByRoom.get(roomId)||[])].filter(item=>item.userId===user.id&&item.readyState===WebSocket.OPEN).length});
    enqueueRoom(roomId, async () => {
      const latest = store.getRoom(roomId);
      const player = latest && findPlayer(latest, user.id);
      if (!player) return;
      if (hasLiveUserSocket(roomId, user.id)) return;
      player.connected = false;
      persist(latest);
      publishRoom(latest);
      const humanCount = latest.players.filter(item => item.kind === "human").length;
      if (latest.status === "playing" && humanCount > 1) {
        const key = `${roomId}:${user.id}`;
        audit("trustee_timer_start",{roomId,userRef:userRef(user.id),graceMs:Number(process.env.RECONNECT_GRACE_MS||60000)});
        disconnectTimers.set(key, setTimeout(() => enqueueRoom(roomId, async () => {
          const delayed = store.getRoom(roomId);
          const roomPlayer = delayed && findPlayer(delayed, user.id);
          if (!roomPlayer || roomPlayer.connected || hasLiveUserSocket(roomId,user.id) || delayed.status !== "playing") return;
          audit("trustee_timer_fire",{roomId,userRef:userRef(user.id),gameVersion:delayed.game?.version});
          roomPlayer.trustee = true;
          const gamePlayer = delayed.game?.players.find(item => item.id === user.id);
          if (gamePlayer) gamePlayer.trustee = true;
          const botEvents = runBots(delayed);
          const events = botEvents.length ? commitGameTransition(delayed, botEvents) : (persist(delayed), []);
          scheduleDecisionTimeout(delayed);
          if (events.length) broadcast(roomId, { type: "game.events", events, version: delayed.game.version, stateHash: stateHash(delayed.game) });
          publishRoom(delayed);
          disconnectTimers.delete(key);
        }), Number(process.env.RECONNECT_GRACE_MS || 60000)));
      }
    }).catch(error => console.error(JSON.stringify({ level: "error", roomId, error: error.message })));
  });
});

if (require.main === module) {
  server.listen(PORT, HOST, () => console.log(`Hangzhou multiplayer H5 listening on ${PUBLIC_BASE_URL}`));
  const shutdown = signal => close().then(() => {
    console.log(`Stopped after ${signal}`);
    process.exit(0);
  });
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

function close() {
  shuttingDown = true;
  for (const timer of disconnectTimers.values()) clearTimeout(timer);
  disconnectTimers.clear();
  for (const timer of decisionTimers.values()) clearTimeout(timer);
  decisionTimers.clear();
  for (const client of wss.clients) client.terminate();
  return new Promise(resolve => server.close(() => { store.close(); resolve(); }));
}
module.exports = { server, store, close };
