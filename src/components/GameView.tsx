import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Clock, Footprints, Heart, HelpCircle, Home, KeyRound, LayoutGrid, Pause, Play, RotateCcw, Trophy, Volume2, VolumeX, Skull } from "lucide-react";
import { Engine, type DirName, type Hud, type Phase, type Result } from "../game/engine";
import { Renderer } from "../game/renderer";
import { sfx } from "../game/audio";
import { DIFF_INFO } from "../game/levels";
import { LEVELS_PER_DIFF, type Diff, type LevelData } from "../game/types";

interface Props {
  level: LevelData;
  diff: Diff;
  soundOn: boolean;
  shakeOn: boolean;
  showTouch: boolean;
  onComplete: (r: Result) => void;
  onNextLevel: () => void;
  onNextDifficulty: (() => void) | null;
  onLevelSelect: () => void;
  onMenu: () => void;
  onToggleSound: () => void;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
const KEYS: Record<string, DirName> = {
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
};

const panelBtn = "flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-display text-xs font-bold transition active:scale-95 sm:text-sm";
const ghostBtn = `${panelBtn} border border-indigo-300/30 bg-indigo-400/10 text-indigo-100 hover:bg-indigo-400/20`;

export function GameView(props: Props) {
  const { level, diff } = props;
  const info = DIFF_INFO[diff];
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const rendRef = useRef<Renderer | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const lastPhase = useRef<Phase>("playing");
  const toastTimer = useRef(0);
  const touchDir = useRef<DirName | null>(null);
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);

