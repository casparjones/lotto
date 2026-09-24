import test from "node:test";
import assert from "node:assert/strict";
import { Drawing } from "../src/state.js";
import { CONFIG as K } from "../src/config.js";
function run(seed, batch = 1, pause = false) {
  const d = new Drawing();
  d.reset(seed);
  d.start();
  let steps = 0,
    maxRadius = 0;
  while (d.running && steps < 120 * 360) {
    for (let j = 0; j < batch && d.running; j++) {
      d.step();
      steps++;
      if (steps % 120 === 0)
        for (const b of d.physics.balls) {
          assert.ok(Number.isFinite(b.body.position.x));
          if (b.state === "free") {
            const c = d.physics.machines[b.machine].center,
              r = d.physics.machines[b.machine].radius;
            const length = Math.hypot(
              b.body.position.x - c[0],
              b.body.position.y - c[1],
              b.body.position.z - c[2],
            );
            maxRadius = Math.max(maxRadius, length);
            assert.ok(length <= r - K.ball.radius + 1e-8);
          }
        }
      if (pause && steps % 317 === 0) {
        d.stop();
        const before = JSON.stringify(
          d.physics.balls.map((b) => [
            b.state,
            b.body.position,
            b.body.velocity,
          ]),
        );
        for (let i = 0; i < 25; i++) d.step();
        assert.equal(
          JSON.stringify(
            d.physics.balls.map((b) => [
              b.state,
              b.body.position,
              b.body.velocity,
            ]),
          ),
          before,
        );
        d.start();
      }
    }
  }
  assert.equal(d.phase, "ENDE");
  assert.equal(d.numbers.length, 7);
  assert.equal(new Set(d.numbers).size, 7);
  assert.ok(d.numbers.every((n) => n >= 1 && n <= 49));
  assert.ok(d.superNumber >= 0 && d.superNumber <= 9);
  assert.ok(d.elapsed >= 180 && d.elapsed <= 240, `Laufzeit ${d.elapsed}`);
  return {
    numbers: d.numbers,
    super: d.superNumber,
    steps,
    duration: d.elapsed,
  };
}
test("Vollständige Ziehung; feste Grenzen; 1×, 2× und Pause liefern gleiche Ergebnisse", () => {
  const a = run("1993");
  assert.deepEqual(run("1993", 2), a);
  assert.deepEqual(run("1993", 2, true), a);
  console.log("Seed 1993:", a);
});
test("Weitere Seeds schließen mit gültigen unterschiedlichen Zahlen ab", () => {
  for (const seed of ["Samstag", "2026", "0"]) console.log(seed, run(seed));
});
test("Reset stellt nach wiederholtem Start/Stop sämtliche Anfangsbedingungen her", () => {
  const d = new Drawing();
  d.reset("reset");
  const original = JSON.stringify(
    d.physics.balls.map((b) => [
      b.number,
      b.body.mass,
      b.body.position,
      b.release,
    ]),
  );
  for (let i = 0; i < 10; i++) {
    d.start();
    for (let j = 0; j < 150; j++) d.step();
    d.stop();
    d.reset("reset");
    assert.equal(d.phase, "BEREIT");
    assert.equal(d.elapsed, 0);
    assert.deepEqual(d.numbers, []);
    assert.equal(d.superNumber, null);
    assert.equal(
      JSON.stringify(
        d.physics.balls.map((b) => [
          b.number,
          b.body.mass,
          b.body.position,
          b.release,
        ]),
      ),
      original,
    );
  }
});

test("Störungswächter mischt erneut und gibt eine tatsächlich gefangene Kugel unverändert aus", () => {
  const d = new Drawing();
  d.start();
  while (d.phase !== "ZIEHEN") d.step();
  const physicalStep = d.physics.step.bind(d.physics);
  d.physics.step = (dt, flags) => physicalStep(dt, { ...flags, draw: false });
  while (d.phase === "ZIEHEN") d.step();
  assert.equal(d.phase, "MISCHEN");
  assert.equal(d.physics.machines[0].boost, K.timing.boost);
  assert.deepEqual(d.numbers, []);
  d.physics.step = physicalStep;
  while (d.phase !== "AUSLAUF" && d.elapsed < 120) d.step();
  assert.equal(d.phase, "AUSLAUF");
  const captured = d.current.number,
    advanceRoute = d.physics.advanceRoute;
  d.physics.advanceRoute = () => {};
  while (d.phase === "AUSLAUF") d.step();
  assert.equal(d.phase, "ANZEIGE");
  assert.equal(d.current.state, "rail");
  assert.deepEqual(d.numbers, [captured]);
  assert.match(d.notice, /Störung — Ziehungsleiter greift ein/);
  d.physics.advanceRoute = advanceRoute;
});
