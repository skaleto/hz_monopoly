"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const release = process.argv.slice(2).includes("--release");
const reportFile = path.join(root, "artifacts", "verify", "report.json");
const report = {
  startedAt: new Date().toISOString(),
  mode: release ? "release" : "standard",
  commit: gitText(["rev-parse", "HEAD"]),
  branch: gitText(["branch", "--show-current"]),
  packageVersion: JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version,
  steps: []
};

function gitText(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function record(name, work) {
  const startedAt = Date.now();
  let status = 0;
  let error = null;
  process.stdout.write(`\n==> ${name}\n`);
  try {
    const result = work();
    status = typeof result === "number" ? result : Number(result?.status || 0);
    if (status !== 0) error = `exit ${status}`;
  } catch (caught) {
    status = 1;
    error = caught.stack || caught.message;
    process.stderr.write(`${error}\n`);
  }
  report.steps.push({ name, status: status === 0 ? "pass" : "fail", durationMs: Date.now() - startedAt, error });
  return status === 0;
}

function command(program, args) {
  return spawnSync(program, args, { cwd: root, stdio: "inherit", env: { ...process.env, CI: "1" } }).status ?? 1;
}

function trackedFiles() {
  const result = spawnSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error("GIT_LS_FILES_FAILED");
  return result.stdout.split("\0").filter(Boolean);
}

function checkForbiddenFiles() {
  const forbidden = trackedFiles().filter(file =>
    file === ".env" ||
    file.startsWith("data/") ||
    file.startsWith("node_modules/") ||
    file.startsWith("screenshots/") ||
    file.startsWith("artifacts/") ||
    /\.(?:db|sqlite|sqlite3|log)$/i.test(file)
  );
  if (forbidden.length) throw new Error(`FORBIDDEN_TRACKED_FILES:\n${forbidden.join("\n")}`);
  process.stdout.write(`tracked files: ${trackedFiles().length}; forbidden: 0\n`);
  return 0;
}

function checkSyntax() {
  const files = [];
  const ignoredDirectories = new Set([".git", ".trae", "node_modules", "artifacts", "screenshots"]);
  function visit(relativeDirectory) {
    const directory = path.join(root, relativeDirectory);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) visit(relative);
      } else if (entry.isFile() && entry.name.endsWith(".js")) files.push(relative);
    }
  }
  visit("");
  files.sort();
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    const isModuleSource = /^\s*(?:import|export)\s/m.test(source);
    const result = isModuleSource
      ? spawnSync(path.join(root, "node_modules", ".bin", "esbuild"), [file, "--bundle", "--platform=browser", "--outfile=/dev/null", "--log-level=error"], { cwd: root, encoding: "utf8" })
      : spawnSync(process.execPath, ["--check", file], { cwd: root, encoding: "utf8" });
    if (result.status !== 0) {
      process.stderr.write(result.stderr || result.stdout);
      return result.status || 1;
    }
  }
  process.stdout.write(`JavaScript syntax: ${files.length} files\n`);
  return 0;
}

function releaseCleanliness() {
  const status = gitText(["status", "--porcelain", "--untracked-files=no"]);
  if (status) throw new Error(`RELEASE_REQUIRES_CLEAN_TRACKED_TREE:\n${status}`);
  return 0;
}

record("tracked-file safety", checkForbiddenFiles);
record("JavaScript syntax", checkSyntax);
record("production dependency audit", () => command("npm", ["audit", "--omit=dev", "--audit-level=high"]));
record("core, integration and asset tests", () => command("npm", ["test"]));
record("390x844 product E2E", () => command("npm", ["run", "test:e2e"]));
record("deterministic M1 simulation hard gate", () => command("npm", ["run", "sim:balance", "--", "--games", "200", "--profile", "current", "--assert-hard"]));
record("deterministic M3 cash-pressure candidate gate", () => command("npm", ["run", "sim:balance", "--", "--games", "1000", "--profile", "cautious", "--seed", "20261010", "--assert-hard", "--assert-candidate"]));

if (release) {
  record("release tracked-tree cleanliness", releaseCleanliness);
  record("fresh reproducible asset build", () => command(process.execPath, ["scripts/verify-reproducible-build.js"]));
}

report.finishedAt = new Date().toISOString();
report.status = report.steps.every(step => step.status === "pass") ? "pass" : "fail";
fs.mkdirSync(path.dirname(reportFile), { recursive: true });
fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`\nVERIFY=${report.status.toUpperCase()} report=${path.relative(root, reportFile)}\n`);
if (report.status !== "pass") process.exitCode = 1;
