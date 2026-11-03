import type { Engine } from "./engine";
import { key, type LevelData } from "./types";
import { sentinelPos, spikeAmp, trapOffset } from "./sim";

/**
 * Canvas renderer in the MAZEBOUND style: deep indigo stone walls, cyan orb, red sentinels,
 * amber keys and doors, violet switch/gates, emerald portal. Uses logical tile units so the
 * canvas can be resized freely without affecting game state.
 */
export class Renderer {
  private base: HTMLCanvasElement | null = null;
  private fog: HTMLCanvasElement | null = null;
  private memory: HTMLCanvasElement | null = null;
  w = 0;
  h = 0;
  dpr = 1;

  constructor(private L: LevelData) {}

  resize(cssW: number, cssH: number, dpr: number) {
    this.w = cssW;
    this.h = cssH;
    this.dpr = dpr;
    this.buildBase();
    this.fog = null;
    this.memory = null;
  }

  resetMemory() {
    this.memory = null;
  }

  private buildBase() {
    const { L, w, h, dpr } = this;
    const ts = w / L.width;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.floor(w * dpr));
    c.height = Math.max(1, Math.floor(h * dpr));
    const y = c.getContext("2d");
    if (!y) return;
    y.scale(dpr, dpr);
    y.fillStyle = "#0a0d20";
    y.fillRect(0, 0, w, h);
    for (let r = 0; r < L.height; r++) {
      for (let q = 0; q < L.width; q++) {
        if (L.grid[r][q] === 1) continue;
        const px = q * ts;
        const py = r * ts;
        y.fillStyle = (q + r) % 2 === 0 ? "#0c1026" : "#0a0e22";
        y.fillRect(px, py, ts, ts);
        y.fillStyle = "rgba(99, 116, 255, 0.05)";
        y.fillRect(px, py, ts, 1);
        y.fillRect(px, py, 1, ts);
      }
    }
    y.fillStyle = "rgba(34,211,238,0.10)";
    y.beginPath();
    y.roundRect(L.start.x * ts + ts * 0.14, L.start.y * ts + ts * 0.14, ts * 0.72, ts * 0.72, ts * 0.16);
    y.fill();
    for (let r = 0; r < L.height; r++) {
      for (let q = 0; q < L.width; q++) {
        if (L.grid[r][q] !== 1) continue;
        const px = q * ts;
        const py = r * ts;
        const below = r + 1 < L.height && L.grid[r + 1][q] === 0;
        const g = y.createLinearGradient(px, py, px, py + ts);
        g.addColorStop(0, "#2b376e");
        g.addColorStop(0.55, "#1c2450");
        g.addColorStop(1, "#121833");
        y.fillStyle = g;
        y.beginPath();
        y.roundRect(px + 0.5, py + 0.5, ts - 1, ts - 1, ts * 0.14);
        y.fill();
        y.fillStyle = "rgba(148, 184, 255, 0.20)";
        y.fillRect(px + ts * 0.14, py + ts * 0.07, ts * 0.72, Math.max(1, ts * 0.05));
        if (below) {
          y.fillStyle = "rgba(0,0,0,0.4)";
          y.fillRect(px, py + ts - Math.max(2, ts * 0.1), ts, Math.max(2, ts * 0.1));
        }
        if (((q * 73856093) ^ (r * 19349663)) & 7 || true) {
          if ((((q * 73856093) ^ (r * 19349663)) & 7) === 0) {
            y.fillStyle = "rgba(148,184,255,0.13)";
            y.beginPath();
            y.arc(px + ts / 2, py + ts / 2, ts * 0.07, 0, Math.PI * 2);
            y.fill();
          }
        }
      }
    }
    this.base = c;
  }

  draw(c: CanvasRenderingContext2D, e: Engine, shakeOn: boolean) {
    const { L, w, h } = this;
    if (!this.base) return;
    const ts = w / L.width;
    const t = e.clock;
    const amb = performance.now();
    const X = (v: number) => (v + 0.5) * ts;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    let shaking = false;
    if (shakeOn && t < e.shakeUntil) {
      const s = 5 * ((e.shakeUntil - t) / 320);
      c.save();
      c.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      shaking = true;
    }
    c.drawImage(this.base, 0, 0, w, h);

    // exit portal
    {
      const ex = X(L.exit.x);
      const ey = X(L.exit.y);
      const p = 0.5 + 0.5 * Math.sin(amb / 280);
      const g = c.createRadialGradient(ex, ey, 0, ex, ey, ts * 1.15);
      g.addColorStop(0, `rgba(52,211,153,${0.5 + p * 0.25})`);
      g.addColorStop(1, "rgba(52,211,153,0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(ex, ey, ts * 1.15, 0, Math.PI * 2);
      c.fill();
      for (let i = 0; i < 3; i++) {
        c.strokeStyle = `rgba(110,231,183,${0.75 - i * 0.2})`;
        c.lineWidth = Math.max(1.4, ts * 0.055);
        c.beginPath();
        const a = amb / (420 + i * 160) + i * 2.1;
        c.arc(ex, ey, ts * (0.34 - i * 0.085), a, a + Math.PI * 1.45);
        c.stroke();
      }
      c.fillStyle = "#d1fae5";
      c.beginPath();
      c.arc(ex, ey, ts * 0.075, 0, Math.PI * 2);
      c.fill();
    }

    // checkpoints
    for (const cp of L.checkpoints) {
      const on = e.activeCheckpoints.has(key(cp.x, cp.y));
      const cx = X(cp.x);
      const cy = X(cp.y);
      c.fillStyle = on ? "rgba(52,211,153,0.16)" : "rgba(148,163,184,0.12)";
      c.beginPath();
      c.roundRect(cp.x * ts + ts * 0.12, cp.y * ts + ts * 0.12, ts * 0.76, ts * 0.76, ts * 0.14);
      c.fill();
      c.strokeStyle = on ? "#34d399" : "#64748b";
      c.lineWidth = Math.max(1.4, ts * 0.05);
      c.beginPath();
      c.moveTo(cx - ts * 0.14, cy + ts * 0.3);
      c.lineTo(cx - ts * 0.14, cy - ts * 0.3);
      c.stroke();
      const wave = Math.sin(amb / 240 + cp.x) * ts * 0.03;
      c.fillStyle = on ? "#34d399" : "#64748b";
      c.beginPath();
      c.moveTo(cx - ts * 0.14, cy - ts * 0.3);
      c.lineTo(cx + ts * 0.2, cy - ts * 0.2 + wave);
      c.lineTo(cx - ts * 0.14, cy - ts * 0.08);
      c.closePath();
      c.fill();
    }

    // spike traps
    for (const tr of L.traps) {
      const a = spikeAmp(e.elapsed, trapOffset(tr.x, tr.y, L.spikeCycle), L.spikeCycle);
      const px = tr.x * ts;
      const py = tr.y * ts;
      c.fillStyle = "rgba(80, 16, 32, 0.55)";
      c.beginPath();
      c.roundRect(px + ts * 0.08, py + ts * 0.08, ts * 0.84, ts * 0.84, ts * 0.12);
      c.fill();
      if (a > 0.55) {
        c.fillStyle = `rgba(244, 63, 94, ${(a - 0.55) * 0.5})`;
        c.fillRect(px + ts * 0.08, py + ts * 0.08, ts * 0.84, ts * 0.84);
      }
      const hgt = ts * 0.52 * a;
      c.fillStyle = a > 0.1 ? "#cbd5e1" : "rgba(100,116,139,0.6)";
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const sx = px + ts * (0.14 + i * 0.3);
          const sy = py + ts * (0.14 + j * 0.3);
          c.beginPath();
          c.moveTo(sx, sy + ts * 0.24);
          c.lineTo(sx + ts * 0.09, sy + ts * 0.24 - hgt * 0.8);
          c.lineTo(sx + ts * 0.18, sy + ts * 0.24);
          c.closePath();
          c.fill();
        }
      }
    }

    // keys
    for (const k of L.keys) {
      if (e.collectedKeys.has(key(k.x, k.y))) continue;
      const bob = Math.sin(amb / 300 + k.x * 1.7 + k.y) * ts * 0.05;
      const kx = X(k.x);
      const ky = X(k.y) + bob;
      const g = c.createRadialGradient(kx, ky, 0, kx, ky, ts * 0.75);
      g.addColorStop(0, "rgba(251,191,36,0.5)");
      g.addColorStop(1, "rgba(251,191,36,0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(kx, ky, ts * 0.75, 0, Math.PI * 2);
      c.fill();
      c.save();
      c.translate(kx, ky);
      c.rotate(-0.7 + Math.sin(amb / 500 + k.x) * 0.15);
      c.strokeStyle = "#fbbf24";
      c.fillStyle = "#fbbf24";
      c.lineWidth = Math.max(1.6, ts * 0.075);
      c.beginPath();
      c.arc(-ts * 0.13, 0, ts * 0.14, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.moveTo(-ts * 0.02, ts * 0.08);
      c.lineTo(ts * 0.3, ts * 0.08);
      c.stroke();
      c.fillRect(ts * 0.16, ts * 0.08, ts * 0.05, ts * 0.13);
      c.fillRect(ts * 0.27, ts * 0.08, ts * 0.05, ts * 0.17);
      c.restore();
    }

    // doors
    for (const d of L.doors) {
      const k = key(d.x, d.y);
      const px = d.x * ts;
      const py = d.y * ts;
      const open = e.openedDoors.has(k);
      if (open) {
        const p = Math.min(1, (t - (e.doorAnimAt.get(k) ?? 0)) / 380);
        if (p >= 1) continue;
        c.save();
        c.globalAlpha = 1 - p;
        c.translate(0, -p * ts * 0.7);
      }
      const g = c.createLinearGradient(px, py, px, py + ts);
      g.addColorStop(0, "#92600f");
      g.addColorStop(0.5, "#b45309");
      g.addColorStop(1, "#7c4a08");
      c.fillStyle = g;
      c.beginPath();
      c.roundRect(px + ts * 0.06, py + ts * 0.04, ts * 0.88, ts * 0.92, ts * 0.08);
      c.fill();
      c.strokeStyle = "rgba(0,0,0,0.35)";
      c.lineWidth = Math.max(1, ts * 0.03);
      c.strokeRect(px + ts * 0.18, py + ts * 0.16, ts * 0.64, ts * 0.3);
      c.strokeRect(px + ts * 0.18, py + ts * 0.56, ts * 0.64, ts * 0.3);
      c.fillStyle = "#fde68a";
      c.beginPath();
      c.arc(X(d.x), X(d.y), ts * 0.075, 0, Math.PI * 2);
      c.fill();
      c.fillRect(X(d.x) - ts * 0.028, X(d.y), ts * 0.056, ts * 0.12);
      if (open) c.restore();
    }

    // switch
    if (L.switchPos) {
      const s = L.switchPos;
      const sx = X(s.x);
      const sy = X(s.y);
      const col = e.gateOpen ? "#34d399" : "#a78bfa";
      c.fillStyle = e.gateOpen ? "rgba(52,211,153,0.14)" : "rgba(167,139,250,0.14)";
      c.beginPath();
      c.roundRect(s.x * ts + ts * 0.1, s.y * ts + ts * 0.1, ts * 0.8, ts * 0.8, ts * 0.16);
      c.fill();
      c.strokeStyle = col;
      c.lineWidth = Math.max(1.2, ts * 0.04);
      c.stroke();
      const ang = e.gateOpen ? 0.8 : -0.8;
      c.strokeStyle = "#e2e8f0";
      c.lineWidth = Math.max(1.6, ts * 0.07);
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(sx, sy + ts * 0.18);
      c.lineTo(sx + Math.sin(ang) * ts * 0.3, sy + ts * 0.18 - Math.cos(ang) * ts * 0.3);
      c.stroke();
      c.fillStyle = col;
      c.beginPath();
      c.arc(sx + Math.sin(ang) * ts * 0.3, sy + ts * 0.18 - Math.cos(ang) * ts * 0.3, ts * 0.1, 0, Math.PI * 2);
      c.fill();
      if (!e.gateOpen) {
        const p = 0.5 + 0.5 * Math.sin(amb / 320);
        c.fillStyle = `rgba(167,139,250,${0.25 + p * 0.3})`;
        c.beginPath();
        c.arc(sx, sy, ts * (0.3 + p * 0.08), 0, Math.PI * 2);
        c.fill();
      }
    }

    // gates
    for (const gt of L.gates) {
      const px = gt.x * ts;
      const py = gt.y * ts;
      let p = 0;
      if (e.gateOpen) {
        p = Math.min(1, (t - e.gateAnimAt) / 420);
        if (p >= 1) continue;
      }
      c.save();
      c.translate(0, -p * ts * 0.9);
      c.globalAlpha = 1 - p * 0.6;
      c.fillStyle = "rgba(46,16,101,0.7)";
      c.beginPath();
      c.roundRect(px + ts * 0.04, py + ts * 0.04, ts * 0.92, ts * 0.92, ts * 0.1);
      c.fill();
      c.fillStyle = "#a78bfa";
      c.fillRect(px + ts * 0.05, py + ts * 0.02, ts * 0.9, ts * 0.16);
      for (let i = 0; i < 4; i++) {
        const bx = px + ts * (0.12 + i * 0.22);
        const g = c.createLinearGradient(bx, py, bx + ts * 0.12, py);
        g.addColorStop(0, "#8b5cf6");
        g.addColorStop(1, "#6d28d9");
        c.fillStyle = g;
        c.beginPath();
        c.roundRect(bx, py + ts * 0.1, ts * 0.13, ts * 0.88, ts * 0.05);
        c.fill();
      }
      c.restore();
    }

    // sentinels (red balls)
    for (const s of L.sentinels) {
      for (let tail = 2; tail >= 0; tail--) {
        const p = sentinelPos(s, e.elapsed - tail * 0.07, L.sentinelSpeed);
        const sx = X(p.x);
        const sy = X(p.y);
        const head = tail === 0;
        const r = ts * (head ? 0.3 : 0.3 - tail * 0.05);
        if (head) {
          const g = c.createRadialGradient(sx, sy, 0, sx, sy, ts * 0.85);
          g.addColorStop(0, "rgba(251,113,133,0.5)");
          g.addColorStop(1, "rgba(251,113,133,0)");
          c.fillStyle = g;
          c.beginPath();
          c.arc(sx, sy, ts * 0.85, 0, Math.PI * 2);
          c.fill();
        }
        const g = c.createRadialGradient(sx - r * 0.3, sy - r * 0.3, r * 0.2, sx, sy, r);
        g.addColorStop(0, head ? "#fda4af" : "rgba(253,164,175,0.4)");
        g.addColorStop(1, head ? "#e11d48" : "rgba(225,29,72,0.25)");
        c.fillStyle = g;
        c.beginPath();
        c.arc(sx, sy, r, 0, Math.PI * 2);
        c.fill();
        if (head) {
          const nxt = sentinelPos(s, e.elapsed + 0.05, L.sentinelSpeed);
          const ex = Math.sign(nxt.x - p.x);
          const ey = Math.sign(nxt.y - p.y);
          c.fillStyle = "#fff1f2";
          c.beginPath();
          c.arc(sx + ex * ts * 0.1, sy + ey * ts * 0.1, ts * 0.11, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = "#881337";
          c.beginPath();
          c.arc(sx + ex * ts * 0.15, sy + ey * ts * 0.15, ts * 0.055, 0, Math.PI * 2);
          c.fill();
        }
      }
    }

    // particles
    for (const p of e.particles) {
      c.globalAlpha = 1 - p.life / p.maxLife;
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(X(p.x), X(p.y), p.size * ts, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    // player orb
    {
      let px = X(e.rx);
      let py = X(e.ry);
      let sc = 1;
      if (e.phase === "won-anim") {
        const m = Math.min(1, (t - e.wonAt) / 750);
        px += (X(L.exit.x) - px) * m;
        py += (X(L.exit.y) - py) * m;
        sc = 1 - m * 0.85;
      }
      const blink = t < e.invulnUntil && e.phase === "playing" && Math.floor(t / 110) % 2 === 0;
      c.fillStyle = "rgba(0,0,0,0.45)";
      c.beginPath();
      c.ellipse(px, py + ts * 0.3 * sc, ts * 0.24 * sc, ts * 0.1 * sc, 0, 0, Math.PI * 2);
      c.fill();
      if (!blink) {
        const r = ts * 0.31 * sc;
        const glow = c.createRadialGradient(px, py, 0, px, py, ts * 0.8 * sc);
        glow.addColorStop(0, "rgba(34,211,238,0.55)");
        glow.addColorStop(1, "rgba(34,211,238,0)");
        c.fillStyle = glow;
        c.beginPath();
        c.arc(px, py, ts * 0.8 * sc, 0, Math.PI * 2);
        c.fill();
        const g = c.createRadialGradient(px - r * 0.35, py - r * 0.4, r * 0.15, px, py, r);
        g.addColorStop(0, "#a5f3fc");
        g.addColorStop(0.55, "#22d3ee");
        g.addColorStop(1, "#0369a1");
        c.fillStyle = g;
        c.beginPath();
        c.arc(px, py, r, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "rgba(8, 47, 73, 0.9)";
        c.beginPath();
        c.arc(px + e.facing.x * r * 0.38, py + e.facing.y * r * 0.38, r * 0.34, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#ecfeff";
        c.beginPath();
        c.arc(px + e.facing.x * r * 0.45, py + e.facing.y * r * 0.45, r * 0.13, 0, Math.PI * 2);
        c.fill();
      }
    }
    if (shaking) c.restore();

    // fog of war (explored areas stay faintly visible; hazards stay visible as beacons)
    if (L.fogRadius > 0 && e.phase !== "won" && e.phase !== "won-anim") {
      const fw = Math.floor(w);
      const fh = Math.floor(h);
      if (!this.fog || this.fog.width !== fw || this.fog.height !== fh) {
        this.fog = document.createElement("canvas");
        this.fog.width = fw;
        this.fog.height = fh;
      }
      if (!this.memory || this.memory.width !== fw || this.memory.height !== fh) {
        this.memory = document.createElement("canvas");
        this.memory.width = fw;
        this.memory.height = fh;
      }
      const px = X(e.rx);
      const py = X(e.ry);
      const rad = ts * L.fogRadius;
      const m = this.memory.getContext("2d")!;
      const mg = m.createRadialGradient(px, py, rad * 0.3, px, py, rad * 0.9);
      mg.addColorStop(0, "rgba(255,255,255,1)");
      mg.addColorStop(1, "rgba(255,255,255,0)");
      m.fillStyle = mg;
      m.beginPath();
      m.arc(px, py, rad, 0, Math.PI * 2);
      m.fill();
      const f = this.fog.getContext("2d")!;
      f.globalCompositeOperation = "source-over";
      f.clearRect(0, 0, fw, fh);
      f.fillStyle = "rgba(2, 3, 12, 0.965)";
      f.fillRect(0, 0, fw, fh);
      f.globalCompositeOperation = "destination-out";
      f.globalAlpha = 0.38;
      f.drawImage(this.memory, 0, 0);
      f.globalAlpha = 1;
      const g = f.createRadialGradient(px, py, ts * 0.4, px, py, rad);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(0.75, "rgba(0,0,0,0.92)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      f.fillStyle = g;
      f.beginPath();
      f.arc(px, py, rad, 0, Math.PI * 2);
      f.fill();
      f.globalCompositeOperation = "source-over";
      c.drawImage(this.fog, 0, 0, w, h);
      // hazard beacons: spikes and sentinels never hide in the dark
      for (const tr of L.traps) {
        c.strokeStyle = "rgba(251,113,133,0.55)";
        c.lineWidth = Math.max(1.2, ts * 0.06);
        c.beginPath();
        c.roundRect(tr.x * ts + ts * 0.14, tr.y * ts + ts * 0.14, ts * 0.72, ts * 0.72, ts * 0.12);
        c.stroke();
      }
      for (const s of L.sentinels) {
        const p = sentinelPos(s, e.elapsed, L.sentinelSpeed);
        const g2 = c.createRadialGradient(X(p.x), X(p.y), 0, X(p.x), X(p.y), ts * 0.7);
        g2.addColorStop(0, "rgba(251,113,133,0.95)");
        g2.addColorStop(0.35, "rgba(244,63,94,0.65)");
        g2.addColorStop(1, "rgba(244,63,94,0)");
        c.fillStyle = g2;
        c.beginPath();
        c.arc(X(p.x), X(p.y), ts * 0.7, 0, Math.PI * 2);
        c.fill();
      }
      const pg = c.createRadialGradient(px, py, 0, px, py, ts * 1.1);
      pg.addColorStop(0, "rgba(34,211,238,0.18)");
      pg.addColorStop(1, "rgba(34,211,238,0)");
      c.fillStyle = pg;
      c.beginPath();
      c.arc(px, py, ts * 1.1, 0, Math.PI * 2);
      c.fill();
    }

    // hint trail
    if (e.hintPath && t < e.hintExpiresAt) {
      const fade = (e.hintExpiresAt - t) / 4200;
      for (let i = 1; i < e.hintPath.length; i++) {
        const p = e.hintPath[i];
        const pulse = 0.55 + 0.45 * Math.sin(t / 160 - i * 0.7);
        c.fillStyle = `rgba(103, 232, 249, ${0.8 * fade * pulse})`;
        c.beginPath();
        c.arc(X(p.x), X(p.y), ts * 0.13, 0, Math.PI * 2);
        c.fill();
      }
    } else if (e.hintPath) e.hintPath = null;

    // damage flash
    if (t < e.flashUntil) {
      const a = ((e.flashUntil - t) / 350) * 0.4;
      const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, "rgba(244,63,94,0)");
      g.addColorStop(1, `rgba(244,63,94,${a})`);
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }
  }
}
