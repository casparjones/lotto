// Geometrie des Geräts als reine Daten. Physik und Darstellung bauen beide darauf auf,
// damit Kollider und sichtbare Teile exakt übereinstimmen.
import { CONFIG } from "./config.js";
import { sinCos, GRAD, normiere, kreuz, mal, plus, minus, laenge } from "./mathe.js";

const sc = [0, 0];

/** Punkt in Trommelkoordinaten aus (x, Radius, Winkel um die Achse). */
function zylinderPunkt(x, rho, phi) {
  sinCos(phi, sc);
  return [x, rho * sc[1], rho * sc[0]];
}

/**
 * Auswerfschiene als Mittellinie mit Innen- und Außenradius je Punkt (Trommelkoordinaten).
 * Aufbau: Trichter (Schaufel an der Wand) → Spirale zur Achse → Viertelbogen → konische Hohlachse.
 */
export function schienenPolylinie(s) {
  const pkt = [];
  const phiM = s.phiMuendungGrad * GRAD;
  const bogen = s.bogenGrad * GRAD;
  const b = s.bogenRadius;
  const add = (p, ri) => pkt.push({ x: p[0], y: p[1], z: p[2], ri, ro: ri + s.wand });

  const rhoWand = (x) => Math.sqrt(s.wandRadius * s.wandRadius - x * x);
  const xVon = (u) => {
    const f = u >= s.uebergang ? 1 : u / s.uebergang;
    return s.muendungX + (s.ebeneX - s.muendungX) * f * f * (3 - 2 * f);
  };
  // Trichter: kurzer Bogen vor der Mündung an der Wand, weitet sich zur Schaufel auf (Mündung zeigt in Ziehrichtung +phi)
  const rho0 = rhoWand(s.muendungX);
  const dPhiT = s.trichterLaenge / rho0;
  for (let i = 0; i < s.trichterPunkte; i++) {
    const f = i / s.trichterPunkte;
    add(zylinderPunkt(s.muendungX, rho0, phiM + dPhiT * (1 - f)), s.trichterRadius + (s.innen - s.trichterRadius) * f);
  }
  const iMuendung = pkt.length;
  // Spirale: an der Mündung tangential entlang der Wand, am Ende radial zur Achse
  for (let i = 0; i <= s.punkte; i++) {
    const u = i / s.punkte;
    const phi = phiM - bogen * (1 - (1 - u) * (1 - u));
    const x = xVon(u);
    const g = u * Math.sqrt(u);
    const rho = rhoWand(x) * (1 - g) + b * g;
    add(zylinderPunkt(x, rho, phi), s.innen);
  }
  // Viertelbogen in der Ebene (x, Radius): Mittelpunkt (ebeneX − b, b)
  const phiE = phiM - bogen;
  const nBogen = 7;
  for (let j = 1; j <= nBogen; j++) {
    sinCos((-Math.PI / 2) * (j / nBogen), sc);
    add(zylinderPunkt(s.ebeneX - b + b * sc[1], b + b * sc[0], phiE), s.innen);
  }
  const iAchse = pkt.length - 1;
  // Hohlachse, konisch erweitert
  const x0 = s.ebeneX - b;
  for (let j = 1; j <= s.achsPunkte; j++) {
    const f = j / s.achsPunkte;
    add([x0 + (s.achsEnde - x0) * f, 0, 0], s.innen + (s.achsInnenEnde - s.innen) * f);
  }
  // Bogenlänge
  let acc = 0;
  pkt[0].s = 0;
  for (let i = 1; i < pkt.length; i++) {
    const a = pkt[i - 1], c = pkt[i];
    acc += Math.sqrt((c.x - a.x) ** 2 + (c.y - a.y) ** 2 + (c.z - a.z) ** 2);
    c.s = acc;
  }
  return {
    punkte: pkt,
    iMuendung,
    sKlappe: s.taschenLaenge,
    sSperre: acc - s.sperreVorEnde,
    klappeHoehe: s.klappeHoehe,
    sEintritt: pkt[iMuendung].s + 0.01,
    sAchse: pkt[iAchse].s,
    sEnde: acc,
    eintritt: s.eintritt,
  };
}

