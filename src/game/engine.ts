import type { LevelData, Pt } from "./types";
import { key } from "./types";
import { findPath, sentinelPos, spikeAmp, trapOffset, SENTINEL_HIT_R2, SPIKE_DAMAGE_LEVEL } from "./sim";

export type Phase = "playing" | "paused" | "won-anim" | "won" | "failed";
export type DirName = "up" | "down" | "left" | "right";
export const DIR_VEC: Record<DirName, Pt> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export interface EngineEvent {
  type: "step" | "key" | "door" | "switch" | "gate" | "checkpoint" | "hurt" | "win" | "lose" | "denied" | "hint" | "toast";
  text?: string;
  kind?: "info" | "good" | "warn";
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Result {
  level: number;
  time: number;
  moves: number;
  heartsLeft: number;
  score: number;
  stars: number;
}

export interface Hud {
  time: number;
  moves: number;
  hearts: number;
  maxHearts: number;
  keysHeld: number;
  keysTotal: number;
  keysCollected: number;
  hintsLeft: number;
  objective: string;
}

const INVULN_START_MS = 1500;
const INVULN_HIT_MS = 2200;
const BUFFER_MS = 260;

/**
 * Pure game logic (no DOM). Position, movement, hazards, lives, objectives.
 * `update(dt)` advances the simulation; the renderer only reads state.
 */
export class Engine {
  phase: Phase = "playing";
  clock = 0; // ms of simulated play time
  elapsed = 0; // seconds
  tileX = 0;
  tileY = 0;
  fromX = 0;
  fromY = 0;
  stepT = 0;
  moving = false;
  rx = 0;
  ry = 0;
  facing: Pt = { x: 1, y: 0 };
  bufferDir: Pt | null = null;
  bufferUntil = 0;
  held: DirName[] = [];
  hearts = 0;
  moves = 0;
  keysHeld = 0;
  collectedKeys = new Set<string>();
  openedDoors = new Set<string>();
  doorAnimAt = new Map<string, number>();
  gateOpen = true;
  gateAnimAt = 0;
  activeCheckpoints = new Set<string>();
  respawn: Pt = { x: 0, y: 0 };
  hintsLeft = 0;
  hintPath: Pt[] | null = null;
  hintExpiresAt = 0;
  invulnUntil = 0;
  flashUntil = 0;
  shakeUntil = 0;
  deniedUntil = 0;
  wonAt = 0;
  particles: Particle[] = [];
  completed = false;
  result: Result | null = null;
  lastHurtBy: "spikes" | "sentinel" | null = null;

  private doorSet: Set<string>;
  private gateSet: Set<string>;
  private keySet: Set<string>;
  private trapSet: Map<string, Pt>;
  private cpSet: Set<string>;

  constructor(
    public L: LevelData,
    private emit: (e: EngineEvent) => void = () => {},
    private scoreMult = 1,
    private noInvuln = false,
  ) {
    this.doorSet = new Set(L.doors.map((p) => key(p.x, p.y)));
    this.gateSet = new Set(L.gates.map((p) => key(p.x, p.y)));
    this.keySet = new Set(L.keys.map((p) => key(p.x, p.y)));
    this.trapSet = new Map(L.traps.map((p) => [key(p.x, p.y), p]));
    this.cpSet = new Set(L.checkpoints.map((p) => key(p.x, p.y)));
    this.reset();
  }

  /** Restart the level: restores all level-specific state. */
  reset() {
    const L = this.L;
    this.phase = "playing";
    this.clock = 0;
    this.elapsed = 0;
    this.tileX = this.fromX = this.rx = L.start.x;
    this.tileY = this.fromY = this.ry = L.start.y;
    this.stepT = 0;
    this.moving = false;
    this.facing = { x: 1, y: 0 };
    this.bufferDir = null;
    this.bufferUntil = 0;
    this.held = [];
    this.hearts = L.hearts;
    this.moves = 0;
    this.keysHeld = 0;
    this.collectedKeys = new Set();
    this.openedDoors = new Set();
    this.doorAnimAt = new Map();
    this.gateOpen = L.gates.length === 0;
    this.gateAnimAt = 0;
    this.activeCheckpoints = new Set();
    this.respawn = { ...L.start };
    this.hintsLeft = L.hints;
    this.hintPath = null;
    this.hintExpiresAt = 0;
    this.invulnUntil = this.noInvuln ? 0 : INVULN_START_MS;
    this.flashUntil = this.shakeUntil = this.deniedUntil = this.wonAt = 0;
    this.particles = [];
    this.completed = false;
    this.result = null;
    this.lastHurtBy = null;
  }

  // ------------------------------------------------------------ input
  press(d: DirName) {
    if (!this.held.includes(d)) this.held.push(d);
    if (this.phase === "playing") {
      this.bufferDir = DIR_VEC[d];
      this.bufferUntil = this.clock + BUFFER_MS;
    }
  }
  release(d: DirName) {
    this.held = this.held.filter((h) => h !== d);
  }
  releaseAll() {
    this.held = [];
  }
  /** One-shot direction (swipe). */
  nudge(d: DirName) {
    if (this.phase !== "playing") return;
    this.bufferDir = DIR_VEC[d];
    this.bufferUntil = this.clock + BUFFER_MS;
  }
  private currentHeld(): Pt | null {
    return this.held.length ? DIR_VEC[this.held[this.held.length - 1]] : null;
  }

  togglePause() {
    if (this.phase === "playing") this.phase = "paused";
    else if (this.phase === "paused") this.phase = "playing";
  }

  // ------------------------------------------------------------ rules
  private tileState(x: number, y: number): "wall" | "door" | "gate" | "ok" {
    const L = this.L;
    if (x < 0 || y < 0 || x >= L.width || y >= L.height || L.grid[y][x] === 1) return "wall";
    const k = key(x, y);
    if (this.doorSet.has(k) && !this.openedDoors.has(k)) return this.keysHeld > 0 ? "ok" : "door";
    if (this.gateSet.has(k) && !this.gateOpen) return "gate";
    return "ok";
  }

  private toast(text: string, kind: "info" | "good" | "warn" = "info") {
    this.emit({ type: "toast", text, kind });
  }

  burst(x: number, y: number, color: string, n = 14, speed = 2.6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (0.4 + Math.random() * 0.6) * speed;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6, life: 0, maxLife: 0.45 + Math.random() * 0.4, color, size: 0.05 + Math.random() * 0.07 });
    }
  }

  private tryMove(d: Pt, report: boolean): boolean {
    if (this.moving || this.phase !== "playing") return false;
    const nx = this.tileX + d.x;
    const ny = this.tileY + d.y;
    this.facing = d;
    const st = this.tileState(nx, ny);
    if (st === "ok") {
      this.fromX = this.tileX;
      this.fromY = this.tileY;
      this.tileX = nx;
      this.tileY = ny;
      this.moving = true;
      this.stepT = 0;
      return true;
    }
    if (report && (st === "door" || st === "gate") && this.clock > this.deniedUntil) {
      this.emit({ type: "denied" });
      this.shakeUntil = this.clock + 180;
      this.toast(st === "door" ? "Locked! You need a key to open this door." : "A sealed gate blocks the way. Find the switch!", "warn");
      this.deniedUntil = this.clock + 1500;
    }
    return false;
  }

  private onArrive() {
    const L = this.L;
    this.moves++;
    this.emit({ type: "step" });
    const k = key(this.tileX, this.tileY);
    if (this.keySet.has(k) && !this.collectedKeys.has(k)) {
      this.collectedKeys.add(k);
      this.keysHeld++;
      this.emit({ type: "key" });
      this.burst(this.tileX, this.tileY, "#fbbf24", 16, 2.8);
      this.toast("Key collected!", "good");
    }
    if (this.doorSet.has(k) && !this.openedDoors.has(k)) {
      this.openedDoors.add(k);
      this.doorAnimAt.set(k, this.clock);
      this.keysHeld = Math.max(0, this.keysHeld - 1);
      this.emit({ type: "door" });
      this.burst(this.tileX, this.tileY, "#f59e0b", 12, 2.2);
      this.toast("Door unlocked!", "good");
    }
    if (L.switchPos && this.tileX === L.switchPos.x && this.tileY === L.switchPos.y && !this.gateOpen) {
      this.gateOpen = true;
      this.gateAnimAt = this.clock;
      this.emit({ type: "switch" });
      this.burst(this.tileX, this.tileY, "#a78bfa", 18, 3);
      this.toast("A distant gate grinds open!", "good");
    }
    if (this.cpSet.has(k) && !this.activeCheckpoints.has(k)) {
      this.activeCheckpoints.add(k);
      this.respawn = { x: this.tileX, y: this.tileY };
      this.emit({ type: "checkpoint" });
      this.burst(this.tileX, this.tileY, "#34d399", 14, 2.4);
      this.toast("Checkpoint saved!", "good");
    }
    if (this.tileX === L.exit.x && this.tileY === L.exit.y) {
      this.phase = "won-anim";
      this.wonAt = this.clock;
      this.burst(this.tileX, this.tileY, "#34d399", 26, 3.4);
    }
  }

  private damage(src: "spikes" | "sentinel") {
    if (this.phase !== "playing" || this.clock < this.invulnUntil) return;
    this.hearts -= 1;
    this.lastHurtBy = src;
    this.emit({ type: "hurt" });
    this.flashUntil = this.clock + 350;
    this.shakeUntil = this.clock + 320;
    this.burst(this.rx, this.ry, "#fb7185", 16, 3);
    if (this.hearts <= 0) {
      this.hearts = 0;
      this.phase = "failed";
      this.emit({ type: "lose" });
      return;
    }
    this.toast(src === "spikes" ? "Spikes! Back to your last checkpoint." : "Caught by a sentinel! Back to your last checkpoint.", "warn");
    this.tileX = this.fromX = this.rx = this.respawn.x;
    this.tileY = this.fromY = this.ry = this.respawn.y;
    this.moving = false;
    this.stepT = 0;
    this.bufferDir = null;
    this.invulnUntil = this.clock + INVULN_HIT_MS;
  }

  private complete() {
    if (this.completed) return;
    this.completed = true;
    const L = this.L;
    const time = Math.floor(this.elapsed);
    const timeBonus = Math.max(0, L.parTime - time) * 12;
    const moveBonus = Math.max(0, L.parMoves - this.moves) * 4;
    const score = Math.round((600 + this.hearts * 200 + timeBonus + moveBonus + 250) * this.scoreMult);
    const stars = time <= L.parTime && this.moves <= L.parMoves * 1.1 ? 3 : time <= L.parTime * 1.7 ? 2 : 1;
    this.result = { level: L.level, time, moves: this.moves, heartsLeft: this.hearts, score, stars };
    this.phase = "won";
    this.emit({ type: "win" });
  }

  // ------------------------------------------------------------ hints
  useHint() {
    if (this.phase !== "playing") return;
    const L = this.L;
    if (this.hintsLeft === 0) {
      this.emit({ type: "denied" });
      this.toast("No hints left on this difficulty!", "warn");
      return;
    }
    const pass = (x: number, y: number) => {
      if (L.grid[y][x] === 1) return false;
      const k = key(x, y);
      if (this.doorSet.has(k) && !this.openedDoors.has(k)) return this.keysHeld > 0;
      return !(this.gateSet.has(k) && !this.gateOpen);
    };
    const here = { x: this.tileX, y: this.tileY };
    const closedDoors = L.doors.filter((d) => !this.openedDoors.has(key(d.x, d.y)));
    const freeKeys = L.keys.filter((k) => !this.collectedKeys.has(key(k.x, k.y)));
    let target = L.exit;
    if (closedDoors.length > 0 && this.keysHeld === 0 && freeKeys.length > 0) {
      let best: Pt | null = null;
      let bl = Infinity;
      for (const k of freeKeys) {
        const p = findPath(L, here, k, pass);
        if (p && p.length < bl) {
          bl = p.length;
          best = k;
        }
      }
      target = best ?? L.exit;
    } else if (L.gates.length > 0 && !this.gateOpen && L.switchPos) {
      target = L.switchPos;
    }
    const path = findPath(L, here, target, pass);
    if (!path || path.length < 2) {
      this.toast("You are already on the right track!", "info");
      return;
    }
    if (this.hintsLeft > 0) this.hintsLeft -= 1;
    this.hintPath = path;
    this.hintExpiresAt = this.clock + 4200;
    this.emit({ type: "hint" });
    this.toast("A guiding trail appears…", "info");
  }

  // ------------------------------------------------------------ tick
  update(dt: number) {
    // particles always animate
    this.particles = this.particles.filter((p) => {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 2.4 * dt;
      return p.life < p.maxLife;
    });
    if (this.phase !== "playing" && this.phase !== "won-anim") return;
    this.elapsed += dt;
    this.clock += dt * 1000;
    const L = this.L;

    if (this.phase === "playing") {
      const buffered = () => (this.bufferDir && this.clock < this.bufferUntil ? this.bufferDir : null);
      if (this.moving) {
        this.stepT += (dt * 1000) / L.stepMs;
        if (this.stepT >= 1 - 1e-6) {
          this.stepT = 0;
          this.moving = false;
          this.fromX = this.tileX;
          this.fromY = this.tileY;
          this.onArrive();
          if (this.phase === "playing") {
            const buf = buffered();
            const cur = this.currentHeld();
            let started = false;
            if (buf) {
              started = this.tryMove(buf, true);
              if (started) this.bufferDir = null;
            }
            if (!started && cur && cur !== buf) this.tryMove(cur, true);
          }
        }
      } else {
        const buf = buffered();
        const cur = this.currentHeld();
        let started = false;
        if (buf) {
          started = this.tryMove(buf, false);
          if (started) this.bufferDir = null;
        }
        if (!started && cur && cur !== buf) this.tryMove(cur, true);
        else if (!started && buf) this.tryMove(buf, true);
      }
      const e = this.moving ? 1 - Math.pow(1 - Math.min(1, this.stepT), 2) : 1;
      this.rx = this.fromX + (this.tileX - this.fromX) * e;
      this.ry = this.fromY + (this.tileY - this.fromY) * e;

      if (this.phase === "playing" && this.clock >= this.invulnUntil) {
        const tx = Math.round(this.rx);
        const ty = Math.round(this.ry);
        const trap = this.trapSet.get(key(tx, ty));
        if (trap && spikeAmp(this.elapsed, trapOffset(trap.x, trap.y, L.spikeCycle), L.spikeCycle) > SPIKE_DAMAGE_LEVEL) {
          this.damage("spikes");
        }
        if (this.phase === "playing" && this.clock >= this.invulnUntil) {
          for (const s of L.sentinels) {
            const p = sentinelPos(s, this.elapsed, L.sentinelSpeed);
            const dx = p.x - this.rx;
            const dy = p.y - this.ry;
            if (dx * dx + dy * dy < SENTINEL_HIT_R2) {
              this.damage("sentinel");
              break;
            }
          }
        }
      }
    } else if (this.clock - this.wonAt > 780) {
      this.complete();
    }

    if (Math.random() < 0.1) {
      this.particles.push({ x: L.exit.x + (Math.random() - 0.5) * 0.7, y: L.exit.y + (Math.random() - 0.5) * 0.7, vx: (Math.random() - 0.5) * 0.4, vy: -0.6 - Math.random() * 0.5, life: 0, maxLife: 0.7, color: "#6ee7b7", size: 0.04 + Math.random() * 0.04 });
    }
  }

  hud(): Hud {
    const L = this.L;
    const closed = L.doors.filter((d) => !this.openedDoors.has(key(d.x, d.y))).length;
    const free = L.keys.filter((k) => !this.collectedKeys.has(key(k.x, k.y))).length;
    let objective = "Reach the exit";
    if (closed > 0 && this.keysHeld === 0 && free > 0) objective = "Find a key";
    else if (L.gates.length > 0 && !this.gateOpen) objective = "Activate the switch";
    else if (closed > 0) objective = "Unlock a door with your key";
    return {
      time: Math.floor(this.elapsed),
      moves: this.moves,
      hearts: this.hearts,
      maxHearts: L.hearts,
      keysHeld: this.keysHeld,
      keysTotal: L.keys.length,
      keysCollected: this.collectedKeys.size,
      hintsLeft: this.hintsLeft,
      objective,
    };
  }
}
