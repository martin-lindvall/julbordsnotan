// Lo-fi chiptune sound effects + a cosy looping original christmas lo-fi tune.
// Everything is synthesised with WebAudio — no audio files.

let ctx, master, sfxBus, musicBus, noiseBuf, crackle;
let sfxOn = load('jn:sfx', true);
let musicOn = load('jn:music', false);
let timer = null, nextTime = 0, step = 0;

function load(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v === '1'; } catch { return d; } }
function save(k, v) { try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* ignore */ } }

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    const warm = ctx.createBiquadFilter();
    warm.type = 'lowpass';
    warm.frequency.value = 5200;
    master.connect(warm).connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.5;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.0;
    const lofi = ctx.createBiquadFilter();
    lofi.type = 'lowpass';
    lofi.frequency.value = 1900;
    lofi.Q.value = 0.7;
    musicBus.connect(lofi).connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function tone({ freq, to, type = 'square', t, dur = 0.1, vol = 0.2, dest = sfxBus, attack = 0.004, detune = 0 }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.detune.value = detune;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ t, dur = 0.05, vol = 0.1, hp = 6000, dest = sfxBus, bp }) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = bp ? 'bandpass' : 'highpass';
  f.frequency.value = bp || hp;
  if (bp) f.Q.value = 6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(dest);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.02);
}

export function play(name) {
  if (!sfxOn || !ensure()) return;
  const t = ctx.currentTime + 0.01;
  switch (name) {
    case 'up':
      tone({ freq: 660, to: 1320, t, dur: 0.08, vol: 0.18 });
      tone({ freq: 1320, t: t + 0.06, dur: 0.07, vol: 0.12 });
      break;
    case 'down':
      tone({ freq: 700, to: 330, t, dur: 0.12, vol: 0.16 });
      break;
    case 'nope':
      tone({ freq: 140, t, dur: 0.12, vol: 0.2, type: 'sawtooth' });
      tone({ freq: 110, t: t + 0.12, dur: 0.18, vol: 0.2, type: 'sawtooth' });
      break;
    case 'join':
      [72, 76, 79, 84].forEach((m, i) => tone({ freq: mtof(m), t: t + i * 0.07, dur: 0.12, vol: 0.14 }));
      break;
    case 'coin':
      [88, 91, 96].forEach((m, i) => tone({ freq: mtof(m), t: t + i * 0.06, dur: 0.18, vol: 0.12 }));
      [0, 0.09, 0.18].forEach((d) => noise({ t: t + d, dur: 0.06, vol: 0.06, hp: 8000 }));
      break;
    case 'click':
      tone({ freq: 1800, t, dur: 0.03, vol: 0.08 });
      break;
    case 'win': {
      // little original fanfare
      const mel = [72, 76, 79, 84, null, 79, 84, 88, null, 84, 91];
      mel.forEach((m, i) => m && tone({ freq: mtof(m), t: t + i * 0.11, dur: 0.2, vol: 0.13 }));
      [60, 64, 67].forEach((m) => tone({ freq: mtof(m), t: t + 0.9, dur: 1.2, vol: 0.06, type: 'triangle' }));
      for (let i = 0; i < 12; i++) noise({ t: t + i * 0.1, dur: 0.05, vol: 0.05, hp: 9000 });
      break;
    }
  }
}

// ---------- music ----------
const BPM = 72;
const STEP = 60 / BPM / 4; // 16th notes
const CHORDS = [
  { root: 41, notes: [53, 57, 60, 64] }, // Fmaj7
  { root: 40, notes: [52, 55, 59, 62] }, // Em7
  { root: 38, notes: [50, 53, 57, 60] }, // Dm7
  { root: 43, notes: [53, 55, 59, 62] }, // G7
];
const _ = null;
const MELODY = [
  76, _, _, 72, _, _, 74, _, 76, _, 79, _, _, _, _, _,
  74, _, _, 71, _, _, 72, _, 74, _, _, _, 67, _, _, _,
  72, _, _, 69, _, _, 72, _, 74, _, 76, _, _, 77, _, 76,
  74, _, _, _, 71, _, _, _, 67, _, 69, _, 71, _, _, _,
];

function schedule(s, t) {
  const bar = Math.floor(s / 16) % 4;
  const pos = s % 16;
  const ch = CHORDS[bar];
  const swing = s % 2 === 1 ? STEP * 0.28 : 0;
  const tt = t + swing;
  if (pos === 0) {
    ch.notes.forEach((m, i) => {
      tone({ freq: mtof(m), t: t + i * 0.02, dur: STEP * 15, vol: 0.035, type: 'triangle', dest: musicBus, attack: 0.25, detune: (i % 2 ? 6 : -6) });
    });
  }
  if (pos === 0 || pos === 10) tone({ freq: mtof(ch.root), t: tt, dur: STEP * 5, vol: 0.16, type: 'triangle', dest: musicBus, attack: 0.01 });
  // kick
  if (pos === 0 || pos === 7 || pos === 10) tone({ freq: 120, to: 45, t: tt, dur: 0.18, vol: 0.35, type: 'sine', dest: musicBus });
  // dusty snare
  if (pos === 4 || pos === 12) noise({ t: tt, dur: 0.14, vol: 0.12, bp: 1800, dest: musicBus });
  // sleigh bells
  if (pos % 2 === 0) noise({ t: tt, dur: 0.04, vol: pos % 4 === 2 ? 0.05 : 0.025, hp: 9000, dest: musicBus });
  if (pos % 4 === 2) noise({ t: tt + 0.05, dur: 0.03, vol: 0.02, hp: 10000, dest: musicBus });
  const m = MELODY[s % 64];
  if (m) tone({ freq: mtof(m), t: tt, dur: STEP * 3.2, vol: 0.05, type: 'square', dest: musicBus, attack: 0.01, detune: Math.random() * 8 - 4 });
}

function startCrackle() {
  const len = ctx.sampleRate * 3;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.04 + (Math.random() < 0.0006 ? (Math.random() * 2 - 1) * 0.9 : 0);
  crackle = ctx.createBufferSource();
  crackle.buffer = buf;
  crackle.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2500;
  const g = ctx.createGain();
  g.gain.value = 0.25;
  crackle.connect(f).connect(g).connect(musicBus);
  crackle.start();
}

function startMusic() {
  if (!ensure() || timer) return;
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setTargetAtTime(0.9, ctx.currentTime, 0.5);
  startCrackle();
  nextTime = ctx.currentTime + 0.1;
  timer = setInterval(() => {
    while (nextTime < ctx.currentTime + 0.2) {
      schedule(step, nextTime);
      nextTime += STEP;
      step = (step + 1) % 64;
    }
  }, 30);
}

function stopMusic() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
  if (crackle) { crackle.stop(ctx.currentTime + 1); crackle = null; }
}

export const isSfxOn = () => sfxOn;
export const isMusicOn = () => musicOn;
export function toggleSfx() { sfxOn = !sfxOn; save('jn:sfx', sfxOn); if (sfxOn) play('click'); return sfxOn; }
export function toggleMusic() {
  musicOn = !musicOn;
  save('jn:music', musicOn);
  musicOn ? startMusic() : stopMusic();
  return musicOn;
}
// Browsers only allow audio after a user gesture: resume remembered music on first tap.
export function unlockOnGesture() {
  const go = () => {
    ensure();
    if (musicOn) startMusic();
    window.removeEventListener('pointerdown', go);
    window.removeEventListener('keydown', go);
  };
  window.addEventListener('pointerdown', go);
  window.addEventListener('keydown', go);
}
