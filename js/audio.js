// Lo-fi chiptune sound effects + a cosy looping original christmas lo-fi tune.
// Everything is synthesised with WebAudio — no audio files.

let ctx, master, sfxBus, musicBus, noiseBuf, crackle;
let sfxOn = load('jn:sfx', true);
let musicOn = load('jn:music', true);
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

// ---------- music: lo-fi "Jingle Bells" (J. Pierpont, 1857 – public domain) ----------
const BPM = 94;
const STEP = 60 / BPM / 2; // 8th notes
const BAR = 8; // 8ths per bar

const CH = {
  Cmaj9: [36, [52, 55, 59, 62]], Am9: [45, [55, 59, 60, 64]], Fmaj7: [41, [53, 57, 60, 64]],
  Dm9: [38, [53, 57, 60, 64]], G13: [43, [53, 57, 59, 64]], G7: [43, [53, 55, 59, 62]],
  C9: [36, [52, 55, 58, 62]], Em7: [40, [55, 59, 62, 64]], A7: [45, [55, 61, 64, 67]],
  D9: [38, [54, 57, 60, 64]],
};
// one entry per bar; "X Y" = two chords, half a bar each (lo-fi jazz reharmonisation)
const CHORD_BARS = (
  'Cmaj9 Am9 Cmaj9 C9 Fmaj7 Cmaj9 D9 G13 Cmaj9 Am9 Cmaj9 C9 Fmaj7 Em7/A7 Dm9/G7 Cmaj9 ' + // chorus
  'Cmaj9 Cmaj9 Cmaj9 Fmaj7 Dm9 G13 G7 Cmaj9 Cmaj9 Cmaj9 Cmaj9 Fmaj7 Dm9 Em7/A7 Dm9/G7 Cmaj9' // verse
).split(' ').map((b) => b.split('/'));

// melody: note:duration-in-quarter-notes, bars separated by |
const TUNE = `
E5 E5 E5:2 | E5 E5 E5:2 | E5 G5 C5:1.5 D5:.5 | E5:4 |
F5 F5 F5:1.5 F5:.5 | F5 E5 E5 E5:.5 E5:.5 | E5 D5 D5 E5 | D5:2 G5:2 |
E5 E5 E5:2 | E5 E5 E5:2 | E5 G5 C5:1.5 D5:.5 | E5:4 |
F5 F5 F5:1.5 F5:.5 | F5 E5 E5 E5:.5 E5:.5 | G5 G5 F5 D5 | C5:4 |
G4 E5 D5 C5 | G4:3 G4:.5 G4:.5 | G4 E5 D5 C5 | A4:4 |
A4 F5 E5 D5 | B4:4 | G5 G5 F5 D5 | E5:4 |
G4 E5 D5 C5 | G4:4 | G4 E5 D5 C5 | A4:3 A4 |
A4 F5 E5 D5 | G5 G5 G5 G5 | A5 G5 F5 D5 | C5:4`;

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const MELODY = new Map(); // 8th-step -> [midi, quarters]
(() => {
  let pos = 0; // in quarters
  for (const tok of TUNE.replace(/\|/g, ' ').trim().split(/\s+/)) {
    const [n, d = '1'] = tok.split(':');
    const midi = 12 * (+n.slice(-1) + 1) + NOTE[n[0]];
    MELODY.set(Math.round(pos * 2), [midi, +d]);
    pos += +d;
  }
})();
const LOOP = CHORD_BARS.length * BAR;

function schedule(s, t) {
  const bar = Math.floor(s / BAR);
  const pos = s % BAR;
  const half = pos < 4 ? 0 : 1;
  const names = CHORD_BARS[bar];
  const [root, notes] = CH[names[Math.min(half, names.length - 1)]];
  const tt = t + (s % 2 === 1 ? STEP * 0.3 : 0); // swing the off-beats
  const chordChange = pos === 0 || (pos === 4 && names.length > 1);
  if (chordChange) {
    const len = names.length > 1 ? 4 : 8;
    notes.forEach((m, i) => tone({ freq: mtof(m), t: t + i * 0.025, dur: STEP * len, vol: 0.03, type: 'triangle', dest: musicBus, attack: 0.15, detune: i % 2 ? 7 : -7 }));
    tone({ freq: mtof(root), t, dur: STEP * 2.6, vol: 0.17, type: 'triangle', dest: musicBus });
  }
  if (pos === 5 && names.length === 1) tone({ freq: mtof(root + 7), t: tt, dur: STEP * 2, vol: 0.12, type: 'triangle', dest: musicBus });
  // soft "keys" comp stabs on the and-of-2 and and-of-4
  if (pos === 3 || pos === 7) notes.forEach((m) => tone({ freq: mtof(m + 12), t: tt, dur: STEP * 0.8, vol: 0.012, type: 'square', dest: musicBus }));
  // drums: kick, dusty snare, sleigh bells on every 8th (it IS jingle bells)
  if (pos === 0 || pos === 5) tone({ freq: 115, to: 42, t: tt, dur: 0.2, vol: 0.33, type: 'sine', dest: musicBus });
  if (pos === 2 || pos === 6) noise({ t: tt, dur: 0.15, vol: 0.1, bp: 1700, dest: musicBus });
  noise({ t: tt, dur: 0.05, vol: pos % 2 ? 0.022 : 0.045, hp: 9000, dest: musicBus });
  noise({ t: tt + 0.04, dur: 0.03, vol: 0.015, hp: 10500, dest: musicBus });
  const mel = MELODY.get(s);
  if (mel) {
    const [m, q] = mel;
    const d = Math.max(STEP * 1.6, q * 2 * STEP * 0.92);
    tone({ freq: mtof(m), t: tt, dur: d, vol: 0.075, type: 'triangle', dest: musicBus, attack: 0.008, detune: Math.random() * 10 - 5 });
    tone({ freq: mtof(m), t: tt, dur: Math.min(d, 0.5), vol: 0.025, type: 'square', dest: musicBus, attack: 0.008 });
  }
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
      step = (step + 1) % LOOP;
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
// Browsers never allow sound before the first tap/click/key press on the page.
// Music is on by default and starts on that first interaction.
let started = false;
let startedAt = 0;
export const isStarted = () => started;
// true for the gesture that unlocked audio, so that tap isn't also treated as a toggle
export const justStarted = () => performance.now() - startedAt < 1000;
export function unlockOnGesture(onStart) {
  const evs = ['pointerdown', 'touchend', 'click', 'keydown'];
  const go = () => {
    // iOS: play through the silent switch like a music app (Safari 16.4+)
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* ignore */ }
    if (!ensure()) return;
    if (musicOn) startMusic();
    started = true;
    startedAt = performance.now();
    evs.forEach((e) => window.removeEventListener(e, go, true));
    if (onStart) onStart();
  };
  evs.forEach((e) => window.addEventListener(e, go, true));
}
