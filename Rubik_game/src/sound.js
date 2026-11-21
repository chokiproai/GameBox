export class SoundEngine {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.lastTurnAt = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.56;
      this.master.connect(this.ctx.destination);
      this.noise = this._makeNoiseBuffer();
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    } catch {
      this.ctx = null;
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (this.enabled) this.init();
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  _makeNoiseBuffer() {
    const length = Math.floor(this.ctx.sampleRate * 0.12);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  _ready() {
    return Boolean(this.enabled && this.ctx && this.master);
  }

  _noiseBurst(at, duration, frequency, gainValue, pan = 0) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 1.1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(gainValue, at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

    let output = gain;
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      gain.connect(panner);
      output = panner;
    }

    source.connect(filter);
    filter.connect(gain);
    output.connect(this.master);
    source.start(at);
    source.stop(at + duration + 0.02);
  }

  turn(pan = 0) {
    if (!this._ready()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (now - this.lastTurnAt < 0.025) return;
    this.lastTurnAt = now;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 380;

    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(72, now + 0.1);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.065, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.15);

    this._noiseBurst(now, 0.045, 2500, 0.026, pan);
    this._noiseBurst(now + 0.075, 0.055, 1800, 0.015, pan);

    const tickAt = now + 0.105;
    const tick = ctx.createOscillator();
    tick.type = "triangle";
    const tickGain = ctx.createGain();
    tick.frequency.setValueAtTime(1150, tickAt);
    tick.frequency.exponentialRampToValueAtTime(640, tickAt + 0.035);
    tickGain.gain.setValueAtTime(0.0001, tickAt);
    tickGain.gain.exponentialRampToValueAtTime(0.018, tickAt + 0.003);
    tickGain.gain.exponentialRampToValueAtTime(0.0001, tickAt + 0.055);
    tick.connect(tickGain);
    tickGain.connect(this.master);
    tick.start(tickAt);
    tick.stop(tickAt + 0.07);
  }

  ui() {
    if (!this._ready()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(510, now + 0.055);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.017, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  detent() {
    if (!this._ready()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1480, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.025);
    filter.type = "highpass";
    filter.frequency.value = 640;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.0085, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  solved() {
    if (!this._ready()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.08;
    const notes = [
      [523.25, 0, 1.2],
      [783.99, 0.12, 1.4],
      [1046.5, 0.24, 1.8],
      [1318.5, 0.38, 1.5],
    ];

    notes.forEach(([frequency, delay, length]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = "sine";
      osc.frequency.value = frequency;
      filter.type = "lowpass";
      filter.frequency.value = 2400;
      const at = now + delay;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.032, at + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      osc.start(at);
      osc.stop(at + length + 0.05);
    });

    this._noiseBurst(now, 0.18, 6000, 0.006, 0);
  }
}
