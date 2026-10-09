"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hz-monopoly-release-"));
const archive = path.join(tempRoot, "source.tar");
const fresh = path.join(tempRoot, "source");

function run(program, args, cwd = root) {
  const result = spawnSync(program, args, { cwd, stdio: "inherit", env: { ...process.env, CI: "1" } });
  if (result.status !== 0) throw new Error(`${program} ${args.join(" ")} failed with ${result.status}`);
}

function sha(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function generatedFiles(base) {
  const assets = fs.readdirSync(path.join(base, "public", "assets"))
    .filter(name => name.endsWith(".webp"))
    .map(name => path.join("public", "assets", name));
  return [...assets, path.join("public", "dice-renderer.js")].sort();
}

try {
  fs.mkdirSync(fresh);
  run("git", ["archive", "--format=tar", "-o", archive, "HEAD"]);
  run("tar", ["-xf", archive, "-C", fresh]);
  run("npm", ["ci", "--ignore-scripts"], fresh);
  run("npm", ["run", "build:assets"], fresh);
  run("npm", ["run", "build:celebrations"], fresh);
  run("npm", ["run", "build:project-icons"], fresh);
  run("npm", ["run", "build:dice"], fresh);

  const files = generatedFiles(root);
  const mismatches = files.filter(file => sha(path.join(root, file)) !== sha(path.join(fresh, file)));
  if (mismatches.length) throw new Error(`NON_REPRODUCIBLE_GENERATED_FILES:\n${mismatches.join("\n")}`);
  process.stdout.write(`REPRODUCIBLE_BUILD=PASS files=${files.length}\n`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
