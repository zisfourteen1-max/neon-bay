// NEON BAY — every sound is synthesized with WebAudio: no audio files, no
// network. Engine hum, sirens, gunshots, punches, pickups and mission jingles.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
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
  }

  noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = vol || 0.3;
    if (lowpass) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      src.connect(filter);
      filter.connect(gain);
    } else {
      src.connect(gain);
    }
    gain.connect(this.master);
    src.start(t);
  }

  shoot() {
    this.noise(0.14, 0.5, 1800);
    this.tone(180, 0.1, 'square', 0.15, 60);
  }

  punch() {
    this.noise(0.09, 0.35, 700);
  }

  reload() {
    this.tone(500, 0.05, 'square', 0.1);
    setTimeout(() => this.tone(700, 0.05, 'square', 0.1), 90);
  }

  pickup() {
    this.tone(660, 0.09, 'sine', 0.2);
    setTimeout(() => this.tone(880, 0.12, 'sine', 0.2), 90);
  }

  crash() {
    this.noise(0.25, 0.4, 500);
  }

  missionStart() {
    [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'triangle', 0.22), i * 110));
  }

  missionComplete() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.tone(f, 0.2, 'triangle', 0.24), i * 120));
  }

  missionFail() {
    [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'sawtooth', 0.14), i * 140));
  }

  busted() {
    [330, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'sawtooth', 0.16), i * 180));
  }

  // A two-tone siren that follows the wanted level; call every frame.
  siren(on, dt) {
    if (!this.ctx) return;
    if (!on) {
      if (this.sirenOsc) {
        try { this.sirenOsc.stop(); } catch (e) { /* already stopped */ }
        this.sirenOsc = null;
        this.sirenGain = null;
      }
      return;
    }
    if (!this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain.gain.value = this.muted ? 0 : 0.05;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenPhase = 0;
    }
    this.sirenPhase = (this.sirenPhase || 0) + dt;
    const f = 650 + Math.sin(this.sirenPhase * 4.5) * 220;
    this.sirenOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
    if (this.sirenGain) this.sirenGain.gain.value = this.muted ? 0 : 0.05;
  }

  // Engine hum that follows the driven car's speed; call every frame.
  engine(speedRatio, driving) {
    if (!this.ctx) return;
    if (!driving) {
      if (this.engineOsc) {
        try { this.engineOsc.stop(); } catch (e) { /* already stopped */ }
        this.engineOsc = null;
        this.engineGain = null;
      }
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 60;
      this.engineGain.gain.value = this.muted ? 0 : 0.04;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    this.engineOsc.frequency.setTargetAtTime(55 + speedRatio * 140, this.ctx.currentTime, 0.08);
    if (this.engineGain) this.engineGain.gain.value = this.muted ? 0 : 0.03 + speedRatio * 0.04;
  }

  // A lazy sunset bassline that loops quietly under the game.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [110, 110, 130.8, 98, 110, 146.8, 130.8, 98];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const f = bass[this.musicStep % bass.length];
      this.musicStep += 1;
      this.tone(f, 0.5, 'triangle', 0.07);
      if (this.musicStep % 4 === 1) this.tone(f * 2, 0.3, 'sine', 0.04);
    }, 420);
  }
}
