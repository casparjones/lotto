// Starrkörper-Physik für Kugeln (6 Freiheitsgrade: Lage, Geschwindigkeit, Drehung, Winkelgeschwindigkeit).
// Kollider: Hohlkugel (Trommelwand, innen/außen), Kapseln (Speichen, Nabe, Stäbe), Quader (Bahnen,
// Wände), Rohre mit veränderlichem Radius (Auswerfschiene, Trichter, Röhrchen).
// Rotierende Kollider liefern am Kontaktpunkt ihre Wandgeschwindigkeit ω × r.
// Löser: sequentielle Impulse mit Coulomb-Reibung, fester Zeitschritt. Keine Zufallszahlen.
import { sinCos } from "./mathe.js";

const SC = [0, 0];

export class Kontakt {
  constructor() {
    this.a = null; this.b = null;
    this.nx = 0; this.ny = 0; this.nz = 0;
    this.vsx = 0; this.vsy = 0; this.vsz = 0;
    this.e = 0; this.mu = 0; this.ziel = 0;
    this.ln = 0; this.ltx = 0; this.lty = 0; this.ltz = 0;
    this.mn = 0; this.mt = 0; this.vn0 = 0; this.klack = false; this.art = 0;
  }
}

/** Nächster Punkt einer Polylinie (Rohr-Mittellinie) zu p. */
export class RohrAbfrage {
  constructor() {
    this.seg = 0; this.t = 0; this.s = 0; this.d = 0;
    this.qx = 0; this.qy = 0; this.qz = 0; this.ri = 0; this.ro = 0;
    this.vor = false; this.hinter = false;
  }
}

export class Rohr {
  constructor(def, geraet = null) {
    const p = def.punkte;
    this.name = def.name;
    this.index = def.index ?? -1;
    this.geraet = geraet;
    this.n = p.length;
    this.x = new Float64Array(p.map((q) => q.x));
    this.y = new Float64Array(p.map((q) => q.y));
    this.z = new Float64Array(p.map((q) => q.z));
    this.ri = new Float64Array(p.map((q) => q.ri));
    this.ro = new Float64Array(p.map((q) => q.ro));
    const ns = this.n - 1;
    this.len = new Float64Array(ns);
    this.s0 = new Float64Array(this.n);
    this.mx = new Float64Array(ns); this.my = new Float64Array(ns); this.mz = new Float64Array(ns);
    let roMax = 0;
    for (let i = 0; i < ns; i++) {
      const dx = this.x[i + 1] - this.x[i], dy = this.y[i + 1] - this.y[i], dz = this.z[i + 1] - this.z[i];
      this.len[i] = Math.sqrt(dx * dx + dy * dy + dz * dz);
      this.s0[i + 1] = this.s0[i] + this.len[i];
      this.mx[i] = this.x[i] + dx / 2; this.my[i] = this.y[i] + dy / 2; this.mz[i] = this.z[i] + dz / 2;
      if (this.ro[i] > roMax) roMax = this.ro[i];
    }
    if (this.ro[ns] > roMax) roMax = this.ro[ns];
    this.roMax = roMax;
    this.sEnde = this.s0[ns];
    this.sEintritt = def.sEintritt ?? 0.02;
    this.sAchse = def.sAchse ?? Infinity;
    this.eintritt = def.eintritt ?? 0.005;
    this.aussen = def.aussen ?? false;
    this.material = def.material ?? "metall";
    // Sperren quer im Rohr (Taschenklappe, Auslasssperre): { s, offen, tx, ty, tz }
    this.sperren = [];
    for (const sp of def.sperren ?? []) this.sperreHinzu(sp.name, sp.s, sp.offen ?? true);
    // Hüllquader für schnelle Ablehnung
    let a = [Infinity, Infinity, Infinity], b = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < this.n; i++) {
      a = [Math.min(a[0], this.x[i]), Math.min(a[1], this.y[i]), Math.min(a[2], this.z[i])];
      b = [Math.max(b[0], this.x[i]), Math.max(b[1], this.y[i]), Math.max(b[2], this.z[i])];
    }
    this.min = a.map((v) => v - roMax - 0.03);
    this.max = b.map((v) => v + roMax + 0.03);
  }

  sperreHinzu(name, sPos, offen) {
    const ns = this.n - 1;
    let i = 0;
    while (i < ns - 1 && this.s0[i + 1] < sPos) i++;
    const sp = {
      name, s: sPos, offen,
      tx: (this.x[i + 1] - this.x[i]) / this.len[i],
      ty: (this.y[i + 1] - this.y[i]) / this.len[i],
      tz: (this.z[i + 1] - this.z[i]) / this.len[i],
    };
    this.sperren.push(sp);
    this[name] = sp;
    return sp;
  }

  imHuellquader(px, py, pz) {
    return px > this.min[0] && px < this.max[0] && py > this.min[1] && py < this.max[1] && pz > this.min[2] && pz < this.max[2];
  }

  /** Füllt out mit dem nächsten Punkt; maxD begrenzt die Suche (Infinity = alle Segmente). */
  abfrage(px, py, pz, out, maxD = Infinity) {
    let best = Infinity, bestT = 0, bestSeg = -1, rawBest = 0;
    const ns = this.n - 1;
    for (let i = 0; i < ns; i++) {
      const hl = this.len[i] / 2;
      const ex = px - this.mx[i], ey = py - this.my[i], ez = pz - this.mz[i];
      const dm = Math.sqrt(ex * ex + ey * ey + ez * ez) - hl;
      if (dm > maxD) continue;
      if (dm > 0 && dm * dm > best) continue;
      const ax = this.x[i], ay = this.y[i], az = this.z[i];
      const dx = this.x[i + 1] - ax, dy = this.y[i + 1] - ay, dz = this.z[i + 1] - az;
      const l2 = this.len[i] * this.len[i];
      const raw = ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / l2;
      const t = raw < 0 ? 0 : raw > 1 ? 1 : raw;
      const qx = ax + dx * t - px, qy = ay + dy * t - py, qz = az + dz * t - pz;
      const d2 = qx * qx + qy * qy + qz * qz;
      if (d2 < best) { best = d2; bestT = t; bestSeg = i; rawBest = raw; }
    }
    if (bestSeg < 0) { out.seg = -1; return out; }
    const i = bestSeg, t = bestT;
    out.seg = i; out.t = t;
    out.qx = this.x[i] + (this.x[i + 1] - this.x[i]) * t;
    out.qy = this.y[i] + (this.y[i + 1] - this.y[i]) * t;
    out.qz = this.z[i] + (this.z[i + 1] - this.z[i]) * t;
    out.d = Math.sqrt(best);
    out.s = this.s0[i] + this.len[i] * t;
    out.ri = this.ri[i] + (this.ri[i + 1] - this.ri[i]) * t;
    out.ro = this.ro[i] + (this.ro[i + 1] - this.ro[i]) * t;
    out.vor = i === 0 && rawBest < 0;
    out.hinter = i === ns - 1 && rawBest > 1;
    return out;
  }
}

