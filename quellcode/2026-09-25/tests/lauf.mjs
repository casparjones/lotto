// Headless-Durchlauf einer Ziehung mit Protokoll (Entwicklungswerkzeug)
import { Ziehung } from "../src/ablauf.js";
const seed = process.argv[2] ?? "19930403";
const maxT = Number(process.argv[3] ?? 400);
const verbose = process.argv.includes("-v");
const z = new Ziehung(seed);
z.starten();
const t0 = performance.now();
let letzte = 0;
while (!z.fertig && z.t < maxT) {
  z.schritt();
  for (const e of z.ereignisse) {
    if (e.typ === "phase" || e.typ === "sub" || verbose) console.log(e.t.toFixed(2).padStart(7), e.typ, e.phase ?? "", e.sub ?? "", e.nummer ?? "", e.text ?? "", e.index ?? "");
    else console.log(e.t.toFixed(2).padStart(7), e.typ, JSON.stringify(e));
  }
  z.ereignisse.length = 0;
  if (verbose && z.t - letzte > 1) {
    letzte = z.t;
    const H = z.haupt;
    const drin = z.hauptKugeln.filter((k) => k.geraet === H).length;
    const schiene = z.hauptKugeln.filter((k) => k.rohr === H.schiene).map((k) => k.nummer + "@" + k.rohrS.toFixed(2));
    const ein = z.hauptKugeln.filter((k) => k.zone === "einwurf" && k.geraet !== H).map(k=>`${k.nummer}:${k.px.toFixed(2)},${k.py.toFixed(2)},${k.pz.toFixed(2)}`);
    console.log("   t", z.t.toFixed(1), "ω", H.omega.toFixed(2), "drin", drin, "schiene", schiene.join(" "), "ein", ein.slice(0,6).join(" "), "nK", z.welt.nK);
  }
}
const ms = performance.now() - t0;
console.log("Zahlen", z.zahlen, "Superzahl", z.superzahl, "Dauer", z.t.toFixed(1), "s  Rechenzeit", (ms / 1000).toFixed(1), "s");
const st = z.statistik;
console.log("Tasche Mischen", st.taschenMischen, "Tasche Ziehen", st.taschenZiehen, "Umdr. Mischen", st.umdrehungenMischen.toFixed(1), "Aufnahmen Mischen", st.aufnahmenMischen, "Umdr. Ziehen", st.umdrehungenZiehen.toFixed(1), "Aufn. Ziehen", st.aufnahmenZiehen);
console.log("Zieh-Umdrehungen bis Auslass", st.ziehUmdrehungen.map((u) => u.toFixed(2)).join(" "), "entwichen", st.entwichen, "Störungen", st.stoerungen, "Wächter", st.waechter);
