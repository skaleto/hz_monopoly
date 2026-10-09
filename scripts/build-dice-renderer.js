"use strict";

const path = require("node:path");
const esbuild = require("esbuild");

esbuild.build({
  entryPoints: [path.join(__dirname, "..", "src", "dice-renderer.js")],
  outfile: path.join(__dirname, "..", "public", "dice-renderer.js"),
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["chrome100", "safari15.4"],
  legalComments: "eof"
}).catch(error => {
  console.error(error);
  process.exit(1);
});