/** Drehende Trommel mit Wand, Kapseln (Speichen) und Auswerfschiene. */
export class Trommel {
  constructor(name, zentrum, radius, wand, luke) {
    this.name = name;
    this.cx = zentrum[0]; this.cy = zentrum[1]; this.cz = zentrum[2];
    this.R = radius; this.Ro = radius + wand;
    this.winkel = 0; this.c = 1; this.s = 0; this.omega = 0;
    this.ziel = 0; this.beschleunigung = 1;
    this.luke = luke; // { richtung:[x,y,z], radius } in Trommelkoordinaten
    this.lukeOffen = false;
    this.kapseln = [];
    this.schiene = null;
    this.material = "acryl";
  }
  /** Weltpunkt → Trommelkoordinaten (Drehung um x). */
  lokal(px, py, pz, o) {
    const dy = py - this.cy, dz = pz - this.cz;
    o[0] = px - this.cx;
    o[1] = this.c * dy + this.s * dz;
    o[2] = -this.s * dy + this.c * dz;
    return o;
  }
  /** Richtung Trommel → Welt. */
  drehe(x, y, z, o) {
    o[0] = x;
    o[1] = this.c * y - this.s * z;
    o[2] = this.s * y + this.c * z;
    return o;
  }
  motor(dt) {
    const d = this.ziel - this.omega;
    const m = this.beschleunigung * dt;
    this.omega += d > m ? m : d < -m ? -m : d;
    this.winkel += this.omega * dt;
    sinCos(this.winkel, SC);
    this.s = SC[0]; this.c = SC[1];
  }
}

