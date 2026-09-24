// Browsertest: lädt den Build über einen Webserver, prüft Konsole und HTTP-Status, macht Bildschirmfotos.
// Aufruf: node tests/browser.mjs [URL] [Ausgabeordner]
import { chromium } from "playwright";
const url = process.argv[2] ?? "http://127.0.0.1:8765/tests/claude-opus-5-5/";
const out = process.argv[3] ?? "./test-bilder";
const schritte = (process.argv[4] ?? "2,start,6,12,20,30").split(",");
import { mkdirSync } from "node:fs";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PFAD || undefined, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const fehler = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") fehler.push(m.type() + ": " + m.text()); });
page.on("pageerror", (e) => fehler.push("pageerror: " + e.message));
page.on("response", (r) => { if (r.status() >= 400) fehler.push("HTTP " + r.status() + " " + r.url()); });
page.on("requestfailed", (r) => fehler.push("failed " + r.url()));
await page.goto(url, { waitUntil: "load" });
let t0 = Date.now();
for (const s of schritte) {
  if (s === "start") { await page.keyboard.press("Space"); t0 = Date.now(); continue; }
  if (s.startsWith("klick:")) { await page.click(s.slice(6)); continue; }
  const ziel = Number(s) * 1000;
  const warte = ziel - (Date.now() - t0);
  if (warte > 0) await page.waitForTimeout(warte);
  const info = await page.evaluate(() => { const z = window.__lotto?.ziehung; return z ? { phase: z.phase, t: z.t.toFixed(1), zahlen: z.zahlen.join(","), fps: window.__lotto.buehne.hochwertig } : null; });
  console.log("t=" + s, JSON.stringify(info));
  await page.screenshot({ path: `${out}/bild-${s.padStart(3, "0")}.png` });
}
console.log(fehler.length ? "FEHLER:\n" + fehler.join("\n") : "Keine Konsolenfehler, alle Anfragen OK");
await browser.close();
