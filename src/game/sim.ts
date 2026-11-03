import type { LevelData, Pt, Sentinel } from "./types";

/** Deterministic hazard maths shared by the game, the level generator and the validators. */

export const SPIKE_DAMAGE_LEVEL = 0.62;
export const SENTINEL_HIT_R2 = 0.42;
export const TICK = 0.025; // seconds per validation tick

/** Position of a patrolling sentinel (red ball) at a given time. */
export function sentinelPos(s: Sentinel, elapsed: number, speedMult: number): Pt {
  const dx = s.to.x - s.from.x;
  const dy = s.to.y - s.from.y;
  const A = Math.abs(dx) + Math.abs(dy);
  if (A === 0) return { ...s.from };
  const q = (((elapsed * s.speed * speedMult + s.phase * A * 2) % (A * 2)) + A * 2) % (A * 2);
  const e = q < A ? q : A * 2 - q;
  return { x: s.from.x + Math.sign(dx) * e, y: s.from.y + Math.sign(dy) * e };
}

/** 0 = spikes fully down, 1 = fully raised. */
export function spikeAmp(elapsed: number, offset: number, cycle: number): number {
  const r = (((elapsed + offset) % cycle) + cycle) % cycle / cycle;
  return r < 0.16 ? r / 0.16 : r < 0.58 ? 1 : r < 0.76 ? 1 - (r - 0.58) / 0.18 : 0;
}

export const trapOffset = (x: number, y: number, cycle: number) => (((x * 37 + y * 91) % 100) / 100) * cycle;

const DIRS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];
export { DIRS };

export const inBounds = (L: { width: number; height: number }, x: number, y: number) =>
  x >= 0 && y >= 0 && x < L.width && y < L.height;

export const isOpen = (L: LevelData, x: number, y: number) => inBounds(L, x, y) && L.grid[y][x] === 0;

/** Breadth-first path between two tiles with a custom passability test. */
export function findPath(
  L: LevelData,
  from: Pt,
  to: Pt,
  passable: (x: number, y: number) => boolean,
): Pt[] | null {
  if (from.x === to.x && from.y === to.y) return [from];
  const prev = new Map<number, number>();
  const id = (x: number, y: number) => y * L.width + x;
  const q: Pt[] = [from];
  prev.set(id(from.x, from.y), -1);
  for (let i = 0; i < q.length; i++) {
    const c = q[i];
    for (const d of DIRS) {
      const nx = c.x + d.x;
      const ny = c.y + d.y;
      if (!inBounds(L, nx, ny)) continue;
      const k = id(nx, ny);
      if (prev.has(k) || !passable(nx, ny)) continue;
      prev.set(k, id(c.x, c.y));
      if (nx === to.x && ny === to.y) {
        const out: Pt[] = [];
        let cur = k;
        while (cur !== -1) {
          out.push({ x: cur % L.width, y: Math.floor(cur / L.width) });
          cur = prev.get(cur)!;
        }
        return out.reverse();
      }
      q.push({ x: nx, y: ny });
    }
  }
  return null;
}