export class Kugel {
  constructor(id, nummer, satz, r, m) {
    this.id = id; this.nummer = nummer; this.satz = satz;
    this.r = r; this.m = m; this.invM = 1 / m;
    this.invI = 1 / ((2 / 3) * m * r * r); // dünnwandige Hohlkugel
    this.px = 0; this.py = 0; this.pz = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.wx = 0; this.wy = 0; this.wz = 0;
    this.qx = 0; this.qy = 0; this.qz = 0; this.qw = 1;
    this.modus = "frei"; // frei | gehalten | ruhend | skript
    this.geraet = null; // Trommel, in der die Kugel liegt
    this.rohr = null; // Rohr, in dem die Kugel läuft
    this.rohrS = 0;
    this.ruhe = 0;
    this.gezogen = false;
  }
}

export class Welt {
  constructor(p) {
    this.p = p;
    this.dt = p.dt;
    this.kugeln = [];
    this.trommeln = [];
    this.boxen = [];
    this.kapseln = [];
    this.rohre = [];
    this.schalter = Object.create(null);
    this.kontakte = [];
    this.nK = 0;
    this.zeit = 0;
    this.q = new RohrAbfrage();
    this.l = [0, 0, 0];
    this.w = [0, 0, 0];
    this.rassel = 0; // Summe der Aufprallenergie (für Ton)
    this.rasselAnzahl = 0;
    this.klacks = []; // harte Aufschläge in Röhrchen
    this.beiRohr = null; // Rückruf (kugel, rohr, "rein"|"raus"|"ende")
    this.mat = p.materialien;
  }

  aktiv(teil) {
    return !teil.schalter || this.schalter[teil.schalter] === true;
  }

  neuerKontakt() {
    if (this.nK >= this.kontakte.length) this.kontakte.push(new Kontakt());
    return this.kontakte[this.nK++];
  }

  /**
   * Kontakt einer Kugel mit einer Fläche. n zeigt zur Kugel. (vs*) = Geschwindigkeit der Fläche.
   */
  kontaktFlaeche(k, nx, ny, nz, tiefe, vsx, vsy, vsz, matName, klack = false) {
    const c = this.neuerKontakt();
    const m = this.mat[matName] || this.mat.metall;
    c.a = k; c.b = null;
    c.nx = nx; c.ny = ny; c.nz = nz;
    c.vsx = vsx; c.vsy = vsy; c.vsz = vsz;
    c.mu = m.mu;
    c.klack = klack;
    this.vorbereiten(c, m.e, tiefe);
  }

  vorbereiten(c, e, tiefe) {
    const a = c.a, b = c.b;
    const kA = a.invM + a.r * a.r * a.invI;
    let invN = a.invM, kT = kA;
    if (b) { invN += b.invM; kT += b.invM + b.r * b.r * b.invI; }
    c.mn = 1 / invN; c.mt = 1 / kT;
    c.ln = 0; c.ltx = 0; c.lty = 0; c.ltz = 0;
    const vn = this.relativ(c, this.w);
    c.vn0 = vn;
    const p = this.p;
    const zielE = vn < -p.restitutionSchwelle ? -e * vn : 0;
    let bias = (p.biasFaktor / this.dt) * (tiefe - p.slop);
    if (bias < 0) bias = 0;
    if (bias > p.maxBias) bias = p.maxBias;
    c.ziel = zielE > bias ? zielE : bias;
    if (vn < -p.restitutionSchwelle) {
      const en = vn * vn * (b ? 1 : 0.7);
      this.rassel += en;
      this.rasselAnzahl++;
      if (c.klack && -vn > 0.25) this.klacks.push({ kugel: a, staerke: -vn });
    }
  }

  /** Relativgeschwindigkeit am Kontaktpunkt; Rückgabe: Normalanteil, out = Vektor. */
  relativ(c, out) {
    const a = c.a, n0 = c.nx, n1 = c.ny, n2 = c.nz;
    // Punkt auf a: −r·n → v + ω × (−r n) = v − r (ω × n)
    let rx = a.vx - a.r * (a.wy * n2 - a.wz * n1);
    let ry = a.vy - a.r * (a.wz * n0 - a.wx * n2);
    let rz = a.vz - a.r * (a.wx * n1 - a.wy * n0);
    const b = c.b;
    if (b) {
      rx -= b.vx + b.r * (b.wy * n2 - b.wz * n1);
      ry -= b.vy + b.r * (b.wz * n0 - b.wx * n2);
      rz -= b.vz + b.r * (b.wx * n1 - b.wy * n0);
    } else {
      rx -= c.vsx; ry -= c.vsy; rz -= c.vsz;
    }
    out[0] = rx; out[1] = ry; out[2] = rz;
    return rx * n0 + ry * n1 + rz * n2;
  }

