// Zustandsautomat der Ziehung. Läuft ausschließlich im Physiktakt (fester Zeitschritt),
// damit 1× und 2× exakt dieselbe Ziehung ergeben. Die gezogene Zahl ist immer die Nummer der
// Kugel, die physikalisch durch den Achsauslass gerollt ist – es gibt keine vorab bestimmte Zahl.
import { CONFIG, upmZuRad } from "./config.js";
import { Welt, Trommel, Rohr, Kugel } from "./physik.js";
import { geraetGeometrie, statischeTeile, muldenPosition, roehrchenX, bahnHoehe, lukenPunkt, achsauslassWelt } from "./geometrie.js";
import { zufall } from "./mathe.js";

export const PHASEN = ["BEREIT", "EINWURF", "MISCHEN", "ZIEHEN", "AUSLAUF", "ANZEIGE", "SUPERZAHL", "ENDE"];

export const PHASEN_TEXT = {
  BEREIT: "Bereit",
  EINWURF: "Einwurf",
  MISCHEN: "Mischen",
  ZIEHEN: "Ziehen",
  AUSLAUF: "Auslauf",
  ANZEIGE: "Anzeige",
  SUPERZAHL: "Superzahl",
  ENDE: "Ende",
};

const ZWEI_PI = 2 * 3.141592653589793;

export class Ziehung {
  constructor(seed) {
    this.seed = String(seed);
    const A = CONFIG.ablauf;
    this.A = A;
    this.welt = new Welt(CONFIG.physik);
    this.dt = this.welt.dt;
    this.haupt = this.baueTrommel(CONFIG.haupt);
    this.superT = this.baueTrommel(CONFIG.superzahl);
    this.welt.trommeln.push(this.haupt, this.superT);

    const st = statischeTeile();
    this.welt.boxen = st.boxen;
    this.welt.kapseln = st.kapseln;
    this.welt.rohre = st.rohre.map((d) => new Rohr(d));
    this.einwurfRohr = this.welt.rohre.find((r) => r.name === "einwurf");
    this.roehrchen = this.welt.rohre.filter((r) => r.name.startsWith("roehrchen")).sort((a, b) => a.index - b.index);
    this.superRoehrchen = this.welt.rohre.find((r) => r.name === "superRoehrchen");
    this.welt.beiRohr = (k, rohr, art) => this.rohrEreignis(k, rohr, art);

    const S = this.welt.schalter;
    for (let i = 0; i < CONFIG.roehrchen.anzahl; i++) {
      S["deckel" + i] = i !== 0;
      S["stift" + i] = i === 0;
    }

    this.ereignisse = [];
    this.phase = "BEREIT";
    this.sub = "";
    this.phasenZeit = 0;
    this.subZeit = 0;
    this.t = 0;
    this.zahlen = []; // Reihenfolge der Ziehung (6 Gewinnzahlen + Zusatzzahl)
    this.kugelnGezogen = [];
    this.superzahl = null;
    this.aktuell = null; // Kugel im Auslauf
    this.faktor = 1; // Drehzahlfaktor (Wächter)
    this.superFaktor = 1;
    this.durchlauf = 0; // Anzahl Mischzyklen
    this.lukeZu = 0;
    this.fertig = false;
    this.stoerung = null;
    this.statistik = {
      umdrehungenMischen: 0,
      umdrehungenZiehen: 0,
      aufnahmenMischen: 0, // Kugeln, die in MISCHEN hinter die Tasche gelangen
      aufnahmenZiehen: 0,
      taschenMischen: 0, // Kugeln, die in MISCHEN in die Schaufeltasche fallen
      taschenZiehen: 0,
      ziehUmdrehungen: [], // Umdrehungen in ZIEHEN bis zum Achsauslass
      entwichen: 0,
      stoerungen: 0,
      waechter: 0,
      phasenDauer: [],
    };
    this.ziehUmdrehung = 0;

    this.erzeugeKugeln();
    this.vorbereiten();
  }

