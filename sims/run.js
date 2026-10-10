"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  createGame,
  applyCommand,
  getBotCommand,
  getTimeoutCommand,
  getUpgradeCost,
  getRent,
  hasCompleteGroup,
  sectorProjectCount,
  rankings,
  cityScore
} = require("../game-core");
const { profiles } = require("./profiles");

function parseArgs(argv) {
  const result = { games: 200, profile: "current", all: false, assertHard: false, assertCandidate: false, output: null, seed: 1 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--games") result.games = Number(argv[++index]);
    else if (value === "--profile") result.profile = argv[++index];
    else if (value === "--all") result.all = true;
    else if (value === "--assert-hard") result.assertHard = true;
    else if (value === "--assert-candidate") result.assertCandidate = true;
    else if (value === "--output") result.output = argv[++index];
    else if (value === "--seed") result.seed = Number(argv[++index]);
    else throw new Error(`UNKNOWN_ARGUMENT:${value}`);
  }
  if (!Number.isInteger(result.games) || result.games < 1 || result.games > 10000) throw new Error("INVALID_GAME_COUNT");
  if (!Number.isInteger(result.seed) || result.seed < 0) throw new Error("INVALID_SEED");
  return result;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
}

function legalUpgrade(state, player, tile, reserveCash) {
  if (tile.type !== "property" || ![tile.ownerId, tile.partnerId].includes(player.id) || tile.level >= 3) return false;
  if (tile.level === 2 && state.balance.upgrade.level3RequiresCompleteGroup) {
    const unlocked = state.balance.sectorBonuses.enabled
      ? sectorProjectCount(state, player.id, tile.group) >= state.balance.sectorBonuses.flagshipMinProjects
      : hasCompleteGroup(state, player.id, tile.group);
    if (!unlocked) return false;
  }
  return player.cash - getUpgradeCost(state, tile) >= reserveCash;
}

function chooseAction(state, actor, random, policy, turnUpgrades, playerUpgradeCounts) {
  if (state.phase === "roll" && state.players[state.currentSeat]?.id === actor.id) {
    const turnKey = `${state.round}:${state.currentSeat}`;
    const upgradesUsed = playerUpgradeCounts.get(actor.id) || 0;
    if (policy.upgradeEnabled && state.round >= policy.upgradeAfterRound && upgradesUsed < policy.maxUpgradesPerPlayer && !turnUpgrades.has(turnKey)) {
      const candidates = state.board
        .filter(tile => legalUpgrade(state, actor, tile, policy.reserveCash))
        .map(tile => {
          const before = getRent(state, tile);
          const after = getRent(state, { ...tile, level: tile.level + 1 });
          return { tile, value: (after - before) / Math.max(1, getUpgradeCost(state, tile)) };
        })
        .sort((left, right) => right.value - left.value || left.tile.index - right.tile.index);
      if (candidates.length) {
        turnUpgrades.add(turnKey);
        playerUpgradeCounts.set(actor.id, upgradesUsed + 1);
        return { command: "UPGRADE_PROPERTY", payload: { tileIndex: candidates[0].tile.index } };
      }
    }
  }

  if (state.pending?.type === "property" && state.pending.actorId === actor.id) {
    const tile = state.board[state.pending.tileIndex];
    const share = Math.ceil(tile.price / 2);
    const partners = state.players.filter(player => player.id !== actor.id && player.cash - share >= policy.reserveCash);
    if (partners.length && random() < policy.partnershipRate && actor.cash - share >= policy.reserveCash) {
      partners.sort((left, right) => right.cash - left.cash || left.seat - right.seat);
      return { command: "INVITE_PARTNER", payload: { targetPlayerId: partners[0].id } };
    }
  }

  if (state.phase === "partner_response" && state.pending?.targetPlayerId === actor.id) {
    const tile = state.board[state.pending.tileIndex];
    const share = Math.ceil(tile.price / 2);
    return actor.cash - share >= policy.reserveCash
      ? { command: "ACCEPT_PARTNER", payload: {} }
      : { command: "DECLINE_PARTNER", payload: {} };
  }

  return getBotCommand(state, actor.id, random);
}

