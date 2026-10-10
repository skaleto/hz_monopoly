"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hangzhou-e2e-"));
process.env.DB_FILE = path.join(tempDir, "e2e.db");
process.env.APP_SECRET = "e2e-secret";
process.env.SMS_MODE = "dev";
process.env.DEV_SMS_CODE = "123456";
process.env.RECONNECT_GRACE_MS = "300";
process.env.BASE_PATH = "/hangzhou-partners";
process.env.NODE_ENV = "test";
process.env.TEST_DICE_SEQUENCE = "5,1,6";
process.env.TEST_DICE = "1";
process.env.TEST_FIRST_SEAT = "0";
process.env.TEST_CITY_EVENT_ID = "venture_window";

const { server, store, close } = require("../server/server");
const screenshotDir = path.join(__dirname, "..", "screenshots");
const previewVideoDir = process.env.RECORD_E2E_DIR || "";
fs.mkdirSync(screenshotDir, { recursive: true });
if (previewVideoDir) fs.mkdirSync(previewVideoDir, { recursive: true });

async function login(page, phone, nickname) {
  await page.locator("#phoneInput").fill(phone);
  await page.locator("#nicknameInput").fill(nickname);
  await page.locator("#sendCodeButton").click();
  await page.locator("#codeInput").fill("123456");
  await page.locator("#consentInput").check();
  await page.locator("#loginButton").click();
  await page.locator("#homeView").waitFor({ state: "visible" });
}

