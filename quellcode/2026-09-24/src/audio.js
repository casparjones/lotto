import { CONFIG as K } from "./config.js";
export class Sound {
  constructor() {
    this.enabled = false;
    this.lastImpact = 0;
  }
  async toggle() {
    if (!this.context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      this.context = new Audio();
      this.gain = this.context.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(this.context.destination);
      this.motor = this.context.createOscillator();
      this.motor.type = "sine";
      this.motor.frequency.value = K.audio.motorHz;
      this.motor.connect(this.gain);
      this.motor.start();
      this.noise = this.context.createBuffer(
        1,
        this.context.sampleRate * K.audio.noiseDuration,
        this.context.sampleRate,
      );
      const data = this.noise.getChannelData(0); // Deterministisches Rauschsignal, unabhängig von Simulationszustand und Seed.
      for (let i = 0; i < data.length; i++)
        data[i] =
          Math.sin(i * i * K.audio.noisePhase) *
          Math.exp((-i / data.length) * K.audio.noiseDecay);
    }
    await this.context.resume();
    this.enabled = !this.enabled;
    if (!this.enabled)
      this.gain.gain.setTargetAtTime(
        0,
        this.context.currentTime,
        K.audio.muteRamp,
      );
    return this.enabled;
  }
  update(omega) {
    if (!this.enabled) return;
    this.motor.frequency.setTargetAtTime(
      K.audio.motorHz + Math.abs(omega) * K.audio.frequencyFactor,
      this.context.currentTime,
      K.audio.frequencyRamp,
    );
    this.gain.gain.setTargetAtTime(
      Math.min(1, Math.abs(omega) / Math.PI) * K.audio.motorGain,
      this.context.currentTime,
      K.audio.gainRamp,
    );
  }
  impact(speed) {
    if (
      !this.enabled ||
      this.context.currentTime - this.lastImpact < K.audio.impactInterval
    )
      return;
    this.lastImpact = this.context.currentTime;
    const source = this.context.createBufferSource(),
      gain = this.context.createGain();
    source.buffer = this.noise;
    gain.gain.value = Math.min(speed, K.audio.impactLimit) * K.audio.impactGain;
    source.connect(gain);
    gain.connect(this.context.destination);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
    source.start();
  }
}
