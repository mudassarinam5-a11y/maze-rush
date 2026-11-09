
import { useCallback, useEffect, useMemo, useState } from "react";
import { GameView } from "./components/GameView";
import {
  AboutScreen,
  DifficultyScreen,
  HelpScreen,
  LevelSelectScreen,
  MenuScreen,
  SettingsScreen,
  PrivacyPolicyScreen,
  TermsScreen,
  HelpCenterScreen,
  FAQScreen,
  ContactScreen,
  DisclaimerScreen,
  CookiePolicyScreen,
} from "./components/Screens";
import { clampLevel, getLevel } from "./game/levels";
import { bestKey, clearSave, defaultSave, loadSave, writeSave, type SaveData } from "./game/save";
import { setSoundEnabled, sfx } from "./game/audio";
import type { Result } from "./game/engine";
import { DIFFS, LEVELS_PER_DIFF, type Diff } from "./game/types";

type Screen =
  | "menu"
  | "difficulty"
  | "levels"
  | "settings"
  | "help"
  | "game"
  | "about"
  | "privacy"
  | "terms"
  | "helpCenter"
  | "faq"
  | "contact"
  | "disclaimer"
  | "cookiePolicy";

function useTouchMode(pref: "auto" | "on" | "off") {
  const compute = () => {
    if (pref === "on") return true;
    if (pref === "off") return false;
    return window.matchMedia?.("(pointer: coarse)").matches || window.matchMedia?.("(hover: none)").matches || Math.min(window.innerWidth, window.innerHeight) < 600;
  };
  const [v, setV] = useState(compute);
  useEffect(() => {
    const f = () => setV(compute());
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pref]);
  return v;
}

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [screen, setScreen] = useState<Screen>("menu");
  const [level, setLevel] = useState(1);
  const diff = save.settings.difficulty;
  const showTouch = useTouchMode(save.settings.touch);

  useEffect(() => writeSave(save), [save]);
  useEffect(() => setSoundEnabled(save.settings.sound), [save.settings.sound]);

  const update = useCallback((fn: (s: SaveData) => SaveData) => setSave((s) => fn(s)), []);
  const setDifficulty = useCallback((d: Diff) => update((s) => ({ ...s, settings: { ...s.settings, difficulty: d } })), [update]);

  const startLevel = useCallback((n: number) => {
    sfx.click();
    setLevel(clampLevel(n));
    setScreen("game");
  }, []);

  const onComplete = useCallback(
    (r: Result) => {
      update((s) => {
        const d = s.settings.difficulty;
        const k = bestKey(d, r.level);
        const prev = s.best[k];
        const better = !prev || r.stars > prev.stars || (r.stars === prev.stars && r.score > prev.score);
        return {
          ...s,
          unlocked: { ...s.unlocked, [d]: Math.max(s.unlocked[d], Math.min(LEVELS_PER_DIFF + 1, r.level + 1)) },
          best: better ? { ...s.best, [k]: { stars: r.stars, time: prev ? Math.min(prev.time, r.time) : r.time, score: Math.max(prev?.score ?? 0, r.score) } } : s.best,
          totalScore: s.totalScore + (prev ? 0 : r.score),
        };
      });
    },
    [update],
  );

  const levelData = useMemo(() => getLevel(diff, level), [diff, level]);
  const nextDiff = DIFFS[DIFFS.indexOf(diff) + 1] as Diff | undefined;

  if (screen === "game") {
    return (
      <GameView
        key={`${diff}-${level}`}
        level={levelData}
        diff={diff}
        soundOn={save.settings.sound}
        shakeOn={save.settings.shake}
        showTouch={showTouch}
        onComplete={onComplete}
        onNextLevel={() => startLevel(level + 1)}
        onNextDifficulty={nextDiff ? () => { setDifficulty(nextDiff); setLevel(1); } : null}
        onLevelSelect={() => setScreen("levels")}
        onMenu={() => setScreen("menu")}
        onToggleSound={() => update((s) => ({ ...s, settings: { ...s.settings, sound: !s.settings.sound } }))}
      />
    );
  }

  if (screen === "difficulty") {
    return <DifficultyScreen save={save} onBack={() => setScreen("menu")} onPick={(d) => { setDifficulty(d); setScreen("levels"); }} />;
  }

  if (screen === "levels") {
    return <LevelSelectScreen save={save} onBack={() => setScreen("menu")} onDifficulty={setDifficulty} onPick={startLevel} />;
  }

  if (screen === "settings") {
    return (
      <SettingsScreen
        save={save}
        onBack={() => setScreen("menu")}
        onChange={(settings) => update((s) => ({ ...s, settings }))}
        onReset={() => { clearSave(); setSave({ ...defaultSave(), settings: save.settings }); }}
      />
    );
  }

  if (screen === "help") return <HelpScreen onBack={() => setScreen("menu")} />;
  if (screen === "about") return <AboutScreen onBack={() => setScreen("menu")} />;
  if (screen === "privacy") return <PrivacyPolicyScreen onBack={() => setScreen("menu")} />;
  if (screen === "terms") return <TermsScreen onBack={() => setScreen("menu")} />;

  if (screen === "helpCenter") {
    return (
      <HelpCenterScreen
        onBack={() => setScreen("menu")}
        onFAQ={() => setScreen("faq")}
        onContact={() => setScreen("contact")}
        onDisclaimer={() => setScreen("disclaimer")}
        onCookiePolicy={() => setScreen("cookiePolicy")}
      />
    );
  }

  if (screen === "faq") return <FAQScreen onBack={() => setScreen("helpCenter")} />;
  if (screen === "contact") return <ContactScreen onBack={() => setScreen("helpCenter")} />;
  if (screen === "disclaimer") return <DisclaimerScreen onBack={() => setScreen("helpCenter")} />;
  if (screen === "cookiePolicy") return <CookiePolicyScreen onBack={() => setScreen("helpCenter")} />;

  return (
    <MenuScreen
      save={save}
      onPlay={() => startLevel(Math.min(save.unlocked[diff], LEVELS_PER_DIFF))}
      onDifficulty={() => setScreen("difficulty")}
      onLevels={() => setScreen("levels")}
      onSettings={() => setScreen("settings")}
      onHelp={() => setScreen("help")}
      onAbout={() => setScreen("about")}
      onPrivacy={() => setScreen("privacy")}
      onTerms={() => setScreen("terms")}
      onHelpCenter={() => setScreen("helpCenter")}
    />
  );
}
