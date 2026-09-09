import "./style.css";
import { CONFIG as K } from "./config.js";
import { Drawing } from "./state.js";
import { Studio } from "./renderer.js";
import { Director } from "./camera.js";
import { Sound } from "./audio.js";
import { UI } from "./ui.js";
const sound = new Sound();
let ui;
const drawing = new Drawing({
  onChange: (d) => ui?.refresh(d),
  onImpact: (v) => sound.impact(v),
});
try {
  const studio = new Studio(document.getElementById("viewport"), drawing),
    director = new Director(studio);
  ui = new UI(drawing, director, studio, sound);
  let previous = performance.now(),
    accumulator = 0,
    frames = 0,
    frameTime = 0,
    low = false;
  function frame(now) {
    requestAnimationFrame(frame);
    const realDt = Math.min((now - previous) / 1000, K.maxFrame);
    previous = now;
    if (document.hidden) {
      accumulator = 0;
      return;
    }
    if (drawing.running) {
      accumulator += realDt * ui.speed;
      let steps = 0;
      while (accumulator >= K.dt && steps < K.maxSteps) {
        drawing.step();
        accumulator -= K.dt;
        steps++;
      }
    } else accumulator = 0;
    studio.update(realDt);
    director.update(realDt, drawing);
    sound.update(
      studio.devices.reduce((sum, d) => sum + Math.abs(d.coast || 0), 0),
    );
    studio.render();
    ui.tick();
    frameTime += realDt;
    frames++;
    if (frameTime >= K.render.qualityWindow) {
      if (frames / frameTime < K.render.minFps && !low) {
        low = true;
        studio.lowerQuality();
        document.querySelector(".studio").classList.add("low-quality");
      }
      frames = 0;
      frameTime = 0;
    }
  }
  requestAnimationFrame(frame);
  // Ausschließlich für reproduzierbare Browser-Abnahmen, ohne Zugriff auf Zufallsquellen.
  window.__lotto = { drawing, studio, director, ui };
} catch (error) {
  document.getElementById("notice").textContent =
    "Das 3D-Studio benötigt WebGL. Bitte aktivieren Sie die Hardwarebeschleunigung und öffnen Sie die Seite erneut.";
  document.getElementById("start").disabled = true;
  console.error(error);
}
