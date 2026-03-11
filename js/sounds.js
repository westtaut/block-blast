// ─── SOUND ENGINE ────────────────────────────────────────────────────────────
// Music: HTML Audio element (MP3, looped)
// SFX:   Web Audio API (synthesized, no external files)

const SoundEngine = {
  ctx:          null,
  sfxGain:      null,
  musicEl:      null,       // HTMLAudioElement
  musicEnabled: true,
  sfxEnabled:   true,
  musicPlaying: false,
  _musicVol:    0.55,       // 0–1
  _sfxVol:      0.55,       // 0–1

  // ── INIT ────────────────────────────────────────────────────────────────
  init() {
    // Web Audio for SFX
    try {
      this.ctx     = new (window.AudioContext || window.webkitAudioContext)();
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this._sfxVol;
      this.sfxGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Web Audio unavailable', e);
    }

    // HTML Audio element for music (supports MP3 loop natively)
    try {
      this.musicEl       = new Audio('assets/music.mp3');
      this.musicEl.loop  = true;
      this.musicEl.volume= this._musicVol;
      this.musicEl.preload = 'auto';
    } catch (e) {
      console.warn('Audio element unavailable', e);
    }

    return this;
  },

  // ── RESUME AudioContext (required after user gesture) ────────────────────
  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  },

  // ── MUSIC ────────────────────────────────────────────────────────────────
  startMusic() {
    if (!this.musicEnabled || !this.musicEl || this.musicPlaying) return;
    this.resume();
    this.musicEl.play().then(() => {
      this.musicPlaying = true;
    }).catch(e => {
      // Autoplay blocked — will retry on next user interaction
      this.musicPlaying = false;
    });
  },

  stopMusic() {
    if (!this.musicEl) return;
    // Fade out gracefully
    const fade = () => {
      if (!this.musicEl) return;
      if (this.musicEl.volume > 0.04) {
        this.musicEl.volume = Math.max(0, this.musicEl.volume - 0.04);
        setTimeout(fade, 40);
      } else {
        this.musicEl.pause();
        this.musicEl.currentTime = 0;
        this.musicEl.volume = this._musicVol;
        this.musicPlaying = false;
      }
    };
    fade();
  },

  setMusicVolume(v) {
    this._musicVol = Math.max(0, Math.min(1, v));
    if (this.musicEl) this.musicEl.volume = this._musicVol;
  },

  setSfxVolume(v) {
    this._sfxVol = Math.max(0, Math.min(1, v));
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(this._sfxVol, this.ctx.currentTime, 0.05);
  },

  // ── SFX CORE ──────────────────────────────────────────────────────────────
  _play(freq, type, duration, gain, delay = 0, pitchEnd = null) {
    if (!this.ctx || !this.sfxEnabled) return;
    try {
      const osc = this.ctx.createOscillator();
      const g   = this.ctx.createGain();
      osc.connect(g); g.connect(this.sfxGain);

      osc.type = type;
      const t0 = this.ctx.currentTime + delay;
      osc.frequency.setValueAtTime(freq, t0);
      if (pitchEnd) osc.frequency.exponentialRampToValueAtTime(pitchEnd, t0 + duration * 0.8);

      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    } catch (e) {}
  },

  _noise(duration, gain, delay = 0) {
    if (!this.ctx || !this.sfxEnabled) return;
    try {
      const bufLen  = Math.ceil(this.ctx.sampleRate * duration);
      const buf     = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
      const data    = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);

      const src = this.ctx.createBufferSource();
      src.buffer = buf;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 800;
      filter.Q.value = 0.5;

      const g = this.ctx.createGain();
      src.connect(filter); filter.connect(g); g.connect(this.sfxGain);

      const t0 = this.ctx.currentTime + delay;
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

      src.start(t0); src.stop(t0 + duration + 0.01);
    } catch (e) {}
  },

  // ── SFX EVENTS ────────────────────────────────────────────────────────────

  // Piece picked up from tray — soft pop
  snap() {
    this.resume();
    this._play(600,  'sine',     0.06, 0.22);
    this._play(900,  'sine',     0.04, 0.12, 0.04);
  },

  // Piece placed on board — satisfying thud
  place() {
    this.resume();
    this._play(180, 'sine',     0.08, 0.45);
    this._play(260, 'triangle', 0.06, 0.28, 0.02);
    this._noise(0.06, 0.12);
  },

  // Line clear — rising chime cascade
  lineClear(count = 1) {
    this.resume();
    const scales = [
      [523, 659, 784],
      [659, 784, 1047],
      [784, 1047, 1318],
      [1047, 1318, 1568],
    ];
    const notes = scales[Math.min(count - 1, 3)];
    notes.forEach((f, i) => {
      this._play(f, 'sine', 0.25, 0.45 - i * 0.05, i * 0.07);
    });

    // Deep punch
    this._play(80, 'sine', 0.18, 0.55);
    this._noise(0.12, 0.2, 0.01);

    if (count >= 2) {
      // Sparkle trail
      [1318, 1568, 2093].forEach((f, i) => {
        this._play(f, 'sine', 0.15, 0.25, 0.22 + i * 0.06);
      });
    }
    if (count >= 3) {
      // Big impact boom
      this._play(55, 'sawtooth', 0.3, 0.4, 0.05);
      this._play(110, 'sine',    0.3, 0.3, 0.05);
    }
  },

  // Combo — escalating pitch
  combo(n) {
    this.resume();
    const base = 330 * Math.pow(1.18, n - 2);
    this._play(base,        'sine',     0.12, 0.4);
    this._play(base * 1.26, 'sine',     0.10, 0.28, 0.07);
    this._play(base * 1.5,  'triangle', 0.08, 0.2,  0.13);
  },

  // Button tap — subtle
  button() {
    this.resume();
    this._play(660, 'sine', 0.04, 0.18);
  },

  // Invalid placement
  error() {
    this.resume();
    this._play(180, 'square', 0.08, 0.22);
    this._play(140, 'square', 0.08, 0.18, 0.07);
  },

  // Game over — descending
  gameOver() {
    this.resume();
    [220, 185, 147, 110].forEach((f, i) => {
      this._play(f, 'sawtooth', 0.35, 0.38, i * 0.14);
    });
    this._noise(0.3, 0.25, 0.1);
  },

  // Level win — fanfare
  levelWin() {
    this.resume();
    const melody = [523, 659, 784, 1047, 1318];
    melody.forEach((f, i) => {
      this._play(f,     'sine', 0.22, 0.4, i * 0.09);
      this._play(f * 2, 'sine', 0.12, 0.2, i * 0.09 + 0.04);
    });
  },

  // Achievement unlocked
  achievement() {
    this.resume();
    [784, 988, 1175, 1568].forEach((f, i) => {
      this._play(f, 'sine', 0.2, 0.35, i * 0.075);
    });
  },
};
