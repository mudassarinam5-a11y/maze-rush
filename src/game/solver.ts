import type { LevelData, Pt } from "./types";
import { DIRS, isOpen, sentinelPos, spikeAmp, trapOffset, TICK } from "./sim";

/**
 * Level validators.
 *  - validateStatic: layout, objects, keys/doors/gate logic (ignores moving hazards).
 *  - validateDynamic: time-expanded search that proves the level can be completed
 *    WITHOUT taking any damage from spikes or sentinels (waiting is allowed).
 * They are used by the offline level generator and by scripts/validate-levels.ts.
 */

const FLAG_GATE = 256;
const pop = (n: number) => {
  let c = 0;
  while (n) {
    c += n & 1;
    n >>= 1;
  }
  return c;
};

interface Ctx {
  L: LevelData;
  W: number;
  doorIdx: Map<number, number>;
  keyIdx: Map<number, number>;
  gateSet: Set<number>;
  switchId: number;
  exitId: number;
}

function build(L: LevelData): Ctx {
  const W = L.width;
  const id = (p: Pt) => p.y * W + p.x;
  const doorIdx = new Map<number, number>();
  L.doors.forEach((d, i) => doorIdx.set(id(d), i));
  const keyIdx = new Map<number, number>();
  L.keys.forEach((k, i) => keyIdx.set(id(k), i));
  return {
    L,
    W,
    doorIdx,
    keyIdx,
    gateSet: new Set(L.gates.map(id)),
    switchId: L.switchPos ? id(L.switchPos) : -1,
    exitId: id(L.exit),
  };
}

function passable(c: Ctx, x: number, y: number, flags: number): boolean {
  if (!isOpen(c.L, x, y)) return false;
  const t = y * c.W + x;
  const di = c.doorIdx.get(t);
  if (di !== undefined && !(flags & (16 << di))) {
    return pop(flags & 15) - pop((flags >> 4) & 15) > 0;
  }
  if (c.gateSet.has(t) && !(flags & FLAG_GATE)) return false;
  return true;
}

function arrive(c: Ctx, x: number, y: number, flags: number): number {
  const t = y * c.W + x;
  const ki = c.keyIdx.get(t);
  if (ki !== undefined) flags |= 1 << ki;
  const di = c.doorIdx.get(t);
  if (di !== undefined) flags |= 16 << di;
  if (t === c.switchId) flags |= FLAG_GATE;
  return flags;
}

export interface StaticResult {
  ok: boolean;
  errors: string[];
  minMoves: number;
}

export function validateStatic(L: LevelData): StaticResult {
  const errors: string[] = [];
  const c = build(L);
  const all: [string, Pt][] = [
    ["start", L.start],
    ["exit", L.exit],
    ...L.keys.map((p, i) => [`key${i}`, p] as [string, Pt]),
    ...L.doors.map((p, i) => [`door${i}`, p] as [string, Pt]),
    ...L.gates.map((p, i) => [`gate${i}`, p] as [string, Pt]),
    ...L.traps.map((p, i) => [`trap${i}`, p] as [string, Pt]),
    ...L.checkpoints.map((p, i) => [`checkpoint${i}`, p] as [string, Pt]),
  ];
  if (L.switchPos) all.push(["switch", L.switchPos]);
  const seen = new Map<string, string>();
  for (const [n, p] of all) {
    if (!isOpen(L, p.x, p.y)) errors.push(`${n} is not on an open tile`);
    const k = `${p.x},${p.y}`;
    if (seen.has(k)) errors.push(`${n} overlaps ${seen.get(k)}`);
    seen.set(k, n);
  }
  if (L.keys.length < L.doors.length) errors.push("fewer keys than doors");
  if (L.gates.length > 0 && !L.switchPos) errors.push("gate without switch");
  for (const s of L.sentinels) {
    const A = Math.abs(s.to.x - s.from.x) + Math.abs(s.to.y - s.from.y);
    if (A < 2) errors.push("sentinel patrol too short");
    const dx = Math.sign(s.to.x - s.from.x);
    const dy = Math.sign(s.to.y - s.from.y);
    for (let i = 0; i <= A; i++) {
      if (!isOpen(L, s.from.x + dx * i, s.from.y + dy * i)) errors.push("sentinel patrol crosses a wall");
    }
    // clearance from start / checkpoints (safe respawn)
    const safeTiles = [L.start, ...L.checkpoints, L.exit];
    for (const p of safeTiles) {
      for (let i = 0; i <= A; i++) {
        const d = Math.abs(p.x - (s.from.x + dx * i)) + Math.abs(p.y - (s.from.y + dy * i));
        if (d < 4) {
          errors.push("sentinel patrol too close to start/checkpoint/exit");
          i = A + 1;
          break;
        }
      }
    }
  }
  for (const t of L.traps) {
    for (const p of [L.start, ...L.checkpoints]) {
      if (Math.abs(p.x - t.x) + Math.abs(p.y - t.y) < 3) errors.push("spike too close to start/checkpoint");
    }
  }
  // flag BFS
  const dist = new Map<number, number>();
  const startState = (L.start.y * c.W + L.start.x) * 512;
  dist.set(startState, 0);
  const q = [startState];
  let minMoves = -1;
  const reached = new Set<number>();
  for (let i = 0; i < q.length; i++) {
    const s = q[i];
    const tile = Math.floor(s / 512);
    const flags = s % 512;
    const d = dist.get(s)!;
    reached.add(tile);
    if (tile === c.exitId && minMoves < 0) minMoves = d;
    const x = tile % c.W;
    const y = Math.floor(tile / c.W);
    for (const dir of DIRS) {
      const nx = x + dir.x;
      const ny = y + dir.y;
      if (!passable(c, nx, ny, flags)) continue;
      const ns = (ny * c.W + nx) * 512 + arrive(c, nx, ny, flags);
      if (dist.has(ns)) continue;
      dist.set(ns, d + 1);
      q.push(ns);
    }
  }
  if (minMoves < 0) errors.push("exit is not reachable");
  L.keys.forEach((k, i) => {
    if (!reached.has(k.y * c.W + k.x)) errors.push(`key${i} unreachable`);
  });
  if (L.switchPos && !reached.has(c.switchId)) errors.push("switch unreachable");
  // exit must be reachable while *every* door/gate is actually required or at least valid
  return { ok: errors.length === 0, errors, minMoves };
}

