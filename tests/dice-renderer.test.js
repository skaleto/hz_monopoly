"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

test("single dice geometry tumbles all visible faces and lands on every authoritative result", { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.setContent('<canvas id="dice" style="display:block;width:390px;height:640px"></canvas>');
    await page.addScriptTag({ path: path.join(__dirname, "..", "public", "dice-renderer.js") });
    const traces = await page.evaluate(async () => {
      const renderer = window.HangzhouDiceRenderer.create(document.querySelector("#dice"));
      const results = [];
      for (const value of [1, 2, 3, 4, 5, 6]) results.push(await renderer.roll(value));
      return results;
    });
    assert.equal(traces.length, 6);
    for (const trace of traces) {
      assert.equal(trace.visualStyle, "reference-rounded-mesh-v1");
      assert.equal(trace.topAtEnd, trace.result);
      assert.ok(trace.visibleChanges >= 3, `result ${trace.result} visible changes ${trace.visibleChanges}`);
      assert.ok(trace.duration >= 1300 && trace.duration <= 1550, `result ${trace.result} duration ${trace.duration}`);
      assert.ok(trace.renderCostP95 <= 8, `result ${trace.result} draw p95 ${trace.renderCostP95}`);
      assert.ok(trace.renderCostMax <= 16, `result ${trace.result} draw max ${trace.renderCostMax}`);
      assert.equal(trace.prewarmed, true);
      assert.ok(trace.canvas.dpr <= 1.5);
      assert.ok(new Set(trace.samples.flatMap(sample => sample.visible)).size >= 5);
    }
    console.log(JSON.stringify({ diceRendererMetrics: traces.map(trace => ({ result: trace.result, prewarmDuration: trace.prewarmDuration, frameP50: trace.frameP50, frameP95: trace.frameP95, frameMax: trace.frameMax, longFrames: trace.longFrames, renderCostP50: trace.renderCostP50, renderCostP95: trace.renderCostP95, renderCostMax: trace.renderCostMax, canvas: trace.canvas })) }));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
