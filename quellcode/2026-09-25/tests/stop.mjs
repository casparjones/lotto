// Stop/Start/Reset im Browser: Stop friert ein, Start setzt exakt fort, Reset stellt BEREIT her.
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: process.env.CHROME_VOLL || undefined, args: ["--use-gl=angle", "--use-angle=gl", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const fehler = [];
p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") fehler.push(m.text()); });
p.on("pageerror", (e) => fehler.push(e.message));
await p.goto(process.env.URL ?? "http://127.0.0.1:8765/tests/2026-09-25/");
await p.waitForTimeout(1000);
const info = () => p.evaluate(() => { const z = window.__lotto.ziehung; return { phase: z.phase, t: z.t, zahlen: z.zahlen.join(","), s: z.superzahl, pos: z.welt.kugeln.slice(0, 3).map((k) => k.px.toFixed(6)).join("|") }; });
for (let runde = 0; runde < 3; runde++) {
  await p.keyboard.press("Space");
  await p.waitForTimeout(4000 + runde * 3000);
  await p.keyboard.press("Space"); // Stop
  const a = await info();
  await p.waitForTimeout(1500);
  const c = await info();
  console.log(`Runde ${runde}: Stop bei t=${a.t.toFixed(2)} (${a.phase}); nach 1,5 s t=${c.t.toFixed(2)}, Lage gleich: ${a.pos === c.pos}`);
  await p.keyboard.press("Space"); // Fortsetzen
  await p.waitForTimeout(2000);
  await p.evaluate(() => window.__lotto.vorspulen(400));
  const e = await info();
  console.log(`   Ergebnis ${e.zahlen} | ${e.s}  (${e.phase})`);
  await p.keyboard.press("r");
  const r = await info();
  const dom = await p.evaluate(() => [...document.querySelectorAll(".feld")].map((f) => f.textContent).join("") + "|" + document.getElementById("tafel").hidden);
  console.log(`   Reset: ${r.phase}, t=${r.t}, Felder leer & Tafel weg: ${dom === "|true"}`);
}
console.log(fehler.length ? "FEHLER: " + fehler.join("\n") : "Keine Konsolenfehler");
await b.close();
