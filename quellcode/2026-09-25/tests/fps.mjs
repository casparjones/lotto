// FPS-Messung mit GPU (headless=new, ANGLE/GL): node tests/fps.mjs
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: process.env.CHROME_VOLL || undefined, headless: true, args: ["--use-gl=angle", "--use-angle=gl", "--ignore-gpu-blocklist", "--enable-gpu"] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto(process.env.URL ?? "http://127.0.0.1:8765/tests/2026-09-25/");
await p.waitForTimeout(1500);
console.log(await p.evaluate(() => { const gl = document.createElement("canvas").getContext("webgl2"); const e = gl.getExtension("WEBGL_debug_renderer_info"); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "?"; }));
await p.keyboard.press("Space");
for (let i = 0; i < 4; i++) {
  const r = await p.evaluate(async () => { let n = 0; const t0 = performance.now(); await new Promise((res) => { const f = () => { n++; performance.now() - t0 < 3000 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); }); const z = window.__lotto.ziehung; return { fps: +(n / 3).toFixed(1), phase: z.phase, t: +z.t.toFixed(1), hoch: window.__lotto.buehne.hochwertig }; });
  console.log(JSON.stringify(r));
}
await b.close();
