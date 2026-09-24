// Abnahmetests (Headless, Node): Punkte 1, 2, 3, 6 und 8 der Abnahme.
// Aufruf: node tests/abnahme.mjs [anzahlSeeds]
import { Ziehung } from "../src/ablauf.js";

const n = Number(process.argv[2] ?? 8);
const seeds = ["19930403", ...Array.from({ length: n - 1 }, (_, i) => "seed-" + (i + 1))];
let ok = true;
const pruefe = (bed, text) => { if (!bed) ok = false; console.log((bed ? "  ✓ " : "  ✗ ") + text); };

/** Lässt eine Ziehung laufen; schritteProFrame simuliert unterschiedliche Frame-Aufteilung (1× / 2×). */
function lauf(seed, schritteProFrame) {
  const z = new Ziehung(seed);
  z.starten();
  let dauerBisEnde = null;
  while (!z.fertig && z.t < 600) {
    for (let i = 0; i < schritteProFrame; i++) {
      z.schritt();
      if (z.phase === "ENDE" && dauerBisEnde === null) dauerBisEnde = z.t;
    }
    z.ereignisse.length = 0;
  }
  return { z, dauer: dauerBisEnde, schluss: z.t };
}

let summe = { mU: 0, mT: 0, mA: 0 };
for (const seed of seeds) {
  console.log(`Seed ${seed}`);
  const a = lauf(seed, 4); // 1×: 4 Schritte je Frame bei 60 fps
  const b = lauf(seed, 8); // 2×: 8 Schritte je Frame
  const z = a.z, st = z.statistik;
  const zahlen = z.zahlen;
  pruefe(zahlen.length === 7 && new Set(zahlen).size === 7 && zahlen.every((x) => x >= 1 && x <= 49), `7 verschiedene Zahlen aus 1–49: ${zahlen.join(", ")}`);
  pruefe(Number.isInteger(z.superzahl) && z.superzahl >= 0 && z.superzahl <= 9, `Superzahl 0–9: ${z.superzahl}`);
  pruefe(JSON.stringify([zahlen, z.superzahl]) === JSON.stringify([b.z.zahlen, b.z.superzahl]), "1× und 2× identisch");
  pruefe(st.entwichen === 0, `keine Kugel verlässt die Trommel außer durch Luke/Achsauslass (entwichen: ${st.entwichen})`);
  pruefe(a.dauer >= 180 && a.dauer <= 240, `Dauer Start → Schlusstafel: ${(a.dauer / 60).toFixed(2)} min`);
  const maxU = Math.max(...st.ziehUmdrehungen);
  pruefe(maxU <= 3, `ZIEHEN: Kugel am Achsauslass nach höchstens ${maxU.toFixed(2)} Umdrehungen (≤ 3)`);
  const rate = st.aufnahmenMischen / st.umdrehungenMischen;
  console.log(`    MISCHEN: ${st.umdrehungenMischen.toFixed(1)} U, ${st.taschenMischen} Kugeln in der Schaufeltasche, ${st.aufnahmenMischen} in die Schiene · Störungen ${st.stoerungen}, Wächter ${st.waechter}`);
  summe.mU += st.umdrehungenMischen; summe.mT += st.taschenMischen; summe.mA += st.aufnahmenMischen;
}
// Wiederholbarkeit
const w1 = lauf("wiederholung", 4).z, w2 = lauf("wiederholung", 4).z;
console.log("Wiederholung");
pruefe(JSON.stringify([w1.zahlen, w1.superzahl]) === JSON.stringify([w2.zahlen, w2.superzahl]), `gleicher Seed → gleiche Zahlen (${w1.zahlen.join(", ")} | ${w1.superzahl})`);
const r1 = lauf("A", 4).z, r2 = lauf("B", 4).z;
pruefe(JSON.stringify(r1.zahlen) !== JSON.stringify(r2.zahlen), "anderer Seed → andere Zahlen");
console.log("Richtungsumkehr (Mittel über alle Seeds)");
pruefe(summe.mT / summe.mU < 0.1, `MISCHEN: ${(summe.mT / summe.mU).toFixed(3)} Kugeln je Umdrehung in der Schaufel (< 0,1), ${(summe.mA / summe.mU).toFixed(3)} in der Schiene`);
console.log(ok ? "\nALLE PRÜFUNGEN BESTANDEN" : "\nPRÜFUNGEN FEHLGESCHLAGEN");
process.exit(ok ? 0 : 1);
