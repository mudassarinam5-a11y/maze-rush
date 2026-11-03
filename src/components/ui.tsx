import { useEffect, useRef, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

/** Animated maze backdrop used on menu screens (a glowing trail follows a solved maze). */
export function Background() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let off: HTMLCanvasElement | null = null;
    let path: { x: number; y: number }[] = [];
    let ts = 20;
    let ox = 0;
    let oy = 0;
    let W = 0;
    let H = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const build = () => {
      W = cv.clientWidth;
      H = cv.clientHeight;
      cv.width = Math.floor(W * dpr);
      cv.height = Math.floor(H * dpr);
      ts = Math.max(18, Math.round(Math.min(W, H) / 16));
      const cols = Math.max(7, Math.floor(W / ts / 2) * 2 + 1);
      const rows = Math.max(7, Math.floor(H / ts / 2) * 2 + 1);
      ox = (W - cols * ts) / 2;
      oy = (H - rows * ts) / 2;
      // deterministic maze (fixed seed) so the backdrop is stable
      let s = 1234567;
      const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
      const g = Array.from({ length: rows }, () => Array(cols).fill(1));
      const stack: [number, number][] = [[1, 1]];
      g[1][1] = 0;
      while (stack.length) {
        const [cx, cy] = stack[stack.length - 1];
        const opts = [[2, 0], [-2, 0], [0, 2], [0, -2]].filter(([dx, dy]) => g[cy + dy]?.[cx + dx] === 1 && cx + dx > 0 && cy + dy > 0 && cx + dx < cols - 1 && cy + dy < rows - 1);
        if (!opts.length) {
          stack.pop();
          continue;
        }
        const [dx, dy] = opts[Math.floor(rnd() * opts.length)];
        g[cy + dy / 2][cx + dx / 2] = 0;
        g[cy + dy][cx + dx] = 0;
        stack.push([cx + dx, cy + dy]);
      }
      // path from top-left to bottom-right-ish via BFS
      const goal = { x: cols - 2 - ((cols - 2) % 2 === 0 ? 1 : 0), y: rows - 2 - ((rows - 2) % 2 === 0 ? 1 : 0) };
      const prev = new Map<number, number>([[cols + 1, -1]]);
      const q = [cols + 1];
      for (let i = 0; i < q.length; i++) {
        const c = q[i];
        const x = c % cols;
        const y = Math.floor(c / cols);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = (y + dy) * cols + x + dx;
          if (g[y + dy]?.[x + dx] !== 0 || prev.has(n)) continue;
          prev.set(n, c);
          q.push(n);
        }
      }
      path = [];
      let cur = goal.y * cols + goal.x;
      if (!prev.has(cur)) cur = q[q.length - 1];
      while (cur !== -1) {
        path.push({ x: cur % cols, y: Math.floor(cur / cols) });
        cur = prev.get(cur)!;
      }
      path.reverse();
      off = document.createElement("canvas");
      off.width = cv.width;
      off.height = cv.height;
      const o = off.getContext("2d")!;
      o.scale(dpr, dpr);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (g[y][x] !== 1) continue;
          o.fillStyle = "rgba(43,55,110,0.38)";
          o.beginPath();
          o.roundRect(ox + x * ts + 1, oy + y * ts + 1, ts - 2, ts - 2, ts * 0.14);
          o.fill();
        }
      }
    };
    build();
    const ro = new ResizeObserver(build);
    ro.observe(cv);

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!off || path.length < 2) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(off, 0, 0, W, H);
      const prog = ((now / 1000) * 7) % (path.length + 12);
      const head = Math.min(path.length - 1, Math.floor(prog));
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 1; i <= head; i++) {
        const a = path[i - 1];
        const b = path[i];
        const alpha = Math.max(0, 0.5 - (head - i) * 0.012);
        if (alpha <= 0) continue;
        ctx.strokeStyle = `rgba(34,211,238,${alpha.toFixed(3)})`;
        ctx.lineWidth = ts * 0.16;
        ctx.beginPath();
        ctx.moveTo(ox + (a.x + 0.5) * ts, oy + (a.y + 0.5) * ts);
        ctx.lineTo(ox + (b.x + 0.5) * ts, oy + (b.y + 0.5) * ts);
        ctx.stroke();
      }
      const h = path[head];
      const hx = ox + (h.x + 0.5) * ts;
      const hy = oy + (h.y + 0.5) * ts;
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, ts * 1.6);
      g.addColorStop(0, "rgba(103,232,249,0.85)");
      g.addColorStop(0.35, "rgba(34,211,238,0.35)");
      g.addColorStop(1, "rgba(34,211,238,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(hx, hy, ts * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ecfeff";
      ctx.beginPath();
      ctx.arc(hx, hy, ts * 0.14, 0, Math.PI * 2);
      ctx.fill();
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}

/** Full-viewport screen shell: backdrop + vignette + internally scrolling content. */
export function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="app-h relative w-full overflow-hidden bg-[#05060f]">
      <Background />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(5,6,15,0.72)_78%,rgba(5,6,15,0.95)_100%)]" />
      <div className="nice-scroll safe-pad absolute inset-0 z-10 overflow-y-auto overflow-x-hidden">
        <div className={`mx-auto flex min-h-full w-full flex-col items-center px-2 py-2 ${wide ? "max-w-4xl" : "max-w-3xl"}`}>{children}</div>
      </div>
    </div>
  );
}

export function BackButton({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 self-start rounded-xl border border-indigo-300/25 bg-[#0c1024]/90 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-indigo-400/20 active:scale-95"
    >
      <ChevronLeft className="h-4 w-4" /> {label}
    </button>
  );
}

export function ScreenTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="anim-slide-up mt-2 text-center short:mt-0">
      <h2 className="font-display text-2xl font-black tracking-wide text-white sm:text-4xl short:text-xl">{children}</h2>
      {sub && <p className="mt-1 text-xs text-slate-400 sm:text-sm">{sub}</p>}
    </div>
  );
}

export function Stars({ n, size = "h-3.5 w-3.5" }: { n: number; size?: string }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${n} of 3 stars`}>
      {[1, 2, 3].map((v) => (
        <svg key={v} viewBox="0 0 24 24" className={`${size} ${v <= n ? "fill-amber-400 text-amber-300" : "fill-slate-700 text-slate-600"}`}>
          <path d="M12 2l2.9 6.26 6.6.57-5 4.4 1.5 6.47L12 16.9 5.99 19.7 7.5 13.23l-5-4.4 6.6-.57L12 2z" />
        </svg>
      ))}
    </span>
  );
}
