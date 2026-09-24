// Einstieg: verbindet Simulation (Physik + Zustandsautomat), Darstellung, Kameraregie, Oberfläche und Ton.
import "./style.css";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CONFIG } from "./config.js";
import { Ziehung, PHASEN_TEXT } from "./ablauf.js";
import { Buehne } from "./renderer.js";
import { Regie } from "./kamera.js";
import { Oberflaeche } from "./ui.js";
import { Ton } from "./audio.js";

const reduziert = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("leinwand");
const buehne = new Buehne(canvas);
const ton = new Ton();

const zustand = {
  seed: CONFIG.seed.standard,
  laeuft: false,
  tempo: 1,
  modus: "regie",
  akku: 0,
  offsetH: 0, offsetS: 0, // sichtbarer Nachlauf der Trommeln bei Stop
  nachH: 0, nachS: 0, // Winkelgeschwindigkeit des Nachlaufs
  angleichen: 0, // > 0: Nachlauf wird vor dem Fortsetzen zurückgeführt
  fps: { zeit: 0, frames: 0 },
};

let z = new Ziehung(zustand.seed);

const regie = new Regie(buehne.kamera, { reduziert, blende: () => buehne.weicherSchnitt() });
const orbit = new OrbitControls(buehne.kamera, canvas);
orbit.enabled = false;
orbit.enableDamping = true;
orbit.minDistance = 0.25;
orbit.maxDistance = 6;
orbit.maxPolarAngle = Math.PI * 0.49;

const ui = new Oberflaeche({
  start: () => starten(),
  stop: () => anhalten(),
  startStop: () => (zustand.laeuft ? anhalten() : starten()),
  reset: () => zuruecksetzen(),
  tempo: (t) => {
    zustand.tempo = t;
    ui.schalter("b-1x", t === 1);
    ui.schalter("b-2x", t === 2);
  },
  kamera: (m) => kameraModus(m),
  tv: () => {
    buehne.tv = !buehne.tv;
    ui.schalter("b-tv", buehne.tv);
    ui.rahmen.classList.toggle("tv", buehne.tv);
    groesse();
  },
  flimmern: () => {
    buehne.flimmern = !buehne.flimmern && !reduziert;
    ui.schalter("b-flimmern", buehne.flimmern);
  },
  warm: () => {
    buehne.setzeStudio(!buehne.warm);
    ui.schalter("b-warm", buehne.warm);
  },
  ton: async () => {
    const an = await ton.umschalten();
    ui.schalter("b-ton", an);
  },
  seed: (wert) => {
    const s = String(wert).trim() || CONFIG.seed.standard;
    if (z.phase !== "BEREIT") return;
    zustand.seed = s;
    zuruecksetzen();
  },
});
ui.seed.value = zustand.seed;

function kameraModus(m) {
  zustand.modus = m;
  ui.schalter("b-regie", m === "regie");
  ui.schalter("b-frei", m === "frei");
  orbit.enabled = m === "frei";
  if (m === "frei") {
    orbit.target.copy(regie.aktuell.ziel);
    orbit.update();
  } else {
    regie.anwenden();
  }
}

function starten() {
  if (z.fertig || zustand.laeuft) return;
  if (z.phase === "BEREIT") {
    z.starten();
    verarbeiteEreignisse();
  }
  // sichtbaren Nachlauf erst zurückführen, dann exakt fortsetzen
  zustand.angleichen = zustand.offsetH !== 0 || zustand.offsetS !== 0 ? 0.35 : 0;
  zustand.angleichVon = [zustand.offsetH, zustand.offsetS];
  zustand.nachH = zustand.nachS = 0;
  zustand.laeuft = true;
  zustand.akku = 0;
  aktualisiereKnoepfe();
  ui.ansage(z.phase === "EINWURF" && z.phasenZeit === 0 ? "Die Ziehung beginnt." : "Fortsetzung.");
}

function anhalten() {
  if (!zustand.laeuft) return;
  zustand.laeuft = false;
  // Physik und Kamera stehen; die Trommeln laufen sichtbar aus
  zustand.nachH = z.haupt.omega;
  zustand.nachS = z.superT.omega;
  aktualisiereKnoepfe();
  ui.ansage("Angehalten.");
}

