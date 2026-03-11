// ─── SOUND ENGINE (Web Audio API — no external files) ────────────────────────

const SoundEngine = {
  ctx: null,
  masterGain: null,
  musicGain: null,
  sfxGain: null,
  musicNode: null,
  musicEnabled: true,
  sfxEnabled: true,
  musicPlaying: false,
  _musicScheduled: [],

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.18;
      this.musicGain.connect(this.masterGain);
    } catch(e) {
      console.warn('Web Audio not supported');
    }
    return this;
  },

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  },

  // ── SFX ──────────────────────────────────────────────────────────────────
  _tone(freq, type, duration, gainVal, delay = 0) {
    if (!this.ctx || !this.sfxEnabled) return;
    try {
      const osc  = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + delay);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + duration);
      osc.start(this.ctx.currentTime + delay);
      osc.stop(this.ctx.currentTime + delay + duration + 0.01);
    } catch(e) {}
  },

  place() {
    this.resume();
    this._tone(220, 'sine', 0.08, 0.4);
    this._tone(330, 'sine', 0.06, 0.25, 0.06);
  },

  snap() {
    this.resume();
    this._tone(440, 'sine', 0.04, 0.3);
  },

  lineClear(count = 1) {
    this.resume();
    const freqs = [523, 659, 784, 1047];
    for (let i = 0; i < Math.min(count, 4); i++) {
      this._tone(freqs[i], 'sine', 0.15, 0.5, i * 0.06);
    }
    if (count >= 2) {
      setTimeout(() => this._tone(1318, 'sine', 0.2, 0.4), 200);
    }
  },

  combo(multiplier) {
    this.resume();
    const base = 440 * Math.pow(1.2, multiplier - 1);
    this._tone(base, 'triangle', 0.12, 0.45);
    this._tone(base * 1.5, 'sine', 0.1, 0.3, 0.08);
  },

  gameOver() {
    this.resume();
    this._tone(220, 'sawtooth', 0.3, 0.4);
    this._tone(165, 'sawtooth', 0.3, 0.3, 0.25);
    this._tone(110, 'sawtooth', 0.5, 0.3, 0.5);
  },

  levelWin() {
    this.resume();
    [523, 659, 784, 1047, 1318].forEach((f, i) => {
      this._tone(f, 'sine', 0.2, 0.4, i * 0.08);
    });
  },

  button() {
    this.resume();
    this._tone(660, 'sine', 0.05, 0.2);
  },

  error() {
    this.resume();
    this._tone(180, 'square', 0.12, 0.3);
    this._tone(140, 'square', 0.12, 0.25, 0.1);
  },

  achievement() {
    this.resume();
    [784, 988, 1175, 1568].forEach((f, i) => {
      this._tone(f, 'sine', 0.18, 0.35, i * 0.07);
    });
  },

  // ── BACKGROUND MUSIC (procedural ambient) ─────────────────────────────────
  startMusic() {
    if (!this.ctx || !this.musicEnabled || this.musicPlaying) return;
    this.musicPlaying = true;
    this._scheduleAmbient(this.ctx.currentTime);
  },

  stopMusic() {
    this.musicPlaying = false;
    this._musicScheduled.forEach(n => { try { n.stop(); } catch{} });
    this._musicScheduled = [];
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
      setTimeout(() => { if(this.musicGain) this.musicGain.gain.value = 0.18; }, 600);
    }
  },

  _scheduleAmbient(startTime) {
    if (!this.musicPlaying || !this.ctx) return;

    // Calm pentatonic progression: Am pentatonic
    const scale = [220, 261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784];
    const chords = [
      [220, 329.6, 440],
      [196, 293.7, 392],
      [261.6, 392, 523.3],
      [220, 329.6, 493.9],
    ];

    const barDuration = 3.2;
    const totalBars   = 4;

    for (let bar = 0; bar < totalBars; bar++) {
      const barStart = startTime + bar * barDuration;
      const chord = chords[bar % chords.length];

      // Pad chord
      chord.forEach(freq => {
        this._musicNote(freq / 2, 'sine', barStart, barDuration * 0.9, 0.25);
        this._musicNote(freq, 'sine', barStart, barDuration * 0.85, 0.12);
      });

      // Melody notes (gentle arp)
      const melodyNotes = [0, 2, 4, 6, 4, 2, 3, 5];
      melodyNotes.forEach((si, i) => {
        const noteTime = barStart + i * (barDuration / melodyNotes.length);
        const freq = scale[si % scale.length];
        this._musicNote(freq, 'sine', noteTime, barDuration / melodyNotes.length * 0.6, 0.06);
      });
    }

    // Schedule next loop
    const loopEnd = startTime + totalBars * barDuration;
    const scheduleDelay = (loopEnd - this.ctx.currentTime - 0.5) * 1000;
    setTimeout(() => {
      if (this.musicPlaying) this._scheduleAmbient(loopEnd);
    }, Math.max(100, scheduleDelay));
  },

  _musicNote(freq, type, startTime, duration, gainVal) {
    if (!this.ctx) return;
    try {
      const osc  = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1200;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.type = type;
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(gainVal, startTime + 0.15);
      gain.gain.setValueAtTime(gainVal, startTime + duration * 0.7);
      gain.gain.linearRampToValueAtTime(0, startTime + duration);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
      this._musicScheduled.push(osc);
    } catch(e) {}
  },

  setMusicVolume(v) {
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(v * 0.18, this.ctx.currentTime, 0.1);
  },

  setSfxVolume(v) {
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(v * 0.5, this.ctx.currentTime, 0.1);
  },
};
