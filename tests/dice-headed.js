"use strict";

const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: false });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.setContent('<canvas id="dice" style="display:block;width:390px;height:640px"></canvas>');
    await page.addScriptTag({ path: path.join(__dirname, "..", "public", "dice-renderer.js") });
    const prewarmDuration = await page.evaluate(async () => {
      window.__headedDiceRenderer = window.HangzhouDiceRenderer.create(document.querySelector("#dice"));
      return window.__headedDiceRenderer.prewarm();
    });
    const traces = [];
    for (const value of [1, 2, 3, 4, 5, 6]) {
      traces.push(await page.evaluate(result => window.__headedDiceRenderer.roll(result), value));
    }
    const report = { prewarmDuration, traces };
    for (const trace of report.traces) {
      assert.equal(trace.topAtEnd, trace.result);
      assert.ok(trace.visibleChanges >= 3);
      assert.ok(trace.frameP95 <= 34, `result ${trace.result} frame p95 ${trace.frameP95}`);
      assert.equal(trace.longFrames, 0, `result ${trace.result} long frames ${trace.longFrames}`);
      assert.ok(trace.renderCostP95 <= 8);
      assert.ok(trace.renderCostMax <= 16);
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ diceHeadedMetrics: { prewarmDuration: report.prewarmDuration, traces: report.traces.map(trace => ({ result: trace.result, frameP50: trace.frameP50, frameP95: trace.frameP95, frameMax: trace.frameMax, longFrames: trace.longFrames, renderCostP95: trace.renderCostP95, renderCostMax: trace.renderCostMax, topAtEnd: trace.topAtEnd, visibleChanges: trace.visibleChanges, canvas: trace.canvas })) } }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
