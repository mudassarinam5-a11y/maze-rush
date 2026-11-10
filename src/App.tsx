
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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

const screenPaths: Record<Screen, string> = {
  menu: "/",
  difficulty: "/",
  levels: "/",
  settings: "/",
  help: "/how-to-play",
  game: "/",
  about: "/about",
  privacy: "/privacy-policy",
  terms: "/terms",
  helpCenter: "/help",
  faq: "/faq",
  contact: "/contact",
  disclaimer: "/disclaimer",
  cookiePolicy: "/cookie-policy",
};

const routeScreens: Record<string, Screen> = {
  "/about": "about",
  "/privacy-policy": "privacy",
  "/terms": "terms",
  "/help": "helpCenter",
  "/how-to-play": "help",
  "/faq": "faq",
  "/contact": "contact",
  "/disclaimer": "disclaimer",
  "/cookie-policy": "cookiePolicy",
};

const pageScreens = new Set<Screen>([
  "about",
  "privacy",
  "terms",
  "helpCenter",
  "help",
  "faq",
  "contact",
  "disclaimer",
  "cookiePolicy",
]);

function useTouchMode(pref: "auto" | "on" | "off") {
  const compute = () => {
    if (pref === "on") return true;
    if (pref === "off") return false;
    return (
      window.matchMedia?.("(pointer: coarse)").matches ||
      window.matchMedia?.("(hover: none)").matches ||
      Math.min(window.innerWidth, window.innerHeight) < 600
    );
  };

  const [v, setV] = useState(compute);

  useEffect(() => {
    const f = () => setV(compute());
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, [pref]);

  return v;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [screen, setScreen] = useState<Screen>("menu");
  const [level, setLevel] = useState(1);

  const diff = save.settings.difficulty;
  const showTouch = useTouchMode(save.settings.touch);

  const goToScreen = useCallback(
    (next: Screen) => {
      setScreen(next);
      const path = screenPaths[next];

      if (location.pathname !== path) {
        navigate(path);
      }
    },
    [location.pathname, navigate],
  );

  useEffect(() => {
    const routeScreen = routeScreens[location.pathname];

    if (routeScreen) {
      setScreen(routeScreen);
    } else if (location.pathname === "/") {
      setScreen((current) =>
        pageScreens.has(current) ? "menu" : current,
      );
    } else {
      navigate("/", { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => writeSave(save), [save]);
  useEffect(() => setSoundEnabled(save.settings.sound), [save.settings.sound]);

  const update = useCallback(
    (fn: (s: SaveData) => SaveData) => setSave((s) => fn(s)),
    [],
  );

  const setDifficulty = useCallback(
    (d: Diff) =>
      update((s) => ({
        ...s,
        settings: { ...s.settings, difficulty: d },
      })),
    [update],
  );

  const startLevel = useCallback(
    (n: number) => {
      sfx.click();
      setLevel(clampLevel(n));
      goToScreen("game");
    },
    [goToScreen],
  );

  const onComplete = useCallback(
    (r: Result) => {
      update((s) => {
        const d = s.settings.difficulty;
        const k = bestKey(d, r.level);
        const prev = s.best[k];
        const better =
          !prev ||
          r.stars > prev.stars ||
          (r.stars === prev.stars && r.score > prev.score);

        return {
          ...s,
          unlocked: {
            ...s.unlocked,
            [d]: Math.max(
              s.unlocked[d],
              Math.min(LEVELS_PER_DIFF + 1, r.level + 1),
            ),
          },
          best: better
            ? {
                ...s.best,
                [k]: {
                  stars: r.stars,
                  time: prev ? Math.min(prev.time, r.time) : r.time,
                  score: Math.max(prev?.score ?? 0, r.score),
                },
              }
            : s.best,
          totalScore: s.totalScore + (prev ? 0 : r.score),
        };
      });
    },
    [update],
  );

  const levelData = useMemo(
    () => getLevel(diff, level),
    [diff, level],
  );

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
        onNextDifficulty={
          nextDiff
            ? () => {
                setDifficulty(nextDiff);
                setLevel(1);
              }
            : null
        }
        onLevelSelect={() => goToScreen("levels")}
        onMenu={() => goToScreen("menu")}
        onToggleSound={() =>
          update((s) => ({
            ...s,
            settings: {
              ...s.settings,
              sound: !s.settings.sound,
            },
          }))
        }
      />
    );
  }

  if (screen === "difficulty") {
    return (
      <DifficultyScreen
        save={save}
        onBack={() => goToScreen("menu")}
        onPick={(d) => {
          setDifficulty(d);
          goToScreen("levels");
        }}
      />
    );
  }

  if (screen === "levels") {
    return (
      <LevelSelectScreen
        save={save}
        onBack={() => goToScreen("menu")}
        onDifficulty={setDifficulty}
        onPick={startLevel}
      />
    );
  }

  if (screen === "settings") {
    return (
      <SettingsScreen
        save={save}
        onBack={() => goToScreen("menu")}
        onChange={(settings) =>
          update((s) => ({ ...s, settings }))
        }
        onReset={() => {
          clearSave();
          setSave({
            ...defaultSave(),
            settings: save.settings,
          });
        }}
      />
    );
  }

  if (screen === "help") {
    return <HelpScreen onBack={() => goToScreen("menu")} />;
  }

  if (screen === "about") {
    return <AboutScreen onBack={() => goToScreen("menu")} />;
  }

  if (screen === "privacy") {
    return <PrivacyPolicyScreen onBack={() => goToScreen("menu")} />;
  }

  if (screen === "terms") {
    return <TermsScreen onBack={() => goToScreen("menu")} />;
  }

  if (screen === "helpCenter") {
    return (
      <HelpCenterScreen
        onBack={() => goToScreen("menu")}
        onFAQ={() => goToScreen("faq")}
        onContact={() => goToScreen("contact")}
        onDisclaimer={() => goToScreen("disclaimer")}
        onCookiePolicy={() => goToScreen("cookiePolicy")}
      />
    );
  }

  if (screen === "faq") {
    return <FAQScreen onBack={() => goToScreen("helpCenter")} />;
  }

  if (screen === "contact") {
    return <ContactScreen onBack={() => goToScreen("helpCenter")} />;
  }

  if (screen === "disclaimer") {
    return <DisclaimerScreen onBack={() => goToScreen("helpCenter")} />;
  }

  if (screen === "cookiePolicy") {
    return <CookiePolicyScreen onBack={() => goToScreen("helpCenter")} />;
  }

  return (
    <MenuScreen
      save={save}
      onPlay={() =>
        startLevel(Math.min(save.unlocked[diff], LEVELS_PER_DIFF))
      }
      onDifficulty={() => goToScreen("difficulty")}
      onLevels={() => goToScreen("levels")}
      onSettings={() => goToScreen("settings")}
      onHelp={() => goToScreen("help")}
      onAbout={() => goToScreen("about")}
      onPrivacy={() => goToScreen("privacy")}
      onTerms={() => goToScreen("terms")}
      onHelpCenter={() => goToScreen("helpCenter")}
    />
  );
}
