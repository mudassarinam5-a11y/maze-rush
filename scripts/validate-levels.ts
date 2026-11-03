/**
 * Independent validation of every level in src/game/levelData.json.
 * Usage: npx tsx scripts/validate-levels.ts
 *
 * For each of the 80 levels:
 *  1. static checks (objects on open tiles, keys >= doors, switch/gate, exit + keys reachable)
 *  2. hazard-aware search that finds a damage-free route (spikes + red sentinels, waiting allowed)
 *  3. replay of that route through the REAL game engine; it must reach "won" with all hearts intact
 * Then: uniqueness (rotation/mirror-insensitive), counts and per-mode progression metrics.
 */
import { readFileSync } from "node:fs";
import { recordToLevel } from "../src/game/levelLoader";
import { Engine, type DirName } from "../src/game/engine";
import { validateDynamic, validateStatic } from "../src/game/solver";
import { DIFFS, type LevelData, type LevelRecord } from "../src/game/types";
import { TICK } from "../src/game/sim";

const records: LevelRecord[] = JSON.parse(readFileSync(new URL("../src/game/levelData.json", import.meta.url), "utf8"));
const levels = records.map(recordToLevel);
let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.log("  FAIL:", msg);
};

const DIRN: DirName[] = ["right", "left", "down", "up"]; // order of DIRS in sim.ts

function replay(L: LevelData, actions: { t: number; dir: number }[]) {
  const e = new Engine(L, () => {}, 1, true);
  let ai = 0;
  const last = actions[actions.length - 1].t;
  for (let tick = 1; tick < last + 400; tick++) {
    while (ai < actions.length && actions[ai].t === tick) e.nudge(DIRN[actions[ai++].dir]);
    e.update(TICK);
    if (e.phase === "won" || e.phase === "failed") break;
  }
  return e;
}

// canonical form under the 8 symmetries
function canon(L: LevelData): string {
  const g = L.grid;
  const variants: string[] = [];
  const H = g.length;
  const W = g[0].length;
  for (let t = 0; t < 8; t++) {
    const rows: string[] = [];
    const w = t & 4 ? H : W;
    const h = t & 4 ? W : H;
    for (let y = 0; y < h; y++) {
      let row = "";
      for (let x = 0; x < w; x++) {
        let sx = x;
        let sy = y;
        if (t & 1) sx = w - 1 - sx;
        if (t & 2) sy = h - 1 - sy;
        row += t & 4 ? g[sx][sy] : g[sy][sx];
      }
      rows.push(row);
    }
    variants.push(rows.join("/"));
  }
  return variants.sort()[0];
}

const seen = new Map<string, string>();
const t0 = Date.now();
let validated = 0;
for (const diff of DIFFS) {
  const ls = levels.filter((l) => l.diff === diff);
  if (ls.length !== 20) fail(`${diff} has ${ls.length} levels`);
  ls.forEach((L, i) => {
    const tag = `${diff} L${L.level}`;
    if (L.level !== i + 1) fail(`${tag}: numbering`);
    let ok = true;
    const st = validateStatic(L);
    if (!st.ok) {
      ok = false;
      st.errors.forEach((e) => fail(`${tag}: ${e}`));
    }
    const dyn = validateDynamic(L);
    if (!dyn.ok) {
      ok = false;
      fail(`${tag}: no damage-free route found`);
    } else {
      const e = replay(L, dyn.actions);
      if (e.phase !== "won") {
        ok = false;
        fail(`${tag}: engine replay ended in phase ${e.phase}`);
      } else if (e.hearts !== L.hearts) {
        ok = false;
        fail(`${tag}: engine replay lost hearts (${e.hearts}/${L.hearts})`);
      } else if (e.result?.level !== L.level) {
        ok = false;
        fail(`${tag}: result level mismatch`);
      }
    }
    const c = canon(L);
    if (seen.has(c)) {
      ok = false;
      fail(`${tag}: layout duplicates ${seen.get(c)}`);
    }
    seen.set(c, tag);
    if (ok) validated++;
  });
}

// --- engine unit tests: collisions, cooldown, lose/win separation
{
  const base = levels.find((l) => l.diff === "normal" && l.sentinels.length > 0)!;
  const e = new Engine(base, () => {}, 1, true);
  const s = base.sentinels[0];
  // teleport the player onto the sentinel and keep updating
  let ticks = 0;
  const startHearts = e.hearts;
  const place = () => {
    const mid = { x: Math.round((s.from.x + s.to.x) / 2), y: Math.round((s.from.y + s.to.y) / 2) };
    e.tileX = e.fromX = e.rx = mid.x;
    e.tileY = e.fromY = e.ry = mid.y;
  };
  // sentinels move; just park the player on the patrol line each frame until hit
  while (e.hearts === startHearts && ticks++ < 4000) {
    const phase = e.elapsed;
    const p = { x: s.from.x, y: s.from.y };
    void phase;
    void p;
    place();
    e.update(TICK);
  }
  if (e.hearts !== startHearts - 1) fail(`collision did not remove exactly one heart (${e.hearts})`);
  if (e.phase !== "playing") fail("collision with hearts remaining must not end the level");
  if (e.tileX !== e.respawn.x || e.tileY !== e.respawn.y) fail("player not moved to respawn after a hit");
  const h = e.hearts;
  for (let i = 0; i < 60; i++) {
    place(); // stand in the hazard lane during the cool-down
    e.update(TICK); // < 2.2s cool-down
  }
  if (e.hearts !== h) fail("cool-down failed: lost a second heart immediately");
  // drain remaining hearts -> must end in 'failed', never 'won'
  let guard = 0;
  while (e.phase === "playing" && guard++ < 200000) {
    e.invulnUntil = 0;
    place();
    e.update(TICK);
  }
  if (e.phase !== "failed" || e.hearts !== 0) fail(`expected lose state, got ${e.phase}/${e.hearts}`);
  if (e.result) fail("lose state must not produce a win result");
  console.log("Engine collision / cool-down / lose-state tests complete.");
}

// --- progression summary
for (const diff of DIFFS) {
  const ls = levels.filter((l) => l.diff === diff);
  const row = (L: LevelData) =>
    `${L.width}x${L.height} hz:${L.traps.length}sp+${L.sentinels.length}ball d:${L.doors.length}${L.gates.length ? "+G" : ""} par:${L.parMoves} ♥${L.hearts} hint:${L.hints} fog:${L.fogRadius}`;
  console.log(`${diff.padEnd(10)} L1  → ${row(ls[0])}\n${"".padEnd(10)} L10 → ${row(ls[9])}\n${"".padEnd(10)} L20 → ${row(ls[19])}`);
}
console.log(`\nLevels: ${levels.length}; unique layouts (rotation/mirror-insensitive): ${seen.size}; fully validated: ${validated}/${levels.length}; failures: ${failures}; ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(failures ? 1 : 0);