function assertState(state) {
  if (!state || !Array.isArray(state.players) || !Array.isArray(state.board)) throw new Error("INVALID_STATE_SHAPE");
  if (!Number.isInteger(state.currentSeat) || state.currentSeat < 0 || state.currentSeat >= state.players.length) throw new Error("INVALID_CURRENT_SEAT");
  for (const player of state.players) {
    if (!Number.isFinite(player.cash) || !Number.isFinite(player.influence)) throw new Error("NON_FINITE_PLAYER_METRIC");
    if (!Number.isInteger(player.position) || !state.board[player.position]) throw new Error("INVALID_PLAYER_POSITION");
  }
  const playerIds = new Set(state.players.map(player => player.id));
  for (const tile of state.board) {
    if (tile.ownerId && !playerIds.has(tile.ownerId)) throw new Error("UNKNOWN_OWNER");
    if (tile.partnerId && !playerIds.has(tile.partnerId)) throw new Error("UNKNOWN_PARTNER");
  }
}

function simulateProfile(name, profile, options) {
  const metrics = {
    profile: name,
    label: profile.label,
    rulesetVersion: profile.rulesetVersion,
    games: options.games,
    seedStart: options.seed,
    finishedGames: 0,
    guardFailures: 0,
    stateFailures: 0,
    commandFailures: 0,
    investments: 0,
    skippedInvestments: 0,
    partnerships: 0,
    upgrades: 0,
    rentEvents: 0,
    cityEvents: 0,
    opportunityEvents: 0,
    reviewEntries: 0,
    reviewHeldTurns: 0,
    itemCardsDrawn: 0,
    itemCardsUsed: 0,
    restructures: 0,
    gamesWithRestructure: 0,
    gamesWithCashAtOrBelow300: 0,
    gamesWithCompleteGroup: 0,
    gamesWithSectorTier3: 0,
    gamesWithSectorTier4: 0,
    sectorTier2Unlocks: 0,
    sectorTier3Unlocks: 0,
    sectorTier4Unlocks: 0,
    leadChangesInFinalRounds: 0,
    winsByTurn: [0, 0, 0, 0],
    rentAmounts: [],
    rentShareOfPayerCash: [],
    finalScoreGaps: [],
    minimumCashByPlayer: [],
    finalCashByPlayer: []
  };

  for (let gameIndex = 0; gameIndex < options.games; gameIndex += 1) {
    const random = seededRandom(options.seed + gameIndex);
    let state = createGame([0, 1, 2, 3].map(seat => ({ id: `p${seat}`, nickname: `P${seat + 1}`, kind: "bot" })), {
      rulesetVersion: profile.rulesetVersion,
      board: profile.board,
      balance: profile.balance
    });
    const turnUpgrades = new Set();
    const playerUpgradeCounts = new Map();
    let guard = 0;
    let gameRestructured = false;
    let gameCashAtOrBelow300 = false;
    const minimumCash = new Map(state.players.map(player => [player.id, player.cash]));
    let lastFinalLeader = null;
    try {
      while (!state.finished && guard < 4000) {
        guard += 1;
        assertState(state);
        let actor = state.phase === "partner_response"
          ? state.players.find(player => player.id === state.pending?.targetPlayerId)
          : state.players.find(player => player.id === state.pending?.actorId) || state.players[state.currentSeat];
        let action = chooseAction(state, actor, random, profile.botPolicy, turnUpgrades, playerUpgradeCounts);
        if (!action) {
          const timeout = getTimeoutCommand(state);
          if (!timeout) throw new Error(`NO_ACTION:${state.phase}`);
          actor = state.players.find(player => player.id === timeout.actorId);
          action = timeout;
        }
        const cashBefore = new Map(state.players.map(player => [player.id, player.cash]));
        const result = applyCommand(state, actor.id, action.command, action.payload, { random, nowMs: guard });
        state = result.state;
        for (const event of result.events) {
          if (event.type === "PROPERTY_BOUGHT") metrics.investments += 1;
          else if (event.type === "PROPERTY_SKIPPED") metrics.skippedInvestments += 1;
          else if (event.type === "PARTNERSHIP_ACCEPTED") metrics.partnerships += 1;
          else if (event.type === "PROPERTY_UPGRADED") metrics.upgrades += 1;
          else if (["DAILY_RESOLVED", "CITY_EVENT_RESOLVED"].includes(event.type)) {
            metrics.cityEvents += 1;
            if (event.payload?.cityEvent?.effect === "item_gain") metrics.itemCardsDrawn += 1;
          }
          else if (event.type === "OPPORTUNITY_RESOLVED") metrics.opportunityEvents += 1;
          else if (["REVIEW_RESOLVED", "REVIEW_DETAINED"].includes(event.type)) metrics.reviewEntries += 1;
          else if (event.type === "REVIEW_HELD") metrics.reviewHeldTurns += 1;
          else if (event.type === "ITEM_CARD_DRAWN") metrics.itemCardsDrawn += 1;
          else if (event.type === "ITEM_CARD_USED") metrics.itemCardsUsed += 1;
          else if (event.type === "PLAYER_RESTRUCTURED") { metrics.restructures += 1; gameRestructured = true; }
          else if (event.type === "RENT_PAID") {
            metrics.rentEvents += 1;
            metrics.rentAmounts.push(event.payload.amount);
            const before = cashBefore.get(event.payload.playerId);
            if (before > 0) metrics.rentShareOfPayerCash.push(event.payload.amount / before);
          }
        }
        for (const current of state.players) {
          minimumCash.set(current.id, Math.min(minimumCash.get(current.id), current.cash));
          if (current.cash <= 300) gameCashAtOrBelow300 = true;
        }
        if (state.round >= state.maxRounds - 2) {
          const leader = rankings(state)[0]?.id;
          if (lastFinalLeader && leader !== lastFinalLeader) metrics.leadChangesInFinalRounds += 1;
          lastFinalLeader = leader;
        }
      }
      assertState(state);
    } catch (error) {
      metrics.commandFailures += 1;
      if (String(error.message).startsWith("INVALID_") || String(error.message).startsWith("UNKNOWN_")) metrics.stateFailures += 1;
    }
    if (guard >= 4000 && !state.finished) metrics.guardFailures += 1;
    if (state.finished) metrics.finishedGames += 1;
    if (gameRestructured) metrics.gamesWithRestructure += 1;
    if (gameCashAtOrBelow300) metrics.gamesWithCashAtOrBelow300 += 1;
    metrics.minimumCashByPlayer.push(...minimumCash.values());
    metrics.finalCashByPlayer.push(...state.players.map(player => player.cash));

    const completed = state.players.some(player => new Set(state.board
      .filter(tile => tile.type === "property" && [tile.ownerId, tile.partnerId].includes(player.id))
      .map(tile => tile.group)
      .filter(group => hasCompleteGroup(state, player.id, group))).size > 0);
    if (completed) metrics.gamesWithCompleteGroup += 1;
    let gameTier3 = false;
    let gameTier4 = false;
    const sectors = [...new Set(state.board.filter(tile => tile.type === "property").map(tile => tile.group))];
    for (const player of state.players) {
      for (const sector of sectors) {
        const count = sectorProjectCount(state, player.id, sector);
        if (count >= 2) metrics.sectorTier2Unlocks += 1;
        if (count >= 3) { metrics.sectorTier3Unlocks += 1; gameTier3 = true; }
        if (count >= 4) { metrics.sectorTier4Unlocks += 1; gameTier4 = true; }
      }
    }
    if (gameTier3) metrics.gamesWithSectorTier3 += 1;
    if (gameTier4) metrics.gamesWithSectorTier4 += 1;
    const finalRanking = rankings(state);
    if (finalRanking[0]) metrics.winsByTurn[finalRanking[0].seat] += 1;
    if (finalRanking[1]) metrics.finalScoreGaps.push(cityScore(state, finalRanking[0]) - cityScore(state, finalRanking[1]));
  }

  const perGame = value => Number((value / options.games).toFixed(3));
  return {
    profile: metrics.profile,
    label: metrics.label,
    rulesetVersion: metrics.rulesetVersion,
    games: metrics.games,
    seedStart: metrics.seedStart,
    hard: {
      finishRate: perGame(metrics.finishedGames),
      guardFailures: metrics.guardFailures,
      stateFailures: metrics.stateFailures,
      commandFailures: metrics.commandFailures,
      winPctByTurn: metrics.winsByTurn.map(value => Number((value * 100 / options.games).toFixed(1)))
    },
    gameplay: {
      investmentsPerGame: perGame(metrics.investments),
      projectsAcquiredPerGame: perGame(metrics.investments + metrics.partnerships),
      skippedInvestmentsPerGame: perGame(metrics.skippedInvestments),
      partnershipsPerGame: perGame(metrics.partnerships),
      upgradesPerGame: perGame(metrics.upgrades),
      rentEventsPerGame: perGame(metrics.rentEvents),
      cityEventsPerGame: perGame(metrics.cityEvents),
      opportunityEventsPerGame: perGame(metrics.opportunityEvents),
      reviewEntriesPerGame: perGame(metrics.reviewEntries),
      reviewHeldTurnsPerGame: perGame(metrics.reviewHeldTurns),
      itemCardsDrawnPerGame: perGame(metrics.itemCardsDrawn),
      itemCardsUsedPerGame: perGame(metrics.itemCardsUsed),
      rentP50: percentile(metrics.rentAmounts, 0.5),
      rentP90: percentile(metrics.rentAmounts, 0.9),
      rentShareOfCashP90: Number(percentile(metrics.rentShareOfPayerCash, 0.9).toFixed(3)),
      minimumCashP10: percentile(metrics.minimumCashByPlayer, 0.1),
      minimumCashP50: percentile(metrics.minimumCashByPlayer, 0.5),
      finalCashP50: percentile(metrics.finalCashByPlayer, 0.5),
      finalCashP90: percentile(metrics.finalCashByPlayer, 0.9),
      gamesWithCashAtOrBelow300Pct: Number((metrics.gamesWithCashAtOrBelow300 * 100 / options.games).toFixed(1)),
      restructureEventsPerGame: perGame(metrics.restructures),
      gamesWithRestructurePct: Number((metrics.gamesWithRestructure * 100 / options.games).toFixed(1)),
      gamesWithCompleteGroupPct: Number((metrics.gamesWithCompleteGroup * 100 / options.games).toFixed(1)),
      sectorTier2UnlocksPerGame: perGame(metrics.sectorTier2Unlocks),
      sectorTier3UnlocksPerGame: perGame(metrics.sectorTier3Unlocks),
      sectorTier4UnlocksPerGame: perGame(metrics.sectorTier4Unlocks),
      gamesWithSectorTier3Pct: Number((metrics.gamesWithSectorTier3 * 100 / options.games).toFixed(1)),
      gamesWithSectorTier4Pct: Number((metrics.gamesWithSectorTier4 * 100 / options.games).toFixed(1)),
      finalRoundLeadChangesPerGame: perGame(metrics.leadChangesInFinalRounds),
      finalScoreGapP50: percentile(metrics.finalScoreGaps, 0.5),
      finalScoreGapP90: percentile(metrics.finalScoreGaps, 0.9)
    }
  };
}