  baueTrommel(g) {
    const geo = geraetGeometrie(g);
    const tr = new Trommel(g.name, g.zentrum, g.radius, g.wand, geo.luke);
    tr.kapseln = geo.kapseln;
    const s = geo.schiene;
    tr.schiene = new Rohr({
      name: "schiene_" + g.name,
      punkte: s.punkte,
      sEintritt: s.sEintritt,
      sAchse: s.sAchse,
      eintritt: s.eintritt,
      aussen: true,
      material: "metall",
      sperren: [
        { name: "klappe", s: s.sKlappe, offen: true },
        { name: "auslass", s: s.sSperre, offen: false },
      ],
    }, tr);
    const m = s.punkte[s.iMuendung];
    tr.muendung = [m.x, m.y, m.z];
    tr.klappeGrenze = s.klappeHoehe * g.radius;
    tr.beschleunigung = CONFIG.motor.beschleunigung;
    tr.geometrie = geo;
    tr.cfg = g;
    return tr;
  }

  erzeugeKugeln() {
    const K = CONFIG.kugel, Sd = CONFIG.seed, S = CONFIG.schuette.raster;
    const rnd = zufall(this.seed);
    const intervall = this.A.einwurfDauer / (K.anzahl - 1);
    this.hauptKugeln = [];
    for (let i = 0; i < K.anzahl; i++) {
      const m = K.masse * (1 + rnd.bereich(-K.streuung, K.streuung));
      const k = new Kugel(i, i + 1, "haupt", K.radius, m);
      const reihe = Math.floor(i / S.spalten), spalte = i % S.spalten;
      const p = muldenPosition(reihe, spalte);
      k.px = p[0] + rnd.bereich(-Sd.positionsStoerung, Sd.positionsStoerung);
      k.py = p[1];
      k.pz = p[2] + rnd.bereich(-Sd.positionsStoerung, Sd.positionsStoerung);
      k.modus = "gehalten";
      k.freigabe = Math.max(0, i * intervall + rnd.bereich(-Sd.zeitStoerung, Sd.zeitStoerung));
      k.zone = "schuette";
      this.hauptKugeln.push(k);
      this.welt.kugeln.push(k);
    }
    this.superKugeln = [];
    const tr = this.superT;
    for (let i = 0; i < K.superAnzahl; i++) {
      const m = K.masse * (1 + rnd.bereich(-K.streuung, K.streuung));
      const k = new Kugel(K.anzahl + i, i, "super", K.radius, m);
      const lage = i < 5 ? 0 : 1;
      const j = i < 5 ? i : i - 5;
      k.px = tr.cx + (j - 2) * 0.043 + lage * 0.02 + rnd.bereich(-0.002, 0.002);
      k.py = tr.cy - 0.125 + lage * 0.045;
      k.pz = tr.cz + (lage ? 0.03 : -0.02) + rnd.bereich(-0.002, 0.002);
      k.geraet = tr;
      k.zone = "trommel";
      this.superKugeln.push(k);
      this.welt.kugeln.push(k);
    }
  }

  /** Superzahl-Kugeln kommen vor der Sendung zur Ruhe (deterministisch). */
  vorbereiten() {
    const n = Math.round(1.5 / this.dt);
    for (let i = 0; i < n; i++) this.welt.schritt();
    this.welt.zeit = 0;
    this.welt.rassel = 0;
    this.welt.klacks.length = 0;
  }

  melde(e) {
    e.t = this.t;
    this.ereignisse.push(e);
  }

  setzePhase(phase, sub = "") {
    this.statistik.phasenDauer.push([this.phase, this.phasenZeit]);
    this.phase = phase;
    this.sub = sub;
    this.phasenZeit = 0;
    this.subZeit = 0;
    this.melde({ typ: "phase", phase, sub, durchlauf: this.durchlauf, anzahl: this.zahlen.length });
  }

  setzeSub(sub) {
    this.sub = sub;
    this.subZeit = 0;
    this.melde({ typ: "sub", phase: this.phase, sub });
  }

  starten() {
    if (this.phase === "BEREIT") {
      this.setzePhase("EINWURF");
      this.haupt.lukeOffen = true;
    }
  }

  stoerungMelden(text) {
    this.statistik.stoerungen++;
    this.stoerung = { text, bis: this.t + 3.5 };
    this.melde({ typ: "stoerung", text });
  }

  // ------------------------------------------------------------ Rohr-Ereignisse aus der Physik

