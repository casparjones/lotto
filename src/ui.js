import { PHASES } from "./config.js";
const $ = (id) => document.getElementById(id);
export class UI {
  constructor(drawing, director, studio, sound) {
    this.d = drawing;
    this.speed = 1;
    this.director = director;
    this.studio = studio;
    this.sound = sound;
    $("results").innerHTML = Array.from(
      { length: 6 },
      () => '<div class="number">–</div>',
    ).join("");
    $("start").onclick = () => drawing.start();
    $("stop").onclick = () => drawing.stop();
    $("reset").onclick = () => this.reset();
    $("seed").onchange = () => this.reset();
    for (const speed of [1, 2])
      $("speed" + speed).onclick = () => {
        this.speed = speed;
        for (const n of [1, 2])
          $("speed" + n).setAttribute("aria-pressed", String(n === speed));
      };
    for (const mode of ["director", "free"])
      $(mode).onclick = () => {
        director.setFree(mode === "free");
        $("director").setAttribute("aria-pressed", String(mode === "director"));
        $("free").setAttribute("aria-pressed", String(mode === "free"));
      };
    $("tv").onclick = () => {
      const on = document.querySelector(".studio").classList.toggle("tv");
      $("tv").setAttribute("aria-pressed", String(on));
      $("flicker-label").hidden = !on;
      studio.resize();
    };
    $("flicker").onchange = () =>
      document
        .querySelector(".studio")
        .classList.toggle("flicker", $("flicker").checked);
    $("sound").onclick = async () => {
      try {
        const on = await sound.toggle();
        $("sound").setAttribute("aria-pressed", String(on));
        $("sound").querySelector("span").textContent = on
          ? "Ton an"
          : "Ton aus";
      } catch {
        $("notice").textContent =
          "Audio ist in diesem Browser nicht verfügbar.";
      }
    };
    window.addEventListener("keydown", (e) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(e.target.tagName) ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.repeat
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        drawing.running ? drawing.stop() : drawing.start();
      }
      if (e.key.toLowerCase() === "r") this.reset();
    });
    this.refresh(drawing);
  }
  reset() {
    this.d.reset($("seed").value || "1993");
    this.studio.rebuildBalls();
    this.director.reset();
    this.refresh(this.d);
  }
  refresh(d) {
    $("phase").textContent = d.phase;
    $("phase-description").textContent =
      d.running || d.phase === "BEREIT" || d.phase === "ENDE"
        ? PHASES[d.phase]
        : "Pausiert. Start setzt die Ziehung fort.";
    $("broadcast-status").textContent =
      d.phase === "BEREIT"
        ? "STUDIO BEREIT"
        : d.phase === "ENDE"
          ? "ZIEHUNG BEENDET"
          : d.running
            ? "ZIEHUNG LÄUFT"
            : "PAUSE";
    $("start").disabled = d.running || d.completed;
    $("start").querySelector("span").textContent =
      d.phase === "BEREIT" ? "Start" : "Fortsetzen";
    $("stop").disabled = !d.running;
    $("seed").disabled = d.phase !== "BEREIT";
    const nums =
      d.phase === "ENDE"
        ? [...d.numbers.slice(0, 6)].sort((a, b) => a - b)
        : d.numbers;
    [...$("results").children].forEach((el, i) => {
      el.textContent = nums[i] ?? "–";
      el.classList.toggle("filled", nums[i] !== undefined);
    });
    for (const [id, n] of [
      ["extra-number", d.numbers[6]],
      ["super-number", d.superNumber],
    ]) {
      $(id).textContent = n ?? "–";
      $(id).classList.toggle("filled", n !== null && n !== undefined);
    }
    $("result-caption").textContent =
      d.phase === "ENDE"
        ? "GEWINNZAHLEN · AUFSTEIGEND SORTIERT"
        : "DIE GEWINNZAHLEN";
    $("notice").textContent = d.notice;
    const announcement = `${d.phase}. ${PHASES[d.phase]}${d.superNumber !== null ? ` Superzahl ${d.superNumber}.` : ""}${d.phase === "ANZEIGE" ? ` ${d.numbers.length === 7 ? "Zusatzzahl" : "Gewinnzahl"} ${d.numbers.at(-1)}.` : ""}${d.phase === "ENDE" ? ` Gewinnzahlen ${nums.slice(0, 6).join(", ")}. Zusatzzahl ${d.numbers[6]}. Superzahl ${d.superNumber}.` : ""}`;
    if ($("announcer").textContent !== announcement)
      $("announcer").textContent = announcement;
  }
  tick() {
    const time = Math.floor(this.d.elapsed);
    $("elapsed").innerHTML =
      `${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")} <span>/ ZIEHUNGSZEIT</span>`;
  }
}