  loese(c) {
    const a = c.a, b = c.b, n0 = c.nx, n1 = c.ny, n2 = c.nz;
    const w = this.w;
    // Normalimpuls
    let vn = this.relativ(c, w);
    let d = (c.ziel - vn) * c.mn;
    let neu = c.ln + d;
    if (neu < 0) neu = 0;
    d = neu - c.ln;
    c.ln = neu;
    if (d !== 0) {
      a.vx += d * n0 * a.invM; a.vy += d * n1 * a.invM; a.vz += d * n2 * a.invM;
      if (b) { b.vx -= d * n0 * b.invM; b.vy -= d * n1 * b.invM; b.vz -= d * n2 * b.invM; }
    }
    // Reibung (tangential, als Vektor begrenzt)
    vn = this.relativ(c, w);
    const tx = w[0] - vn * n0, ty = w[1] - vn * n1, tz = w[2] - vn * n2;
    let jx = c.ltx - tx * c.mt, jy = c.lty - ty * c.mt, jz = c.ltz - tz * c.mt;
    const grenze = c.mu * c.ln;
    const j2 = jx * jx + jy * jy + jz * jz;
    if (j2 > grenze * grenze) {
      const f = grenze / Math.sqrt(j2);
      jx *= f; jy *= f; jz *= f;
    }
    const dx = jx - c.ltx, dy = jy - c.lty, dz = jz - c.ltz;
    c.ltx = jx; c.lty = jy; c.ltz = jz;
    if (dx === 0 && dy === 0 && dz === 0) return;
    // a: Impuls J am Punkt −r n  → Δω = I⁻¹ (−r n × J)
    a.vx += dx * a.invM; a.vy += dy * a.invM; a.vz += dz * a.invM;
    let f = -a.r * a.invI;
    a.wx += f * (n1 * dz - n2 * dy); a.wy += f * (n2 * dx - n0 * dz); a.wz += f * (n0 * dy - n1 * dx);
    if (b) {
      b.vx -= dx * b.invM; b.vy -= dy * b.invM; b.vz -= dz * b.invM;
      f = -b.r * b.invI;
      b.wx += f * (n1 * dz - n2 * dy); b.wy += f * (n2 * dx - n0 * dz); b.wz += f * (n0 * dy - n1 * dx);
    }
  }

  // ------------------------------------------------------------ Kontakterzeugung

  kontaktKugeln() {
    const K = this.kugeln, n = K.length;
    for (let i = 0; i < n; i++) {
      const ai = K[i];
      const aFrei = ai.modus === "frei";
      if (!aFrei && ai.modus !== "ruhend") continue;
      for (let j = i + 1; j < n; j++) {
        let a = ai, b = K[j];
        if (b.modus !== "frei" && b.modus !== "ruhend") continue;
        if (!aFrei) {
          if (b.modus !== "frei") continue;
          a = b; b = ai; // die bewegliche Kugel ist immer a
        }
        if (a.rohr !== b.rohr || a.geraet !== b.geraet) continue;
        const dx = a.px - b.px, dy = a.py - b.py, dz = a.pz - b.pz;
        const rr = a.r + b.r;
        if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const c = this.neuerKontakt();
        c.a = a; c.b = b.modus === "frei" ? b : null;
        c.nx = dx / d; c.ny = dy / d; c.nz = dz / d;
        c.vsx = 0; c.vsy = 0; c.vsz = 0;
        c.mu = this.mat.kugel.mu; c.klack = false;
        this.vorbereiten(c, this.mat.kugel.e, rr - d);
      }
    }
  }

