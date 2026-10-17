/* Procedural WebAudio SFX. No external files: nothing fails when audio is
   missing, and the browser autoplay policy is respected (init on gesture). */

let audioCtx = null;
let masterGain = null;
let volume = 0.8;

export function ensureAudio() {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {
    audioCtx = null;
  }
}

export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (masterGain) masterGain.gain.value = volume;
}

export function getVolume() {
  return volume;
}

function tone(freq, endFreq, duration, type, vol, delay = 0) {
  if (!audioCtx || !masterGain) return;
  try {
    const t0 = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  } catch {
    /* audio is best-effort */
  }
}

function noiseBurst(duration, vol, filterFreq) {
  if (!audioCtx || !masterGain) return;
  try {
    const t0 = audioCtx.currentTime;
    const bufferSize = Math.floor(audioCtx.sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = audioCtx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(masterGain);
    src.start(t0);
  } catch {
    /* best-effort */
  }
}

export function playSound(kind) {
  if (!audioCtx) return;
  switch (kind) {
    case 'punch':
      tone(260, 90, 0.12, 'square', 0.06);
      noiseBurst(0.08, 0.05, 1800);
      break;
    case 'hit':
      tone(190, 60, 0.16, 'square', 0.1);
      tone(90, 40, 0.22, 'triangle', 0.12);
      noiseBurst(0.12, 0.07, 1400);
      break;
    case 'heavy':
      tone(140, 45, 0.3, 'sawtooth', 0.12);
      tone(70, 30, 0.4, 'triangle', 0.14);
      noiseBurst(0.22, 0.1, 900);
      break;
    case 'whoosh':
      tone(420, 160, 0.14, 'sine', 0.045);
      break;
    case 'blue':
      tone(240, 980, 0.42, 'sine', 0.09);
      tone(120, 520, 0.42, 'triangle', 0.06, 0.04);
      tone(720, 1500, 0.3, 'sine', 0.04, 0.12);
      break;
    case 'blueCollapse':
      tone(900, 180, 0.35, 'sine', 0.08);
      break;
    case 'red':
      tone(520, 70, 0.5, 'sawtooth', 0.11);
      noiseBurst(0.3, 0.12, 700);
      break;
    case 'redCharge':
      tone(120, 420, 0.5, 'sawtooth', 0.05);
      break;
    case 'purple':
      tone(80, 620, 1.2, 'sawtooth', 0.1);
      tone(40, 300, 1.3, 'triangle', 0.12, 0.1);
      tone(560, 120, 1.0, 'square', 0.05, 0.35);
      noiseBurst(0.8, 0.1, 500);
      break;
    case 'purpleImpact':
      tone(160, 35, 0.9, 'square', 0.13);
      tone(700, 80, 0.7, 'sawtooth', 0.08);
      noiseBurst(0.7, 0.13, 600);
      break;
    case 'infinity':
      tone(660, 1320, 0.4, 'sine', 0.07);
      tone(330, 720, 0.5, 'triangle', 0.05, 0.05);
      break;
    case 'domain':
      tone(90, 420, 1.1, 'sine', 0.12);
      tone(60, 300, 1.2, 'triangle', 0.1, 0.08);
      tone(440, 880, 0.9, 'sine', 0.05, 0.2);
      tone(30, 110, 1.6, 'sawtooth', 0.08, 0.15);
      break;
    case 'domainEnd':
      tone(520, 120, 1.1, 'sine', 0.08);
      tone(260, 70, 1.2, 'triangle', 0.07, 0.1);
      break;
    case 'jump':
      tone(320, 520, 0.12, 'sine', 0.05);
      break;
    case 'dash':
      tone(700, 180, 0.16, 'sawtooth', 0.04);
      noiseBurst(0.14, 0.04, 2400);
      break;
    case 'ko':
      tone(420, 60, 0.9, 'square', 0.1);
      tone(210, 40, 1.1, 'triangle', 0.11, 0.05);
      break;
    case 'charge':
      tone(180, 620, 0.6, 'triangle', 0.05);
      break;
    case 'ui':
      tone(520, 720, 0.1, 'sine', 0.06);
      break;
    case 'denied':
      tone(220, 160, 0.14, 'square', 0.05);
      break;
  }
}