/** Rotierende Teile eines Geräts in Trommelkoordinaten. */
export function geraetGeometrie(g) {
  const kapseln = [];
  for (const [phiGrad, neigung] of g.speichen.liste) {
    sinCos(phiGrad * GRAD, sc);
    const d = normiere([neigung, sc[1], sc[0]]);
    kapseln.push({ a: [0, 0, 0], b: mal(d, g.speichen.laenge), r: g.speichen.radius, teil: "speiche", material: "metall" });
  }
  kapseln.push({ a: [0, 0, 0], b: [0, 0, 0], r: g.nabe, teil: "nabe", material: "metall" });
  kapseln.push({ a: [g.welle.links, 0, 0], b: [g.welle.rechts, 0, 0], r: g.welle.radius, teil: "welle", material: "metall" });
  const luke = g.luke ? { richtung: normiere(g.luke.richtung), radius: g.luke.radius } : null;
  return { kapseln, schiene: schienenPolylinie(g.schiene), luke };
}

// ---------------------------------------------------------------- Quader-Helfer (OBB)

/** Achsparalleler Quader aus Mittelpunkt und Halbmaßen. */
function quader(name, c, h, material, extra = {}) {
  return { name, c, u: [1, 0, 0], v: [0, 1, 0], w: [0, 0, 1], h, material, ...extra };
}

/** Platte, deren Oberseite durch `mitte` geht; L = Längsrichtung, W = Querrichtung. */
function platte(name, mitte, L, W, laengeM, breite, dicke, material, extra = {}) {
  let n = normiere(kreuz(W, L));
  if (n[1] < 0) n = mal(n, -1);
  const c = minus(mitte, mal(n, dicke / 2));
  return { name, c, u: normiere(L), v: n, w: normiere(W), h: [laengeM / 2, dicke / 2, breite / 2], material, ...extra };
}

/** Senkrechte Wand zwischen zwei Punkten im Grundriss. */
function wand(name, x1, z1, x2, z2, yu, yo, dicke, material, extra = {}) {
  const u = normiere([x2 - x1, 0, z2 - z1]);
  const v = [0, 1, 0];
  const w = kreuz(u, v);
  const len = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
  return { name, c: [(x1 + x2) / 2, (yu + yo) / 2, (z1 + z2) / 2], u, v, w, h: [len / 2, (yo - yu) / 2, dicke / 2], material, ...extra };
}

/** Punkt der Einwurfluke in Weltkoordinaten (Trommel in Grundstellung). */
export function lukenPunkt() {
  const g = CONFIG.haupt;
  const h = normiere(g.luke.richtung);
  return plus(g.zentrum, mal(h, g.radius));
}

/** Oberfläche der Sammelrampe unter der Schütte. */
export function rampenHoehe(x) {
  const s = CONFIG.schuette;
  sinCos(s.neigungGrad * GRAD, sc);
  return s.unterkanteY + (x - s.unterkanteX) * (sc[0] / sc[1]);
}

/** Lage einer Mulde (Kugelmittelpunkt auf der Schieberplatte) und Normale der Rampe. */
export function muldenPosition(reihe, spalte) {
  const s = CONFIG.schuette;
  sinCos(s.neigungGrad * GRAD, sc);
  const n = [-sc[0], sc[1], 0];
  const x = s.raster.x0 + reihe * s.raster.abstand;
  const z = lukenPunkt()[2] + (spalte - (s.raster.spalten - 1) / 2) * s.raster.abstand;
  const boden = [x, rampenHoehe(x), z];
  return plus(boden, mal(n, s.schieberHoehe + CONFIG.kugel.radius));
}

/** Höhe der Verteilerbahn B an Stelle x. */
export function bahnHoehe(x) {
  const b = CONFIG.bahn;
  return b.bStartY - (x - b.bStartX) * b.bGefaelle;
}

export function roehrchenX(i) {
  return CONFIG.roehrchen.x0 + i * CONFIG.roehrchen.abstand;
}

export function achsauslassWelt(g) {
  return [g.zentrum[0] + g.schiene.achsEnde, g.zentrum[1], g.zentrum[2]];
}

