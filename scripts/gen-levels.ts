/**
 * Offline level generator for MAZE RUSH.
 * Usage: npx tsx scripts/gen-levels.ts
 *
 * Every level is generated from a fixed seed, then validated (static + hazard-aware).
 * Only levels that pass are written to src/game/levelData.json, which is the single
 * source of truth the game loads at run time. No random layouts are generated in the browser.
 */
import { writeFileSync } from "node:fs";
import type { Diff, LevelData, LevelRecord, Pt, Sentinel } from "../src/game/types";
import { DIFFS } from "../src/game/types";
import { DIRS, findPath } from "../src/game/sim";
import { validateDynamic, validateStatic } from "../src/game/solver";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
const ri = (r: Rng, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
function shuffle<T>(r: Rng, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Params {
  cw: number;
  ch: number;
  braid: number;
  pNewest: number;
  straight: number;
  minRatio: number;
  rooms: number;
  doors: number;
  gate: boolean;
  spikes: number;
  sentinels: number;
  checkpoints: number;
  hearts: number;
  hints: number;
  fog: number;
  sentSpeed: number;
  spikeCycle: number;
  stepMs: number;
}

function params(diff: Diff, L: number): Params {
  const t = (L - 1) / 19;
  const off = [0, 1, -1][L % 3];
  const sizeFor = (a: number, b: number, cap = 13) => {
    const n = Math.round(lerp(a, b, t));
    let cw = n;
    let ch = clamp(n + off, 5, cap);
    if (L % 2 === 0) [cw, ch] = [ch, cw];
    return { cw, ch };
  };
  switch (diff) {
    case "easy":
      return {
        ...sizeFor(5, 9),
        braid: lerp(0.7, 0.35, t),
        pNewest: lerp(0.35, 0.6, t),
        straight: lerp(0.3, 0.5, t),
        minRatio: lerp(0.12, 0.2, t),
        rooms: L % 4 === 3 || L >= 15 ? 1 : 0,
        doors: L < 4 ? 0 : L < 11 ? 1 : 2,
        gate: false,
        spikes: L < 6 ? 0 : Math.round(lerp(1, 4, (L - 6) / 14)),
        sentinels: L < 8 ? 0 : L < 15 ? 1 : 2,
        checkpoints: L >= 8 ? 1 : 0,
        hearts: L < 14 ? 5 : 4,
        hints: -1,
        fog: 0,
        sentSpeed: +lerp(0.55, 0.7, t).toFixed(2),
        spikeCycle: 2.1,
        stepMs: 150,
      };
    case "normal":
      return {
        ...sizeFor(8, 12),
        braid: lerp(0.35, 0.15, t),
        pNewest: lerp(0.55, 0.8, t),
        straight: lerp(0.35, 0.55, t),
        minRatio: lerp(0.2, 0.3, t),
        rooms: L % 5 === 0 || L % 7 === 2 ? 1 : 0,
        doors: L < 9 ? 1 : L < 16 ? 2 : 3,
        gate: L >= 8 && L % 2 === 0,
        spikes: Math.round(lerp(2, 8, t)),
        sentinels: Math.round(lerp(1, 3, t)),
        checkpoints: L >= 14 ? 2 : 1,
        hearts: L < 8 ? 4 : 3,
        hints: L < 11 ? 4 : 3,
        fog: 0,
        sentSpeed: +lerp(0.85, 1.1, t).toFixed(2),
        spikeCycle: 1.8,
        stepMs: 150,
      };
    case "hard":
      return {
        ...sizeFor(9, 13),
        braid: lerp(0.15, 0.05, t),
        pNewest: lerp(0.75, 0.9, t),
        straight: lerp(0.4, 0.6, t),
        minRatio: lerp(0.28, 0.4, t),
        rooms: L % 6 === 0 ? 1 : 0,
        doors: L < 3 ? 1 : L < 10 ? 2 : 3,
        gate: L >= 4 && (L % 2 === 0 || L >= 12),
        spikes: Math.round(lerp(3, 11, t)),
        sentinels: Math.round(lerp(2, 5, t)),
        checkpoints: L < 10 ? 1 : 2,
        hearts: L < 13 ? 3 : 2,
        hints: L < 9 ? 3 : L < 17 ? 2 : 1,
        fog: +lerp(8, 5.2, t).toFixed(1),
        sentSpeed: +lerp(1.15, 1.4, t).toFixed(2),
        spikeCycle: 1.5,
        stepMs: 125,
      };
    case "impossible":
      return {
        ...sizeFor(11, 13),
        braid: lerp(0.06, 0, t),
        pNewest: lerp(0.85, 0.97, t),
        straight: lerp(0.45, 0.65, t),
        minRatio: lerp(0.36, 0.46, t),
        rooms: L % 7 === 4 ? 1 : 0,
        doors: L < 4 ? 2 : 3,
        gate: L >= 2,
        spikes: Math.round(lerp(5, 14, t)),
        sentinels: Math.round(lerp(3, 7, t)),
        checkpoints: 2,
        hearts: L < 6 ? 3 : 2,
        hints: L < 8 ? 2 : L < 16 ? 1 : 0,
        fog: +lerp(5.2, 3.2, t).toFixed(1),
        sentSpeed: +lerp(1.4, 1.7, t).toFixed(2),
        spikeCycle: 1.25,
        stepMs: 125,
      };
  }
}

const NAME_ADJ = [
  "Quiet", "Mossy", "Twisting", "Hidden", "Winding", "Silent", "Forgotten", "Echoing", "Crooked", "Shifting",
  "Sunken", "Ancient", "Frozen", "Burning", "Hollow", "Shattered", "Endless", "Cursed", "Whispering", "Final",
];
const NAME_NOUN: Record<Diff, string> = { easy: "Garden", normal: "Ruins", hard: "Catacomb", impossible: "Abyss" };

// ---------------------------------------------------------------- maze helpers
type Grid = number[][];

function carveMaze(cw: number, ch: number, r: Rng, pNewest: number, straight: number): Grid {
  const W = cw * 2 + 1;
  const H = ch * 2 + 1;
  const g: Grid = Array.from({ length: H }, () => Array(W).fill(1));
  const vis = Array.from({ length: ch }, () => Array(cw).fill(false));
  const last: number[][] = Array.from({ length: ch }, () => Array(cw).fill(-1));
  const sx = ri(r, 0, cw - 1);
  const sy = ri(r, 0, ch - 1);
  vis[sy][sx] = true;
  g[sy * 2 + 1][sx * 2 + 1] = 0;
  const list: Pt[] = [{ x: sx, y: sy }];
  while (list.length) {
    const idx = r() < pNewest ? list.length - 1 : Math.floor(r() * list.length);
    const c = list[idx];
    const opts: number[] = [];
    for (let d = 0; d < 4; d++) {
      const nx = c.x + DIRS[d].x;
      const ny = c.y + DIRS[d].y;
      if (nx >= 0 && ny >= 0 && nx < cw && ny < ch && !vis[ny][nx]) opts.push(d);
    }
    if (!opts.length) {
      list.splice(idx, 1);
      continue;
    }
    const ld = last[c.y][c.x];
    const d = ld >= 0 && opts.includes(ld) && r() < straight ? ld : opts[Math.floor(r() * opts.length)];
    const nx = c.x + DIRS[d].x;
    const ny = c.y + DIRS[d].y;
    g[c.y * 2 + 1 + DIRS[d].y][c.x * 2 + 1 + DIRS[d].x] = 0;
    g[ny * 2 + 1][nx * 2 + 1] = 0;
    vis[ny][nx] = true;
    last[ny][nx] = d;
    list.push({ x: nx, y: ny });
  }
  return g;
}

const deg = (g: Grid, x: number, y: number) => {
  let n = 0;
  for (const d of DIRS) if (g[y + d.y]?.[x + d.x] === 0) n++;
  return n;
};

function braid(g: Grid, cw: number, ch: number, frac: number, r: Rng) {
  const dead: Pt[] = [];
  for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) if (deg(g, cx * 2 + 1, cy * 2 + 1) === 1) dead.push({ x: cx * 2 + 1, y: cy * 2 + 1 });
  const todo = shuffle(r, dead).slice(0, Math.round(dead.length * frac));
  for (const p of todo) {
    if (deg(g, p.x, p.y) !== 1) continue;
    const cands = DIRS.filter((d) => {
      const wx = p.x + d.x;
      const wy = p.y + d.y;
      const nx = p.x + d.x * 2;
      const ny = p.y + d.y * 2;
      return nx > 0 && ny > 0 && ny < g.length - 1 && nx < g[0].length - 1 && g[wy][wx] === 1;
    });
    if (!cands.length) continue;
    const dead2 = cands.filter((d) => deg(g, p.x + d.x * 2, p.y + d.y * 2) === 1);
    const d = (dead2.length ? dead2 : cands)[Math.floor(r() * (dead2.length || cands.length))];
    g[p.y + d.y][p.x + d.x] = 0;
  }
}

function addRooms(g: Grid, cw: number, ch: number, n: number, r: Rng) {
  for (let i = 0; i < n; i++) {
    const rw = ri(r, 2, 3);
    const rh = ri(r, 2, 3);
    if (cw < rw + 2 || ch < rh + 2) continue;
    const cx = ri(r, 1, cw - rw - 1);
    const cy = ri(r, 1, ch - rh - 1);
    for (let y = cy * 2 + 1; y <= (cy + rh - 1) * 2 + 1; y++) for (let x = cx * 2 + 1; x <= (cx + rw - 1) * 2 + 1; x++) g[y][x] = 0;
  }
}

function bfsDist(g: Grid, from: Pt, blocked?: Set<number>): Map<number, number> {
  const W = g[0].length;
  const dist = new Map<number, number>();
  dist.set(from.y * W + from.x, 0);
  const q: Pt[] = [from];
  for (let i = 0; i < q.length; i++) {
    const c = q[i];
    const d = dist.get(c.y * W + c.x)!;
    for (const dir of DIRS) {
      const nx = c.x + dir.x;
      const ny = c.y + dir.y;
      if (g[ny]?.[nx] !== 0) continue;
      const k = ny * W + nx;
      if (dist.has(k) || blocked?.has(k)) continue;
      dist.set(k, d + 1);
      q.push({ x: nx, y: ny });
    }
  }
  return dist;
}

const man = (a: Pt, b: Pt) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const same = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y;

// ---------------------------------------------------------------- level builder
function emptyLevel(diff: Diff, level: number, p: Params, g: Grid): LevelData {
  return {
    diff,
    level,
    name: `${NAME_ADJ[level - 1]} ${NAME_NOUN[diff]}`,
    width: g[0].length,
    height: g.length,
    grid: g,
    start: { x: 1, y: 1 },
    exit: { x: 1, y: 1 },
    keys: [],
    doors: [],
    gates: [],
    switchPos: null,
    traps: [],
    checkpoints: [],
    sentinels: [],
    parTime: 0,
    parMoves: 0,
    hearts: p.hearts,
    hints: p.hints,
    fogRadius: p.fog,
    sentinelSpeed: p.sentSpeed,
    spikeCycle: p.spikeCycle,
    stepMs: p.stepMs,
  };
}

function attempt(diff: Diff, level: number, p: Params, seed: number, needRatio: number): LevelData | null {
  const r = mulberry(seed);
  const g = carveMaze(p.cw, p.ch, r, p.pNewest, p.straight);
  braid(g, p.cw, p.ch, p.braid, r);
  addRooms(g, p.cw, p.ch, p.rooms, r);
  const W = g[0].length;
  const H = g.length;
  const L = emptyLevel(diff, level, p, g);

  // start in a corner, exit at the far end
  const corner = ri(r, 0, 3);
  L.start = { x: corner & 1 ? W - 2 : 1, y: corner & 2 ? H - 2 : 1 };
  const dist = bfsDist(g, L.start);
  let best = -1;
  for (const [k, d] of dist) {
    const x = k % W;
    const y = Math.floor(k / W);
    if (x % 2 === 1 && y % 2 === 1 && d > best) {
      best = d;
      L.exit = { x, y };
    }
  }
  if (best / 2 < needRatio * p.cw * p.ch) return null;

  const P = findPath(L, L.start, L.exit, (x, y) => g[y][x] === 0)!;
  const idOf = (q: Pt) => q.y * W + q.x;

  // ---- obstacles on chokepoints of the solution path
  const nObs = p.doors + (p.gate ? 1 : 0);
  const chosen: number[] = [];
  if (nObs > 0) {
    const choke: number[] = [];
    for (let i = 4; i < P.length - 5; i++) {
      const q = P[i];
      if (deg(g, q.x, q.y) !== 2) continue;
      const d = bfsDist(g, L.start, new Set([idOf(q)]));
      if (!d.has(idOf(L.exit))) choke.push(i);
    }
    for (let j = 1; j <= nObs; j++) {
      const target = (j / (nObs + 1) + (r() - 0.5) * 0.08) * P.length;
      const opts = choke.filter((i) => chosen.every((c) => Math.abs(c - i) >= 4)).sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
      if (!opts.length) return null;
      chosen.push(opts[0]);
    }
    chosen.sort((a, b) => a - b);
    const gateAt = p.gate ? ri(r, 0, nObs - 1) : -1;
    const switchBlocked: Set<number>[] = [];
    chosen.forEach((ci, k) => {
      const q = P[ci];
      if (k === gateAt) L.gates.push({ ...q });
      else L.doors.push({ ...q });
      switchBlocked.push(new Set(chosen.slice(k).map((c) => idOf(P[c]))));
    });
    // place keys / switch in the region reachable BEFORE the obstacle they serve
    const used: Pt[] = [L.start, L.exit];
    const hard = diff === "hard" || diff === "impossible" || level > 12;
    for (let k = 0; k < chosen.length; k++) {
      const region = bfsDist(g, L.start, switchBlocked[k]);
      const cands: { p: Pt; d: number }[] = [];
      for (const [id, d] of region) {
        const x = id % W;
        const y = Math.floor(id / W);
        if (deg(g, x, y) !== 1 || d < 4) continue;
        const q = { x, y };
        if (used.some((u) => man(u, q) < 3)) continue;
        cands.push({ p: q, d });
      }
      if (!cands.length) return null;
      cands.sort((a, b) => b.d - a.d);
      const third = Math.max(1, Math.floor(cands.length / 3));
      const pool = hard ? cands.slice(0, third) : cands.slice(Math.floor(cands.length / 4), Math.max(Math.floor(cands.length / 4) + 1, Math.floor(cands.length * 0.75)));
      const pick = pool[Math.floor(r() * pool.length)].p;
      used.push(pick);
      if (k === gateAt) L.switchPos = pick;
      else L.keys.push(pick);
    }
  }

  const items = (): Pt[] => [L.start, L.exit, ...L.keys, ...L.doors, ...L.gates, ...(L.switchPos ? [L.switchPos] : [])];

  // ---- checkpoints on the solution path
  for (let k = 0; k < p.checkpoints; k++) {
    const f = p.checkpoints === 1 ? 0.55 : k === 0 ? 0.4 : 0.72;
    const idx = Math.round(f * P.length);
    const opts = P.map((q, i) => ({ q, i }))
      .filter(({ q, i }) => i > 6 && i < P.length - 8 && deg(g, q.x, q.y) === 2 && [...items(), ...L.checkpoints].every((u) => man(u, q) >= 4))
      .sort((a, b) => Math.abs(a.i - idx) - Math.abs(b.i - idx));
    if (!opts.length) return null;
    L.checkpoints.push({ ...opts[0].q });
  }

  const finish = (): boolean => {
    const dyn = validateDynamic(L);
    return dyn.ok;
  };
  if (!finish()) return null;

  // ---- sentinels (red balls) patrolling side branches that cross the solution path
  const segCells = (s: Sentinel): Pt[] => {
    const A = man(s.from, s.to);
    const dx = Math.sign(s.to.x - s.from.x);
    const dy = Math.sign(s.to.y - s.from.y);
    return Array.from({ length: A + 1 }, (_, i) => ({ x: s.from.x + dx * i, y: s.from.y + dy * i }));
  };
  const cands: Sentinel[] = [];
  const routes: Pt[][] = [P];
  for (const target of [...L.keys, ...(L.switchPos ? [L.switchPos] : [])]) {
    const rp = findPath(L, L.start, target, (x, y) => g[y][x] === 0);
    if (rp && rp.length > 12) routes.push(rp);
  }
  for (const route of routes) {
   for (let i = 6; i < route.length - 5; i++) {
    const q = route[i];
    const pv = route[i - 1];
    const nx = route[i + 1];
    for (const d of DIRS.slice(0, 4)) {
      if (d.x < 0 || d.y < 0) continue; // handle both directions via k1/k2
      const sides = [d, { x: -d.x, y: -d.y }];
      const ext = sides.map((s) => {
        const tx = q.x + s.x;
        const ty = q.y + s.y;
        if (g[ty]?.[tx] !== 0 || same({ x: tx, y: ty }, pv) || same({ x: tx, y: ty }, nx)) return 0;
        let n = 0;
        while (n < 5 && g[q.y + s.y * (n + 1)]?.[q.x + s.x * (n + 1)] === 0) n++;
        return n;
      });
      const k1 = ext[0];
      const k2 = ext[1];
      if (k1 + k2 < 3) continue;
      const from = { x: q.x - d.x * k2, y: q.y - d.y * k2 };
      const to = { x: q.x + d.x * k1, y: q.y + d.y * k1 };
      cands.push({ from, to, axis: d.x !== 0 ? "h" : "v", phase: r(), speed: +(0.9 + r() * 0.25).toFixed(2) });
    }
   }
  }
  const safeCells = () => [L.start, L.exit, ...L.checkpoints];
  let tries = 0;
  for (const s of shuffle(r, cands)) {
    if (L.sentinels.length >= p.sentinels || tries > 160) break;
    const cells = segCells(s);
    if (cells.some((c) => safeCells().some((u) => man(u, c) < 4))) continue;
    if (cells.some((c) => [...L.keys, ...L.doors, ...L.gates, ...(L.switchPos ? [L.switchPos] : [])].some((u) => man(u, c) < 3))) continue;
    if (L.sentinels.some((o) => segCells(o).some((oc) => cells.some((c) => man(oc, c) < 3)))) continue;
    tries++;
    L.sentinels.push(s);
    if (!finish()) L.sentinels.pop();
  }
  if (L.sentinels.length < Math.min(p.sentinels, 1) && p.sentinels > 0) return null;

  // ---- spikes on corridor tiles
  const reachable = [...bfsDist(g, L.start).keys()].map((id) => ({ x: id % W, y: Math.floor(id / W) }));
  const onPath = new Set(P.map(idOf));
  const spikeCand = shuffle(
    r,
    reachable.filter((q) => deg(g, q.x, q.y) === 2),
  );
  spikeCand.sort((a, b) => (onPath.has(idOf(b)) ? 0.65 : 0.0) + r() * 0.5 - ((onPath.has(idOf(a)) ? 0.65 : 0.0) + r() * 0.5));
  tries = 0;
  for (const q of spikeCand) {
    if (L.traps.length >= p.spikes || tries > 60) break;
    if (safeCells().some((u) => man(u, q) < 3)) continue;
    if (items().some((u) => man(u, q) < 3)) continue;
    if (L.traps.some((u) => man(u, q) < 3)) continue;
    if (L.sentinels.some((s) => segCells(s).some((c) => man(c, q) < 3))) continue;
    tries++;
    L.traps.push(q);
    if (!finish()) L.traps.pop();
  }
  if (L.traps.length < Math.ceil(p.spikes * 0.7)) return null;

  const st = validateStatic(L);
  if (!st.ok) return null;
  L.parMoves = Math.ceil(st.minMoves * 1.2) + 4;
  L.parTime = Math.ceil((L.parMoves * L.stepMs) / 1000 * 1.6 + 8 + L.sentinels.length * 2);
  return L;
}

function generate(diff: Diff, level: number): { L: LevelData; tries: number } {
  const p = params(diff, level);
  const base = (DIFFS.indexOf(diff) + 1) * 100003 + level * 7919;
  for (let a = 0; a < 800; a++) {
    const need = p.minRatio * (1 - 0.5 * (a / 800));
    const L = attempt(diff, level, p, base + a * 31, need);
    if (L) return { L, tries: a + 1 };
  }
  throw new Error(`Could not generate ${diff} ${level}`);
}

const toRecord = (L: LevelData): LevelRecord => {
  const { grid, ...rest } = L;
  return { ...rest, rows: grid.map((row) => row.map((c) => (c ? "#" : ".")).join("")) };
};

const out: LevelRecord[] = [];
const t0 = Date.now();
for (const diff of DIFFS) {
  for (let level = 1; level <= 20; level++) {
    const { L, tries } = generate(diff, level);
    out.push(toRecord(L));
    console.log(
      `${diff.padEnd(10)} L${String(level).padStart(2)} ${L.width}x${L.height} doors:${L.doors.length} gate:${L.gates.length} spikes:${L.traps.length} sent:${L.sentinels.length} cp:${L.checkpoints.length} hearts:${L.hearts} hints:${L.hints} fog:${L.fogRadius} par:${L.parMoves} tries:${tries}`,
    );
  }
}
writeFileSync(new URL("../src/game/levelData.json", import.meta.url), JSON.stringify(out));
console.log(`Wrote ${out.length} levels in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
