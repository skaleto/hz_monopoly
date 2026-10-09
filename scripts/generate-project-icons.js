"use strict";

const path = require("node:path");
const sharp = require("sharp");

const assets = path.join(__dirname, "..", "public", "assets");
const icons = [
  {
    name: "project_expo",
    sky: "#d9f4ff",
    ground: "#72c7dc",
    body: '<path d="M118 333h276v70H118z" fill="#fff8e8" stroke="#17304f" stroke-width="18"/><path d="M148 327l41-122h134l41 122" fill="#ffd95a" stroke="#17304f" stroke-width="18" stroke-linejoin="round"/><path d="M213 205v122m86-122v122" stroke="#17304f" stroke-width="16"/><path d="M238 116h36v89h-36z" fill="#ff7f73" stroke="#17304f" stroke-width="14"/><path d="M274 124c63 3 82 25 95 49-31 10-61 7-95-5z" fill="#53c7a2" stroke="#17304f" stroke-width="12"/>'
  },
  {
    name: "project_sports",
    sky: "#e4f7e9",
    ground: "#65c28d",
    body: '<ellipse cx="256" cy="324" rx="160" ry="91" fill="#fff8e8" stroke="#17304f" stroke-width="18"/><ellipse cx="256" cy="318" rx="111" ry="52" fill="#72c7dc" stroke="#17304f" stroke-width="14"/><path d="M145 318h222M256 266v104" stroke="#fff" stroke-width="10"/><path d="M185 214l22-80h98l22 80" fill="#ff8fb4" stroke="#17304f" stroke-width="16"/><circle cx="256" cy="174" r="28" fill="#ffd95a" stroke="#17304f" stroke-width="12"/>'
  },
  {
    name: "project_community",
    sky: "#eee8ff",
    ground: "#9d83e8",
    body: '<path d="M118 393V197l92-61 72 52 62-39 50 42v202z" fill="#fff8e8" stroke="#17304f" stroke-width="18" stroke-linejoin="round"/><path d="M172 242h55v55h-55zm112 0h55v55h-55zm-112 91h55v60h-55zm112 0h55v60h-55z" fill="#72c7dc" stroke="#17304f" stroke-width="11"/><path d="M94 205l116-82 73 51 62-39 73 62" fill="none" stroke="#ff7f73" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    name: "project_art",
    sky: "#fff0d8",
    ground: "#efab62",
    body: '<path d="M105 390h302l-32-189-119-78-119 78z" fill="#fff8e8" stroke="#17304f" stroke-width="18" stroke-linejoin="round"/><path d="M160 217h192M148 272h216" stroke="#ff8fb4" stroke-width="18" stroke-linecap="round"/><path d="M210 390v-80h92v80" fill="#72c7dc" stroke="#17304f" stroke-width="14"/><path d="M256 123v-40" stroke="#17304f" stroke-width="14"/><path d="M256 82c48 0 74 18 91 39-42 13-72 10-91-1z" fill="#53c7a2" stroke="#17304f" stroke-width="12"/>'
  }
];

function svg(icon) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="96" fill="${icon.sky}"/>
    <path d="M0 390c92-55 163-44 244 5 87-57 177-56 268 3v114H0z" fill="${icon.ground}"/>
    ${icon.body}
  </svg>`;
}

async function main() {
  for (const icon of icons) {
    const source = Buffer.from(svg(icon));
    await sharp(source).png().toFile(path.join(assets, `${icon.name}.png`));
    await sharp(source).resize(256, 256).webp({ quality: 88, effort: 6 }).toFile(path.join(assets, `${icon.name}.v1.webp`));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