function zuruecksetzen() {
  const s = String(ui.seed.value).trim() || CONFIG.seed.standard;
  zustand.seed = s;
  ui.seed.value = s;
  z = new Ziehung(s);
  zustand.laeuft = false;
  zustand.akku = 0;
  zustand.offsetH = zustand.offsetS = zustand.nachH = zustand.nachS = 0;
  zustand.angleichen = 0;
  regie.zuruecksetzen();
  buehne.setzeLupe(null);
  buehne.blende = 0;
  ui.leeren();
  ui.phase("BEREIT");
  aktualisiereKnoepfe();
  ui.ansage("Zurückgesetzt. Bereit.");
}

function aktualisiereKnoepfe() {
  ui.zustand({ laeuft: zustand.laeuft, phase: z.phase, fertig: z.fertig });
}

function ordinal(i) {
  return i < 6 ? `${i + 1}. Gewinnzahl` : i === 6 ? "Zusatzzahl" : "Superzahl";
}

function verarbeiteEreignisse() {
  for (const e of z.ereignisse) {
    regie.ereignis(e, z);
    switch (e.typ) {
      case "phase":
      case "sub":
        ui.phase(e.phase, e.sub);
        if (e.typ === "phase") ui.ansage("Phase: " + (PHASEN_TEXT[e.phase] || e.phase) + ".");
        break;
      case "gelandet":
        ui.zahl(e.index, e.nummer);
        buehne.setzeLupe(z.roehrchenPosition(e.index));
        ui.ansage(`${ordinal(e.index)}: ${e.nummer}.`);
        break;
      case "stoerung":
        ui.stoerung(e.text);
        ui.ansage(e.text + ".");
        break;
      case "waechter":
        ui.hinweis(`Drehzahl +15 % (Faktor ${e.faktor.toFixed(2)}), neuer Mischzyklus`);
        ui.ansage("Keine Kugel gefangen. Drehzahl erhöht, neuer Mischzyklus.");
        break;
      case "ergebnis": {
        ui.tafel(e.zahlen, e.superzahl, z.seed);
        const sechs = e.zahlen.slice(0, 6).sort((a, b) => a - b).join(", ");
        ui.ansage(`Ergebnis: ${sechs}. Zusatzzahl ${e.zahlen[6]}. Superzahl ${e.superzahl}.`);
        break;
      }
      case "fertig":
        zustand.laeuft = false;
        aktualisiereKnoepfe();
        break;
    }
  }
  z.ereignisse.length = 0;
}

// ------------------------------------------------------------ Größe

function groesse() {
  const w = window.innerWidth, h = window.innerHeight;
  const leiste = document.querySelector(".steuerung");
  const reserve = leiste ? leiste.offsetHeight + 20 : 0;
  const r = buehne.groesse(w, h, reserve);
  ui.setzeRahmen(r);
}
window.addEventListener("resize", groesse);
groesse();

// ------------------------------------------------------------ Hauptschleife

const dt = CONFIG.physik.dt;
let letzte = performance.now();
let uhr = 0;