  const [phase, setPhase] = useState<Phase>("playing");
  const [hud, setHud] = useState<Hud | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string; kind: string } | null>(null);
  const [intro, setIntro] = useState(true);
  const [result, setResult] = useState<Result | null>(null);
  const [hurtBy, setHurtBy] = useState<string | null>(null);

  const showToast = useCallback((text: string, kind: string) => {
    setToast({ id: Date.now() + Math.random(), text, kind });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  const restart = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    e.reset();
    rendRef.current?.resetMemory();
    lastPhase.current = "playing";
    setPhase("playing");
    setResult(null);
    setHurtBy(null);
    setIntro(true);
    window.setTimeout(() => setIntro(false), 2200);
    showToast(`Level ${e.L.level} restarted`, "info");
  }, [showToast]);

  const hint = useCallback(() => engineRef.current?.useHint(), []);
  const pause = useCallback(() => engineRef.current?.togglePause(), []);

  // ---- engine, renderer, loop, keyboard (created once per level; resizing never resets state)
  useEffect(() => {
    const engine = new Engine(
      level,
      (ev) => {
        switch (ev.type) {
          case "step": sfx.step(); break;
          case "key": sfx.key(); break;
          case "door": sfx.door(); break;
          case "switch": sfx.switchFlip(); window.setTimeout(sfx.gate, 120); break;
          case "checkpoint": sfx.checkpoint(); break;
          case "hurt": sfx.hurt(); break;
          case "denied": sfx.denied(); break;
          case "hint": sfx.hint(); break;
          case "win": sfx.win(); break;
          case "lose": sfx.lose(); break;
          case "toast": showToast(ev.text ?? "", ev.kind ?? "info"); break;
        }
      },
      DIFF_INFO[diff].scoreMult,
    );
    const rend = new Renderer(level);
    engineRef.current = engine;
    rendRef.current = rend;
    // test-only hook: stripped from production builds
    if (import.meta.env.MODE === "test") (window as unknown as { __engine?: Engine }).__engine = engine;
    lastPhase.current = "playing";
    setPhase("playing");
    setResult(null);
    setIntro(true);
    const introTimer = window.setTimeout(() => setIntro(false), 2600);
    const objTimer = window.setTimeout(() => {
      const parts: string[] = [];
      if (level.doors.length) parts.push(`collect ${level.keys.length} key${level.keys.length > 1 ? "s" : ""}`);
      if (level.gates.length) parts.push("flip the switch");
      showToast(parts.length ? `Objective: ${parts.join(", ")}, then reach the exit` : "Objective: reach the exit portal", "info");
    }, 500);

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const area = areaRef.current!;
    const layout = () => {
      const aw = area.clientWidth;
      const ah = area.clientHeight;
      if (aw < 10 || ah < 10) return;
      const ts = Math.min(aw / level.width, ah / level.height);
      const cssW = Math.max(40, Math.floor(ts * level.width));
      const cssH = (cssW * level.height) / level.width;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      rend.resize(cssW, cssH, dpr);
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(area);

    let raf = 0;
    let prev = performance.now();
    let hudKey = "";
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      engine.update(dt);
      rend.draw(ctx, engine, propsRef.current.shakeOn);
      const h = engine.hud();
      const k = `${h.time}|${h.moves}|${h.hearts}|${h.keysHeld}|${h.keysCollected}|${h.hintsLeft}|${h.objective}`;
      if (k !== hudKey) {
        hudKey = k;
        setHud(h);
      }
      if (engine.phase !== lastPhase.current) {
        lastPhase.current = engine.phase;
        setPhase(engine.phase);
        if (engine.phase === "won" && engine.result) {
          setResult(engine.result);
          propsRef.current.onComplete(engine.result);
        }
        if (engine.phase === "failed") setHurtBy(engine.lastHurtBy);
      }
    };
    raf = requestAnimationFrame(loop);

    const onKeyDown = (e: KeyboardEvent) => {
      const d = KEYS[e.code];
      if (d) {
        e.preventDefault();
        sfx.unlock();
        engine.press(d);
        return;
      }
      if (e.repeat) return;
      if (e.code === "KeyP" || e.code === "Escape") {
        e.preventDefault();
        engine.togglePause();
      } else if (e.code === "KeyR") restart();
      else if (e.code === "KeyH") engine.useHint();
      else if (e.code === "KeyM") propsRef.current.onToggleSound();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const d = KEYS[e.code];
      if (d) engine.release(d);
    };
    const onBlur = () => engine.releaseAll();
    const onVis = () => {
      if (document.hidden && engine.phase === "playing") engine.togglePause();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.clearTimeout(introTimer);
      window.clearTimeout(objTimer);
      window.clearTimeout(toastTimer.current);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, diff]);

  // ---- touch helpers
  const setTouch = (d: DirName | null) => {
    const e = engineRef.current;
    if (!e) return;
    if (touchDir.current && touchDir.current !== d) e.release(touchDir.current);
    touchDir.current = d;
    if (d) {
      sfx.unlock();
      e.press(d);
    }
  };
  const onSwipeDown = (ev: React.PointerEvent) => {
    swipe.current = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
  };
  const onSwipeMove = (ev: React.PointerEvent) => {
    const s = swipe.current;
    if (!s || s.id !== ev.pointerId) return;
    const dx = ev.clientX - s.x;
    const dy = ev.clientY - s.y;
    if (Math.abs(dx) < 22 && Math.abs(dy) < 22) return;
    setTouch(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    s.x = ev.clientX;
    s.y = ev.clientY;
  };
  const onSwipeUp = (ev: React.PointerEvent) => {
    if (swipe.current?.id === ev.pointerId) {
      swipe.current = null;
      setTouch(null);
    }
  };

  const dpadBtn =
    "touch-none-select flex items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-100 backdrop-blur active:bg-cyan-400/30 active:scale-95 transition-all text-xl font-bold h-[clamp(46px,11.5vmin,66px)] w-[clamp(46px,11.5vmin,66px)]";
  const pad = (d: DirName, glyph: string, label: string) => (
    <button
      className={dpadBtn}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setTouch(d);
      }}
      onPointerUp={() => setTouch(null)}
      onPointerCancel={() => setTouch(null)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {glyph}
    </button>
  );

  const hearts = hud?.maxHearts ?? level.hearts;
  const heartsLeft = hud?.hearts ?? level.hearts;
  const hintsLeft = hud?.hintsLeft ?? level.hints;
  const hintLabel = hintsLeft < 0 ? "∞" : String(hintsLeft);
  const chip = "flex items-center gap-1.5 rounded-xl border border-indigo-300/20 bg-[#0c1024]/90 px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm";

  return (
    <div className="app-h safe-pad relative flex w-full flex-col overflow-hidden bg-[#05060f]">
      {/* HUD */}
      <div className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center justify-center gap-1.5 pb-1.5 sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className={chip}>
            <span className="font-display text-[11px] font-bold tracking-widest text-cyan-300">LEVEL {level.level}</span>
            <span className="hidden max-w-[150px] truncate text-sm font-medium text-slate-200 md:inline">{level.name}</span>
            <span className="rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-200">{info.label}</span>
          </div>
          <div className={chip} aria-label="Lives">
            {Array.from({ length: hearts }, (_, i) => (
              <Heart key={i} className={`h-4 w-4 ${i < heartsLeft ? "fill-rose-400 text-rose-300" : "fill-transparent text-slate-600"}`} />
            ))}
          </div>
          <div className={chip}>
            <Clock className="h-3.5 w-3.5 text-cyan-300" />
            <span className="min-w-[34px] font-semibold tabular-nums">{fmt(hud?.time ?? 0)}</span>
          </div>
          <div className={`${chip} hidden min-[420px]:flex`}>
            <Footprints className="h-3.5 w-3.5 text-cyan-300" />
            <span className="font-semibold tabular-nums">{hud?.moves ?? 0}</span>
          </div>
          {level.keys.length > 0 && (
            <div className={`${chip} border-amber-300/25`}>
              <KeyRound className="h-3.5 w-3.5 text-amber-300" />
              <span className="font-semibold tabular-nums">
                {hud?.keysCollected ?? 0}/{level.keys.length}
              </span>
              {(hud?.keysHeld ?? 0) > 0 && <span className="rounded bg-amber-400/20 px-1 text-[11px] font-bold text-amber-200">holding {hud?.keysHeld}</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.currentTarget.blur(); hint(); }}
            disabled={hintsLeft === 0}
            className={`${chip} font-display font-bold text-cyan-100 transition hover:bg-cyan-400/20 active:scale-95 disabled:opacity-40`}
            aria-label={`Hint, ${hintsLeft < 0 ? "unlimited" : hintsLeft} left`}
          >
            <HelpCircle className="h-4 w-4" /> HINT <span className="tabular-nums text-amber-200">{hintLabel}</span>
          </button>
          <button
            onClick={(e) => { e.currentTarget.blur(); pause(); }}
            className={`${chip} text-slate-200 transition hover:bg-indigo-400/20 active:scale-95`}
            aria-label="Pause"
          >
            <Pause className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* objective (hidden on short screens) */}
      <div className="hidden justify-center pb-1.5 [@media(min-height:600px)]:flex">
        <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-0.5 text-xs font-semibold tracking-wide text-emerald-200">
          Objective: {hud?.objective ?? "Reach the exit"}
        </span>
      </div>

      {/* playfield + controls */}
      <div className="mx-auto flex min-h-0 w-full max-w-[1100px] flex-1 flex-col items-center gap-2 landscape:flex-row">
        <div ref={areaRef} className="relative flex min-h-0 min-w-0 w-full flex-1 items-center justify-center self-stretch">
          <div className="relative overflow-hidden rounded-2xl border border-indigo-300/25 shadow-[0_0_50px_rgba(56,89,255,0.15)]">
            <canvas
              ref={canvasRef}
              className="game-canvas"
              onPointerDown={onSwipeDown}
              onPointerMove={onSwipeMove}
              onPointerUp={onSwipeUp}
              onPointerCancel={onSwipeUp}
              aria-label="Maze playfield"
            />
            {intro && phase === "playing" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-2">
                <div className="anim-pop-in rounded-2xl border border-cyan-300/30 bg-[#05060f]/85 px-5 py-3 text-center backdrop-blur-sm">
                  <div className="font-display text-xs font-bold tracking-[0.3em] text-cyan-300">
                    {info.label.toUpperCase()} · LEVEL {level.level} / {LEVELS_PER_DIFF}
                  </div>
                  <div className="font-display mt-1 text-lg font-black text-white sm:text-2xl">{level.name}</div>
                  <div className="mt-1 text-xs text-slate-400">Find your way to the emerald portal</div>
                </div>
              </div>
            )}
            {toast && (
              <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-2">
                <div
                  key={toast.id}
                  className={`anim-toast rounded-full px-3 py-1.5 text-center text-xs font-semibold shadow-lg backdrop-blur sm:text-sm ${
                    toast.kind === "warn" ? "border border-rose-300/40 bg-rose-950/85 text-rose-100" : toast.kind === "good" ? "border border-emerald-300/40 bg-emerald-950/85 text-emerald-100" : "border border-cyan-300/40 bg-[#0a1030]/90 text-cyan-100"
                  }`}
                >
                  {toast.text}
                </div>
              </div>
            )}
          </div>
        </div>

        {props.showTouch && (
          <div className="flex w-full shrink-0 items-end justify-between px-1 pb-1 landscape:contents">
            <div className="grid grid-cols-3 gap-1.5 landscape:order-first landscape:shrink-0 landscape:self-center" role="group" aria-label="Movement controls">
              <span />
              {pad("up", "▲", "Move up")}
              <span />
              {pad("left", "◀", "Move left")}
              {pad("down", "▼", "Move down")}
              {pad("right", "▶", "Move right")}
            </div>
            <div className="flex flex-col gap-2 landscape:shrink-0 landscape:self-center">
              <button className={`${dpadBtn} flex-col !text-[10px] font-display`} aria-label="Hint" disabled={hintsLeft === 0} onPointerDown={(e) => { e.preventDefault(); hint(); }}>
                <HelpCircle className="h-5 w-5" />
                HINT
              </button>
              <button className={`${dpadBtn} flex-col !text-[10px] font-display`} aria-label="Pause" onPointerDown={(e) => { e.preventDefault(); pause(); }}>
                <Pause className="h-5 w-5" />
                PAUSE
              </button>
            </div>
          </div>
        )}
      </div>

      {!props.showTouch && (
        <div className="mx-auto hidden w-full max-w-[1100px] flex-wrap items-center justify-center gap-x-4 gap-y-0.5 pt-1.5 text-[11px] text-slate-500 [@media(min-height:640px)]:flex">
          <span>Move: WASD / Arrow keys</span>
          <span>Hint: H</span>
          <span>Pause: P</span>
          <span>Restart: R</span>
          <span>Sound: M</span>
          <span>Collect keys · flip switches · dodge red sentinels · time the spikes</span>
        </div>
      )}

      {/* PAUSE */}
      {phase === "paused" && (
        <Overlay>
          <div className="anim-pop-in w-full max-w-xs rounded-3xl border border-indigo-300/25 bg-[#0c1024] p-5 text-center shadow-2xl">
            <div className="font-display text-2xl font-black tracking-wide text-white">PAUSED</div>
            <p className="mt-1 text-sm text-slate-400">
              {info.label} · Level {level.level} · {fmt(hud?.time ?? 0)} · {hud?.moves ?? 0} moves
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button onClick={(e) => { e.currentTarget.blur(); pause(); }} className={`${panelBtn} bg-cyan-500 text-[#04121a] hover:bg-cyan-400`}>
                <Play className="h-4 w-4" /> RESUME
              </button>
              <button onClick={(e) => { e.currentTarget.blur(); restart(); }} className={ghostBtn}>
                <RotateCcw className="h-4 w-4" /> RESTART LEVEL
              </button>
              <button onClick={(e) => { e.currentTarget.blur(); props.onToggleSound(); }} className={ghostBtn}>
                {props.soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} SOUND: {props.soundOn ? "ON" : "OFF"}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={props.onLevelSelect} className={`${ghostBtn} !px-2`}>
                  <LayoutGrid className="h-4 w-4" /> LEVELS
                </button>
                <button onClick={props.onMenu} className={`${panelBtn} !px-2 border border-rose-300/25 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20`}>
                  <Home className="h-4 w-4" /> MENU
                </button>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Move: WASD / Arrow keys · Pause: P · Hint: H · Restart: R</p>
          </div>
        </Overlay>
      )}

      {/* WIN — only ever shown after the engine reaches the "won" phase */}
      {phase === "won" && result && (
        <Overlay tint="emerald">
          <div className="anim-pop-in w-full max-w-sm rounded-3xl border border-emerald-300/30 bg-[#0c1024] p-5 text-center shadow-2xl short:p-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-500/20 shadow-[0_0_35px_rgba(52,211,153,0.5)] short:hidden">
              <Trophy className="h-6 w-6 text-emerald-300" />
            </div>
            <div className="font-display mt-2 text-3xl font-black text-white short:mt-0 short:text-2xl">YOU WIN!</div>
            <div className="font-display text-sm font-bold tracking-widest text-emerald-300">CONGRATULATIONS!</div>
            <p className="mt-1 text-sm text-slate-300">
              {info.label} · Level {result.level} completed
            </p>
            <div className="mt-2 flex items-center justify-center">
              {[1, 2, 3].map((c) => (
                <svg key={c} viewBox="0 0 24 24" className={`anim-star-pop mx-0.5 h-7 w-7 ${c <= result.stars ? "fill-amber-400 text-amber-300" : "fill-slate-700 text-slate-600"}`} style={{ animationDelay: `${0.15 + c * 0.18}s` }}>
                  <path d="M12 2l2.9 6.26 6.6.57-5 4.4 1.5 6.47L12 16.9 5.99 19.7 7.5 13.23l-5-4.4 6.6-.57L12 2z" />
                </svg>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ["TIME", fmt(result.time)],
                ["MOVES", String(result.moves)],
                ["SCORE", result.score.toLocaleString()],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-white/5 px-2 py-2">
                  <div className="text-[10px] font-bold tracking-wider text-slate-400">{k}</div>
                  <div className="font-display text-base font-bold tabular-nums text-white">{v}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Par: {fmt(level.parTime)} · {level.parMoves} moves · Hearts left: {result.heartsLeft}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {level.level < LEVELS_PER_DIFF ? (
                <button onClick={props.onNextLevel} className={`${panelBtn} bg-emerald-500 text-[#04150c] hover:bg-emerald-400`}>
                  NEXT LEVEL <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <>
                  <p className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200">
                    All {LEVELS_PER_DIFF} {info.label} levels are complete!
                  </p>
                  {props.onNextDifficulty && (
                    <button onClick={props.onNextDifficulty} className={`${panelBtn} bg-emerald-500 text-[#04150c] hover:bg-emerald-400`}>
                      TRY THE NEXT DIFFICULTY <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
              <div className="grid grid-cols-3 gap-2">
                <button onClick={(e) => { e.currentTarget.blur(); restart(); }} className={`${ghostBtn} !px-1 !text-[11px]`}>
                  <RotateCcw className="h-3.5 w-3.5" /> REPLAY
                </button>
                <button onClick={props.onLevelSelect} className={`${ghostBtn} !px-1 !text-[11px]`}>
                  <LayoutGrid className="h-3.5 w-3.5" /> LEVEL SELECT
                </button>
                <button onClick={props.onMenu} className={`${ghostBtn} !px-1 !text-[11px]`}>
                  <Home className="h-3.5 w-3.5" /> MAIN MENU
                </button>
              </div>
            </div>
          </div>
        </Overlay>
      )}

      {/* LOSE — only ever shown after all hearts are gone */}
      {phase === "failed" && (
        <Overlay tint="rose">
          <div className="anim-pop-in w-full max-w-xs rounded-3xl border border-rose-300/30 bg-[#170a12] p-5 text-center shadow-2xl short:p-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-rose-300/40 bg-rose-500/20 shadow-[0_0_35px_rgba(244,63,94,0.45)] short:hidden">
              <Skull className="h-6 w-6 text-rose-300" />
            </div>
            <div className="font-display mt-2 text-3xl font-black text-white short:mt-0 short:text-2xl">YOU LOSE</div>
            <div className="font-display text-sm font-bold tracking-widest text-rose-300">OUT OF HEARTS</div>
            <p className="mt-1 text-sm text-slate-400">
              {info.label} · Level {level.level}
              <br />
              Survived {fmt(hud?.time ?? 0)} · {hud?.moves ?? 0} moves
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button onClick={(e) => { e.currentTarget.blur(); restart(); }} className={`${panelBtn} bg-rose-500 text-white hover:bg-rose-400`}>
                <RotateCcw className="h-4 w-4" /> TRY AGAIN
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={props.onLevelSelect} className={`${ghostBtn} !px-1 !text-[11px]`}>
                  <LayoutGrid className="h-3.5 w-3.5" /> LEVEL SELECT
                </button>
                <button onClick={props.onMenu} className={`${ghostBtn} !px-1 !text-[11px]`}>
                  <Home className="h-3.5 w-3.5" /> MAIN MENU
                </button>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-slate-500 short:hidden">
              Tip: {hurtBy === "sentinel" ? "wait at a junction until the red sentinel moves away, then cross." : "watch the spike timing and cross while the spikes are down."}
            </p>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ children, tint = "slate" }: { children: React.ReactNode; tint?: "slate" | "emerald" | "rose" }) {
  const bg = tint === "rose" ? "bg-[#0e0408]/80" : tint === "emerald" ? "bg-[#04050e]/75" : "bg-[#04050e]/80";
  return (
    <div className={`anim-fade-in nice-scroll safe-pad absolute inset-0 z-30 flex overflow-y-auto ${bg} backdrop-blur-sm`}>
      <div className="m-auto flex w-full justify-center py-1">{children}</div>
    </div>
  );
}
