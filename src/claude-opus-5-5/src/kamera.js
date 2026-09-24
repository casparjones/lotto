// Kameraregie („Regie"-Modus): Einstellungen je Phase, weiche Fahrten mit Ease-in/out,
// Schwenk mit der fallenden Kugel, Close-up am Röhrchen, weicher Schnitt zurück.
// Die Regie läuft im Takt der Simulationszeit: Stop friert sie ein, 2× beschleunigt sie.
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { easeInOut } from "./mathe.js";

const K = CONFIG.kamera;

function pose(p) {
  return { pos: new THREE.Vector3(...p.pos), ziel: new THREE.Vector3(...p.ziel), fov: p.fov };
}
function kopie(p) {
  return { pos: p.pos.clone(), ziel: p.ziel.clone(), fov: p.fov };
}

export class Regie {
  constructor(kamera, { reduziert, blende }) {
    this.kamera = kamera;
    this.reduziert = reduziert;
    this.blende = blende; // Rückruf für den weichen Schnitt
    this.aktuell = pose(K.totale);
    this.fahrt = null;
    this.folge = null;
    this.timer = []; // { zeit, aktion }
    this.zeit = 0;
    this.anwenden();
  }

  zuruecksetzen() {
    this.fahrt = null;
    this.folge = null;
    this.timer = [];
    this.zeit = 0;
    this.aktuell = pose(K.totale);
    this.anwenden();
  }

  schnitt(p, weich = false) {
    if (weich) this.blende();
    this.fahrt = null;
    this.folge = null;
    this.aktuell = kopie(p);
  }

  fahre(p, dauer) {
    this.folge = null;
    if (this.reduziert || dauer <= 0) { this.schnitt(p); return; }
    this.fahrt = { von: kopie(this.aktuell), nach: kopie(p), dauer, t: 0 };
  }

  folgeKugel(kugel, versatz) {
    if (this.reduziert) return; // ohne Kamerafahrt: Einstellung bleibt, Close-up folgt als Schnitt
    this.fahrt = null;
    this.folge = { kugel, versatz: new THREE.Vector3(...versatz), ziel: this.aktuell.ziel.clone(), pos: this.aktuell.pos.clone() };
  }

  nach(sekunden, aktion) {
    this.timer.push({ zeit: this.zeit + sekunden, aktion });
  }

  closeup(pos, abstand = K.roehrchenAbstand, fov = K.roehrchenFov) {
    const p = new THREE.Vector3(...pos);
    return { pos: p.clone().add(new THREE.Vector3(0.0, K.roehrchenHoehe, abstand)), ziel: p, fov };
  }

  /** Reaktion auf Ereignisse des Zustandsautomaten. */
  ereignis(e, z) {
    const D = K.dauer;
    if (e.typ === "phase") {
      switch (e.phase) {
        case "BEREIT":
          this.schnitt(pose(K.totale));
          break;
        case "EINWURF":
          this.schnitt(pose(K.totale));
          this.fahre(pose(K.einwurf), CONFIG.ablauf.einwurfDauer + 1.5);
          break;
        case "MISCHEN":
          if (e.durchlauf === 0) this.fahre(pose(K.pushIn), D.pushIn);
          else this.fahre(pose(K.pushIn2), CONFIG.ablauf.mischen);
          break;
        case "ZIEHEN":
          this.fahre(pose(K.schiene), D.halbnah);
          break;
        case "SUPERZAHL":
          this.fahre(pose(K.superzahl), D.schluss); // Schwenk zum Superzahlgerät
          break;
        case "ENDE":
          this.schnitt(pose(K.schluss), true);
          break;
      }
    } else if (e.typ === "achsauslass") {
      const haupt = e.satz === "haupt";
      if (haupt) {
        this.fahre(pose(K.achse), 0.7);
        const k = z.aktuell;
        this.nach(0.7, () => this.folgeKugel(k, K.folgeVersatz));
      } else {
        const k = z.aktuell;
        this.folgeKugel(k, K.superFolgeVersatz);
      }
    } else if (e.typ === "gelandet") {
      const p = z.roehrchenPosition(e.index);
      const cu = e.index === 7 ? this.closeup(p, K.superNah.abstand, K.superNah.fov) : this.closeup(p);
      this.fahre(cu, D.closeup);
      if (e.index < 7) {
        // nach dem Halt weicher Schnitt zurück in die Totale
        this.nach(D.closeup + CONFIG.ablauf.anzeige, () => this.schnitt(pose(K.rueck), true));
      }
    } else if (e.typ === "waechter") {
      this.fahre(pose(K.pushIn), D.weich);
    }
  }

  update(dt) {
    this.zeit += dt;
    for (let i = 0; i < this.timer.length; i++) {
      if (this.zeit >= this.timer[i].zeit) {
        const a = this.timer[i].aktion;
        this.timer.splice(i--, 1);
        a();
      }
    }
    if (this.fahrt) {
      const f = this.fahrt;
      f.t += dt;
      const u = easeInOut(f.t / f.dauer);
      this.aktuell.pos.lerpVectors(f.von.pos, f.nach.pos, u);
      this.aktuell.ziel.lerpVectors(f.von.ziel, f.nach.ziel, u);
      this.aktuell.fov = f.von.fov + (f.nach.fov - f.von.fov) * u;
      if (f.t >= f.dauer) this.fahrt = null;
    } else if (this.folge) {
      const f = this.folge;
      const k = f.kugel;
      const a = 1 - Math.exp(-K.folgeGlaettung * dt);
      const ziel = new THREE.Vector3(k.px, k.py, k.pz);
      f.ziel.lerp(ziel, a);
      f.pos.lerp(ziel.clone().add(f.versatz), a * 0.8);
      this.aktuell.pos.copy(f.pos);
      this.aktuell.ziel.copy(f.ziel);
      this.aktuell.fov += (K.folgeFov - this.aktuell.fov) * a;
    }
  }

  anwenden() {
    const c = this.kamera;
    c.position.copy(this.aktuell.pos);
    c.lookAt(this.aktuell.ziel);
    if (Math.abs(c.fov - this.aktuell.fov) > 1e-4) {
      c.fov = this.aktuell.fov;
      c.updateProjectionMatrix();
    }
  }
}
