// Bedienoberfläche und Einblendungen (Bauchbinde, Störungsanzeige, Schlusstafel, Live-Region).
import { PHASEN_TEXT } from "./ablauf.js";

const $ = (id) => document.getElementById(id);

export class Oberflaeche {
  constructor(aktionen) {
    this.a = aktionen;
    this.rahmen = $("rahmen");
    this.felder = [];
    const box = $("felder");
    for (let i = 0; i < 6; i++) {
      const f = document.createElement("div");
      f.className = "feld";
      box.appendChild(f);
      this.felder.push(f);
    }
    this.felder.push($("feld-zusatz"));
    this.feldSuper = $("feld-super");
    this.bStart = $("b-start");
    this.bStop = $("b-stop");
    this.seed = $("seed");
    this.stoerTimer = 0;

    this.bStart.addEventListener("click", () => this.a.start());
    this.bStop.addEventListener("click", () => this.a.stop());
    $("b-reset").addEventListener("click", () => this.a.reset());
    $("b-1x").addEventListener("click", () => this.a.tempo(1));
    $("b-2x").addEventListener("click", () => this.a.tempo(2));
    $("b-regie").addEventListener("click", () => this.a.kamera("regie"));
    $("b-frei").addEventListener("click", () => this.a.kamera("frei"));
    $("b-tv").addEventListener("click", () => this.a.tv());
    $("b-flimmern").addEventListener("click", () => this.a.flimmern());
    $("b-warm").addEventListener("click", () => this.a.warm());
    $("b-ton").addEventListener("click", () => this.a.ton());
    this.seed.addEventListener("change", () => this.a.seed(this.seed.value));
    this.seed.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { this.seed.blur(); this.a.seed(this.seed.value); }
    });

    window.addEventListener("keydown", (e) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.code === "Space") {
        // fokussierte Buttons nicht doppelt auslösen
        if (el && el.tagName === "BUTTON") el.blur();
        e.preventDefault();
        this.a.startStop();
      } else if (e.key === "r" || e.key === "R") {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault();
        this.a.reset();
      }
    });
  }

  setzeRahmen(r) {
    const s = this.rahmen.style;
    s.left = r.x + "px";
    s.top = r.y + "px";
    s.width = r.w + "px";
    s.height = r.h + "px";
    s.setProperty("--fh", r.h + "px");
  }

  schalter(id, an) {
    const b = $(id);
    b.classList.toggle("an", an);
    b.setAttribute("aria-pressed", an ? "true" : "false");
  }

  zustand({ laeuft, phase, fertig }) {
    this.bStart.disabled = laeuft || fertig;
    this.bStop.disabled = !laeuft;
    this.bStart.firstChild.textContent = phase === "BEREIT" ? "Start " : "Weiter ";
    this.seed.disabled = phase !== "BEREIT";
  }

  phase(name, sub) {
    const t = PHASEN_TEXT[name] || name;
    $("phase-text").textContent = t;
    $("status-phase").textContent = name;
    document.body.dataset.phase = name;
  }

  zahl(index, nummer) {
    const f = index === 7 ? this.feldSuper : this.felder[index];
    if (!f) return;
    f.textContent = String(nummer);
    f.classList.remove("neu");
    void f.offsetWidth;
    f.classList.add("voll", "neu");
  }

  leeren() {
    for (const f of [...this.felder, this.feldSuper]) {
      f.textContent = "";
      f.classList.remove("voll", "neu");
    }
    $("tafel").hidden = true;
    $("stoerung").hidden = true;
    this.hinweis(null);
  }

  stoerung(text) {
    const el = $("stoerung");
    el.textContent = text;
    el.hidden = false;
    clearTimeout(this.stoerTimer);
    this.stoerTimer = setTimeout(() => (el.hidden = true), 3500);
  }

  hinweis(text) {
    const el = $("hinweis");
    if (!text) { el.hidden = true; return; }
    el.textContent = text;
    el.hidden = false;
    clearTimeout(this.hinweisTimer);
    this.hinweisTimer = setTimeout(() => (el.hidden = true), 5000);
  }

  tafel(zahlen, superzahl, seed) {
    const sechs = zahlen.slice(0, 6).sort((a, b) => a - b);
    const box = $("tafel-zahlen");
    box.innerHTML = "";
    for (const n of sechs) {
      const d = document.createElement("div");
      d.className = "kugel";
      d.textContent = String(n);
      box.appendChild(d);
    }
    $("tafel-zusatz").textContent = String(zahlen[6]);
    $("tafel-super").textContent = String(superzahl);
    $("tafel-seed").textContent = seed;
    $("tafel").hidden = false;
  }

  ansage(text) {
    // mehrere Meldungen eines Frames zusammenfassen; neu setzen, damit auch Wiederholungen vorgelesen werden
    if (!this.ansageListe) {
      this.ansageListe = [];
      requestAnimationFrame(() => {
        const el = $("ansage");
        el.textContent = this.ansageListe.join(" ");
        this.ansageListe = null;
      });
    }
    this.ansageListe.push(text);
  }
}
