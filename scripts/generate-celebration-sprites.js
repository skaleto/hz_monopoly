"use strict";

const path = require("node:path");
const sharp = require("sharp");

const assets = path.join(__dirname, "..", "public", "assets");
const frames = 12;
const frameSize = 192;

function sparkle(x, y, scale, opacity) {
  return `<path d="M ${x} ${y-10*scale} L ${x+3*scale} ${y-3*scale} L ${x+10*scale} ${y} L ${x+3*scale} ${y+3*scale} L ${x} ${y+10*scale} L ${x-3*scale} ${y+3*scale} L ${x-10*scale} ${y} L ${x-3*scale} ${y-3*scale} Z" fill="#ffd95a" stroke="#17304f" stroke-width="${2*scale}" opacity="${opacity}"/>`;
}

function handshakeFrame(index) {
  const x = index * frameSize;
  const p = index / (frames - 1);
  const approach = 1-Math.pow(1-Math.min(1,p*1.7),3);
  const bounce = p > .58 ? Math.sin((p - .58) / .42 * Math.PI) * 5 : 0;
  const left = 15 + approach * 24;
  const right = 145 - approach * 24;
  const spark = Math.max(0, (p - .38) / .35);
  return `<g transform="translate(${x} 0) scale(1.2)">
    <circle cx="80" cy="84" r="${28+approach*38}" fill="url(#celebrationGlow)" opacity="${.18+.5*approach}"/>
    <g transform="translate(0 ${bounce})">
      <path d="M ${left-22} 94 Q ${left-15} 69 ${left+15} 72 L 78 91 L 65 114 Q 40 105 ${left-22} 110 Z" fill="url(#mintSleeve)" stroke="#17304f" stroke-width="4" stroke-linejoin="round" filter="url(#softShadow)"/>
      <path d="M ${right+22} 94 Q ${right+15} 69 ${right-15} 72 L 82 91 L 95 114 Q 120 105 ${right+22} 110 Z" fill="url(#purpleSleeve)" stroke="#17304f" stroke-width="4" stroke-linejoin="round" filter="url(#softShadow)"/>
      <path d="M 58 81 C 70 73 77 76 82 83 L 93 99 C 97 105 89 113 82 108 L 70 96 C 64 103 53 96 58 88 Z" fill="url(#skin)" stroke="#17304f" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M 102 81 C 90 73 83 76 78 83 L 67 99 C 63 105 71 113 78 108 L 90 96 C 96 103 107 96 102 88 Z" fill="url(#skin)" stroke="#17304f" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M 70 96 Q 80 88 90 96" fill="none" stroke="#d69371" stroke-width="2" stroke-linecap="round" opacity="${approach}"/>
    </g>
    ${sparkle(80,42,1,Math.min(1,spark))}
    ${sparkle(42,50,.55,Math.min(1,spark*.8))}
    ${sparkle(118,55,.5,Math.min(1,spark*.75))}
    <circle cx="35" cy="118" r="4" fill="#ff8e82" opacity="${spark}"/><circle cx="125" cy="118" r="4" fill="#53c7a2" opacity="${spark}"/>
  </g>`;
}

function purchaseFrame(index) {
  const x = index * frameSize;
  const p = index / (frames - 1);
  const rise = 132 - 82 * (1 - Math.pow(1-p, 2));
  const height = 126 - rise;
  const spark = Math.max(0, (p - .48) / .3);
  const checkScale = Math.max(0, (p - .62) / .38);
  return `<g transform="translate(${x} 0) scale(1.2)">
    <circle cx="80" cy="82" r="${30+p*38}" fill="url(#celebrationGlow)" opacity="${.12+.35*p}"/>
    <ellipse cx="80" cy="133" rx="55" ry="11" fill="#17304f" opacity="${.08+.12*p}"/>
    <g transform="translate(0 ${rise})">
      <path d="M 33 0 L 80 -27 L 127 0 L 120 ${height} L 40 ${height} Z" fill="url(#buildingFront)" stroke="#17304f" stroke-width="4" stroke-linejoin="round" filter="url(#softShadow)"/>
      <path d="M 80 -27 L 127 0 L 80 24 L 33 0 Z" fill="url(#goldRoof)" stroke="#17304f" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M 80 24 L 127 0 L 120 ${height} L 80 ${height+7} Z" fill="url(#buildingSide)" stroke="#17304f" stroke-width="3"/>
      <rect x="52" y="25" width="16" height="17" rx="3" fill="#53c7a2" stroke="#17304f" stroke-width="3"/>
      <rect x="91" y="25" width="16" height="17" rx="3" fill="#32a9c7" stroke="#17304f" stroke-width="3"/>
      <rect x="52" y="55" width="16" height="17" rx="3" fill="#32a9c7" stroke="#17304f" stroke-width="3"/>
      <rect x="91" y="55" width="16" height="17" rx="3" fill="#53c7a2" stroke="#17304f" stroke-width="3"/>
    </g>
    <g transform="translate(110 35) scale(${checkScale})" opacity="${checkScale}">
      <circle cx="0" cy="0" r="22" fill="url(#success)" stroke="#17304f" stroke-width="3.5" filter="url(#softShadow)"/>
      <path d="M -10 0 L -3 8 L 12 -9" fill="none" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    ${sparkle(34,40,.55,Math.min(1,spark))}
    ${sparkle(132,70,.45,Math.min(1,spark*.8))}
  </g>`;
}

async function writeSprite(name, frameBuilder) {
  const content = Array.from({ length: frames }, (_, index) => frameBuilder(index)).join("");
  const defs = `<defs>
    <radialGradient id="celebrationGlow"><stop offset="0" stop-color="#fff6b8" stop-opacity=".95"/><stop offset="1" stop-color="#ffd95a" stop-opacity="0"/></radialGradient>
    <linearGradient id="mintSleeve" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#a5f0d6"/><stop offset="1" stop-color="#42b994"/></linearGradient>
    <linearGradient id="purpleSleeve" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c8bbff"/><stop offset="1" stop-color="#8065d5"/></linearGradient>
    <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffe5d0"/><stop offset="1" stop-color="#f3b58f"/></linearGradient>
    <linearGradient id="buildingFront" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fffdf4"/><stop offset="1" stop-color="#f2e2bd"/></linearGradient>
    <linearGradient id="buildingSide" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eee7ff"/><stop offset="1" stop-color="#b9a6e8"/></linearGradient>
    <linearGradient id="goldRoof" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff09b"/><stop offset="1" stop-color="#f3bd32"/></linearGradient>
    <linearGradient id="success"><stop stop-color="#8ee7bf"/><stop offset="1" stop-color="#35ad83"/></linearGradient>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#17304f" flood-opacity=".22"/></filter>
  </defs>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${frames*frameSize}" height="${frameSize}" viewBox="0 0 ${frames*frameSize} ${frameSize}">${defs}${content}</svg>`;
  await sharp(Buffer.from(svg)).webp({ quality: 84, alphaQuality: 92, effort: 6 }).toFile(path.join(assets, `${name}.v2.webp`));
}

Promise.all([
  writeSprite("celebration_handshake", handshakeFrame),
  writeSprite("celebration_purchase", purchaseFrame)
]).catch(error => { console.error(error); process.exit(1); });