function assertHardGates(report) {
  const failures = [];
  if (report.hard.finishRate !== 1) failures.push(`finishRate=${report.hard.finishRate}`);
  if (report.hard.guardFailures) failures.push(`guardFailures=${report.hard.guardFailures}`);
  if (report.hard.stateFailures) failures.push(`stateFailures=${report.hard.stateFailures}`);
  if (report.hard.commandFailures) failures.push(`commandFailures=${report.hard.commandFailures}`);
  const spread = Math.max(...report.hard.winPctByTurn) - Math.min(...report.hard.winPctByTurn);
  if (report.games >= 200 && spread > 20) failures.push(`turnWinSpread=${spread.toFixed(1)}pp`);
  if (failures.length) throw new Error(`SIM_HARD_GATE_FAILED:${report.profile}:${failures.join(",")}`);
}

function assertCandidateGates(report) {
  const gameplay = report.gameplay, failures = [];
  if (gameplay.gamesWithCashAtOrBelow300Pct < 35 || gameplay.gamesWithCashAtOrBelow300Pct > 70) failures.push(`lowCashGames=${gameplay.gamesWithCashAtOrBelow300Pct}%`);
  if (gameplay.gamesWithRestructurePct < 0.5 || gameplay.gamesWithRestructurePct > 10) failures.push(`restructureGames=${gameplay.gamesWithRestructurePct}%`);
  if (gameplay.projectsAcquiredPerGame < 12) failures.push(`projects=${gameplay.projectsAcquiredPerGame}`);
  if (gameplay.itemCardsDrawnPerGame < 1.7) failures.push(`itemDraws=${gameplay.itemCardsDrawnPerGame}`);
  const reviewHoldPerEntry = gameplay.reviewEntriesPerGame ? gameplay.reviewHeldTurnsPerGame / gameplay.reviewEntriesPerGame : 0;
  if (reviewHoldPerEntry < 0.5 || reviewHoldPerEntry > 1.5) failures.push(`reviewHoldPerEntry=${reviewHoldPerEntry.toFixed(3)}`);
  if (gameplay.minimumCashP50 < 250 || gameplay.minimumCashP50 > 500) failures.push(`minimumCashP50=${gameplay.minimumCashP50}`);
  if (failures.length) throw new Error(`SIM_CANDIDATE_GATE_FAILED:${report.profile}:${failures.join(",")}`);
}

