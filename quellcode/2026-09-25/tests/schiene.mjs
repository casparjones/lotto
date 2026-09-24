import { Ziehung } from "../src/ablauf.js";
const z = new Ziehung(process.argv[2] ?? "1");
z.starten();
const H = z.haupt, r = H.schiene;
const orig = z.welt.beiRohr;
z.welt.beiRohr = (k, rohr, art) => { if (rohr === r) console.log(z.t.toFixed(2), z.phase, art, k.nummer, "s", k.rohrS.toFixed(3), "ω", H.omega.toFixed(2)); orig(k, rohr, art); };
const l = [0,0,0];
let last = 0;
while (z.t < Number(process.argv[3] ?? 40)) {
  z.schritt(); z.ereignisse.length = 0;
  if (z.phase === "ZIEHEN" && z.t - last > 0.5) {
    last = z.t;
    // Mündung in Welt
    const w=[0,0,0]; H.drehe(r.x[0], r.y[0], r.z[0], w);
    // Kugeln nahe Ebene x=-0.2
    const nahe = z.hauptKugeln.filter(k => k.geraet===H && Math.abs(k.px - H.cx - r.x[0]) < 0.05);
    const q = z.welt.q;
    const best = nahe.map(k => { H.lokal(k.px,k.py,k.pz,l); r.abfrage(l[0],l[1],l[2],q); return [k.nummer, q.s.toFixed(3), q.d.toFixed(3), q.vor]; }).sort((a,b)=>a[2]-b[2]).slice(0,3);
    console.log(z.t.toFixed(1), "Mündung welt", w.map(v=>v.toFixed(3)).join(","), "θ", (H.winkel*180/Math.PI%360).toFixed(0), "nahe", nahe.length, JSON.stringify(best));
  }
}
const xs = z.hauptKugeln.map(k=>k.px-H.cx); console.log("x-Verteilung", Math.min(...xs).toFixed(2), Math.max(...xs).toFixed(2), "links<-0.1:", xs.filter(x=>x<-0.1).length);
console.log("Zahlen", z.zahlen);