/** Alle feststehenden Teile: Quader, Kapseln und Rohre in Weltkoordinaten. */
export function statischeTeile() {
  const boxen = [];
  const kapseln = [];
  const rohre = [];
  const S = CONFIG.schuette;
  const kr = CONFIG.kugel.radius;

  // ---------------- Schütte / Sammelrinne (V-Profil, fällt zur Luke hin ab)
  const lp = lukenPunkt();
  const xA = lp[0], zA = lp[2];
  sinCos(S.neigungGrad * GRAD, sc);
  const L = [sc[1], sc[0], 0];
  const lenR = (S.oberkanteX - S.unterkanteX) / sc[1];
  const xm = (S.unterkanteX + S.oberkanteX) / 2;
  const q = sinCos(S.querGrad * GRAD, [0, 0]);
  const bq = S.breite / q[1];
  for (const seite of [-1, 1]) {
    const W = [0, q[0], seite * q[1]];
    const mitte = [xm, rampenHoehe(xm) + (bq / 2) * q[0], zA + seite * (S.breite / 2)];
    boxen.push(platte(seite < 0 ? "rinneHinten" : "rinneVorn", mitte, L, W, lenR, bq, S.plattenDicke, "acryl", { teil: "schuette" }));
  }
  const yU = rampenHoehe(S.unterkanteX) - 0.012;
  const yO = rampenHoehe(S.oberkanteX) + S.wandHoehe;
  const kb = S.kanalBreite / 2;
  const wd = 0.004;
  // Seitenwände parallel zum Gefälle (Höhe über der Rinnensohle konstant)
  const wandSchraeg = (name, xa, za, xb, zb) => {
    const ya = rampenHoehe(xa), yb = rampenHoehe(xb);
    const u = normiere([xb - xa, yb - ya, zb - za]);
    const w = normiere(kreuz(u, [0, 1, 0]));
    const v = kreuz(w, u);
    const len = Math.sqrt((xb - xa) ** 2 + (yb - ya) ** 2 + (zb - za) ** 2);
    const h0 = -0.015, h1 = S.wandHoehe;
    const c = [(xa + xb) / 2 + v[0] * (h0 + h1) / 2, (ya + yb) / 2 + v[1] * (h0 + h1) / 2, (za + zb) / 2 + v[2] * (h0 + h1) / 2];
    boxen.push({ name, c, u, v, w, h: [len / 2, (h1 - h0) / 2, wd / 2], material: "acryl", teil: "schuette" });
  };
  wandSchraeg("rinneWandHinten", S.leitwandBisX, zA - S.breite, S.oberkanteX, zA - S.breite);
  wandSchraeg("rinneWandVorn", S.leitwandBisX, zA + S.breite, S.oberkanteX, zA + S.breite);
  wandSchraeg("leitwandHinten", S.kanalBisX, zA - kb, S.leitwandBisX, zA - S.breite);
  wandSchraeg("leitwandVorn", S.kanalBisX, zA + kb, S.leitwandBisX, zA + S.breite);
  boxen.push(wand("rinneWandOben", S.oberkanteX, zA - S.breite, S.oberkanteX, zA + S.breite, rampenHoehe(S.oberkanteX) - 0.015, rampenHoehe(S.oberkanteX) + S.wandHoehe, wd, "acryl", { teil: "schuette" }));
  const tr = S.einwurfTrichter;
  const xPrall = xA - S.prallwandAbstand;
  const yK = rampenHoehe(S.unterkanteX) + S.wandHoehe;
  boxen.push(wand("kanalHinten", xPrall, zA - kb, S.kanalBisX, zA - kb, tr.oben - 0.03, yK, wd, "acryl", { teil: "schuette" }));
  boxen.push(wand("kanalVorn", xPrall, zA + kb, S.kanalBisX, zA + kb, tr.oben - 0.03, yK, wd, "acryl", { teil: "schuette" }));
  boxen.push(wand("prallwand", xPrall, zA - kb, xPrall, zA + kb, tr.oben - 0.03, yK, wd, "acryl", { teil: "schuette" }));
  rohre.push({
    name: "einwurf",
    punkte: [
      { x: xA, y: tr.oben, z: zA, ri: tr.radiusOben, ro: tr.radiusOben + 0.003 },
      { x: xA, y: tr.mitte, z: zA, ri: tr.radiusUnten, ro: tr.radiusUnten + 0.003 },
      { x: xA, y: tr.unten, z: zA, ri: tr.radiusUnten, ro: tr.radiusUnten + 0.003 },
    ],
    eintritt: kr,
    sEintritt: 0.05,
    material: "acryl",
  });

  // ---------------- Podest (fängt verirrte Kugeln auf)
  const Pd = CONFIG.studio.podest;
  boxen.push(quader("podest", [0.2, Pd.hoehe / 2, Pd.z], [Pd.breite / 2, Pd.hoehe / 2, Pd.tiefe / 2], "sockel", { teil: "podest", unsichtbar: true }));

  // ---------------- Fallschacht
  const F = CONFIG.fallschacht;
  const fx = F.x, fz = F.z, hx = F.halbX, hz = F.halbZ, d = 0.003;
  const hoch = (a, b) => [(a + b) / 2, (b - a) / 2];
  let [cy, hy] = hoch(F.unten, F.oben);
  boxen.push(quader("schachtLinks", [fx - hx - d, cy, fz], [d, hy, hz + d], "acryl", { teil: "fallschacht" }));
  boxen.push(quader("schachtHinten", [fx, cy, fz - hz - d], [hx, hy, d], "acryl", { teil: "fallschacht" }));
  [cy, hy] = hoch(F.unten, F.rechteWandOben);
  boxen.push(quader("schachtRechts", [fx + hx + d, cy, fz], [d, hy, hz + d], "acryl", { teil: "fallschacht" }));
  [cy, hy] = hoch(F.vorderwandUnten, F.oben);
  boxen.push(quader("schachtVorn", [fx, cy, fz + hz + d], [hx, hy, d], "acryl", { teil: "fallschacht" }));
  boxen.push(quader("schachtDeckel", [fx, F.oben + d, fz], [hx + 2 * d, d, hz + 2 * d], "acryl", { teil: "fallschacht" }));
  const LU = normiere([0, F.umlenkVorn - F.umlenkHinten, 2 * hz]);
  boxen.push(platte("umlenkblech", [fx, (F.umlenkHinten + F.umlenkVorn) / 2, fz], LU, [1, 0, 0], 2 * hz / LU[2], 2 * hx, 0.004, "bahn", { teil: "bahn" }));
  // Führungsstäbe in den Ecken (sichtbar, zugleich Kollider)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    kapseln.push({ a: [fx + sx * (hx - 0.006), F.unten, fz + sz * (hz - 0.006)], b: [fx + sx * (hx - 0.006), F.oben, fz + sz * (hz - 0.006)], r: F.fuehrungsstaebe, material: "metall", teil: "fuehrungsstab" });
  }

  // ---------------- Verteilerbahn A (nach vorn) und B (entlang der Röhrchen)
  const B = CONFIG.bahn;
  const R = CONFIG.roehrchen;
  const zA0 = fz + hz;
  const LA = normiere([0, B.aEndeY - F.umlenkVorn, B.aEndeZ - zA0]);
  const lenA = (B.aEndeZ - zA0) / LA[2];
  boxen.push(platte("bahnA", [fx, (F.umlenkVorn + B.aEndeY) / 2, (zA0 + B.aEndeZ) / 2], LA, [1, 0, 0], lenA, B.aBreite, 0.004, "bahn", { teil: "bahn" }));
  const ha = B.aBreite / 2 + 0.003;
  const bz0 = B.bZ - B.bBreite / 2, bz1 = B.bZ + B.bBreite / 2;
  boxen.push(wand("bahnAlinks", fx - ha, zA0, fx - ha, bz0, B.aEndeY - 0.01, F.umlenkVorn + B.wandHoehe, 0.004, "acryl", { teil: "bahn" }));
  boxen.push(wand("bahnArechts", fx + ha, zA0, fx + ha, bz0, B.aEndeY - 0.01, F.umlenkVorn + B.wandHoehe, 0.004, "acryl", { teil: "bahn" }));
  const yB0 = bahnHoehe(B.bStartX), yB1 = bahnHoehe(B.bEndeX);
  boxen.push(wand("bahnBvorn", B.bStartX, bz1 + 0.002, B.bEndeX, bz1 + 0.002, yB1 - 0.012, yB0 + B.wandHoehe, 0.004, "acryl", { teil: "bahn" }));
  boxen.push(wand("bahnBhinten", fx + ha, bz0 - 0.002, B.bEndeX, bz0 - 0.002, yB1 - 0.012, yB0 + B.wandHoehe, 0.004, "acryl", { teil: "bahn" }));
  boxen.push(wand("bahnBanfang", B.bStartX - 0.002, bz0, B.bStartX - 0.002, bz1, yB0 - 0.012, yB0 + B.wandHoehe, 0.004, "acryl", { teil: "bahn" }));
  boxen.push(wand("bahnBende", B.bEndeX + 0.002, bz0, B.bEndeX + 0.002, bz1, yB1 - 0.012, yB1 + B.wandHoehe, 0.004, "acryl", { teil: "bahn" }));
  // Bodenplatten zwischen den Löchern, Deckschieber über den Löchern
  const LB = normiere([1, -B.bGefaelle, 0]);
  const cosB = LB[0];
  const stueck = (name, x0, x1, extra) => {
    const xm2 = (x0 + x1) / 2;
    boxen.push(platte(name, [xm2, bahnHoehe(xm2), B.bZ], LB, [0, 0, 1], (x1 - x0) / cosB, B.bBreite, 0.004, "bahn", { teil: "bahn", ...extra }));
  };
  let xLauf = B.bStartX;
  for (let i = 0; i < R.anzahl; i++) {
    const xi = roehrchenX(i);
    stueck("bahnB" + i, xLauf, xi - B.loch / 2);
    stueck("deckel" + i, xi - B.loch / 2, xi + B.loch / 2, { schalter: "deckel" + i });
    const xs = xi + B.loch / 2 + B.stiftRadius;
    const ys = bahnHoehe(xs) + B.stiftHoehe;
    kapseln.push({ a: [xs, ys, bz0], b: [xs, ys, bz1], r: B.stiftRadius, material: "metall", teil: "stift", schalter: "stift" + i });
    xLauf = xi + B.loch / 2;
  }
  stueck("bahnBrest", xLauf, B.bEndeX);

  // ---------------- Auffangröhrchen und blauer Sockel
  for (let i = 0; i < R.anzahl; i++) {
    const xi = roehrchenX(i);
    const yt = bahnHoehe(xi);
    rohre.push({
      name: "roehrchen" + i,
      index: i,
      punkte: [
        { x: xi, y: yt, z: B.bZ, ri: R.trichter, ro: R.trichter + R.glas },
        { x: xi, y: yt - R.trichterTiefe, z: B.bZ, ri: R.innen, ro: R.innen + R.glas },
        { x: xi, y: R.boden, z: B.bZ, ri: R.innen, ro: R.innen + R.glas },
      ],
      eintritt: R.eintritt,
      sEintritt: 0.03,
      material: "glas",
    });
  }
  const so = R.sockel;
  boxen.push(quader("sockel", [(so.von + so.bis) / 2, (so.unten + R.boden) / 2, B.bZ], [(so.bis - so.von) / 2, (R.boden - so.unten) / 2, so.tiefe / 2], "sockel", { teil: "sockel", klack: true }));

  // ---------------- Superzahl: Schacht direkt über dem Röhrchen
  const SA = CONFIG.superAuslauf;
  const sp = achsauslassWelt(CONFIG.superzahl);
  const sx = sp[0] - 0.012, sz = sp[2], sh = SA.schachtHalb;
  [cy, hy] = hoch(SA.schachtUnten, SA.schachtOben);
  boxen.push(quader("superSchachtLinks", [sx - sh - d, cy, sz], [d, hy, sh + d], "acryl", { teil: "superschacht" }));
  boxen.push(quader("superSchachtHinten", [sx, cy, sz - sh - d], [sh, hy, d], "acryl", { teil: "superschacht" }));
  boxen.push(quader("superSchachtVorn", [sx, cy, sz + sh + d], [sh, hy, d], "acryl", { teil: "superschacht" }));
  [cy, hy] = hoch(SA.schachtUnten, SA.rechteWandOben);
  boxen.push(quader("superSchachtRechts", [sx + sh + d, cy, sz], [d, hy, sh + d], "acryl", { teil: "superschacht" }));
  boxen.push(quader("superSchachtDeckel", [sx, SA.schachtOben + d, sz], [sh + 2 * d, d, sh + 2 * d], "acryl", { teil: "superschacht" }));
  rohre.push({
    name: "superRoehrchen",
    index: 7,
    punkte: [
      { x: sx, y: SA.roehrchenOben, z: sz, ri: sh - 0.004, ro: sh - 0.002 },
      { x: sx, y: SA.trichterUnten, z: sz, ri: R.innen, ro: R.innen + R.glas },
      { x: sx, y: SA.boden, z: sz, ri: R.innen, ro: R.innen + R.glas },
    ],
    eintritt: kr,
    sEintritt: 0.03,
    material: "glas",
  });
  boxen.push(quader("superSockel", [sx, (so.unten + SA.boden) / 2, sz], [0.045, (SA.boden - so.unten) / 2, 0.045], "sockel", { teil: "sockel", klack: true }));

  return { boxen, kapseln, rohre, superRoehrchenX: sx, superRoehrchenZ: sz };
}

export { laenge };
