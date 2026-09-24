// Synthetischer Ton (Web Audio): Motorbrummen nach Drehzahl, Kugelrasseln aus den
// Kollisionsereignissen der Physik, hohles Klacken beim Fall ins Glasröhrchen. Kein Musikbett.
// Standardmäßig aus; der AudioContext entsteht erst beim Klick auf „Ton".
import { CONFIG } from "./config.js";

export class Ton {
  constructor() {
    this.ctx = null;
    this.an = false;
  }

  aufbauen() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    const c = (this.ctx = new Ctx());
    this.master = c.createGain();
    this.master.gain.value = 0;
    const komp = c.createDynamicsCompressor();
    komp.threshold.value = -18;
    komp.ratio.value = 4;
    this.master.connect(komp).connect(c.destination);
    // Motor: Sägezahn + Oberton durch Tiefpass
    this.motorGain = c.createGain();
    this.motorGain.gain.value = 0;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    lp.Q.value = 0.8;
    this.osc1 = c.createOscillator();
    this.osc1.type = "sawtooth";
    this.osc2 = c.createOscillator();
    this.osc2.type = "triangle";
    const g2 = c.createGain();
    g2.gain.value = 0.35;
    this.osc1.connect(lp);
    this.osc2.connect(g2).connect(lp);
    lp.connect(this.motorGain).connect(this.master);
    this.osc1.start();
    this.osc2.start();
    // Rauschen für Klicks
    const len = c.sampleRate;
    this.rauschen = c.createBuffer(1, len, c.sampleRate);
    const d = this.rauschen.getChannelData(0);
    let x = 1;
    for (let i = 0; i < len; i++) {
      x = (x * 16807) % 2147483647; // eigener Generator, unabhängig von der Physik
      d[i] = (x / 2147483647) * 2 - 1;
    }
    this.klickNr = 0;
    return true;
  }

  async umschalten() {
    if (!this.ctx && !this.aufbauen()) return false;
    this.an = !this.an;
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.master.gain.setTargetAtTime(this.an ? 1 : 0, this.ctx.currentTime, 0.05);
    return this.an;
  }

  /** upm: Drehzahlen der Geräte; rassel: Summe v² der Aufpralle; anzahl: Zahl der Aufpralle. */
  update(dt, upm, rassel, anzahl, klacks) {
    if (!this.ctx || !this.an) return;
    const A = CONFIG.audio, c = this.ctx, t = c.currentTime;
    const u = Math.min(60, Math.max(...upm.map(Math.abs)));
    const f = A.motorBasis + A.motorProUpm * u;
    this.osc1.frequency.setTargetAtTime(f, t, 0.08);
    this.osc2.frequency.setTargetAtTime(f * 2.01, t, 0.08);
    this.motorGain.gain.setTargetAtTime(A.motorLautstaerke * Math.min(1, u / 25), t, 0.15);
    const n = Math.min(A.rasselMax, anzahl);
    if (n > 0) {
      const e = Math.sqrt(rassel / anzahl);
      for (let i = 0; i < n; i++) this.klick(t + (i / n) * dt, Math.min(1, e * 1.4) * A.rasselLautstaerke);
    }
    for (const k of klacks) this.klack(t, Math.min(1, k.staerke / 1.5) * A.klackLautstaerke);
  }

  klick(t, laut) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.rauschen;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    this.klickNr = (this.klickNr + 1) % 97;
    bp.frequency.value = 2400 + ((this.klickNr * 53) % 97) * 45;
    bp.Q.value = 4;
    const g = c.createGain();
    g.gain.setValueAtTime(laut, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.025);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t, (this.klickNr / 97) * 0.9, 0.03);
  }

  klack(t, laut) {
    const c = this.ctx;
    for (const [f, a, d] of [[980, 1, 0.09], [2350, 0.5, 0.05], [520, 0.4, 0.14]]) {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.92, t + d);
      const g = c.createGain();
      g.gain.setValueAtTime(laut * a, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + d);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + d + 0.02);
    }
    this.klick(t, laut * 0.8);
  }
}
