import { DIFFS, LEVELS_PER_DIFF, type Diff } from "./types";

const KEY = "mazerush_save_v1";

export interface BestRecord {
  stars: number;
  time: number;
  score: number;
}

export interface SaveData {
  version: 1;
  /** Highest unlocked level per difficulty (1..21; 21 = all 20 completed). Each mode progresses independently. */
  unlocked: Record<Diff, number>;
  best: Record<string, BestRecord>;
  settings: { sound: boolean; difficulty: Diff; shake: boolean; touch: "auto" | "on" | "off" };
  totalScore: number;
}

export const bestKey = (d: Diff, l: number) => `${d}:${l}`;

export function defaultSave(): SaveData {
  return {
    version: 1,
    unlocked: { easy: 1, normal: 1, hard: 1, impossible: 1 },
    best: {},
    settings: { sound: true, difficulty: "normal", shake: true, touch: "auto" },
    totalScore: 0,
  };
}

export function loadSave(): SaveData {
  const d = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const o = JSON.parse(raw);
    const unlocked = { ...d.unlocked };
    for (const k of DIFFS) {
      const v = Number(o?.unlocked?.[k]);
      if (Number.isFinite(v)) unlocked[k] = Math.min(LEVELS_PER_DIFF + 1, Math.max(1, Math.floor(v)));
    }
    const settings = { ...d.settings, ...(o.settings ?? {}) };
    if (!DIFFS.includes(settings.difficulty)) settings.difficulty = "normal";
    if (!["auto", "on", "off"].includes(settings.touch)) settings.touch = "auto";
    return { version: 1, unlocked, best: o.best ?? {}, settings, totalScore: Number(o.totalScore) || 0 };
  } catch {
    return d;
  }
}

export function writeSave(s: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
