/** Tiny WebAudio sound effects (no audio files). Created lazily after the first user input. */
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.06, delay = 0, slideTo?: number) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  unlock: () => void ac(),
  step: () => tone(180, 0.05, "triangle", 0.025),
  key: () => {
    tone(880, 0.1, "triangle", 0.07);
    tone(1320, 0.14, "triangle", 0.06, 0.08);
  },
  door: () => {
    tone(220, 0.12, "square", 0.04);
    tone(330, 0.16, "square", 0.04, 0.09);
  },
  switchFlip: () => tone(300, 0.12, "square", 0.05, 0, 600),
  gate: () => tone(120, 0.4, "sawtooth", 0.04, 0, 60),
  checkpoint: () => {
    tone(660, 0.1, "sine", 0.06);
    tone(990, 0.16, "sine", 0.06, 0.1);
  },
  hurt: () => tone(260, 0.3, "sawtooth", 0.07, 0, 70),
  denied: () => tone(150, 0.12, "square", 0.04),
  hint: () => tone(700, 0.2, "sine", 0.05, 0, 1100),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, "triangle", 0.07, i * 0.1)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.28, "sawtooth", 0.05, i * 0.14)),
  click: () => tone(520, 0.05, "sine", 0.04),
};
