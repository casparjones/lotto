import { CONFIG as K } from "./config.js";
import { Physics } from "./physics.js";
export class Drawing {
  constructor({ onChange = () => {}, onImpact = () => {} } = {}) {
    this.onChange = onChange;
    this.physics = new Physics("1993", onImpact);
    this.reset("1993");
  }
  reset(seed) {
    this.physics.reset(seed);
    this.phase = "BEREIT";
    this.phaseTime = 0;
    this.elapsed = 0;
    this.running = false;
    this.completed = false;
    this.numbers = [];
    this.superNumber = null;
    this.current = null;
    this.superHold = null;
    this.notice = "";
    this.onChange(this);
  }
  start() {
    if (this.completed) return;
    this.running = true;
    if (this.phase === "BEREIT") this.transition("EINWURF");
    this.onChange(this);
  }
  stop() {
    this.running = false;
    this.onChange(this);
  }
  transition(phase) {
    this.phase = phase;
    this.phaseTime = 0;
    this.onChange(this);
  }
  step() {
    if (!this.running) return;
    const dt = K.dt;
    this.elapsed += dt;
    this.phaseTime += dt;
    const m = this.physics.machines[0],
      s = this.physics.machines[1];
    const rpm = (Math.PI * 2) / 60;
    const small = this.phase === "SUPERZAHL";
    m.target =
      this.phase === "MISCHEN"
        ? -K.drum.mixRpm * rpm * m.boost
        : this.phase === "ZIEHEN"
          ? K.drum.drawRpm * rpm * m.boost
          : 0;
    s.target = small
      ? (this.phaseTime < K.timing.superMix ? -K.drum.mixRpm : K.drum.drawRpm) *
        rpm *
        s.boost
      : 0;
    const caught = this.physics.step(dt, {
      load: this.phase === "EINWURF",
      draw: this.phase === "ZIEHEN",
      smallDraw: small && this.phaseTime >= K.timing.superMix && !this.current,
      gate: small
        ? this.phaseTime > K.timing.superMix
        : this.phaseTime > K.timing.drawGate,
    });
    if (
      this.phase === "EINWURF" &&
      this.phaseTime >= K.timing.load + K.timing.loadSettle
    )
      this.transition("MISCHEN");
    else if (
      this.phase === "MISCHEN" &&
      this.phaseTime >= (this.numbers.length ? K.timing.mix : K.timing.firstMix)
    )
      this.transition("ZIEHEN");
    else if (this.phase === "ZIEHEN") {
      if (caught) {
        this.current = caught;
        this.physics.startRoute(caught, this.numbers.length);
        this.transition("AUSLAUF");
      } else if (this.phaseTime > K.timing.watchdog) {
        m.boost *= K.timing.boost;
        this.notice = "Neuer Mischzyklus — Drehzahl um 15 % erhöht";
        this.transition("MISCHEN");
      }
    } else if (this.phase === "AUSLAUF") {
      if (
        this.current.state !== "rail" &&
        this.phaseTime > K.timing.tubeWatchdog
      ) {
        this.physics.intervene(this.current);
        this.notice = "Störung — Ziehungsleiter greift ein";
      }
      if (this.current.state === "rail") {
        this.numbers.push(this.current.number);
        this.transition("ANZEIGE");
      }
    } else if (this.phase === "ANZEIGE" && this.phaseTime >= K.timing.display) {
      this.current = null;
      if (this.numbers.length < 7) this.transition("MISCHEN");
      else {
        for (const b of this.physics.balls)
          if (b.machine === 1 && b.state === "tray") this.physics.release(b);
        this.transition("SUPERZAHL");
      }
    } else if (small) {
      if (caught && !this.current) {
        this.current = caught;
        this.physics.startRoute(caught, 0);
        this.routeStart = this.phaseTime;
      }
      if (this.current) {
        if (
          this.current.state !== "rail" &&
          this.phaseTime - this.routeStart > K.timing.tubeWatchdog
        ) {
          this.physics.intervene(this.current);
          this.notice = "Störung — Ziehungsleiter greift ein";
        }
        if (this.current.state === "rail") {
          if (this.superHold === null) {
            this.superNumber = this.current.number;
            this.superHold = this.phaseTime;
            this.onChange(this);
          }
          if (this.phaseTime - this.superHold >= K.timing.display)
            this.transition("ENDE");
        }
      } else if (this.phaseTime > K.timing.superMix + K.timing.watchdog) {
        s.boost *= K.timing.boost;
        this.phaseTime = 0;
        this.notice = "Superzahl: neuer Mischzyklus";
      }
    } else if (
      this.phase === "ENDE" &&
      Math.abs(m.omega) + Math.abs(s.omega) < K.timing.stopThreshold
    ) {
      this.running = false;
      this.completed = true;
      this.onChange(this);
    }
  }
}