  kontaktBox(k, bx) {
    const ex = k.px - bx.c[0], ey = k.py - bx.c[1], ez = k.pz - bx.c[2];
    const u = bx.u, v = bx.v, w = bx.w, h = bx.h, r = k.r;
    const lu = ex * u[0] + ey * u[1] + ez * u[2];
    if (lu > h[0] + r || lu < -h[0] - r) return;
    const lv = ex * v[0] + ey * v[1] + ez * v[2];
    if (lv > h[1] + r || lv < -h[1] - r) return;
    const lw = ex * w[0] + ey * w[1] + ez * w[2];
    if (lw > h[2] + r || lw < -h[2] - r) return;
    const cu = lu < -h[0] ? -h[0] : lu > h[0] ? h[0] : lu;
    const cv = lv < -h[1] ? -h[1] : lv > h[1] ? h[1] : lv;
    const cw = lw < -h[2] ? -h[2] : lw > h[2] ? h[2] : lw;
    let du = lu - cu, dv = lv - cv, dw = lw - cw;
    let d2 = du * du + dv * dv + dw * dw;
    let tiefe, nu, nv, nw;
    if (d2 > 0) {
      if (d2 >= r * r) return;
      const d = Math.sqrt(d2);
      nu = du / d; nv = dv / d; nw = dw / d;
      tiefe = r - d;
    } else {
      // Mittelpunkt im Quader: kürzester Weg hinaus
      const pu = h[0] - Math.abs(lu), pv = h[1] - Math.abs(lv), pw = h[2] - Math.abs(lw);
      nu = 0; nv = 0; nw = 0;
      if (pu <= pv && pu <= pw) { nu = lu < 0 ? -1 : 1; tiefe = pu + r; }
      else if (pv <= pw) { nv = lv < 0 ? -1 : 1; tiefe = pv + r; }
      else { nw = lw < 0 ? -1 : 1; tiefe = pw + r; }
    }
    const nx = nu * u[0] + nv * v[0] + nw * w[0];
    const ny = nu * u[1] + nv * v[1] + nw * w[1];
    const nz = nu * u[2] + nv * v[2] + nw * w[2];
    this.kontaktFlaeche(k, nx, ny, nz, tiefe, 0, 0, 0, bx.material, bx.klack === true);
  }

  /** Kapsel im Rahmen (lokale Koordinaten lx,ly,lz); tr = Trommel oder null. */
  kontaktKapsel(k, kp, lx, ly, lz, tr) {
    const a = kp.a, b = kp.b;
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const l2 = dx * dx + dy * dy + dz * dz;
    let t = 0;
    if (l2 > 0) {
      t = ((lx - a[0]) * dx + (ly - a[1]) * dy + (lz - a[2]) * dz) / l2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
    }
    const qx = a[0] + dx * t, qy = a[1] + dy * t, qz = a[2] + dz * t;
    const ox = lx - qx, oy = ly - qy, oz = lz - qz;
    const rr = kp.r + k.r;
    const d2 = ox * ox + oy * oy + oz * oz;
    if (d2 >= rr * rr || d2 === 0) return;
    const d = Math.sqrt(d2);
    this.flaecheImRahmen(k, ox / d, oy / d, oz / d, rr - d, qx + (ox / d) * kp.r, qy + (oy / d) * kp.r, qz + (oz / d) * kp.r, tr, kp.material);
  }

  /** Normale und Kontaktpunkt aus Trommelkoordinaten in die Welt übertragen, Wandgeschwindigkeit ω × r. */
  flaecheImRahmen(k, nlx, nly, nlz, tiefe, plx, ply, plz, tr, mat) {
    if (!tr) {
      this.kontaktFlaeche(k, nlx, nly, nlz, tiefe, 0, 0, 0, mat);
      return;
    }
    const w = this.w;
    tr.drehe(nlx, nly, nlz, w);
    const nx = w[0], ny = w[1], nz = w[2];
    tr.drehe(plx, ply, plz, w); // Kontaktpunkt relativ zum Zentrum (Welt)
    const om = tr.omega;
    // ω = (om,0,0): ω × r = (0, −om·rz, om·ry)
    this.kontaktFlaeche(k, nx, ny, nz, tiefe, 0, -om * w[2], om * w[1], mat);
  }

