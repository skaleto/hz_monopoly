"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

class Store {
  constructor(options = {}) {
    this.secret = options.secret || process.env.APP_SECRET || "dev-only-change-me";
    const filename = options.filename || process.env.DB_FILE || path.join(__dirname, "..", "data", "game.db");
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        phone_hmac TEXT UNIQUE NOT NULL,
        phone_masked TEXT NOT NULL,
        nickname TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_login_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        session_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        invite_token_hash TEXT UNIQUE NOT NULL,
        owner_user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        state_json TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS game_events (
        room_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        action_id TEXT NOT NULL,
        actor_user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY(room_id, seq),
        UNIQUE(room_id, action_id, seq)
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status, updated_at);
    `);
  }

  hash(value) { return crypto.createHmac("sha256", this.secret).update(value).digest("hex"); }
  maskPhone(phone) { return `${phone.slice(0, 3)}****${phone.slice(-4)}`; }

  upsertUser(phone, nickname, now = Date.now()) {
    const phoneHmac = this.hash(`phone:${phone}`);
    const existing = this.db.prepare("SELECT * FROM users WHERE phone_hmac = ?").get(phoneHmac);
    if (existing) {
      this.db.prepare("UPDATE users SET nickname = ?, last_login_at = ? WHERE id = ?").run(nickname, now, existing.id);
      return { ...existing, nickname, last_login_at: now };
    }
    const user = { id: crypto.randomUUID(), phone_hmac: phoneHmac, phone_masked: this.maskPhone(phone), nickname, created_at: now, last_login_at: now };
    this.db.prepare("INSERT INTO users(id, phone_hmac, phone_masked, nickname, created_at, last_login_at) VALUES(?,?,?,?,?,?)")
      .run(user.id, user.phone_hmac, user.phone_masked, user.nickname, user.created_at, user.last_login_at);
    return user;
  }

  createSession(userId, now = Date.now()) {
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
    this.db.prepare("INSERT INTO sessions(session_hash, user_id, expires_at) VALUES(?,?,?)").run(this.hash(`session:${token}`), userId, expiresAt);
    return { token, expiresAt };
  }

  getUserBySession(token, now = Date.now()) {
    if (!token) return null;
    const row = this.db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.session_hash=? AND s.expires_at>?`)
      .get(this.hash(`session:${token}`), now);
    return row || null;
  }

  revokeSession(token) {
    if (token) this.db.prepare("DELETE FROM sessions WHERE session_hash=?").run(this.hash(`session:${token}`));
  }

  saveRoom(room, inviteTokenHash = room.inviteTokenHash) {
    const now = Date.now();
    const expiresAt = room.expiresAt || now + 2 * 60 * 60 * 1000;
    const existingRow = this.db.prepare("SELECT state_json FROM rooms WHERE id=?").get(room.id);
    if (existingRow) {
      const existing = JSON.parse(existingRow.state_json);
      const existingVersion = Number(existing.game?.version ?? -1), incomingVersion = Number(room.game?.version ?? -1);
      const existingSeq = Number(existing.seq || 0), incomingSeq = Number(room.seq || 0);
      if (incomingVersion < existingVersion || incomingSeq < existingSeq) throw new Error("STALE_ROOM_WRITE");
    }
    const payload = JSON.stringify({ ...room, inviteTokenHash: undefined });
    this.db.prepare(`INSERT INTO rooms(id, code, invite_token_hash, owner_user_id, status, state_json, expires_at, updated_at)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code, invite_token_hash=excluded.invite_token_hash,
      owner_user_id=excluded.owner_user_id, status=excluded.status, state_json=excluded.state_json, expires_at=excluded.expires_at, updated_at=excluded.updated_at`)
      .run(room.id, room.code, inviteTokenHash, room.ownerUserId, room.status, payload, expiresAt, now);
    room.inviteTokenHash = inviteTokenHash;
    room.expiresAt = expiresAt;
    return room;
  }

  parseRoom(row) {
    if (!row) return null;
    const room = JSON.parse(row.state_json);
    room.inviteTokenHash = row.invite_token_hash;
    room.expiresAt = row.expires_at;
    return room;
  }

  getRoom(id) { return this.parseRoom(this.db.prepare("SELECT * FROM rooms WHERE id=?").get(id)); }
  getRoomByCode(code) { return this.parseRoom(this.db.prepare("SELECT * FROM rooms WHERE code=?").get(code)); }
  getRoomByInviteToken(token) { return this.parseRoom(this.db.prepare("SELECT * FROM rooms WHERE invite_token_hash=?").get(this.hash(`invite:${token}`))); }

  listUserRooms(userId) {
    return this.db.prepare("SELECT * FROM rooms WHERE status IN ('waiting','playing') AND updated_at>? ORDER BY updated_at DESC").all(Date.now() - 24 * 60 * 60 * 1000)
      .map(row => this.parseRoom(row)).filter(room => room.players.some(player => player.id === userId));
  }

  appendEvents(roomId, actionId, actorUserId, events, firstSeq) {
    const insert = this.db.prepare("INSERT OR IGNORE INTO game_events(room_id, seq, action_id, actor_user_id, type, payload_json, created_at) VALUES(?,?,?,?,?,?,?)");
    events.forEach((event, offset) => insert.run(roomId, firstSeq + offset, actionId, actorUserId, event.type, JSON.stringify(event.payload || {}), Date.now()));
  }

  maxEventSeq(roomId) {
    return Number(this.db.prepare("SELECT COALESCE(MAX(seq), 0) AS seq FROM game_events WHERE room_id=?").get(roomId)?.seq || 0);
  }

  commitRoomAndEvents(room, stagedEvents = [], inviteTokenHash = room.inviteTokenHash) {
    const previousSeq = Number(room.seq || 0);
    const baseSeq = Math.max(previousSeq, this.maxEventSeq(room.id));
    const stamped = stagedEvents.map((record, offset) => ({ ...record.event, seq: baseSeq + offset + 1, createdAt: Date.now(), actionId: record.actionId, actorId: record.actorId }));
    room.seq = baseSeq + stamped.length;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const insert = this.db.prepare("INSERT INTO game_events(room_id, seq, action_id, actor_user_id, type, payload_json, created_at) VALUES(?,?,?,?,?,?,?)");
      stamped.forEach(event => insert.run(room.id, event.seq, event.actionId, event.actorId, event.type, JSON.stringify(event.payload || {}), event.createdAt));
      this.saveRoom(room, inviteTokenHash);
      this.db.exec("COMMIT");
      return stamped.map(({ actionId, actorId, ...event }) => event);
    } catch (error) {
      room.seq = previousSeq;
      try { this.db.exec("ROLLBACK"); } catch {}
      throw error;
    }
  }

  eventsAfter(roomId, seq, limit = 200) {
    return this.db.prepare("SELECT seq, type, payload_json, created_at FROM game_events WHERE room_id=? AND seq>? ORDER BY seq LIMIT ?").all(roomId, seq, limit)
      .map(row => ({ seq: row.seq, type: row.type, payload: JSON.parse(row.payload_json), createdAt: row.created_at }));
  }

  close() { this.db.close(); }
}

module.exports = { Store };
