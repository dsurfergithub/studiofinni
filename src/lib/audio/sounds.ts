// Gestión de sonidos por Web Audio API para Finni

let audioCtx: AudioContext | null = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
}

export function soundsEnabled(): boolean {
  return localStorage.getItem('finni_sounds') !== 'false';
}

export function setSoundsEnabled(enabled: boolean) {
  localStorage.setItem('finni_sounds', enabled ? 'true' : 'false');
}

function playTone(freq: number, type: OscillatorType, duration: number, vol: number) {
  if (!soundsEnabled()) return;
  initAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playSweep(freqStart: number, freqEnd: number, type: OscillatorType, duration: number, vol: number) {
  if (!soundsEnabled()) return;
  initAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(freqEnd, audioCtx.currentTime + duration);

  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playNoise(freq: number, duration: number, vol: number) {
  if (!soundsEnabled()) return;
  initAudio();
  if (!audioCtx) return;

  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  noise.start();
}

export function playIngreso() {
  if (!soundsEnabled()) return;
  // D5 -> A5
  playTone(587.33, 'triangle', 0.15, 0.1);
  setTimeout(() => playTone(880.00, 'triangle', 0.2, 0.1), 100);
}

export function playGasto() {
  if (!soundsEnabled()) return;
  // A4 -> C#4
  playTone(440.00, 'triangle', 0.15, 0.1);
  setTimeout(() => playTone(277.18, 'triangle', 0.2, 0.1), 100);
}

export function playDelete() {
  if (!soundsEnabled()) return;
  playNoise(1000, 0.2, 0.1);
  playSweep(400, 200, 'square', 0.2, 0.05);
}

export function playSuccess() {
  if (!soundsEnabled()) return;
  // E5 G5 C6 + C7 brillo
  playTone(659.25, 'sine', 0.1, 0.1);
  setTimeout(() => playTone(783.99, 'sine', 0.1, 0.1), 100);
  setTimeout(() => {
    playTone(1046.50, 'sine', 0.3, 0.1);
    playTone(2093.00, 'sine', 0.4, 0.05); // brillo
  }, 200);
}

export function playError() {
  if (!soundsEnabled()) return;
  playTone(150, 'square', 0.15, 0.1);
  setTimeout(() => playTone(120, 'square', 0.2, 0.1), 150);
}

export function playClick() {
  playTone(1200, 'sine', 0.04, 0.02);
}

export function playSheetOpen() {
  playNoise(2200, 0.1, 0.05);
}

export function playSheetClose() {
  playNoise(1100, 0.1, 0.05);
}