  kontaktRohr(k, rohr, lx, ly, lz, tr, innen) {
    const q = this.q;
    if (innen) {
      rohr.abfrage(lx, ly, lz, q);
      if (q.seg < 0 || q.vor || q.hinter) return;
      for (const sp of rohr.sperren) {
        if (sp.offen || q.s <= sp.s - k.r || q.s >= sp.s + k.r) continue;
        this.flaecheImRahmen(k, -sp.tx, -sp.ty, -sp.tz, q.s - (sp.s - k.r), lx + sp.tx * k.r, ly + sp.ty * k.r, lz + sp.tz * k.r, tr, "metall");
      }
      const erlaubt = q.ri - k.r;
      if (q.d <= erlaubt || q.d === 0) return;
      const ox = (lx - q.qx) / q.d, oy = (ly - q.qy) / q.d, oz = (lz - q.qz) / q.d;
      // Kegelwand: Innennormale = −(radial − dri/ds · Tangente), normiert
      const i = q.seg;
      const g = (rohr.ri[i + 1] - rohr.ri[i]) / rohr.len[i];
      const tx = (rohr.x[i + 1] - rohr.x[i]) / rohr.len[i], ty = (rohr.y[i + 1] - rohr.y[i]) / rohr.len[i], tz = (rohr.z[i + 1] - rohr.z[i]) / rohr.len[i];
      let nx = -ox + g * tx, ny = -oy + g * ty, nz = -oz + g * tz;
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= nl; ny /= nl; nz /= nl;
      this.flaecheImRahmen(k, nx, ny, nz, (q.d - erlaubt) / nl, q.qx + ox * q.ri, q.qy + oy * q.ri, q.qz + oz * q.ri, tr, rohr.material);
    } else {
      rohr.abfrage(lx, ly, lz, q, rohr.roMax + k.r);
      if (q.seg < 0 || q.vor || q.hinter) return;
      if (q.s < rohr.sEintritt && q.d < q.ri - k.r + rohr.eintritt) return; // tritt gerade ein
      const grenze = q.ro + k.r;
      if (q.d >= grenze || q.d === 0) return;
      const ox = (lx - q.qx) / q.d, oy = (ly - q.qy) / q.d, oz = (lz - q.qz) / q.d;
      this.flaecheImRahmen(k, ox, oy, oz, grenze - q.d, q.qx + ox * q.ro, q.qy + oy * q.ro, q.qz + oz * q.ro, tr, rohr.material);
    }
  }

  kontaktTrommel(k, tr) {
    const l = this.l;
    tr.lokal(k.px, k.py, k.pz, l);
    const lx = l[0], ly = l[1], lz = l[2];
    const d2 = lx * lx + ly * ly + lz * lz;
    const drin = k.geraet === tr;
    if (drin) {
      const imRohr = k.rohr === tr.schiene;
      // Wand innen – außer im Achsbereich der Schiene und in der offenen Luke
      if (!(imRohr && k.rohrS > tr.schiene.sAchse - 0.02)) {
        const g = tr.R - k.r;
        if (d2 > g * g) {
          const d = Math.sqrt(d2);
          let offen = false;
          if (tr.luke && tr.lukeOffen) {
            const h = tr.luke.richtung;
            const ax = lx * h[0] + ly * h[1] + lz * h[2];
            const lat2 = d2 - ax * ax;
            const lr = tr.luke.radius - k.r;
            offen = ax > 0 && lat2 < lr * lr;
          }
          if (!offen) this.flaecheImRahmen(k, -lx / d, -ly / d, -lz / d, d - g, (lx / d) * tr.R, (ly / d) * tr.R, (lz / d) * tr.R, tr, tr.material);
        }
      }
      if (imRohr) {
        this.kontaktRohr(k, tr.schiene, lx, ly, lz, tr, true);
        return;
      }
      for (const kp of tr.kapseln) this.kontaktKapsel(k, kp, lx, ly, lz, tr);
      if (tr.schiene && tr.schiene.imHuellquader(lx, ly, lz)) this.kontaktRohr(k, tr.schiene, lx, ly, lz, tr, false);
    } else if (!k.rohr) {
      // von außen (Einwurf, verirrte Kugel)
      const g = tr.Ro + k.r;
      if (d2 < g * g && d2 > 0) {
        const d = Math.sqrt(d2);
        if (tr.luke && tr.lukeOffen) {
          const h = tr.luke.richtung;
          const ax = lx * h[0] + ly * h[1] + lz * h[2];
          const lr = tr.luke.radius;
          if (ax > 0 && d2 - ax * ax < lr * lr) return;
        }
        this.flaecheImRahmen(k, lx / d, ly / d, lz / d, g - d, (lx / d) * tr.Ro, (ly / d) * tr.Ro, (lz / d) * tr.Ro, tr, tr.material);
      }
    }
  }

  // ------------------------------------------------------------ Übergänge zwischen Bereichen