function frame(jetzt) {
  const dtReal = Math.min(0.1, (jetzt - letzte) / 1000);
  letzte = jetzt;
  uhr += dtReal;
  let simDt = 0;

  if (zustand.laeuft && zustand.angleichen > 0) {
    // Nachlauf-Winkel weich zurückführen, Physik wartet
    zustand.angleichen = Math.max(0, zustand.angleichen - dtReal);
    const f = zustand.angleichen / 0.35;
    const e = f * f * (3 - 2 * f);
    zustand.offsetH = zustand.angleichVon[0] * e;
    zustand.offsetS = zustand.angleichVon[1] * e;
  } else if (zustand.laeuft && !zustand.testHalt) {
    zustand.offsetH = zustand.offsetS = 0;
    // fester Zeitschritt: 2× rechnet doppelt so viele Schritte, dt bleibt gleich
    zustand.akku += dtReal * zustand.tempo;
    let n = Math.floor(zustand.akku / dt);
    const max = CONFIG.physik.maxSchritteProFrame * zustand.tempo;
    if (n > max) { n = max; zustand.akku = 0; } else zustand.akku -= n * dt;
    for (let i = 0; i < n && zustand.laeuft; i++) {
      z.schritt();
      simDt += dt;
      if (z.ereignisse.length) verarbeiteEreignisse();
    }
  } else if (zustand.nachH !== 0 || zustand.nachS !== 0) {
    // Stop: Trommeln laufen realistisch aus (gleichmäßig gebremst)
    const brems = (w, w0) => {
      const a = Math.abs(w0) / CONFIG.motor.stopAuslauf;
      const n = Math.abs(w) - a * dtReal;
      return n <= 0 ? 0 : Math.sign(w) * n;
    };
    zustand.offsetH += zustand.nachH * dtReal;
    zustand.offsetS += zustand.nachS * dtReal;
    zustand.nachH0 = zustand.nachH0 || zustand.nachH;
    zustand.nachS0 = zustand.nachS0 || zustand.nachS;
    zustand.nachH = brems(zustand.nachH, zustand.nachH0);
    zustand.nachS = brems(zustand.nachS, zustand.nachS0);
    if (zustand.nachH === 0 && zustand.nachS === 0) zustand.nachH0 = zustand.nachS0 = 0;
  }

  if (simDt > 0) regie.update(simDt);
  if (zustand.modus === "frei") orbit.update();
  else regie.anwenden();

  buehne.aktualisiere(z, { offsetHaupt: zustand.offsetH, offsetSuper: zustand.offsetS, angehalten: !zustand.laeuft && z.phase !== "BEREIT" && !z.fertig });
  buehne.render(uhr, dtReal);

  // Ton
  const w = z.welt;
  const upm = [(z.haupt.omega * 60) / (2 * Math.PI), (z.superT.omega * 60) / (2 * Math.PI)];
  ton.update(dtReal, zustand.laeuft ? upm : upm.map(() => 0), w.rassel, w.rasselAnzahl, w.klacks);
  w.rassel = 0;
  w.rasselAnzahl = 0;
  w.klacks.length = 0;

  leistung(dtReal);
  requestAnimationFrame(frame);
}

/** Unter 30 fps (gemessen über 3 s Laufzeit) schaltet die Nachbearbeitung automatisch ab. */
function leistung(dtReal) {
  const f = zustand.fps;
  if (!buehne.hochwertig || document.hidden || !zustand.laeuft) { f.zeit = 0; f.frames = 0; f.warm = 0; return; }
  // die ersten Sekunden nach dem Start (Shader-Übersetzung) nicht mitzählen
  f.warm = (f.warm || 0) + dtReal;
  if (f.warm < 1.5) return;
  f.zeit += dtReal;
  f.frames++;
  if (f.zeit >= CONFIG.renderer.fpsMessdauer) {
    const fps = f.frames / f.zeit;
    f.zeit = 0;
    f.frames = 0;
    f.schlecht = fps < CONFIG.renderer.fpsGrenze ? (f.schlecht || 0) + 1 : 0;
    if (f.schlecht >= 2) {
      buehne.leistungsmodus();
      groesse();
      ui.hinweis(`Leistungsmodus: ${fps.toFixed(0)} fps – Nachbearbeitung und Brechung abgeschaltet`);
    }
  }
}

document.addEventListener("visibilitychange", () => {
  letzte = performance.now();
  zustand.fps.zeit = 0;
  zustand.fps.frames = 0;
});

ui.phase("BEREIT");
aktualisiereKnoepfe();
requestAnimationFrame(frame);

// Für automatische Tests: lesender Zugriff auf den Zustand
window.__lotto = {
  get ziehung() { return z; },
  get zustand() { return zustand; },
  buehne,
  /** Hält die Echtzeit-Schleife für Bildprüfungen an (ohne sichtbaren Nachlauf). */
  halten(an = true) { zustand.testHalt = an; },
  /** Spult die laufende Ziehung um `sek` Simulationssekunden vor (identische Physikschritte). */
  vorspulen(sek, bisPhase) {
    const n = Math.round(sek / dt);
    for (let i = 0; i < n && !z.fertig; i++) {
      z.schritt();
      regie.update(dt);
      if (z.ereignisse.length) verarbeiteEreignisse();
      if (bisPhase && z.phase === bisPhase) break;
    }
    return { phase: z.phase, t: z.t };
  },
};
