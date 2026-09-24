import { Ziehung } from "../src/ablauf.js";
const z = new Ziehung(process.argv[2] ?? "1");
z.starten();
const H = z.haupt, r = H.schiene;
console.log("sEnde", r.sEnde.toFixed(3), "sAchse", r.sAchse.toFixed(3), "sEintritt", r.sEintritt.toFixed(3), "klappe", r.klappeS);
let last = 0;
const l=[0,0,0];
while (z.t < Number(process.argv[3] ?? 60)) {
  z.schritt();
  for (const e of z.ereignisse) if (e.typ !== "sperre") console.log(e.t.toFixed(2), e.typ, e.phase ?? "", e.nummer ?? "");
  z.ereignisse.length = 0;
  if (z.t - last > 0.25) {
    last = z.t;
    const im = z.hauptKugeln.filter((k) => k.rohr === r && k.rohrS > 0.03);
    if (im.length) console.log("  ", z.t.toFixed(2), z.phase, "θ°", ((H.winkel * 180 / Math.PI) % 360).toFixed(0), "klappe", r.klappeOffen ? "auf" : "zu", im.map((k) => { H.lokal(k.px,k.py,k.pz,l); return `${k.nummer}@s${k.rohrS.toFixed(3)} y${(k.py-H.cy).toFixed(2)} ρ${Math.hypot(l[1],l[2]).toFixed(3)} x${l[0].toFixed(2)}`; }).join(" | "));
  }
}
