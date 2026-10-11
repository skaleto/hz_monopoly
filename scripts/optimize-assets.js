"use strict";

const path = require("node:path");
const sharp = require("sharp");

const assets = path.join(__dirname, "..", "public", "assets");

async function main() {
  await sharp(path.join(assets, "board_base_integrated.png"))
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 78, effort: 6, smartSubsample: true })
    .toFile(path.join(assets, "board.v3.webp"));

  for (const name of ["fox", "panda", "dolphin", "tiger"]) {
    await sharp(path.join(assets, `character_${name}.png`))
      .resize({ width: 256, height: 256, fit: "contain", withoutEnlargement: true })
      .webp({ quality: 82, alphaQuality: 90, effort: 6 })
      .toFile(path.join(assets, `character_${name}.v3.webp`));
  }

  for (const name of ["property", "landmark", "event", "transit", "special"]) {
    await sharp(path.join(assets, `node_${name}.png`))
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize({ width: 176, height: 176, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 82, alphaQuality: 92, effort: 6 })
      .toFile(path.join(assets, `node_${name}.v2.webp`));
  }
}

main().catch(error => { console.error(error); process.exit(1); });
