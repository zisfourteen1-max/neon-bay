// Procedural WebAudio sound: no audio files, everything is synthesized.
// All methods are safe to call before the context exists (first user gesture).
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
    this.bassTimer = null;
    this.bassStep = 0;
    this.bassNotes = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42]; // A1 A1 C2 G1 …
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.value = muted ? 0 : 0.5;
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || !this.master) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      gain.gain.setValueAtTime(vol || 0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // audio is decoration — never break the game
    }
  }

  noise(dur, vol, filterFreq) {
    if (!this.ctx || !this.master) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1200;
      const gain = this.ctx.createGain();
      gain.gain.value = vol || 0.3;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t);
    } catch {
      // ignore
    }
  }

  shot() {
    this.noise(0.12, 0.5, 2400);
    this.tone(180, 0.08, 'square', 0.12, 60);
  }

  punch() {
    this.tone(95, 0.14, 'sine', 0.4, 45);
    this.noise(0.06, 0.2, 500);
  }

  pickup(dry) {
    if (dry) { this.tone(1200, 0.05, 'square', 0.08); return; }
    this.tone(660, 0.09, 'sine', 0.2);
    setTimeout(() => this.tone(880, 0.12, 'sine', 0.2), 70);
  }

  jingle() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.22), i * 110));
  }

  bust() {
    this.tone(440, 0.5, 'sawtooth', 0.16, 110);
  }

  setEngine(on, ratio) {
    if (!this.ctx || !this.master) return;
    try {
      if (on && !this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 70;
        this.engineGain.gain.value = 0.05;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      if (this.engineOsc) {
        this.engineOsc.frequency.value = 60 + ratio * 110;
        this.engineGain.gain.value = on ? 0.04 + ratio * 0.05 : 0;
      }
    } catch {
      // ignore
    }
  }

  setSiren(on) {
    if (!this.ctx || !this.master) return;
    try {
      if (on && !this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenGain = this.ctx.createGain();
        this.sirenOsc.type = 'sine';
        this.sirenOsc.frequency.value = 720;
        this.sirenGain.gain.value = 0.045;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
        let high = false;
        this.sirenTimer = setInterval(() => {
          if (this.sirenOsc) {
            high = !high;
            this.sirenOsc.frequency.value = high ? 950 : 720;
          }
        }, 420);
      } else if (!on && this.sirenOsc) {
        clearInterval(this.sirenTimer);
        this.sirenTimer = null;
        this.sirenOsc.stop();
        this.sirenOsc = null;
        this.sirenGain = null;
      }
    } catch {
      // ignore
    }
  }

  startBassline() {
    if (!this.ctx || this.bassTimer) return;
    this.bassTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const f = this.bassNotes[this.bassStep % this.bassNotes.length];
      this.bassStep++;
      this.tone(f, 0.22, 'triangle', 0.1);
    }, 240);
  }

  stopBassline() {
    if (this.bassTimer) {
      clearInterval(this.bassTimer);
      this.bassTimer = null;
    }
  }
}