  rohrEreignis(k, rohr, art) {
    if (rohr === this.einwurfRohr) {
      if (art === "ende") { k.geraet = this.haupt; k.zone = "trommel"; }
      return;
    }
    const tr = rohr.geraet;
    if (tr) {
      if (art === "rein") {
        k.tief = false; k.zone = "schiene"; k.fortschritt = 0; k.fortschrittS = 0;
        if (tr === this.haupt && (!k.tascheSeit || this.t - k.tascheSeit > 0.3)) {
          if (tr.omega < 0) this.statistik.taschenMischen++; else this.statistik.taschenZiehen++;
        }
        k.tascheSeit = this.t;
      }
      if (art === "raus") { k.zone = "trommel"; }
      if (art === "ende") this.achsauslass(k, tr);
      return;
    }
    if (rohr.index >= 0 && art === "rein") k.zone = "roehrchen";
  }

  achsauslass(k, tr) {
    tr.schiene.auslass.offen = false; // Sperre schließt hinter der ersten Kugel
    k.geraet = null;
    k.rohr = null;
    k.zone = "auslauf";
    k.gezogen = true;
    k.stillZeit = 0;
    k.ruhe = 0;
    if (tr === this.haupt) {
      this.zahlen.push(k.nummer);
      this.kugelnGezogen.push(k);
      this.aktuell = k;
      k.ziel = this.zahlen.length - 1;
      this.statistik.ziehUmdrehungen.push(this.ziehUmdrehung);
      this.melde({ typ: "achsauslass", nummer: k.nummer, index: k.ziel, satz: "haupt" });
      if (this.phase === "ZIEHEN") this.setzePhase("AUSLAUF");
    } else {
      this.superzahl = k.nummer;
      this.aktuell = k;
      k.ziel = 7;
      this.statistik.ziehUmdrehungen.push(this.ziehUmdrehung);
      this.melde({ typ: "achsauslass", nummer: k.nummer, index: 7, satz: "super" });
      if (this.phase === "SUPERZAHL") this.setzeSub("auslauf");
    }
  }

  // ------------------------------------------------------------ Eingriffe des Ziehungsleiters

  skriptPfad(k, punkte, ende) {
    k.modus = "skript";
    k.skript = { art: "pfad", punkte: [[k.px, k.py, k.pz], ...punkte], seg: 0, t: 0, ende };
    k.vx = k.vy = k.vz = 0;
    k.wx = k.wy = k.wz = 0;
  }

  skriptSchiene(k, tr) {
    k.modus = "skript";
    k.skript = { art: "schiene", tr, s: Math.max(0, k.rohrS) };
    k.vx = k.vy = k.vz = 0;
  }

  skripte() {
    const v = this.A.skriptGeschwindigkeit * this.dt;
    for (const k of this.welt.kugeln) {
      if (k.modus !== "skript") continue;
      const sk = k.skript;
      if (sk.art === "pfad") {
        let rest = v;
        while (rest > 0 && sk.seg < sk.punkte.length - 1) {
          const a = sk.punkte[sk.seg], b = sk.punkte[sk.seg + 1];
          const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1e-9;
          const dt = rest / l;
          if (sk.t + dt >= 1) { rest -= (1 - sk.t) * l; sk.seg++; sk.t = 0; }
          else { sk.t += dt; rest = 0; }
        }
        if (sk.seg >= sk.punkte.length - 1) {
          const e = sk.punkte[sk.punkte.length - 1];
          k.px = e[0]; k.py = e[1]; k.pz = e[2];
          k.modus = "frei";
          k.skript = null;
          if (sk.ende) sk.ende(k);
        } else {
          const a = sk.punkte[sk.seg], b = sk.punkte[sk.seg + 1];
          k.px = a[0] + (b[0] - a[0]) * sk.t;
          k.py = a[1] + (b[1] - a[1]) * sk.t;
          k.pz = a[2] + (b[2] - a[2]) * sk.t;
        }
      } else {
        // entlang der mitdrehenden Schiene bis zum Achsauslass
        const tr = sk.tr, r = tr.schiene;
        sk.s += v;
        let i = 0;
        while (i < r.n - 2 && r.s0[i + 1] < sk.s) i++;
        const t = Math.min(1, (sk.s - r.s0[i]) / r.len[i]);
        const lx = r.x[i] + (r.x[i + 1] - r.x[i]) * t;
        const ly = r.y[i] + (r.y[i + 1] - r.y[i]) * t;
        const lz = r.z[i] + (r.z[i + 1] - r.z[i]) * t;
        const w = [0, 0, 0];
        tr.drehe(lx, ly, lz, w);
        k.px = tr.cx + w[0]; k.py = tr.cy + w[1]; k.pz = tr.cz + w[2];
        if (sk.s >= r.sEnde + 0.004) {
          k.modus = "frei";
          k.skript = null;
          this.achsauslass(k, tr);
        }
      }
    }
  }

