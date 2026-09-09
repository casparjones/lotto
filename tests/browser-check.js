import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("http://localhost:5173");
  await page.waitForFunction(() => !!window.__lotto);
  if (process.argv.includes("--layout")) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    console.log(
      await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        elements: [...document.querySelectorAll("body *")]
          .filter((el) => el.getBoundingClientRect().right > innerWidth)
          .map((el) => ({
            tag: el.tagName,
            id: el.id,
            cls: el.className,
            right: el.getBoundingClientRect().right,
            width: el.getBoundingClientRect().width,
          })),
      })),
    );
    await page.screenshot({ path: "/tmp/lotto-mobile.png", fullPage: true });
    await browser.close();
    process.exit(0);
  }

  await page.waitForTimeout(1000);
  await page.screenshot({ path: "/tmp/lotto-ready.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.locator("#start").click();
  await page.waitForTimeout(150);
  await page.locator("#stop").click();
  const paused = await page.evaluate(() => ({
    time: window.__lotto.drawing.elapsed,
    camera: window.__lotto.studio.camera.position.toArray(),
  }));
  await page.waitForTimeout(150);
  assert.deepEqual(
    await page.evaluate(() => ({
      time: window.__lotto.drawing.elapsed,
      camera: window.__lotto.studio.camera.position.toArray(),
    })),
    paused,
  );
  await page.locator("#reset").click();
  assert.equal(await page.locator("#phase").textContent(), "BEREIT");
  await page.locator("#speed2").click();
  assert.equal(await page.evaluate(() => window.__lotto.ui.speed), 2);
  await page.locator("#speed1").click();
  await page.locator("#free").click();
  assert.equal(await page.evaluate(() => window.__lotto.director.free), true);
  await page.locator("#director").click();
  await page.locator("#tv").click();
  const ratio = await page.evaluate(() => {
    const r = document.querySelector("#viewport").getBoundingClientRect();
    return r.width / r.height;
  });
  assert.ok(Math.abs(ratio - 4 / 3) < 0.01);
  await page.screenshot({ path: "/tmp/lotto-tv.png", fullPage: true });
  await page.locator("#tv").click();
  await page.locator("#sound").click();
  assert.equal(
    await page.locator("#sound").getAttribute("aria-pressed"),
    "true",
  );
  await page.locator("#sound").click();
  await page.evaluate(() => {
    const { drawing, studio, director } = window.__lotto;
    drawing.start();
    while (drawing.phase !== "ANZEIGE" && drawing.elapsed < 60) drawing.step();
    studio.update(0);
    director.update(10, drawing);
    drawing.stop();
    studio.render();
  });
  assert.equal(await page.locator("#phase").textContent(), "ANZEIGE");
  await page.screenshot({ path: "/tmp/lotto-close.png", fullPage: true });
  const result = await page.evaluate(() => {
    const { drawing, studio, director } = window.__lotto;
    drawing.start();
    while (drawing.running && drawing.elapsed < 360) drawing.step();
    studio.update(0);
    director.reset();
    studio.render();
    return {
      phase: drawing.phase,
      numbers: drawing.numbers,
      super: drawing.superNumber,
      duration: drawing.elapsed,
    };
  });
  assert.equal(result.phase, "ENDE");
  assert.equal(new Set(result.numbers).size, 7);
  assert.ok(result.super >= 0 && result.super <= 9);
  await page.screenshot({ path: "/tmp/lotto-end.png", fullPage: true });
  await page.locator("#reset").click();
  await page.locator("#speed2").click();
  const repeated = await page.evaluate(() => {
    const d = window.__lotto.drawing;
    d.start();
    while (d.running && d.elapsed < 360) {
      d.step();
      if (d.running) d.step();
    }
    return {
      phase: d.phase,
      numbers: d.numbers,
      super: d.superNumber,
      duration: d.elapsed,
    };
  });
  assert.deepEqual(repeated, result, "Chrome: gleicher Seed nach Reset bei 2×");
  await page.locator("#reset").click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page.evaluate(() => window.__lotto.director.reduced.matches),
    true,
  );
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({ path: "/tmp/lotto-tablet.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Chrome-Abnahme bestanden:",
    browser.version(),
    result,
    "Fehler:",
    errors,
  );
  console.log(
    "Automatisch vereinfachte Grafik:",
    await page.evaluate(() =>
      document.querySelector(".studio").classList.contains("low-quality"),
    ),
  );
} finally {
  await browser.close();
}
