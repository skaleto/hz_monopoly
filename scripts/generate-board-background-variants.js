"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "public", "assets", "board_base_integrated.png");
const output = path.join(root, "artifacts", "background-variants");
const width = 1280;
const height = 853;

const variants = [
  { id:"a-clear-lake", name:"A 清爽湖蓝", blur:.45, saturation:.72, brightness:1.05, top:"#e7fbff", bottom:"#c9f3ea", opacity:.12 },
  { id:"b-morning-mist", name:"B 晨雾青绿", blur:1.15, saturation:.56, brightness:1.07, top:"#f3fbef", bottom:"#cfe8df", opacity:.19 },
  { id:"c-paper-pastel", name:"C 淡彩宣纸", blur:.8, saturation:.34, brightness:1.08, top:"#fff1d2", bottom:"#e8d5b3", opacity:.28, recomb:[[1.08,0,0],[0,1,0],[0,0,.84]] }
];

function overlay({top,bottom,opacity}) {
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="wash" x1="0" y1="0" x2="0.75" y2="1"><stop offset="0" stop-color="${top}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${bottom}" stop-opacity="${Math.min(.42,opacity+.08)}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#wash)"/></svg>`);
}

async function main() {
  fs.mkdirSync(output,{recursive:true});
  for (const variant of variants) {
    const target=path.join(output,`board-${variant.id}.webp`);
    let pipeline=sharp(source)
      .resize({width,withoutEnlargement:true})
      .blur(variant.blur)
      .modulate({saturation:variant.saturation,brightness:variant.brightness});
    if(variant.recomb)pipeline=pipeline.recomb(variant.recomb);
    await pipeline
      .composite([{input:overlay(variant),blend:"over"}])
      .webp({quality:80,effort:6,smartSubsample:true})
      .toFile(target);
  }
  fs.writeFileSync(path.join(output,"manifest.json"),`${JSON.stringify({source:path.relative(root,source),width,height,variants},null,2)}\n`);
  process.stdout.write(`${variants.map(item=>`${item.id}:${path.join(output,`board-${item.id}.webp`)}`).join("\n")}\n`);
}

main().catch(error=>{console.error(error);process.exit(1)});