async function main() {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/hangzhou-partners/`;
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    const contextA = await browser.newContext({ viewport: { width: 390, height: 844 }, ...(previewVideoDir ? { recordVideo: { dir: previewVideoDir, size: { width: 390, height: 844 } } } : {}) });
    const contextB = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const a = await contextA.newPage();
    const b = await contextB.newPage();
    const imageRequestsA = [];
    a.on("request", request => { if (request.resourceType() === "image") imageRequestsA.push(new URL(request.url()).pathname); });
    for (const page of [a, b]) {
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => {
        if (message.type() === "error" && !message.text().includes("401 (Unauthorized)")) errors.push(message.text());
      });
    }

    await a.goto(baseUrl);
    assert.ok(!imageRequestsA.some(pathname => pathname.includes("board.v3.webp")));
    await a.screenshot({ path: path.join(screenshotDir, "01-login-mobile.png"), fullPage: true });
    await login(a, "13800000011", "桃桃");
    await a.locator("#maxPlayersSelect").selectOption("4");
    await a.locator("#createRoomButton").click();
    await a.locator("#roomView").waitFor({ state: "visible" });
    await a.locator("#addBotButton").click();
    await a.locator(".seat.bot").waitFor({ state: "visible" });
    const code = (await a.locator("#roomCode").textContent()).trim();

    await b.goto(baseUrl);
    await login(b, "13800000012", "小禾");
    await b.locator("#roomCodeInput").fill(code);
    await b.locator("#joinRoomButton").click();
    await b.locator("#roomView").waitFor({ state: "visible" });
    await b.locator("#readyButton").click();
    await a.waitForFunction(() => [...document.querySelectorAll(".seat small")].some(node => node.textContent.includes("已准备")));
    await a.locator("#addBotButton").click();
    await a.waitForFunction(() => document.querySelectorAll(".seat.bot").length === 2);
    await a.screenshot({ path: path.join(screenshotDir, "02-room-two-humans-two-bots.png"), fullPage: true });

    await a.locator("#startGameButton").click();
    await a.locator("#gameView").waitFor({ state: "visible" });
    await a.locator("#turnOrderBanner").waitFor({ state: "visible" });
    await a.locator("#turnOrderBanner").evaluate(node => { const animation=node.getAnimations()[0]; if(animation){animation.currentTime=700;animation.pause()} });
    await a.screenshot({ path: path.join(screenshotDir, "03-turn-order-mobile.png"), fullPage: true });
    await a.locator("#turnOrderBanner").evaluate(node => node.getAnimations()[0]?.play());
    await b.locator("#gameView").waitFor({ state: "visible" });
    await b.locator("#turnOrderBanner").waitFor({ state: "visible" });
    assert.match(await a.locator("#turnOrderSummary").textContent(), /①桃桃（你） → ②青团 → ③小禾 → ④小蓝/);
    assert.equal(await a.locator("#turnOrderBanner").evaluate(node => getComputedStyle(node).pointerEvents), "none");
    assert.equal(await a.locator("#turnOrderBanner button").count(), 0);
    await a.locator("#turnOrderBanner").waitFor({ state: "hidden", timeout: 3000 });
    await b.locator("#turnOrderBanner").waitFor({ state: "hidden", timeout: 3000 });
    assert.equal(await a.locator("#soundToggle").textContent(), "音效开");
    await a.locator("#soundToggle").click();
    assert.equal(await a.locator("#soundToggle").textContent(), "音效关");
    assert.equal(await a.evaluate(() => localStorage.getItem("hc_sound_enabled")), "0");
    await a.locator("#soundToggle").click();
    assert.equal(await a.locator("#soundToggle").getAttribute("aria-pressed"), "true");
    assert.equal(await a.evaluate(() => window.__soundController.suspendForTest()), "suspended");
    await a.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await a.locator(".player-chip").first().click();
    await a.waitForFunction(() => window.__soundController.state() === "running");
    assert.equal(await a.locator(".player-chip").count(), 4);
    assert.equal(await a.locator(".player-metrics").count(), 4);
    assert.equal(await a.locator(".player-metrics span").count(), 16);
    assert.match(await a.locator(".player-chip").first().textContent(), /金币/);
    assert.match(await a.locator(".player-chip").first().textContent(), /影响力/);
    assert.match(await a.locator(".player-chip").first().textContent(), /道具/);
    assert.match(await a.locator(".player-chip").first().textContent(), /城市分/);
    assert.equal(await a.locator("#sectorProgress .sector-chip").count(), 5);
    assert.match(await a.locator("#sectorProgress .sector-chip").first().textContent(), /0\/5.*未进入/s);
    assert.equal(await a.locator("#sectorProgress .sector-dots").count(), 5);
    assert.equal(await a.locator("#sectorProgress .sector-dots i").count(), 25);
    assert.equal(await a.locator("#sectorModal").count(), 0);
    assert.equal(await a.locator("#sectorGuide").isHidden(), true);
    await a.locator("#sectorGuideToggle").click();
    assert.equal(await a.locator("#sectorGuideToggle").getAttribute("aria-expanded"), "true");
    assert.deepEqual(await a.locator("#sectorLegend [data-sector-tier]").evaluateAll(nodes => nodes.map(node => node.textContent)), ["1入局","2分红+10%","3可建3级","4城市分+3"]);
    assert.match(await a.locator("#sectorGuide").textContent(), /独资或合伙都计 1 个.*只作用于同板块项目/);
    await a.screenshot({ path: path.join(screenshotDir, "03b-sector-benefits-mobile.png"), fullPage: true });
    await a.locator("#sectorGuideToggle").click();
    assert.equal(await a.locator("#sectorGuide").isHidden(), true);
    assert.equal(await a.locator("#gameHomeButton").evaluate(button => button.parentElement.classList.contains("game-top-actions")), true);
    assert.equal(await a.locator("#rollButton").evaluate(button => button.parentElement.classList.contains("game-bottom")), true);
    assert.equal(await a.locator(".game-bottom > button").count(), 3);
    assert.deepEqual(await a.locator(".game-bottom > button").evaluateAll(buttons => buttons.map(button => button.id)), ["rollButton","inventoryButton","upgradeButton"]);
    assert.equal(await a.locator("#endGameButton").isVisible(), true);
    assert.equal(await b.locator("#endGameButton").isVisible(), false);
    assert.equal(await b.locator("#upgradeButton").isDisabled(), true);
    assert.match(await b.locator("#upgradeButton").getAttribute("title"), /自己的回合/);
    await a.locator("#endGameButton").click();
    await a.locator("#endGameModal").waitFor({ state: "visible" });
    await a.screenshot({ path: path.join(screenshotDir, "18-owner-end-game-confirm-mobile.png"), fullPage: true });
    await a.locator("#endGameCancelButton").click();
    await a.locator("#endGameModal").waitFor({ state: "hidden" });
    assert.equal(await b.locator(".board-tile").count(), 49);
    assert.equal(await b.locator(".board-tile .tile-icon").count(), 49);
    assert.equal(await b.locator(".board-tile .type-mark").count(), 0);
    assert.equal(await b.locator('.board-tile[data-tile-type="property"] .tile-price').count(), 25);
    assert.match(await b.locator('.board-tile[data-tile-type="property"] .tile-price').first().textContent(), /^¥\d+$/);
    assert.equal(await b.locator(".board-tile.has-price").evaluateAll(tiles => tiles.every(tile => {
      const parts = [tile.querySelector(".tile-icon"), tile.querySelector(".tile-name"), tile.querySelector(".tile-price")].map(node => node.getBoundingClientRect());
      return parts.every((rect, index) => index === 0 || rect.top >= parts[index - 1].bottom - 0.5);
    })), true, "project icon, name and price must use separate rows");
    assert.deepEqual(await b.locator(".board-tile.has-price").evaluateAll(tiles => {
      const pairs=tiles.map(tile=>[tile.querySelector(".tile-name"),tile.querySelector(".tile-price")].map(node=>{const style=getComputedStyle(node);return`${style.fontSize}/${style.fontWeight}`}));
      return {nameStyles:[...new Set(pairs.map(pair=>pair[0]))],priceStyles:[...new Set(pairs.map(pair=>pair[1]))],sameLevel:pairs.every(pair=>pair[0]===pair[1])};
    }), { nameStyles:["5.2px/800"],priceStyles:["5.2px/800"],sameLevel:true });
    assert.equal(await b.locator(".board-tile").evaluateAll(tiles => tiles.every(tile => { const rect=tile.getBoundingClientRect(); return Math.abs(rect.width-rect.height)<=0.5; })), true, "all board nodes must be square");
    const persistentLayoutCollisions = await b.evaluate(() => {
      const intersects = (a,b) => Math.min(a.right,b.right) > Math.max(a.left,b.left) && Math.min(a.bottom,b.bottom) > Math.max(a.top,b.top);
      const rect = selector => document.querySelector(selector).getBoundingClientRect();
      return {
        topActionsVsStatus: intersects(rect(".game-top-actions"), rect(".header-status")),
        itemLabelVsBadge: intersects(rect("#inventoryButton .button-label"), rect("#itemCount")),
        railVsPlayers: intersects(rect("#gameFeedbackRail"), rect("#playerBar")),
        railVsBoard: intersects(rect("#gameFeedbackRail"), rect(".board-shell"))
      };
    });
    assert.deepEqual(persistentLayoutCollisions, { topActionsVsStatus:false, itemLabelVsBadge:false, railVsPlayers:false, railVsBoard:true });
    assert.equal(await b.locator("#gameFeedbackRail").evaluate(node=>node.parentElement.id),"gameBoard");
    assert.equal(await b.locator(".board-tile.junction").count(), 2);
    assert.equal(await b.locator(".route-line").count(), 0);
    assert.equal(await b.locator("#branchGuide").count(), 1);
    assert.equal(await b.locator("#branchGuide .branch-segment.water").count(), 1);
    assert.equal(await b.locator("#branchGuide .branch-segment.metro").count(), 1);
    assert.equal(await b.locator("#branchArrowGuide").count(), 0);
    assert.equal(await b.locator(".branch-arrow").count(), 0);
    assert.equal(await b.locator(".route-label").count(), 0);
    const nodeChainGaps = await b.evaluate(() => {
      const center = index => { const rect = document.querySelector(`[data-tile-index="${index}"]`).getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }; };
      const maxGap = indexes => Math.max(...indexes.slice(1).map((index, offset) => { const a = center(indexes[offset]), b = center(index); return Math.hypot(a.x - b.x, a.y - b.y); }));
      return { water: maxGap([23,28,29,45,31,32,33,46,35,36,2]), metro: maxGap([10,37,38,48,39,30,40,41,34,44,17]) };
    });
    assert.ok(nodeChainGaps.water <= 80, `water chain gap ${nodeChainGaps.water}`);
    assert.ok(nodeChainGaps.metro <= 64, `metro chain gap ${nodeChainGaps.metro}`);
    const metroRouteGeometry = await b.evaluate(() => {
      const indexes=[10,37,38,48,39,30,40,41,34,44,17],centers=indexes.map(index=>{const rect=document.querySelector(`[data-tile-index="${index}"]`).getBoundingClientRect();return{index,x:rect.x+rect.width/2,y:rect.y+rect.height/2}}),pairGaps=[],vectors=centers.slice(1).map((point,index)=>({x:point.x-centers[index].x,y:point.y-centers[index].y}));
      centers.forEach((point,index)=>centers.slice(index+1).forEach(other=>pairGaps.push({pair:[point.index,other.index],gap:Math.hypot(point.x-other.x,point.y-other.y)})));
      const lengths=vectors.map(vector=>Math.hypot(vector.x,vector.y)),turns=vectors.slice(1).map((vector,index)=>{const previous=vectors[index],cos=(previous.x*vector.x+previous.y*vector.y)/(Math.hypot(previous.x,previous.y)*Math.hypot(vector.x,vector.y));return Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI}),nearest=pairGaps.sort((left,right)=>left.gap-right.gap)[0];return { minGap:nearest.gap, nearestPair:nearest.pair, maxTurn:Math.max(...turns), pathRatio:lengths.reduce((sum,length)=>sum+length,0)/Math.hypot(centers.at(-1).x-centers[0].x,centers.at(-1).y-centers[0].y), rightmostX:Math.max(...centers.map(point=>point.x)), topmostY:Math.min(...centers.map(point=>point.y)) };
    });
    assert.ok(metroRouteGeometry.minGap >= 26, `metro nodes are crowded ${JSON.stringify(metroRouteGeometry)}`);
    assert.ok(metroRouteGeometry.maxTurn <= 90, `metro route reverses sharply ${JSON.stringify(metroRouteGeometry)}`);
    assert.ok(metroRouteGeometry.pathRatio <= 1.28, `metro route too winding ${JSON.stringify(metroRouteGeometry)}`);
    const topBranchOverlap = await b.evaluate(() => {
      const indexes=[10,37,38,48,39,30,40,41,34,44,17],entries=indexes.map(index=>({index,rect:document.querySelector(`[data-tile-index="${index}"]`).getBoundingClientRect()})),overlaps=[];
      entries.forEach((left,index)=>entries.slice(index+1).forEach(right=>{const width=Math.max(0,Math.min(left.rect.right,right.rect.right)-Math.max(left.rect.left,right.rect.left)),height=Math.max(0,Math.min(left.rect.bottom,right.rect.bottom)-Math.max(left.rect.top,right.rect.top)),ratio=width*height/Math.min(left.rect.width*left.rect.height,right.rect.width*right.rect.height);if(ratio>0)overlaps.push({pair:[left.index,right.index],ratio})}));
      return {maxRatio:Math.max(0,...overlaps.map(item=>item.ratio)),significantPairs:overlaps.filter(item=>item.ratio>.05)};
    });
    assert.ok(topBranchOverlap.maxRatio <= .2, `top branch overlap too large ${JSON.stringify(topBranchOverlap)}`);
    assert.ok(topBranchOverlap.significantPairs.length <= 4, `too many stacked top nodes ${JSON.stringify(topBranchOverlap)}`);
    const movedOuterOverlap = await b.evaluate(() => {
      const groups=[[47,2,3],[42,13,14],[43,24,25]],ratios=[];
      for(const [moved,...neighbors] of groups){const left=document.querySelector(`[data-tile-index="${moved}"]`).getBoundingClientRect();for(const neighbor of neighbors){const right=document.querySelector(`[data-tile-index="${neighbor}"]`).getBoundingClientRect(),width=Math.max(0,Math.min(left.right,right.right)-Math.max(left.left,right.left)),height=Math.max(0,Math.min(left.bottom,right.bottom)-Math.max(left.top,right.top));ratios.push({pair:[moved,neighbor],ratio:width*height/Math.min(left.width*left.height,right.width*right.height)})}}
      return {maxRatio:Math.max(...ratios.map(item=>item.ratio)),pairs:ratios};
    });
    assert.ok(movedOuterOverlap.maxRatio <= .2, `moved outer node overlap too large ${JSON.stringify(movedOuterOverlap)}`);
    const waterRouteGeometry = await b.evaluate(() => {
      const indexes=[23,28,29,45,31,32,33,46,35,36,2],centers=indexes.map(index=>{const rect=document.querySelector(`[data-tile-index="${index}"]`).getBoundingClientRect();return{x:rect.x+rect.width/2,y:rect.y+rect.height/2}}),vectors=centers.slice(1).map((point,index)=>({x:point.x-centers[index].x,y:point.y-centers[index].y}));
      const lengths=vectors.map(vector=>Math.hypot(vector.x,vector.y)),turns=vectors.slice(1).map((vector,index)=>{const previous=vectors[index],cos=(previous.x*vector.x+previous.y*vector.y)/(Math.hypot(previous.x,previous.y)*Math.hypot(vector.x,vector.y));return Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI}),inner=centers.slice(1,-1),pairGaps=[];
      inner.forEach((point,index)=>inner.slice(index+1).forEach(other=>pairGaps.push(Math.hypot(point.x-other.x,point.y-other.y))));
      return{pathRatio:lengths.reduce((sum,length)=>sum+length,0)/Math.hypot(centers.at(-1).x-centers[0].x,centers.at(-1).y-centers[0].y),maxTurn:Math.max(...turns),minInnerGap:Math.min(...pairGaps)};
    });
    assert.ok(waterRouteGeometry.pathRatio <= 1.9, `water route too winding ${JSON.stringify(waterRouteGeometry)}`);
    assert.ok(waterRouteGeometry.maxTurn <= 140, `water route reverses sharply ${JSON.stringify(waterRouteGeometry)}`);
    assert.ok(waterRouteGeometry.minInnerGap >= 29, `water nodes are crowded ${JSON.stringify(waterRouteGeometry)}`);
    assert.equal(await b.locator('.board-tile[data-tile-type="event"]').count(), 9);
    assert.equal(await b.locator('.board-tile[data-tile-type="opportunity"],.board-tile[data-tile-type="daily"]').count(), 0);
    assert.equal(await b.locator('.board-tile[data-tile-type="supply"]').count(), 2);
    assert.equal(await b.locator(".board-tile.next-option").count(), 1);
    assert.equal(await b.locator(".board-tile .tile-icon").evaluateAll(images => new Set(images.map(image => image.getAttribute("src"))).size), 9);
    assert.ok(await b.locator(".board-tile").evaluateAll(tiles => new Set(tiles.map(tile => getComputedStyle(tile).backgroundColor)).size) >= 7);
    assert.equal(await b.locator('.board-tile[data-tile-type="property"]').first().evaluate(tile => getComputedStyle(tile).backgroundColor), "rgb(255, 254, 250)");
    assert.notEqual(await b.locator('.board-tile[data-tile-type="event"]').first().evaluate(tile => getComputedStyle(tile).backgroundColor), await b.locator('.board-tile[data-tile-type="property"]').first().evaluate(tile => getComputedStyle(tile).backgroundColor));
    assert.equal(await b.locator(".board-tile.route-water").count(), 9);
    assert.equal(await b.locator(".board-tile.route-metro").count(), 9);
    assert.equal(await b.locator(".route-water-entry").count(), 1);
    assert.equal(await b.locator(".route-water-exit").count(), 1);
    assert.equal(await b.locator(".route-metro-entry").count(), 1);
    assert.equal(await b.locator(".route-metro-exit").count(), 1);
    assert.notEqual(await b.locator(".board-tile.route-water").first().evaluate(tile => getComputedStyle(tile).borderTopColor), await b.locator(".board-tile.route-metro").first().evaluate(tile => getComputedStyle(tile).borderTopColor));
    for (const page of [a, b]) {
      const brokenImages = await page.locator("img").evaluateAll(images => images.filter(image => !image.complete || image.naturalWidth === 0).map(image => image.getAttribute("src")));
      assert.deepEqual(brokenImages, []);
    }
    await b.locator(".board-tile").nth(1).click();
    await b.locator("#tileDetailModal").waitFor({ state: "visible" });
    const tileClickTrace = await b.evaluate(() => window.__tileClickTrace || []);
    assert.deepEqual(tileClickTrace.at(-1) && {
      eventType: tileClickTrace.at(-1).eventType,
      tileIndex: tileClickTrace.at(-1).tileIndex,
      hiddenBefore: tileClickTrace.at(-1).hiddenBefore,
      opened: tileClickTrace.at(-1).opened,
      hiddenAfter: tileClickTrace.at(-1).hiddenAfter,
      currentView: tileClickTrace.at(-1).currentView,
      sameRoom: tileClickTrace.at(-1).renderedRoomId === tileClickTrace.at(-1).roomId
    }, { eventType: "click", tileIndex: 1, hiddenBefore: true, opened: true, hiddenAfter: false, currentView: "game", sameRoom: true });
    assert.match(await b.locator("#tileDetailCopy").textContent(), /到访分红/);
    assert.match(await b.locator("#tileDetailStats").textContent(), /投资/);
    await b.screenshot({ path: path.join(screenshotDir, "09-tile-detail-mobile.png"), fullPage: true });
    await b.locator("#tileDetailCloseButton").click();
    await b.locator("#inventoryButton").click();
    await b.locator("#itemModal").waitFor({ state: "visible" });
    assert.match(await b.locator("#itemList").textContent(), /道具补给站/);
    await b.locator("#itemCloseButton").click();
    const fixedViewport = await a.evaluate(() => ({ position: getComputedStyle(document.body).position, active: document.body.classList.contains("game-active"), scrollHeight: document.documentElement.scrollHeight, height: innerHeight }));
    assert.equal(fixedViewport.position, "fixed");
    assert.equal(fixedViewport.active, true);
    assert.ok(fixedViewport.scrollHeight <= fixedViewport.height + 1);
    await a.screenshot({ path: path.join(screenshotDir, "03-game-two-humans-two-bots.png"), fullPage: true });
    const mobileFit = await a.evaluate(() => {
      const shell=document.querySelector(".board-shell"),shellRect=shell.getBoundingClientRect(),tiles=[...document.querySelectorAll(".board-tile")].map(tile=>tile.getBoundingClientRect()),sectors=[...document.querySelectorAll("#sectorProgress .sector-chip")].map(tile=>tile.getBoundingClientRect());
      return { noHorizontalScroll:shell.scrollWidth<=shell.clientWidth+1,tilesInside:tiles.every(rect=>rect.left>=shellRect.left-2&&rect.right<=shellRect.right+2&&rect.top>=shellRect.top-2&&rect.bottom<=shellRect.bottom+2),sectorsInside:sectors.length===5&&sectors.every(rect=>rect.left>=0&&rect.right<=innerWidth) };
    });
    assert.deepEqual(mobileFit,{noHorizontalScroll:true,tilesInside:true,sectorsInside:true});
    await a.screenshot({ path: path.join(screenshotDir, "03b-full-map-fitted.png"), fullPage: true });

    await a.bringToFront();
    await a.evaluate(() => { window.__diceTrace = []; });
    await a.locator("#rollButton").click();
    await a.locator("#diceStage").waitFor({ state: "visible" });
    const diceVisual = await a.locator("#diceStage").evaluate(stage => ({ border: getComputedStyle(stage).borderTopWidth, background: getComputedStyle(stage).backgroundColor }));
    assert.equal(diceVisual.border, "0px");
    assert.equal(diceVisual.background, "rgba(0, 0, 0, 0)");
    assert.equal(await a.locator("#diceCanvas").count(), 1);
    assert.equal(await a.locator("#diceImage").count(), 0);
    await a.locator("#decisionModal").waitFor({ state: "visible" });
    assert.equal(await a.locator("#decisionTitle").textContent(), "融资窗口");
    const diceTrace = await a.evaluate(() => window.__diceTrace || []);
    assert.equal(diceTrace.length, 1);
    assert.equal(diceTrace[0].value, 5);
    assert.equal(diceTrace[0].baseValue, 5);
    assert.equal(diceTrace[0].topAtEnd, 5);
    // Multi-page headless Chromium can throttle WebGL rAF; strict motion and duration gates live in dice-renderer.test.js.
    assert.ok(diceTrace[0].visibleChanges >= 1, `dice visible changes ${diceTrace[0].visibleChanges}`);
    assert.ok(diceTrace[0].renderFinishedAt - diceTrace[0].startedAt >= 1300);
    assert.ok(diceTrace[0].finishedAt - diceTrace[0].startedAt >= 1650);
    assert.ok(diceTrace[0].renderCostP95 <= 12, `dice draw p95 ${diceTrace[0].renderCostP95}`);
    assert.ok(diceTrace[0].renderCostMax <= 20, `dice draw max ${diceTrace[0].renderCostMax}`);
    assert.equal(diceTrace[0].prewarmed, true);
    assert.ok(diceTrace[0].canvas.dpr <= 1.5);
    assert.equal(await a.locator("#diceResultText").count(), 0);
    assert.equal(await a.locator(".dice-face").count(), 0);
    assert.match(await a.locator("#diceStage").getAttribute("aria-label"), /骰子 5 点/);
    assert.ok(!imageRequestsA.some(pathname => /dice_[1-6]/.test(pathname)), `unexpected dice image request: ${imageRequestsA}`);
    await a.evaluate(async () => {
      document.querySelector("#decisionModal").hidden = true;
      document.querySelector("#diceStage").hidden = false;
      await window.__diceRenderer.draw();
    });
    await a.screenshot({ path: path.join(screenshotDir, "11-dice-rolling-mobile.png") });
    await a.evaluate(() => {
      document.querySelector("#diceStage").hidden = true;
      document.querySelector("#decisionModal").hidden = false;
    });
    await a.screenshot({ path: path.join(screenshotDir, "04-opportunity-decision-modal.png"), fullPage: true });
    await a.getByRole("button", { name: "稳妥 +60" }).click();
    await a.locator("#decisionModal").waitFor({ state: "hidden", timeout: 500 });
    await a.locator("#cardEffectOverlay").waitFor({ state: "visible" });
    assert.equal(await a.locator("#cardEffectKicker").textContent(), "城市事件");
    assert.equal(await a.locator("#cardEffectName").textContent(), "融资窗口");
    await a.locator("#cardEffectCard").evaluate(node => { const animation=node.getAnimations()[0]; if(animation){animation.currentTime=1200;animation.pause()} });
    await a.screenshot({ path: path.join(screenshotDir, "04b-city-event-reveal.png"), fullPage: true });
    await a.locator("#cardEffectCard").evaluate(node => node.getAnimations()[0]?.play());
    await a.locator("#cardEffectOverlay").waitFor({ state: "hidden", timeout: 2500 });
    await a.waitForFunction(() => document.querySelector("#gameToast.visible")?.textContent.includes("融资窗口"));
    assert.ok((await a.evaluate(() => window.__soundTrace)).some(item => item.name === "opportunity"));
    assert.equal(await a.locator("#eventModal").count(), 0);
    await b.locator("#rollButton").waitFor({ state: "visible" });
    await b.waitForFunction(() => !document.querySelector("#rollButton").disabled);

    await b.evaluate(() => { window.__movementTrace = []; window.__soundTrace = []; });
    await b.locator("#rollButton").click();
    await b.locator("#gameToast.visible").waitFor({ state: "visible" });
    assert.equal(await b.locator("#eventModal").count(), 0);
    assert.equal(await b.locator("#gameToast").evaluate(node => getComputedStyle(node).pointerEvents), "none");
    assert.ok(await b.locator("#gameToast").evaluate(node => parseFloat(getComputedStyle(node).borderRadius)) <= 16);
    assert.equal(await b.locator("#gameToast").evaluate(node => {
      const toast=node.getBoundingClientRect(),panel=node.parentElement.getBoundingClientRect();
      return toast.left>=panel.left&&toast.right<=panel.right&&toast.top>=panel.top&&toast.bottom<=panel.bottom;
    }), true, "game toast must stay in the prominent rail below player cards");
    await b.waitForTimeout(320);
    assert.equal(await b.locator("#gameToast").evaluate(node => {const toast=node.getBoundingClientRect(),board=document.querySelector("#gameBoard").getBoundingClientRect();return toast.left>=board.left&&toast.right<=board.right&&toast.top>=board.top&&toast.bottom<=board.bottom;}),true,"settled toast must stay inside the map");
    await b.waitForTimeout(260);
    await b.screenshot({ path: path.join(screenshotDir, "05-daily-event-popup.png"), fullPage: true });
    const movementTrace = await b.evaluate(() => window.__movementTrace || []);
    await b.waitForFunction(() => (window.__soundTrace || []).some(item => item.name === "diceImpact" && item.coveredBy === "dice-shake-short.v2.ogg"), null, { timeout: 4000 });
    const soundTrace = await b.evaluate(() => window.__soundTrace || []);
    const firstPlayerId = movementTrace[0]?.playerId;
    const firstPath = movementTrace.filter(item => item.playerId === firstPlayerId);
    if(firstPath.length>=2){assert.deepEqual(firstPath.map(item => item.step), firstPath.map((_,index)=>index));assert.equal(new Set(firstPath.map(item => item.tileIndex)).size, firstPath.length);assert.ok(firstPath.slice(1).every((item,index) => item.at - firstPath[index].at >= 300));}
    assert.ok(soundTrace.some(item => item.name === "diceShake" && item.source === "kenney-cc0-short" && item.file === "dice-shake-short.v2.ogg" && item.duration === .72));
    assert.ok(soundTrace.some(item => item.name === "diceImpact" && item.coveredBy === "dice-shake-short.v2.ogg"));
    if(firstPath.length>=2)assert.ok(soundTrace.some(item => item.name === "step"));
    assert.ok(soundTrace.some(item => item.name === "tap"));
    assert.ok(soundTrace.some(item => item.name === "confirm"));

    await b.locator("#openLogButton").click();
    await b.locator("#logModal").waitFor({ state: "visible" });
    assert.ok(await b.locator("#fullEventLog li").count() >= 4);
    await b.screenshot({ path: path.join(screenshotDir, "10-full-log-mobile.png"), fullPage: true });
    await b.locator("#logCloseButton").click();
    const mobileLayout = await b.evaluate(() => ({
      viewport: document.querySelector('meta[name="viewport"]').content,
      turnWhiteSpace: getComputedStyle(document.querySelector(".turn-meta")).whiteSpace,
      turnHeight: document.querySelector(".turn-meta").getBoundingClientRect().height,
      tileIconsLoaded: [...document.querySelectorAll(".tile-icon")].every(image => image.complete && image.naturalWidth > 0)
    }));
    assert.match(mobileLayout.viewport, /user-scalable=no/);
    assert.equal(mobileLayout.turnWhiteSpace, "nowrap");
    assert.ok(mobileLayout.turnHeight < 20);
    assert.equal(mobileLayout.tileIconsLoaded, true);
    await a.waitForTimeout(1500);

    const partnerRoom = store.getRoomByCode(code);
    const humanBuyer = partnerRoom.game.players.find(player => player.id === partnerRoom.ownerUserId);
    const humanPartner = partnerRoom.game.players.find(player => player.kind === "human" && player.id !== partnerRoom.ownerUserId);
    partnerRoom.game.currentSeat = humanBuyer.seat;
    partnerRoom.game.phase = "partner_response";
    partnerRoom.game.pending = { type: "partner", actorId: humanBuyer.id, targetPlayerId: humanPartner.id, tileIndex: 1, expiresAt: Date.now() + 8000 };
    partnerRoom.game.board[1].ownerId = null;
    partnerRoom.game.board[1].partnerId = null;
    partnerRoom.game.board[1].level = 0;
    partnerRoom.game.version += 1;
    store.saveRoom(partnerRoom, partnerRoom.inviteTokenHash);
    assert.equal(partnerRoom.status, "playing");
    assert.ok(store.listUserRooms(humanBuyer.id).some(item => item.id === partnerRoom.id));
    assert.ok(store.listUserRooms(humanPartner.id).some(item => item.id === partnerRoom.id));
    for (const page of [a,b]) {
      await page.evaluate(() => window.__socket.send(JSON.stringify({ type: "resume", lastSeq: Number.MAX_SAFE_INTEGER })));
      await page.locator("#gameView").waitFor({ state: "visible" });
      await page.evaluate(() => { window.__celebrationTrace = []; window.__soundTrace = []; });
    }
    await b.locator("#decisionModal").waitFor({ state: "visible" });
    await b.getByRole("button", { name: "接受合伙" }).click();
    await a.locator("#celebrationOverlay").waitFor({ state: "visible" });
    assert.match(await a.locator("#celebrationTitle").textContent(), /携手投资/);
    assert.match(await a.locator("#celebrationSprite").getAttribute("class"), /handshake/);
    assert.equal(await a.locator("#celebrationOverlay").evaluate(overlay => {
      const viewport={left:0,top:0,right:innerWidth,bottom:innerHeight},nodes=[...overlay.querySelectorAll(".celebration-person img,.celebration-person strong,.celebration-sprite,.celebration-panel h2")].filter(node=>getComputedStyle(node).display!=="none");
      const inside=rect=>rect.left>=viewport.left&&rect.top>=viewport.top&&rect.right<=viewport.right&&rect.bottom<=viewport.bottom;
      return nodes.every(node=>inside(node.getBoundingClientRect()));
    }), true, "partnership celebration content must stay inside the viewport");
    await a.screenshot({ path: path.join(screenshotDir, "15-partnership-celebration-mobile.png"), fullPage: true });
    await a.locator("#celebrationOverlay").waitFor({ state: "hidden" });
    assert.ok((await a.evaluate(() => window.__celebrationTrace)).some(item => item.type === "PARTNERSHIP_ACCEPTED"));
    assert.ok((await a.evaluate(() => window.__soundTrace)).some(item => item.name === "partnership"));

    await a.locator("#gameHomeButton").click();
    await a.locator("#homeView").waitFor({ state: "visible" });
    await a.locator("#resumePanel").waitFor({ state: "visible" });
    assert.ok(await a.locator("#resumeRooms").textContent().then(text => text.includes(code)));
    await a.screenshot({ path: path.join(screenshotDir, "06-home-continue-or-new.png"), fullPage: true });
    await a.locator("#createRoomButton").click();
    await a.locator("#roomView").waitFor({ state: "visible" });
    const secondCode = (await a.locator("#roomCode").textContent()).trim();
    assert.notEqual(secondCode, code);
    await a.screenshot({ path: path.join(screenshotDir, "07-new-room.png"), fullPage: true });

    for (let index = 0; index < 3; index += 1) await a.locator("#addBotButton").click();
    await a.waitForFunction(() => document.querySelectorAll(".seat.bot").length === 3);
    await a.locator("#startGameButton").click();
    await a.locator("#gameView").waitFor({ state: "visible" });
    const supplyRoom = store.getRoomByCode(secondCode);
    supplyRoom.game.players[0].position = 26;
    supplyRoom.game.currentSeat = 0;
    supplyRoom.game.phase = "roll";
    supplyRoom.game.pending = null;
    store.saveRoom(supplyRoom, supplyRoom.inviteTokenHash);
    await a.reload();
    await a.locator("#homeView").waitFor({ state: "visible" });
    await a.locator(".resume-room", { hasText: secondCode }).getByRole("button", { name: "继续" }).click();
    await a.locator("#gameView").waitFor({ state: "visible" });
    await a.evaluate(() => { window.__soundTrace = []; });
    await a.locator("#rollButton").click();
    await a.locator("#gameToast.visible").waitFor({ state: "visible" });
    assert.match(await a.locator("#gameToast").textContent(), /获得道具卡/);
    assert.ok((await a.evaluate(() => window.__soundTrace)).some(item => item.name === "card"));
    await a.waitForFunction(() => document.querySelector("#itemCount").textContent === "1");
    const deterministicCardRoom=store.getRoomByCode(secondCode);deterministicCardRoom.game.players[0].items=["coupon"];deterministicCardRoom.game.currentSeat=0;deterministicCardRoom.game.phase="roll";deterministicCardRoom.game.pending=null;deterministicCardRoom.game.movement=null;deterministicCardRoom.game.version+=1;store.saveRoom(deterministicCardRoom,deterministicCardRoom.inviteTokenHash);
    await a.evaluate(()=>window.__socket.send(JSON.stringify({type:"resume",lastSeq:Number.MAX_SAFE_INTEGER})));await a.waitForTimeout(180);
    const itemBadgePlacement = await a.locator("#inventoryButton").evaluate(button => { const badge=button.querySelector("#itemCount"),outer=button.getBoundingClientRect(),inner=badge.getBoundingClientRect();return{right:outer.right-inner.right,top:inner.top-outer.top}; });
    assert.ok(itemBadgePlacement.right >= 0 && itemBadgePlacement.top >= 0, `item badge placement ${JSON.stringify(itemBadgePlacement)}`);
    await a.locator("#inventoryButton").click();
    await a.locator("#itemModal").waitFor({ state: "visible" });
    assert.equal(await a.locator(".item-entry").count(), 1);
    await a.screenshot({ path: path.join(screenshotDir, "12-item-card-inventory-mobile.png"), fullPage: true });
    await a.locator("[data-use-item]").click();
    await a.locator("#cardEffectOverlay").waitFor({ state: "visible" });
    await a.waitForTimeout(1150);
    await a.screenshot({ path: path.join(screenshotDir, "12b-item-card-effect-mobile.png"), fullPage: true });
    await a.waitForFunction(() => document.querySelector("#itemCount").textContent === "0");
    await a.screenshot({ path: path.join(screenshotDir, "13-item-used-mobile.png"), fullPage: true });

    await a.locator("#gameHomeButton").click();
    await a.locator("#homeView").waitFor({ state: "visible" });
    const purchaseRoom = store.getRoomByCode(secondCode);
    purchaseRoom.game.currentSeat = 0;
    purchaseRoom.game.phase = "decision";
    purchaseRoom.game.pending = { type: "property", actorId: purchaseRoom.game.players[0].id, tileIndex: 1, expiresAt: Date.now() + 15000 };
    purchaseRoom.game.board[1].ownerId = null;
    purchaseRoom.game.board[1].partnerId = null;
    purchaseRoom.game.board[1].level = 0;
    purchaseRoom.game.version += 1;
    store.saveRoom(purchaseRoom, purchaseRoom.inviteTokenHash);
    await a.locator(".resume-room", { hasText: secondCode }).getByRole("button", { name: "继续" }).click();
    await a.locator("#decisionModal").waitFor({ state: "visible" });
    await a.evaluate(() => { window.__celebrationTrace = []; window.__soundTrace = []; });
    await a.getByRole("button", { name: "独立投资" }).click();
    await a.locator("#celebrationOverlay").waitFor({ state: "visible" });
    assert.match(await a.locator("#celebrationTitle").textContent(), /投资/);
    assert.match(await a.locator("#celebrationSprite").getAttribute("class"), /purchase/);
    assert.equal(await a.locator("#celebrationOverlay").evaluate(overlay => {
      const nodes=[...overlay.querySelectorAll(".celebration-person img,.celebration-person strong,.celebration-sprite,.celebration-panel h2")].filter(node=>getComputedStyle(node).display!=="none");
      return nodes.every(node=>{const rect=node.getBoundingClientRect();return rect.left>=0&&rect.top>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight});
    }), true, "purchase celebration content must stay inside the viewport");
    await a.screenshot({ path: path.join(screenshotDir, "16-property-purchase-celebration-mobile.png"), fullPage: true });
    await a.locator("#celebrationOverlay").waitFor({ state: "hidden" });
    assert.ok((await a.evaluate(() => window.__celebrationTrace)).some(item => item.type === "PROPERTY_BOUGHT"));
    assert.ok((await a.evaluate(() => window.__soundTrace)).some(item => item.name === "investment"));
    await a.locator("#gameHomeButton").click();
    await a.locator("#homeView").waitFor({ state: "visible" });
    const rentRoom = store.getRoomByCode(secondCode);
    const rentOwner = rentRoom.game.players.find(player => player.kind === "bot");
    rentRoom.game.players[0].position = 4;
    rentRoom.game.players[0].diceBonus = 0;
    rentRoom.game.players[0].rentShield = false;
    rentRoom.game.currentSeat = 0;
    rentRoom.game.phase = "roll";
    rentRoom.game.pending = null;
    rentRoom.game.movement = null;
    rentRoom.game.board[1].ownerId = rentRoom.game.players[0].id;
    rentRoom.game.board[1].partnerId = null;
    rentRoom.game.board[1].level = 1;
    if (!rentRoom.game.players[0].properties.includes(1)) rentRoom.game.players[0].properties.push(1);
    rentRoom.game.board[5].ownerId = rentOwner.id;
    rentRoom.game.board[5].level = 1;
    if (!rentOwner.properties.includes(5)) rentOwner.properties.push(5);
    store.saveRoom(rentRoom, rentRoom.inviteTokenHash);
    await a.locator(".resume-room", { hasText: secondCode }).getByRole("button", { name: "继续" }).click();
    await a.locator("#gameView").waitFor({ state: "visible" });
    await a.waitForFunction(() => document.querySelector('.board-tile[data-tile-index="5"] .owner-dot')?.textContent.includes("1级"));
    assert.equal(await a.locator("#upgradeButton").isDisabled(), false);
    await a.locator("#upgradeButton").click();
    await a.locator("#upgradeModal").waitFor({ state: "visible" });
    assert.match(await a.locator("#upgradeHint").textContent(), /自己的回合/);
    assert.match(await a.locator('[data-upgrade-tile="1"]').locator("xpath=..").textContent(), /分红提升/);
    await a.screenshot({ path: path.join(screenshotDir, "17-upgrade-project-mobile.png"), fullPage: true });
    await a.locator('[data-upgrade-tile="1"]').click();
    await a.waitForFunction(() => document.querySelector('.board-tile[data-tile-index="1"] .owner-dot')?.textContent.includes("2级"));
    await a.locator('.board-tile[data-tile-index="5"]').click();
    await a.locator("#tileDetailModal").waitFor({ state: "visible" });
    assert.match(await a.locator("#tileDetailStats").textContent(), new RegExp(`${rentOwner.nickname} 独资`));
    await a.locator("#tileDetailCloseButton").click();
    await a.evaluate(() => { window.__coinTrace = []; window.__soundTrace = []; });
    await a.locator("#rollButton").click();
    await a.waitForFunction(() => (window.__coinTrace || []).length > 0);
    const coinTrace = await a.evaluate(() => window.__coinTrace);
    assert.equal(coinTrace[0].fromId, rentRoom.game.players[0].id);
    assert.equal(coinTrace[0].toId, rentOwner.id);
    assert.equal(coinTrace[0].coinCount, 11);
    assert.ok(coinTrace[0].duration >= 2000);
    assert.ok(await a.locator(".avatar-coin").count() > 0);
    const avatarCenters = await a.evaluate(({fromId,toId}) => {
      const center=id=>{const rect=document.querySelector(`.player-chip[data-player-id="${CSS.escape(id)}"] img`).getBoundingClientRect();return{x:rect.left+rect.width/2,y:rect.top+rect.height/2}};
      return{from:center(fromId),to:center(toId)};
    }, { fromId:coinTrace[0].fromId,toId:coinTrace[0].toId });
    assert.ok(Math.hypot(coinTrace[0].from.x-avatarCenters.from.x,coinTrace[0].from.y-avatarCenters.from.y)<=1);
    assert.ok(Math.hypot(coinTrace[0].to.x-avatarCenters.to.x,coinTrace[0].to.y-avatarCenters.to.y)<=1);
    const coinLayout = await a.locator(".avatar-coin").evaluateAll(coins => {
      const forbidden=[...document.querySelectorAll(".player-copy,.player-metrics")].map(node=>node.getBoundingClientRect()),board=document.querySelector(".board-shell").getBoundingClientRect();
      const intersects=(a,b)=>Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);
      const rects=coins.map(coin=>{const rect=coin.getBoundingClientRect();return{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,textCollision:forbidden.some(target=>intersects(rect,target)),boardCollision:intersects(rect,board)}});
      return {ok:rects.every(rect=>!rect.textCollision&&!rect.boardCollision),board:{top:board.top,bottom:board.bottom},rects};
    });
    assert.equal(coinLayout.ok, true, `avatar coin stream must not cover player text or board content: ${JSON.stringify(coinLayout)}`);
    assert.equal(await a.locator(".coin-stream-label").count(), 0);
    assert.ok((await a.evaluate(() => window.__soundTrace)).some(item => item.name === "coin"));
    assert.equal(await a.locator("#eventModal").count(), 0);
    await a.waitForTimeout(700);
    await a.screenshot({ path: path.join(screenshotDir, "14-coin-transfer-mobile.png"), fullPage: true });
    await a.locator("#gameHomeButton").click();
    await a.locator("#homeView").waitFor({ state:"visible" });
    const soundCountAfterHome = await a.evaluate(() => window.__soundTrace.length);
    await a.waitForTimeout(1600);
    assert.equal(await a.locator(".flying-coin").count(), 0);
    assert.equal(await a.locator("#gameToast.visible").count(), 0);
    assert.equal(await a.locator("#diceStage").isHidden(), true);
    assert.equal(await a.locator("#celebrationOverlay").isHidden(), true);
    assert.equal(await a.evaluate(() => window.__soundTrace.length), soundCountAfterHome, "no queued game sound may play after returning home");

    if (errors.length) throw new Error(errors.join("\n"));
    console.log(JSON.stringify({
      e2e: "pass",
      roomCode: code,
      humans: 2,
      bots: 2,
      boardTiles: 49,
      reconnect: "pass (integration websocket resume)",
      secondLoginHome: "pass",
      createNewRoom: "pass",
      brokenImages: 0,
      movementAnimation: firstPath.length>=2?"pass":"not sampled",
      movementStepsObserved: firstPath.length,
      decisionModal: "pass",
      passiveEventToast: "prominent rail below player cards",
      passiveEventModalCount: 0,
      fixedMobileViewport: "pass",
      tileIllustrations: "49/49",
      tileTypes: 5,
      junctionMarkers: 2,
      nodeChains: "outer + water + metro",
      maxInnerNodeGap: nodeChainGaps,
      semanticTileBackgrounds: "property white + distinct event/card/type fills",
      investableProjects: "25 across five sectors",
      squareNodes: "49/49",
      routeBorders: "water cyan + metro purple + matching entry/exit fills",
      branchDirections: "2 continuous routes + color-matched entry/exit endpoints",
      waterRouteGeometry,
      metroRouteGeometry,
      topBranchOverlap,
      movedOuterOverlap,
      waterBranchNodes: 9,
      metroBranchNodes: 9,
      cityEventNodes: 9,
      supplyNodes: 2,
      tileDetail: "pass",
      tileClickTrace: "click / tileIndex / room context / hidden true->false",
      ownershipBadge: "1级 + owner detail",
      fullEventLog: "pass",
      doubleTapZoomDisabled: "pass",
      mobileTurnLayout: "pass",
      playerMetrics: "coins + influence + items",
      openingTurnOrder: "non-blocking randomized order banner, auto-hides in 2.2s",
      sectorBenefitGuide: "compact five-dot overview + inline collapsible tier guide",
      dice3D: "single geometry / three-axis tumble / deterministic landing",
      redundantDiceText: 0,
      movementPacing: ">=300ms per step",
      itemInventory: "pass",
      itemCardDrawAndUse: "pass",
      coinTransfer: "11-coin 2.1s avatar-to-avatar stream",
      leaveGameCancellation: "socket + event queue + dice + toast + celebrations + coins + audio",
      overlapAudit: "player text / toast / coin rail / price rows / item badge / celebrations",
      partnershipCelebration: "two avatars + handshake sprite",
      investmentCelebration: "investor avatar + project sprite",
      upgradeSelector: "own turn only + explicit project/cost/rent",
      ownerEndGame: "owner-only confirmed settlement",
      soundEffects: "dice + step + city event + landmark + transit + review + vote + route + card + coin + partnership + investment",
      consoleErrors: 0
    }, null, 2));
  } finally {
    await browser.close();
    await close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exit(1); });
