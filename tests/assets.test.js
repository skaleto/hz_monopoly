"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const assets = path.join(__dirname, "..", "public", "assets");

test("versioned WebP game assets stay within first-game budget", () => {
  const names = ["board.v3.webp", "character_fox.v3.webp", "character_panda.v3.webp", "character_dolphin.v3.webp", "character_tiger.v3.webp", "node_property.v1.webp", "node_landmark.v1.webp", "node_event.v1.webp", "node_transit.v1.webp", "node_special.v1.webp"];
  const sizes = names.map(name => fs.statSync(path.join(assets, name)).size);
  assert.ok(sizes[0] < 180_000, `board too large: ${sizes[0]}`);
  assert.ok(sizes.slice(1, 5).every(size => size < 25_000), `avatar too large: ${sizes.slice(1, 5)}`);
  assert.ok(sizes.slice(5).every(size => size < 12_000), `node art too large: ${sizes.slice(5)}`);
  assert.ok(sizes.reduce((sum, size) => sum + size, 0) < 270_000);
  const celebrationNames = ["celebration_handshake.v2.webp", "celebration_purchase.v2.webp"];
  const celebrationSizes = celebrationNames.map(name => fs.statSync(path.join(assets, name)).size);
  assert.ok(celebrationSizes.every(size => size < 110_000), `celebration sprite too large: ${celebrationSizes}`);
  assert.ok(celebrationSizes.reduce((sum, size) => sum + size, 0) < 180_000);
});

test("web client references versioned WebP instead of PNG", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  const js = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
  const renderer = fs.readFileSync(path.join(__dirname, "..", "public", "dice-renderer.js"), "utf8");
  assert.match(html, /board\.v3\.webp/);
  assert.doesNotMatch(html, /board_base_integrated\.png/);
  assert.match(js, /character_fox\.v3\.webp/);
  assert.doesNotMatch(js, /character_fox\.png/);
  assert.match(js, /node_property\.v1\.webp/);
  assert.match(js, /project_expo\.v1\.webp/);
  assert.doesNotMatch(js, /node_property\.png/);
  assert.match(html, /id="diceCanvas"/);
  assert.match(html, /dice-renderer\.js\?v=0\.6\.2/);
  assert.doesNotMatch(html, /dice_[1-6]\.(?:png|v1\.webp)/);
  assert.doesNotMatch(js, /dice_[1-6]|diceFiles|diceImage/);
  assert.match(renderer, /visibleChanges/);
  assert.match(renderer, /reference-rounded-mesh-v1/);
  assert.doesNotMatch(renderer, /dice-q\.v1\.glb/);
  assert.match(js, /dice-shake-short\.v2\.ogg/);
  assert.match(js, /kenney-cc0-short/);
  assert.match(js, /visibilitychange/);
  assert.match(js, /sound\.rearm/);
  assert.match(js, /context\.state==="closed"/);
  assert.match(html, /id="celebrationOverlay"/);
  assert.ok(fs.statSync(path.join(__dirname, "..", "public", "audio", "dice-shake-short.v2.ogg")).size < 25_000);
  assert.ok(fs.existsSync(path.join(__dirname, "..", "public", "audio", "dice-shake-short.v2.LICENSE.txt")));
  assert.ok(!fs.existsSync(path.join(__dirname, "..", "public", "audio", "dice-shake-heavy.v1.ogg")));
});

test("short multi-dice shake audio keeps the vetted CC0 derivative and server MIME type", () => {
  const crypto = require("node:crypto");
  const audio = fs.readFileSync(path.join(__dirname, "..", "public", "audio", "dice-shake-short.v2.ogg"));
  const server = fs.readFileSync(path.join(__dirname, "..", "server", "server.js"), "utf8");
  assert.equal(crypto.createHash("sha256").update(audio).digest("hex"), "589aa5853285445648b47d49e443b02e09a62e9f6099f3b9acbae4bb766f6848");
  assert.match(server, /"\.ogg": "audio\/ogg"/);
});

test("four expanded-board projects have reproducible source PNG and compact WebP icons", () => {
  const names = ["project_expo", "project_sports", "project_community", "project_art"];
  for (const name of names) {
    const source = path.join(assets, `${name}.png`);
    const runtime = path.join(assets, `${name}.v1.webp`);
    assert.ok(fs.existsSync(source), `${name} source PNG missing`);
    assert.ok(fs.existsSync(runtime), `${name} runtime WebP missing`);
    assert.ok(fs.statSync(source).size < 40_000, `${name} source PNG too large`);
    assert.ok(fs.statSync(runtime).size < 12_000, `${name} runtime WebP too large`);
  }
  const generator = fs.readFileSync(path.join(__dirname, "..", "scripts", "generate-project-icons.js"), "utf8");
  for (const name of names) assert.match(generator, new RegExp(name));
});
