import assert from "node:assert/strict";
import { Drawing } from "../src/state.js";
import { CONFIG as K } from "../src/config.js";
const d = new Drawing();
d.reset(process.argv[2] || "1993");
d.start();
const stats = { MISCHEN: [], ZIEHEN: [] };
let last = 0;
for (let i = 0; i < 120 * 210 && d.running; i++) {
  d.step();
  const m = d.physics.machines[0];
  const a = ((m.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const threshold = d.phase === "MISCHEN" ? Math.PI / 2 : Math.PI / 4;
  if (
    (d.phase === "MISCHEN" && last > threshold && a <= threshold) ||
    (d.phase === "ZIEHEN" && last < threshold && a >= threshold)
  ) {
    const n = d.physics.balls.filter((b) => {
      const dx = b.body.position.x - m.center[0],
        dy = b.body.position.y - m.center[1];
      const lx = Math.cos(m.angle) * dx + Math.sin(m.angle) * dy,
        ly = -Math.sin(m.angle) * dx + Math.cos(m.angle) * dy;
      return (
        b.machine === 0 &&
        b.state === "free" &&
        Math.abs(lx - (m.radius - 0.052)) < 0.045 &&
        Math.abs(ly) < 0.04 &&
        Math.abs(b.body.position.z - m.center[2]) < 0.05
      );
    }).length;
    stats[d.phase].push(n);
  }
  last = a;
}
console.log(
  stats,
  Object.fromEntries(
    Object.entries(stats).map(([k, v]) => [
      k,
      v.reduce((a, b) => a + b, 0) / v.length,
    ]),
  ),
);

const mean = (a) => a.reduce((sum, n) => sum + n, 0) / a.length;
assert.ok(
  stats.MISCHEN.length > 0 && mean(stats.MISCHEN) < 0.5,
  "Zu viele Kugeln über dem Scheitel in Mischrichtung",
);
assert.ok(
  stats.ZIEHEN.length > 0 && mean(stats.ZIEHEN) >= 1 && mean(stats.ZIEHEN) <= 4,
  "Ziehrichtung trägt im Mittel nicht 1–4 Kugeln",
);
assert.ok(Math.max(...stats.ZIEHEN) <= 4, "Mehr als vier Kugeln am Auslass");