function markdown(reports) {
  const lines = [
    "# 玩法模拟报告",
    "",
    `- games/profile: ${reports[0]?.games || 0}`,
    `- seedStart: ${reports[0]?.seedStart || 0}`,
    "",
    "| profile | finish | win% by turn | acquired | partner | upgrade | tier2/3/4 per game | tier3 games | rent/cash p90 | restructure games | final lead changes |",
    "| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
  ];
  for (const report of reports) {
    lines.push(`| ${report.label} | ${(report.hard.finishRate * 100).toFixed(0)}% | ${report.hard.winPctByTurn.join("/")} | ${report.gameplay.projectsAcquiredPerGame} | ${report.gameplay.partnershipsPerGame} | ${report.gameplay.upgradesPerGame} | ${report.gameplay.sectorTier2UnlocksPerGame}/${report.gameplay.sectorTier3UnlocksPerGame}/${report.gameplay.sectorTier4UnlocksPerGame} | ${report.gameplay.gamesWithSectorTier3Pct}% | ${(report.gameplay.rentShareOfCashP90 * 100).toFixed(1)}% | ${report.gameplay.gamesWithRestructurePct}% | ${report.gameplay.finalRoundLeadChangesPerGame} |`);
  }
  lines.push("", "> 模拟只能检查状态安全和数值分布，不能替代真人试玩。", "");
  return lines.join("\n");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const names = options.all ? Object.keys(profiles) : [options.profile];
  for (const name of names) if (!profiles[name]) throw new Error(`UNKNOWN_PROFILE:${name}`);
  const reports = names.map(name => simulateProfile(name, profiles[name], options));
  if (options.assertHard) reports.forEach(assertHardGates);
  if (options.assertCandidate) reports.forEach(assertCandidateGates);
  const payload = { generatedAt: new Date().toISOString(), reports };
  if (options.output) {
    const prefix = path.resolve(options.output);
    fs.mkdirSync(path.dirname(prefix), { recursive: true });
    fs.writeFileSync(`${prefix}.json`, `${JSON.stringify(payload, null, 2)}\n`);
    fs.writeFileSync(`${prefix}.md`, `${markdown(reports)}\n`);
  }
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

if (require.main === module) main();

module.exports = { parseArgs, seededRandom, simulateProfile, assertHardGates, assertCandidateGates, markdown };
