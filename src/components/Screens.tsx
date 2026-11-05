import { useState } from "react";
import { Play, LayoutGrid, Settings as SettingsIcon, BookOpen, Gauge, Lock, Trophy, Sparkles, Volume2, VolumeX, Trash2, Heart, HelpCircle, CloudFog, KeyRound, Clock, Flag, ToggleLeft, ToggleRight, Swords, Info } from "lucide-react";
import { BackButton, ScreenTitle, Shell, Stars } from "./ui";
import { DIFF_INFO, getLevel } from "../game/levels";
import { bestKey, type SaveData } from "../game/save";
import { DIFFS, LEVELS_PER_DIFF, type Diff } from "../game/types";

const card = "rounded-2xl border border-indigo-300/30 bg-[#0c1024]/90 transition hover:bg-indigo-400/15 active:scale-[0.98]";
const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

const completedCount = (save: SaveData, d: Diff) => Object.keys(save.best).filter((k) => k.startsWith(`${d}:`)).length;
const nextLevelFor = (save: SaveData, d: Diff) => Math.min(save.unlocked[d], LEVELS_PER_DIFF);

// ------------------------------------------------------------------ MAIN MENU
export function MenuScreen({ save, onPlay, onDifficulty, onLevels, onSettings, onHelp, onAbout }: { save: SaveData; onPlay: () => void; onDifficulty: () => void; onLevels: () => void; onSettings: () => void; onHelp: () => void; onAbout?: () => void }) {
  const d = save.settings.difficulty;
  const done = completedCount(save, d);
  const all = save.unlocked[d] > LEVELS_PER_DIFF;
  const lvl = nextLevelFor(save, d);
  return (
    <Shell>
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-3 py-2 short:flex-row short:gap-8">
        <div className="anim-slide-up text-center">
          <div className="mb-2 flex items-center justify-center gap-2 text-[10px] font-bold tracking-[0.3em] text-cyan-300/90 sm:text-[11px] sm:tracking-[0.35em]">
            <Sparkles className="h-3.5 w-3.5" /> 80 LABYRINTHS · ONE WAY OUT <Sparkles className="h-3.5 w-3.5" />
          </div>
          <h1 className="font-display title-gradient text-[clamp(2.4rem,11vmin,6rem)] font-black leading-[0.95] tracking-tight">
            MAZE RUSH
          </h1>
          <p className="font-display mt-2 text-[clamp(0.7rem,2.4vmin,1.1rem)] font-bold tracking-[0.35em] text-slate-300">ESCAPE CHALLENGE</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="rounded-full border border-indigo-300/25 bg-[#0c1024]/90 px-3 py-1.5 font-semibold text-indigo-200">Difficulty: {DIFF_INFO[d].label}</span>
            <span className="rounded-full border border-emerald-300/25 bg-[#0c1024]/90 px-3 py-1.5 font-semibold text-emerald-200">
              {done}/{LEVELS_PER_DIFF} escaped
            </span>
            <span className="flex items-center gap-1 rounded-full border border-amber-300/25 bg-[#0c1024]/90 px-3 py-1.5 font-semibold text-amber-200">
              <Trophy className="h-3.5 w-3.5" /> {save.totalScore.toLocaleString()} pts
            </span>
          </div>
        </div>

        <div className="anim-slide-up flex w-full max-w-sm flex-col gap-2.5 short:max-w-xs" style={{ animationDelay: "0.12s" }}>
          <button
            onClick={onPlay}
            className="group flex w-full items-center gap-3 rounded-2xl border border-cyan-300/50 bg-gradient-to-r from-cyan-500 to-sky-600 px-4 py-3 text-left shadow-[0_0_35px_rgba(34,211,238,0.35)] transition-all hover:shadow-[0_0_50px_rgba(34,211,238,0.55)] active:scale-[0.98]"
          >
            <span className="anim-floaty flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <Play className="h-6 w-6 fill-white text-white" />
            </span>
            <span>
              <span className="font-display block text-lg font-black tracking-wide text-white">{all ? "PLAY AGAIN" : done > 0 ? "CONTINUE" : "PLAY"}</span>
              <span className="block text-xs text-cyan-100/90">
                {DIFF_INFO[d].label} · {all ? `Replay Level ${LEVELS_PER_DIFF}` : `Level ${lvl}`} — {getLevel(d, all ? LEVELS_PER_DIFF : lvl).name}
              </span>
            </span>
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={onDifficulty} className={`${card} flex items-center gap-2 px-3 py-3`}>
              <Gauge className="h-5 w-5 shrink-0 text-amber-300" />
              <span className="font-display text-xs font-bold text-white sm:text-sm">DIFFICULTY</span>
            </button>
            <button onClick={onLevels} className={`${card} flex items-center gap-2 px-3 py-3`}>
              <LayoutGrid className="h-5 w-5 shrink-0 text-indigo-300" />
              <span className="font-display text-xs font-bold text-white sm:text-sm">LEVEL SELECT</span>
            </button>
            <button onClick={onHelp} className={`${card} flex items-center gap-2 px-3 py-3`}>
              <BookOpen className="h-5 w-5 shrink-0 text-violet-300" />
              <span className="font-display text-xs font-bold text-white sm:text-sm">HOW TO PLAY</span>
            </button>
            <button onClick={onSettings} className={`${card} flex items-center gap-2 px-3 py-3`}>
              <SettingsIcon className="h-5 w-5 shrink-0 text-slate-300" />
              <span className="font-display text-xs font-bold text-white sm:text-sm">SETTINGS</span>
            </button>
            <button onClick={onAbout} className={`${card} col-span-2 flex items-center justify-center gap-2 px-3 py-3`}>
  <Info className="h-5 w-5 text-cyan-300" />
  <span className="font-display text-xs font-bold text-white sm:text-sm">ABOUT US</span>
</button>
          </div>
          <p className="mt-1 text-center text-[11px] text-slate-500 short:hidden">Progress saves automatically in your browser · WASD / Arrows / Swipe / D-Pad</p>
        </div>
      </div>
    </Shell>
  );
}

