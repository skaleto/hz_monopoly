"use strict";

const fs=require("node:fs"),path=require("node:path"),sharp=require("sharp");
const root=path.resolve(__dirname,".."),source=path.join(root,"public","assets","board_base_integrated.png"),output=path.join(root,"artifacts","background-variants");
const variants=[
  {id:"a-water-garden",name:"A 西湖水园",extract:{left:80,top:0,width:732,height:1024}},
  {id:"b-twin-bridges",name:"B 双桥绿洲",extract:{left:402,top:0,width:732,height:1024}},
  {id:"c-metro-lakeside",name:"C 紫轨湖畔",extract:{left:724,top:0,width:732,height:1024}}
];

async function main(){fs.mkdirSync(output,{recursive:true});for(const variant of variants){await sharp(source).extract(variant.extract).resize(728,1016,{fit:"fill"}).webp({quality:88,effort:6,smartSubsample:true}).toFile(path.join(output,`board-${variant.id}.webp`))}fs.writeFileSync(path.join(output,"manifest.json"),`${JSON.stringify({kind:"portrait-recomposition-no-filter",source:path.relative(root,source),width:728,height:1016,variants},null,2)}\n`);process.stdout.write(`${variants.map(item=>`${item.id}:${path.join(output,`board-${item.id}.webp`)}`).join("\n")}\n`)}
main().catch(error=>{console.error(error);process.exit(1)});