  // ------------------------------------------------------------ Hauptschritt

  /**
   * Taschenklappe hinter der Schaufel: öffnet nur in Ziehrichtung, wenn die Mündung hoch genug steht
   * und keine andere Kugel tiefer in der Schiene läuft – so fördert die Schiene genau eine Kugel.
   */
  klappen() {
    for (const tr of [this.haupt, this.superT]) {
      const r = tr.schiene, m = tr.muendung;
      const kugeln = tr === this.haupt ? this.hauptKugeln : this.superKugeln;
      const ziehen = tr === this.haupt ? this.phase === "ZIEHEN" : this.phase === "SUPERZAHL" && this.sub === "ziehen";
      const y = tr.c * m[1] - tr.s * m[2];
      let soll = ziehen && tr.omega > 0 && y > tr.klappeGrenze;
      if (soll && kugeln.some((k) => k.rohr === r && k.rohrS > r.klappe.s + k.r)) soll = false;
      if (soll === r.klappe.offen) continue;
      // nicht auf eine Kugel herunterklappen
      if (!soll && kugeln.some((k) => k.rohr === r && Math.abs(k.rohrS - r.klappe.s) < k.r + 0.004)) continue;
      r.klappe.offen = soll;
    }
  }

  schritt() {
    this.klappen();
    this.logik();
    this.welt.schritt();
    this.skripte();
    this.pruefeAufnahmen();
    const dt = this.dt;
    this.t += dt;
    this.phasenZeit += dt;
    this.subZeit += dt;
    if (this.stoerung && this.t > this.stoerung.bis) this.stoerung = null;
  }

  pruefeAufnahmen() {
    const st = this.statistik;
    for (const tr of [this.haupt, this.superT]) {
      const u = Math.abs(tr.omega) * this.dt / ZWEI_PI;
      const mischt = tr.omega < 0;
      if (tr === this.haupt) {
        if (mischt) st.umdrehungenMischen += u; else st.umdrehungenZiehen += u;
      }
      if (tr.omega > 0) this.ziehUmdrehung += tr === this.aktiveTrommel() ? u : 0;
    }
    for (const k of this.hauptKugeln) {
      if (k.rohr !== this.haupt.schiene || k.tief) continue;
      if (k.rohrS > this.haupt.schiene.sEintritt + this.A.tiefeSchiene) {
        k.tief = true;
        if (this.haupt.omega < 0) st.aufnahmenMischen++; else st.aufnahmenZiehen++;
      }
    }
    for (const k of this.hauptKugeln) {
      if (k.geraet === this.haupt && !k.rohr && k.modus === "frei" && !this.haupt.lukeOffen) {
        const dx = k.px - this.haupt.cx, dy = k.py - this.haupt.cy, dz = k.pz - this.haupt.cz;
        if (dx * dx + dy * dy + dz * dz > (this.haupt.R + 0.01) ** 2) {
          st.entwichen++;
          // Sicherheitsnetz, sollte nie greifen
          k.px = this.haupt.cx; k.py = this.haupt.cy - 0.2; k.pz = this.haupt.cz;
          k.vx = k.vy = k.vz = 0;
        }
      }
    }
  }

  aktiveTrommel() {
    return this.phase === "SUPERZAHL" ? this.superT : this.haupt;
  }

  motorZiel(tr, upm) {
    tr.ziel = upmZuRad(upm);
  }