  uebergaenge(k) {
    const q = this.q, l = this.l;
    if (k.rohr) {
      const rohr = k.rohr, tr = rohr.geraet;
      if (tr) tr.lokal(k.px, k.py, k.pz, l); else { l[0] = k.px; l[1] = k.py; l[2] = k.pz; }
      rohr.abfrage(l[0], l[1], l[2], q);
      k.rohrS = q.s;
      if (q.vor) { k.rohr = null; if (this.beiRohr) this.beiRohr(k, rohr, "raus"); }
      else if (q.hinter) { k.rohr = null; if (this.beiRohr) this.beiRohr(k, rohr, "ende"); }
      return;
    }
    // Eintritt in ein Rohr
    if (k.geraet) {
      const tr = k.geraet, rohr = tr.schiene;
      if (!rohr) return;
      tr.lokal(k.px, k.py, k.pz, l);
      if (!rohr.imHuellquader(l[0], l[1], l[2])) return;
      rohr.abfrage(l[0], l[1], l[2], q, rohr.roMax + k.r);
      if (q.seg >= 0 && !q.vor && q.s < rohr.sEintritt && q.d < q.ri - k.r + rohr.eintritt) {
        k.rohr = rohr; k.rohrS = q.s;
        if (this.beiRohr) this.beiRohr(k, rohr, "rein");
      }
      return;
    }
    for (const rohr of this.rohre) {
      if (!rohr.imHuellquader(k.px, k.py, k.pz)) continue;
      rohr.abfrage(k.px, k.py, k.pz, q, rohr.roMax + k.r);
      if (q.seg >= 0 && !q.vor && q.s < rohr.sEintritt && q.d < q.ri - k.r + rohr.eintritt) {
        k.rohr = rohr; k.rohrS = q.s;
        if (this.beiRohr) this.beiRohr(k, rohr, "rein");
        return;
      }
    }
  }

  // ------------------------------------------------------------ Zeitschritt

  schritt() {
    const dt = this.dt, p = this.p;
    for (const tr of this.trommeln) tr.motor(dt);
    this.nK = 0;
    const K = this.kugeln;
    const g = p.schwerkraft, kw = p.luftwiderstand;
    // Geschwindigkeiten: Schwerkraft, Luftwiderstand
    for (const k of K) {
      if (k.modus !== "frei") continue;
      const v = Math.sqrt(k.vx * k.vx + k.vy * k.vy + k.vz * k.vz);
      const f = 1 - kw * v * dt;
      k.vx *= f; k.vy = k.vy * f - g * dt; k.vz *= f;
      const fw = 1 - p.winkelDaempfung * dt;
      k.wx *= fw; k.wy *= fw; k.wz *= fw;
    }
    // Kontakte
    this.kontaktKugeln();
    for (const k of K) {
      if (k.modus !== "frei") continue;
      for (const bx of this.boxen) if (this.aktiv(bx)) this.kontaktBox(k, bx);
      for (const kp of this.kapseln) if (this.aktiv(kp)) this.kontaktKapsel(k, kp, k.px, k.py, k.pz, null);
      if (k.rohr && !k.rohr.geraet) this.kontaktRohr(k, k.rohr, k.px, k.py, k.pz, null, true);
      for (const tr of this.trommeln) {
        if (k.geraet !== tr) {
          const dx = k.px - tr.cx, dy = k.py - tr.cy, dz = k.pz - tr.cz, gg = tr.Ro + k.r;
          if (dx * dx + dy * dy + dz * dz > gg * gg) continue;
        }
        this.kontaktTrommel(k, tr);
      }
    }
    // Lösen
    const n = this.nK, C = this.kontakte;
    for (let it = 0; it < p.iterationen; it++) for (let i = 0; i < n; i++) this.loese(C[i]);
    // Integration
    for (const k of K) {
      if (k.modus !== "frei") continue;
      k.px += k.vx * dt; k.py += k.vy * dt; k.pz += k.vz * dt;
      // Orientierung: q̇ = ½ (0,ω) ⊗ q
      const h = 0.5 * dt, wx = k.wx, wy = k.wy, wz = k.wz;
      const qx = k.qx, qy = k.qy, qz = k.qz, qw = k.qw;
      let nx = qx + h * (wx * qw + wy * qz - wz * qy);
      let ny = qy + h * (wy * qw + wz * qx - wx * qz);
      let nz = qz + h * (wz * qw + wx * qy - wy * qx);
      let nw = qw + h * (-wx * qx - wy * qy - wz * qz);
      const il = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz + nw * nw);
      k.qx = nx * il; k.qy = ny * il; k.qz = nz * il; k.qw = nw * il;
      this.uebergaenge(k);
    }
    this.zeit += dt;
  }
}
