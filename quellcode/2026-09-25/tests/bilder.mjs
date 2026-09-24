// Bildprüfung einzelner Einstellungen per Vorspulen: node tests/bilder.mjs <ausgabe> <plan>
// plan: "tv;start;spule:30;foto:a;warte:1;foto:b" …
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const out = process.argv[2];
const plan = (process.argv[3] ?? "").split(";").filter(Boolean);
const url = process.env.URL ?? "http://127.0.0.1:8765/tests/2026-09-25/";
mkdirSync(out, { recursive: true });
const gpu = process.env.GPU === "1";
const browser = await chromium.launch({
  executablePath: (gpu ? process.env.CHROME_VOLL : process.env.CHROME_PFAD) || undefined,
  args: gpu ? ["--use-gl=angle", "--use-angle=gl", "--ignore-gpu-blocklist", "--enable-gpu"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: Number(process.env.B ?? 1280), height: Number(process.env.H ?? 800) } });
const fehler = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") fehler.push(m.type() + ": " + m.text()); });
page.on("pageerror", (e) => fehler.push("pageerror: " + e.message));
page.on("response", (r) => { if (r.status() >= 400) fehler.push("HTTP " + r.status() + " " + r.url()); });
await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(1500);
for (const s of plan) {
  const [cmd, arg, arg2] = s.split(":");
  if (cmd === "start") { await page.keyboard.press("Space"); await page.evaluate(() => window.__lotto.halten(true)); }
  else if (cmd === "stop") await page.keyboard.press("Space");
  else if (cmd === "klick") await page.click(arg);
  else if (cmd === "taste") await page.keyboard.press(arg);
  else if (cmd === "warte") await page.waitForTimeout(Number(arg) * 1000);
  else if (cmd === "spule") console.log("spule", arg, JSON.stringify(await page.evaluate(([a, b]) => window.__lotto.vorspulen(Number(a), b || undefined), [arg, arg2])));
  else if (cmd === "foto") { await page.waitForTimeout(300); await page.screenshot({ path: `${out}/${arg}.png` }); console.log("foto", arg, JSON.stringify(await page.evaluate(() => { const z = window.__lotto.ziehung; return { phase: z.phase, sub: z.sub, t: +z.t.toFixed(2), zahlen: z.zahlen.join(","), superzahl: z.superzahl }; }))); }
  else if (cmd === "eval") console.log(await page.evaluate(arg));
}
console.log(fehler.length ? "FEHLER:\n" + fehler.join("\n") : "Keine Konsolenfehler, alle Anfragen OK");
await browser.close();
