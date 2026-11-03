import data from "./levelData.json";
import { recordToLevel } from "./levelLoader";
import { DIFFS, LEVELS_PER_DIFF, type Diff, type LevelData, type LevelRecord } from "./types";

export interface DiffInfo {
  label: string;
  blurb: string;
  scoreMult: number;
  accent: string;
}

export const DIFF_INFO: Record<Diff, DiffInfo> = {
  easy: { label: "Easy", blurb: "Gentle mazes, up to 5 hearts and unlimited hints. Learn the labyrinth.", scoreMult: 1, accent: "emerald" },
  normal: { label: "Normal", blurb: "The intended challenge: more keys, spikes and sentinels, with a few hints.", scoreMult: 1.5, accent: "cyan" },
  hard: { label: "Hard", blurb: "Fog closes in. Fewer hearts, fewer hints, faster sentinels.", scoreMult: 2.5, accent: "violet" },
  impossible: { label: "Impossible", blurb: "Heavy fog, the fewest hearts and hints, relentless hazards. Beatable with skill.", scoreMult: 4, accent: "rose" },
};

const byDiff: Record<Diff, LevelData[]> = { easy: [], normal: [], hard: [], impossible: [] };
for (const rec of data as unknown as LevelRecord[]) byDiff[rec.diff].push(recordToLevel(rec));
for (const d of DIFFS) byDiff[d].sort((a, b) => a.level - b.level);

export function getLevel(diff: Diff, level: number): LevelData {
  const l = byDiff[diff][clampLevel(level) - 1];
  return l;
}

export const clampLevel = (n: number) => Math.min(LEVELS_PER_DIFF, Math.max(1, Math.floor(n) || 1));
export const levelName = (diff: Diff, level: number) => getLevel(diff, level).name;