// ------------------------------------------------------------------ DIFFICULTY
export function DifficultyScreen({ save, onPick, onBack }: { save: SaveData; onPick: (d: Diff) => void; onBack: () => void }) {
  const accent: Record<Diff, string> = {
    easy: "border-emerald-300/40 hover:bg-emerald-400/10",
    normal: "border-cyan-300/40 hover:bg-cyan-400/10",
    hard: "border-violet-300/40 hover:bg-violet-400/10",
    impossible: "border-rose-300/40 hover:bg-rose-400/10",
  };
  return (
    <Shell>
      <BackButton onClick={onBack} />
      <ScreenTitle sub="Each difficulty has its own 20 levels and its own saved progress.">SELECT DIFFICULTY</ScreenTitle>
      <div className="anim-slide-up mt-3 grid w-full gap-2.5 sm:grid-cols-2 short:grid-cols-2">
        {DIFFS.map((d) => {
          const L1 = getLevel(d, 1);
          const L20 = getLevel(d, LEVELS_PER_DIFF);
          const active = save.settings.difficulty === d;
          return (
            <button key={d} onClick={() => onPick(d)} className={`rounded-2xl border bg-[#0c1024]/90 p-3 text-left transition active:scale-[0.98] ${accent[d]} ${active ? "ring-2 ring-cyan-300/70" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-black text-white">{DIFF_INFO[d].label.toUpperCase()}</span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">{completedCount(save, d)}/{LEVELS_PER_DIFF}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{DIFF_INFO[d].blurb}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-300">
                <span className="flex items-center gap-1"><Heart className="h-3 w-3 text-rose-300" />{L20.hearts === L1.hearts ? L1.hearts : `${L1.hearts}→${L20.hearts}`}</span>
                <span className="flex items-center gap-1"><HelpCircle className="h-3 w-3 text-cyan-300" />{L1.hints < 0 ? "Unlimited" : L1.hints === L20.hints ? L1.hints : `${L1.hints}→${L20.hints}`}</span>
                <span className="flex items-center gap-1"><CloudFog className="h-3 w-3 text-indigo-300" />{L1.fogRadius > 0 ? "Fog" : "No fog"}</span>
                <span className="flex items-center gap-1"><Swords className="h-3 w-3 text-amber-300" />{L1.width - 1 >> 1}×{L1.height - 1 >> 1} → {L20.width - 1 >> 1}×{L20.height - 1 >> 1}</span>
              </div>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

// ------------------------------------------------------------------ LEVEL SELECT
export function LevelSelectScreen({ save, onPick, onDifficulty, onBack }: { save: SaveData; onPick: (n: number) => void; onDifficulty: (d: Diff) => void; onBack: () => void }) {
  const d = save.settings.difficulty;
  const unlocked = save.unlocked[d];
  return (
    <Shell wide>
      <BackButton onClick={onBack} />
      <ScreenTitle sub="Beat a level to unlock the next one. Stars reward speed and efficiency.">LEVEL SELECT</ScreenTitle>
      <div className="anim-slide-up mt-3 flex flex-wrap justify-center gap-1.5">
        {DIFFS.map((x) => (
          <button
            key={x}
            onClick={() => onDifficulty(x)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition active:scale-95 ${x === d ? "bg-cyan-500 text-[#04121a] shadow-[0_0_18px_rgba(34,211,238,0.45)]" : "border border-indigo-300/25 bg-[#0c1024]/90 text-slate-300 hover:bg-indigo-400/15"}`}
          >
            {DIFF_INFO[x].label}
          </button>
        ))}
      </div>
      <div className="anim-slide-up mt-3 grid w-full grid-cols-4 gap-2 pb-2 sm:grid-cols-5">
        {Array.from({ length: LEVELS_PER_DIFF }, (_, i) => i + 1).map((n) => {
          const locked = n > unlocked;
          const best = save.best[bestKey(d, n)];
          return (
            <button
              key={n}
              disabled={locked}
              onClick={() => onPick(n)}
              className={`flex flex-col items-center rounded-2xl border px-1.5 py-2 transition ${locked ? "cursor-not-allowed border-slate-700/40 bg-[#0a0d1d]/80 opacity-60" : best ? "border-emerald-300/30 bg-emerald-400/[0.07] hover:bg-emerald-400/15 active:scale-95" : "border-cyan-300/30 bg-cyan-400/[0.06] hover:bg-cyan-400/15 active:scale-95"}`}
              aria-label={`Level ${n}${locked ? " (locked)" : ""}`}
            >
              {locked ? <Lock className="h-5 w-5 text-slate-500" /> : <span className="font-display text-xl font-black text-white">{n}</span>}
              <span className="mt-0.5 line-clamp-1 w-full text-center text-[9px] font-medium text-slate-400">{locked ? "Locked" : getLevel(d, n).name}</span>
              {best ? (
                <span className="mt-1 flex flex-col items-center gap-0.5">
                  <Stars n={best.stars} size="h-3 w-3" />
                  <span className="flex items-center gap-0.5 text-[9px] tabular-nums text-slate-500"><Clock className="h-2.5 w-2.5" /> {fmt(best.time)}</span>
                </span>
              ) : (
                !locked && <span className="mt-1 text-[9px] text-cyan-300/80">NEW</span>
              )}
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

// ------------------------------------------------------------------ SETTINGS
export function SettingsScreen({ save, onChange, onReset, onBack }: { save: SaveData; onChange: (s: SaveData["settings"]) => void; onReset: () => void; onBack: () => void }) {
  const s = save.settings;
  const [confirm, setConfirm] = useState(false);
  const row = "flex w-full items-center justify-between gap-3 rounded-2xl border border-indigo-300/25 bg-[#0c1024]/90 px-4 py-3 text-left";
  return (
    <Shell>
      <BackButton onClick={onBack} />
      <ScreenTitle>SETTINGS</ScreenTitle>
      <div className="anim-slide-up mt-3 flex w-full max-w-md flex-col gap-2.5">
        <button className={row} onClick={() => onChange({ ...s, sound: !s.sound })}>
          <span className="flex items-center gap-3">
            {s.sound ? <Volume2 className="h-5 w-5 text-cyan-300" /> : <VolumeX className="h-5 w-5 text-slate-400" />}
            <span className="font-display text-sm font-bold text-white">SOUND</span>
          </span>
          <span className="flex items-center gap-2 text-sm text-slate-300">{s.sound ? "On" : "Off"} {s.sound ? <ToggleRight className="h-6 w-6 text-cyan-300" /> : <ToggleLeft className="h-6 w-6 text-slate-500" />}</span>
        </button>
        <button className={row} onClick={() => onChange({ ...s, shake: !s.shake })}>
          <span className="flex items-center gap-3">
            <Flag className="h-5 w-5 text-rose-300" />
            <span className="font-display text-sm font-bold text-white">SCREEN SHAKE</span>
          </span>
          <span className="flex items-center gap-2 text-sm text-slate-300">{s.shake ? "On" : "Off"} {s.shake ? <ToggleRight className="h-6 w-6 text-cyan-300" /> : <ToggleLeft className="h-6 w-6 text-slate-500" />}</span>
        </button>
        <div className={`${row} flex-col !items-stretch`}>
          <span className="flex items-center gap-3">
            <KeyRound className="h-5 w-5 text-amber-300" />
            <span className="font-display text-sm font-bold text-white">TOUCH CONTROLS</span>
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {(["auto", "on", "off"] as const).map((o) => (
              <button
                key={o}
                onClick={() => onChange({ ...s, touch: o })}
                className={`rounded-lg px-2 py-1.5 text-xs font-bold uppercase transition active:scale-95 ${s.touch === o ? "bg-cyan-500 text-[#04121a]" : "border border-indigo-300/25 bg-indigo-400/10 text-slate-300"}`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
        {confirm ? (
          <div className={`${row} !border-rose-300/40`}>
            <span className="text-sm text-rose-100">Erase all saved progress?</span>
            <span className="flex gap-1.5">
              <button onClick={() => { onReset(); setConfirm(false); }} className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white">YES</button>
              <button onClick={() => setConfirm(false)} className="rounded-lg border border-indigo-300/30 px-3 py-1.5 text-xs font-bold text-slate-200">NO</button>
            </span>
          </div>
        ) : (
          <button className={`${row} hover:bg-rose-400/10`} onClick={() => setConfirm(true)}>
            <span className="flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-rose-300" />
              <span className="font-display text-sm font-bold text-white">RESET PROGRESS</span>
            </span>
          </button>
        )}
        <div className="mt-2 rounded-2xl border border-indigo-300/20 bg-[#0c1024]/80 px-4 py-3 text-center text-sm leading-relaxed text-slate-300">
          <p>There are 4 difficulty levels: Easy, Normal, Hard, and Impossible.</p>
          <p className="mt-2">Every difficulty has 20 levels.</p>
          <p className="mt-2">As the level increases, the difficulty gradually increases within the selected difficulty mode.</p>
        </div>
      </div>
    </Shell>
  );
}

// ------------------------------------------------------------------ HOW TO PLAY
export function HelpScreen({ onBack }: { onBack: () => void }) {
  const items = [
    ["Move", "WASD or arrow keys. On touch screens, swipe on the maze or use the on-screen pad."],
    ["Keys and doors", "Collect a golden key to open one locked door. Each key opens a single door."],
    ["Switches and gates", "Step on the violet switch to open the sealed violet gates."],
    ["Spikes", "Spikes rise and fall. Wait on a safe tile, then cross while they are down."],
    ["Red sentinels", "They patrol in a fixed rhythm. Wait at a junction until one moves away, then cross."],
    ["Hearts", "A hit costs one heart and sends you back to your last checkpoint. You have a short moment of protection afterwards. Lose every heart and the level is lost."],
    ["Hints", "Press H or tap HINT to show a glowing trail to your next objective. Hints are limited on harder difficulties."],
    ["Fog", "On Hard and Impossible, fog hides the maze. Spikes and sentinels still glow through it."],
    ["Goal", "Reach the emerald portal to escape. P pauses, R restarts the level and M toggles sound."],
  ];
  return (
    <Shell>
      <BackButton onClick={onBack} />
      <ScreenTitle>HOW TO PLAY</ScreenTitle>
      <div className="anim-slide-up mt-3 flex w-full max-w-xl flex-col gap-2 pb-2">
        {items.map(([t, d]) => (
          <div key={t} className="rounded-2xl border border-indigo-300/20 bg-[#0c1024]/90 px-4 py-2.5">
            <div className="font-display text-xs font-bold tracking-wider text-cyan-300">{t.toUpperCase()}</div>
            <div className="mt-0.5 text-sm text-slate-300">{d}</div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
// ------------------------------------------------------------------ ABOUT US
export function AboutScreen({ onBack }: { onBack: () => void }) {
  return (
    <Shell>
      <BackButton onClick={onBack} />
      <ScreenTitle sub="Get to know the game and its developer.">ABOUT US</ScreenTitle>

      <div className="anim-slide-up mt-4 flex w-full max-w-xl flex-col gap-3 pb-4">

        <div className="rounded-2xl border border-cyan-300/30 bg-[#0c1024]/90 p-5 text-center">
          <h3 className="font-display text-2xl font-black tracking-wide text-cyan-300">
            MAZE RUSH
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Maze Rush is an exciting maze puzzle game designed to challenge
            your problem-solving skills and provide an enjoyable gaming
            experience.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            The game features 80 challenging levels across four difficulty
            modes: Easy, Normal, Hard, and Impossible. Find your way through
            the maze and reach the exit!
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-300/25 bg-[#0c1024]/90 p-5">
          <h3 className="font-display text-lg font-bold text-white">
            OUR MISSION
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Our mission is to provide players with an enjoyable, engaging,
            and challenging gaming experience while encouraging logical
            thinking and problem-solving skills.
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-300/25 bg-[#0c1024]/90 p-5">
          <h3 className="font-display text-lg font-bold text-white">
            DEVELOPER
          </h3>
          <p className="mt-2 text-base font-bold text-cyan-300">
            Mudassir Inam
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Maze Rush is independently developed and maintained by
            Mudassir Inam.
          </p>
        </div>

        <p className="text-center text-xs text-slate-500">
          Thank you for playing Maze Rush!
        </p>

      </div>
    </Shell>
  );
}