  logik() {
    const A = this.A, M = CONFIG.motor, S = this.welt.schalter, H = this.haupt;
    switch (this.phase) {
      case "BEREIT":
        break;

      case "EINWURF": {
        for (const k of this.hauptKugeln) {
          if (k.modus === "gehalten" && this.phasenZeit >= k.freigabe) {
            k.modus = "frei";
            k.zone = "einwurf";
          }
        }
        const alle = this.hauptKugeln.every((k) => k.geraet === H);
        if (alle && H.lukeOffen) {
          const lp = lukenPunkt();
          const frei = this.hauptKugeln.every((k) => (k.px - lp[0]) ** 2 + (k.py - lp[1]) ** 2 + (k.pz - lp[2]) ** 2 > 0.1 * 0.1);
          if (frei) {
            H.lukeOffen = false;
            this.lukeZu = this.phasenZeit;
            this.melde({ typ: "luke", offen: false });
          }
        }
        if (!H.lukeOffen && this.phasenZeit - this.lukeZu > A.lukeSchliessen) {
          this.durchlauf = 0;
          this.setzePhase("MISCHEN");
        }
        if (this.phasenZeit > A.einwurfWaechter + (this.einwurfEingriffe || 0) * 3 && !alle) {
          this.einwurfEingriffe = (this.einwurfEingriffe || 0) + 1;
          this.stoerungMelden("Störung — Ziehungsleiter greift ein");
          const lp = lukenPunkt();
          const tr = CONFIG.schuette.einwurfTrichter;
          for (const k of this.hauptKugeln) {
            if (k.geraet === H || k.rohr === this.einwurfRohr || k.modus !== "frei") continue;
            k.rohr = null;
            this.skriptPfad(k, [[lp[0], tr.oben + 0.06, lp[2]], [lp[0], tr.unten, lp[2]]], (kk) => { kk.geraet = H; kk.zone = "trommel"; });
          }
        }
        break;
      }

      case "MISCHEN": {
        H.schiene.auslass.offen = false;
        this.motorZiel(H, -M.mischUpm * this.faktor);
        const dauer = this.durchlauf === 0 ? A.mischenErstes : A.mischen;
        if (this.phasenZeit >= dauer) {
          this.durchlauf++;
          this.ziehUmdrehung = 0;
          this.aktuellImZyklus = false;
          this.setzePhase("ZIEHEN");
        }
        break;
      }

      case "ZIEHEN": {
        this.motorZiel(H, M.ziehUpm * this.faktor);
        if (H.omega > 0.3 * H.ziel && !H.schiene.auslass.offen && !this.aktuellImZyklus) {
          H.schiene.auslass.offen = true;
          this.aktuellImZyklus = true;
          this.melde({ typ: "sperre", offen: true, satz: "haupt" });
        }
        this.waechterSchiene(H);
        if (this.phase === "ZIEHEN" && this.phasenZeit > A.ziehenWaechter) {
          this.faktor *= M.waechterFaktor;
          this.statistik.waechter++;
          H.schiene.auslass.offen = false;
          this.aktuellImZyklus = false;
          this.melde({ typ: "waechter", faktor: this.faktor });
          this.setzePhase("MISCHEN");
        }
        break;
      }

      case "AUSLAUF": {
        this.motorZiel(H, -M.nachlaufUpm);
        this.waechterAuslauf(this.aktuell, this.aktuell.ziel);
        break;
      }

      case "ANZEIGE": {
        this.motorZiel(H, -M.nachlaufUpm);
        if (this.phasenZeit >= A.anzeige + A.anzeigeRueckschnitt) {
          if (this.zahlen.length < A.anzahlZiehungen) this.setzePhase("MISCHEN");
          else {
            this.setzePhase("SUPERZAHL", "vorlauf");
          }
        }
        break;
      }

      case "SUPERZAHL": {
        const T = this.superT;
        this.motorZiel(H, 0);
        if (this.sub === "vorlauf") {
          if (this.subZeit >= A.superVorlauf) this.setzeSub("mischen");
        } else if (this.sub === "mischen") {
          this.motorZiel(T, -M.superMischUpm * this.superFaktor);
          if (this.subZeit >= A.superMischen) { this.ziehUmdrehung = 0; this.superImZyklus = false; this.setzeSub("ziehen"); }
        } else if (this.sub === "ziehen") {
          this.motorZiel(T, M.superZiehUpm * this.superFaktor);
          if (T.omega > 0.3 * T.ziel && !T.schiene.auslass.offen && !this.superImZyklus) {
            T.schiene.auslass.offen = true;
            this.superImZyklus = true;
            this.melde({ typ: "sperre", offen: true, satz: "super" });
          }
          this.waechterSchiene(T);
          if (this.sub === "ziehen" && this.subZeit > A.ziehenWaechter) {
            this.superFaktor *= M.waechterFaktor;
            this.statistik.waechter++;
            T.schiene.auslass.offen = false;
            this.melde({ typ: "waechter", faktor: this.superFaktor });
            this.setzeSub("mischen");
          }
        } else if (this.sub === "auslauf") {
          this.motorZiel(T, -M.nachlaufUpm);
          this.waechterAuslauf(this.aktuell, 7);
        } else if (this.sub === "anzeige") {
          this.motorZiel(T, 0);
          if (this.subZeit >= A.superAnzeige) {
            this.setzePhase("ENDE");
            this.melde({ typ: "ergebnis", zahlen: this.zahlen.slice(), superzahl: this.superzahl });
          }
        }
        break;
      }

      case "ENDE":
        this.motorZiel(H, 0);
        this.motorZiel(this.superT, 0);
        if (!this.fertig && this.phasenZeit >= A.endeBremsen) {
          this.fertig = true;
          this.melde({ typ: "fertig" });
        }
        break;
    }
  }

