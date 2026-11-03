export type Diff = "easy" | "normal" | "hard" | "impossible";
export const DIFFS: Diff[] = ["easy", "normal", "hard", "impossible"];
export const LEVELS_PER_DIFF = 20;

export interface Pt {
  x: number;
  y: number;
}

export interface Sentinel {
  from: Pt;
  to: Pt;
  axis: "h" | "v";
  phase: number;
  speed: number;
}

/** Everything the engine, renderer and validators need to know about one level. */
export interface LevelData {
  diff: Diff;
  level: number;
  name: string;
  width: number;
  height: number;
  /** 1 = wall, 0 = open floor */
  grid: number[][];
  start: Pt;
  exit: Pt;
  keys: Pt[];
  doors: Pt[];
  gates: Pt[];
  switchPos: Pt | null;
  traps: Pt[];
  checkpoints: Pt[];
  sentinels: Sentinel[];
  parTime: number;
  parMoves: number;
  hearts: number;
  /** -1 = unlimited */
  hints: number;
  fogRadius: number;
  sentinelSpeed: number;
  spikeCycle: number;
  stepMs: number;
}

/** Compact JSON form stored on disk. */
export interface LevelRecord extends Omit<LevelData, "grid"> {
  rows: string[];
}

export const key = (x: number, y: number) => `${x},${y}`;