export interface Action {
  t: number;
  dir: number; // index in DIRS
}
export interface DynamicResult {
  ok: boolean;
  ticks: number;
  actions: Action[];
}

interface Node {
  tile: number;
  x: number;
  y: number;
  flags: number;
  t: number;
  parent: Node | null;
  dir: number;
  dep: number;
}

const HIT_R2 = 0.8 * 0.8; // conservative (game uses 0.42 ≈ 0.65²)
const SPIKE_SAFE = 0.5; // conservative (game damages above 0.62)

export function validateDynamic(L: LevelData, horizon = 16000, window = 1200): DynamicResult {
  const c = build(L);
  const W = L.width;
  const S = Math.round(L.stepMs / (TICK * 1000));
  const trapMap = new Map<number, number>();
  for (const t of L.traps) trapMap.set(t.y * W + t.x, trapOffset(t.x, t.y, L.spikeCycle));

  const hit = (px: number, py: number, tick: number): boolean => {
    const time = tick * TICK;
    for (const s of L.sentinels) {
      const p = sentinelPos(s, time, L.sentinelSpeed);
      const dx = p.x - px;
      const dy = p.y - py;
      if (dx * dx + dy * dy < HIT_R2) return true;
    }
    if (trapMap.size) {
      const off = trapMap.get(Math.round(py) * W + Math.round(px));
      if (off !== undefined && spikeAmp(time, off, L.spikeCycle) > SPIKE_SAFE) return true;
    }
    return false;
  };
  const moveSafe = (x: number, y: number, nx: number, ny: number, t0: number): boolean => {
    for (let k = 0; k <= S; k++) {
      const s = k / S;
      const e = 1 - (1 - s) * (1 - s);
      if (hit(x + (nx - x) * e, y + (ny - y) * e, t0 + k)) return false;
    }
    return true;
  };

  // tiles whose neighbourhood is ever touched by a hazard need time-aware search
  const hazard = new Uint8Array(W * L.height);
  for (const k of trapMap.keys()) hazard[k] = 1;
  for (const s of L.sentinels) {
    const minX = Math.min(s.from.x, s.to.x);
    const maxX = Math.max(s.from.x, s.to.x);
    const minY = Math.min(s.from.y, s.to.y);
    const maxY = Math.max(s.from.y, s.to.y);
    for (let y = 0; y < L.height; y++) {
      for (let x = 0; x < W; x++) {
        const dx = Math.max(minX - x, 0, x - maxX);
        const dy = Math.max(minY - y, 0, y - maxY);
        if (Math.hypot(dx, dy) < 1.4) hazard[y * W + x] = 1;
      }
    }
  }

  const buckets: Node[][] = [];
  const push = (n: Node) => {
    if (n.t > horizon) return;
    (buckets[n.t] ||= []).push(n);
  };
  const startTile = L.start.y * W + L.start.x;
  push({ tile: startTile, x: L.start.x, y: L.start.y, flags: 0, t: 1, parent: null, dir: -1, dep: 1 });
  const visited = new Set<number>();

  for (let t = 1; t <= horizon; t++) {
    const list = buckets[t];
    if (!list) continue;
    delete buckets[t];
    for (const n of list) {
      const hz = hazard[n.tile] === 1;
      const k = hz ? (n.tile * 512 + n.flags) * (horizon + 1) + t : n.tile * 512 + n.flags;
      if (visited.has(k)) continue;
      visited.add(k);
      if (n.tile === c.exitId) {
        const actions: Action[] = [];
        for (let cur: Node | null = n; cur; cur = cur.parent) if (cur.dir >= 0) actions.push({ t: cur.dep, dir: cur.dir });
        actions.reverse();
        return { ok: true, ticks: t, actions };
      }
      if (hz && !hit(n.x, n.y, t + 1)) {
        push({ ...n, t: t + 1, parent: n, dir: -1 });
      }
      for (let di = 0; di < 4; di++) {
        const d = DIRS[di];
        const nx = n.x + d.x;
        const ny = n.y + d.y;
        if (!passable(c, nx, ny, n.flags)) continue;
        const nt = ny * W + nx;
        const tz = hazard[nt] === 1;
        const nf = arrive(c, nx, ny, n.flags);
        if (!hz && !tz) {
          push({ tile: nt, x: nx, y: ny, flags: nf, t: t + S, parent: n, dir: di, dep: t });
          continue;
        }
        const last = !hz && tz ? t + window : t;
        for (let dep = t; dep <= last; dep++) {
          if (!moveSafe(n.x, n.y, nx, ny, dep)) continue;
          push({ tile: nt, x: nx, y: ny, flags: nf, t: dep + S, parent: n, dir: di, dep });
        }
      }
    }
  }
  return { ok: false, ticks: -1, actions: [] };
}