  /** Bleibt eine Kugel in der Schiene hängen, rollt der Ziehungsleiter sie per Hand aus. */
  waechterSchiene(tr) {
    const r = tr.schiene;
    if (!r.auslass.offen) return;
    const kugeln = tr === this.haupt ? this.hauptKugeln : this.superKugeln;
    for (const k of kugeln) {
      if (k.rohr !== r || k.modus !== "frei") continue;
      if (k.rohrS < r.sEintritt + this.A.tiefeSchiene) { k.fortschritt = 0; continue; }
      if (k.rohrS > k.fortschrittS + 0.01) { k.fortschrittS = k.rohrS; k.fortschritt = 0; }
      k.fortschritt += this.dt;
      if (k.fortschritt > this.A.stoerungNach) {
        this.stoerungMelden("Störung — Ziehungsleiter greift ein");
        k.rohr = null;
        this.skriptSchiene(k, tr);
        return;
      }
    }
  }

  /** Überwacht die fallende Kugel bis zur Ruhe im Röhrchen. */
  waechterAuslauf(k, ziel) {
    if (k.modus === "skript") return;
    const v = Math.sqrt(k.vx * k.vx + k.vy * k.vy + k.vz * k.vz);
    const zielRohr = ziel === 7 ? this.superRoehrchen : this.roehrchen[ziel];
    const P = CONFIG.physik;
    if (k.modus === "frei" && k.rohr && k.rohr.index >= 0) {
      if (v < P.ruheGeschwindigkeit) k.ruhe += this.dt; else k.ruhe = 0;
      if (k.ruhe >= P.ruheDauer && k.rohrS > k.rohr.sEnde - 0.1) {
        this.gelandet(k, k.rohr.index);
        return;
      }
    }
    if (v < 0.03 && !(k.rohr && k.rohr.index >= 0)) k.stillZeit += this.dt;
    else k.stillZeit = 0;
    const zuLange = (this.phase === "AUSLAUF" ? this.phasenZeit : this.subZeit) > this.A.stoerungNach * 3;
    if (k.stillZeit > this.A.stoerungNach || zuLange || k.py < 0.1) {
      this.stoerungMelden("Störung — Ziehungsleiter greift ein");
      k.rohr = null;
      const x = zielRohr.x[0], z = zielRohr.z[0];
      const y = zielRohr.y[0] + 0.03;
      this.skriptPfad(k, [[k.px, y + 0.05, k.pz], [x, y + 0.05, z], [x, y - 0.03, z]], () => {});
    }
  }

  gelandet(k, index) {
    k.modus = "ruhend";
    k.vx = k.vy = k.vz = 0;
    k.wx = k.wy = k.wz = 0;
    k.zone = "roehrchen";
    const S = this.welt.schalter;
    if (index < 7) {
      S["deckel" + index] = true;
      S["stift" + index] = false;
      if (index + 1 < CONFIG.roehrchen.anzahl) {
        S["deckel" + (index + 1)] = false;
        S["stift" + (index + 1)] = true;
      }
      this.melde({ typ: "gelandet", index, nummer: k.nummer, satz: "haupt" });
      this.setzePhase("ANZEIGE");
    } else {
      this.melde({ typ: "gelandet", index: 7, nummer: k.nummer, satz: "super" });
      this.setzeSub("anzeige");
    }
  }

  /** Stand der Schieberplatte 0 (zu) … 1 (offen). */
  schieberStand() {
    if (this.phase === "BEREIT") return 0;
    if (this.phase === "EINWURF") return Math.min(1, this.phasenZeit / (this.A.einwurfDauer + 0.2));
    return 1;
  }

  roehrchenPosition(i) {
    if (i === 7) {
      const r = this.superRoehrchen;
      return [r.x[2], CONFIG.superAuslauf.boden + CONFIG.kugel.radius, r.z[2]];
    }
    return [roehrchenX(i), CONFIG.roehrchen.boden + CONFIG.kugel.radius, CONFIG.bahn.bZ];
  }
}

export { bahnHoehe };
