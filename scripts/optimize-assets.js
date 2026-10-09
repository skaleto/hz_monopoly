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
      .resize({ width: 192, height: 192, fit: "contain", withoutEnlargement: true })
      .webp({ quality: 84, alphaQuality: 92, effort: 6 })
      .toFile(path.join(assets, `node_${name}.v1.webp`));
  }
}

main().catch(error => { console.error(error); process.exit(1); });
