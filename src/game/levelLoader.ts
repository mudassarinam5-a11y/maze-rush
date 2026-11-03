import type { LevelData, LevelRecord } from "./types";

/** Convert the compact on-disk record into the grid form used by the game. */
export function recordToLevel(r: LevelRecord): LevelData {
  const { rows, ...rest } = r;
  return { ...rest, grid: rows.map((row) => Array.from(row, (c) => (c === "#" ? 1 : 0))) };
}
