// Darstellung: Studio, Gerät, Kugeln, Lupe und Nachbearbeitung (TV-Look 1993).
// Alle Teile werden aus denselben Geometriedaten gebaut wie die Kollider der Physik.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CONFIG } from "./config.js";
import { geraetGeometrie, statischeTeile, muldenPosition, lukenPunkt, rampenHoehe, bahnHoehe, roehrchenX, achsauslassWelt } from "./geometrie.js";
import { kugelMaterial } from "./kugeltextur.js";

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// ------------------------------------------------------------------ Materialien

function erzeugeMaterialien(hochwertig) {
  const S = CONFIG.studio;
  const acrylBasis = {
    color: 0xffffff,
    metalness: 0,
    roughness: 0.03,
    ior: 1.49,
    specularIntensity: 1,
    envMapIntensity: 1.25,
    clearcoat: 0.6,
    clearcoatRoughness: 0.05,
  };
  return {
    // Trommel: Acryl mit Fresnel-Reflexion und leichter Brechung
    acrylTrommel: hochwertig
      ? new THREE.MeshPhysicalMaterial({ ...acrylBasis, transmission: 1, thickness: 0.012, attenuationColor: new THREE.Color("#eef6ff"), attenuationDistance: 1.5, side: THREE.DoubleSide, transparent: true })
      : new THREE.MeshPhysicalMaterial({ ...acrylBasis, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }),
    glas: hochwertig
      ? new THREE.MeshPhysicalMaterial({ ...acrylBasis, transmission: 1, thickness: 0.003, ior: 1.5, side: THREE.DoubleSide, transparent: true })
      : new THREE.MeshPhysicalMaterial({ ...acrylBasis, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
    // Kleinteile aus Plexiglas: günstig transparent (Schacht, Bahn, Schütte)
    plexi: new THREE.MeshPhysicalMaterial({ ...acrylBasis, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
    plexiKante: new THREE.MeshPhysicalMaterial({ ...acrylBasis, color: 0xdfeaf3, transparent: true, opacity: 0.35, depthWrite: false }),
    bahn: new THREE.MeshPhysicalMaterial({ ...acrylBasis, color: 0xdde6ee, roughness: 0.25, transparent: true, opacity: 0.55, depthWrite: false }),
    lack: new THREE.MeshStandardMaterial({ color: S.metall, roughness: 0.32, metalness: 0.55, envMapIntensity: 0.9 }),
    lackMatt: new THREE.MeshStandardMaterial({ color: "#26292f", roughness: 0.55, metalness: 0.3 }),
    chrom: new THREE.MeshStandardMaterial({ color: "#e4e8ee", roughness: 0.16, metalness: 1, envMapIntensity: 1.3 }),
    stahl: new THREE.MeshStandardMaterial({ color: "#b9c0c8", roughness: 0.3, metalness: 0.9 }),
    blau: new THREE.MeshStandardMaterial({ color: S.sockelBlau, roughness: 0.42, metalness: 0.1 }),
    pult: new THREE.MeshStandardMaterial({ color: S.pultFarbe, roughness: 0.5, metalness: 0.35 }),
    podest: new THREE.MeshStandardMaterial({ color: "#9aa6b3", roughness: 0.85, metalness: 0 }),
    podestKante: new THREE.MeshStandardMaterial({ color: "#6f7a86", roughness: 0.6, metalness: 0.2 }),
  };
}

// ------------------------------------------------------------------ Hilfen

function zylinderZwischen(a, b, r, mat, seg = 12) {
  const va = V(a), vb = V(b);
  const len = va.distanceTo(vb);
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return m;
}

function boxMesh(bx, mat) {
  const g = new THREE.BoxGeometry(bx.h[0] * 2, bx.h[1] * 2, bx.h[2] * 2);
  const m = new THREE.Mesh(g, mat);
  const basis = new THREE.Matrix4().makeBasis(V(bx.u), V(bx.v), V(bx.w));
  m.quaternion.setFromRotationMatrix(basis);
  m.position.copy(V(bx.c));
  return m;
}

/** Parallel-Transport-Rahmen entlang einer Polylinie. */
function rahmen(punkte) {
  const n = punkte.length;
  const T = [], N = [], B = [];
  for (let i = 0; i < n; i++) {
    const a = punkte[Math.max(0, i - 1)], b = punkte[Math.min(n - 1, i + 1)];
    T.push(b.clone().sub(a).normalize());
  }
  let nn = new THREE.Vector3(0, 1, 0);
  if (Math.abs(nn.dot(T[0])) > 0.9) nn.set(1, 0, 0);
  nn.sub(T[0].clone().multiplyScalar(nn.dot(T[0]))).normalize();
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const q = new THREE.Quaternion().setFromUnitVectors(T[i - 1], T[i]);
      nn = nn.clone().applyQuaternion(q);
      nn.sub(T[i].clone().multiplyScalar(nn.dot(T[i]))).normalize();
    }
    N.push(nn.clone());
    B.push(T[i].clone().cross(nn).normalize());
  }
  return { T, N, B };
}

// ------------------------------------------------------------------ Trommel (rotierender Teil)

function baueTrommel(g, M, istHaupt) {
  const geo = geraetGeometrie(g);
  const gruppe = new THREE.Group(); // dreht sich mit der Trommel
  const halter = new THREE.Group(); // Lage im Raum
  halter.position.copy(V(g.zentrum));
  halter.add(gruppe);

  // Acrylkugel
  const schale = new THREE.Mesh(new THREE.SphereGeometry(g.radius + g.wand / 2, 96, 64), M.acrylTrommel);
  schale.renderOrder = 2;
  gruppe.add(schale);
  // Flanschring der beiden Halbschalen und Polkappen
  const flansch = new THREE.Mesh(new THREE.TorusGeometry(g.radius + g.wand, 0.006, 10, 128), M.plexiKante);
  flansch.rotation.y = Math.PI / 2;
  gruppe.add(flansch);
  for (const sx of [-1, 1]) {
    const kappe = new THREE.Mesh(new THREE.CylinderGeometry(g.radius * 0.17, g.radius * 0.17, 0.012, 40), M.lack);
    kappe.rotation.z = Math.PI / 2;
    kappe.position.x = sx * (Math.sqrt(g.radius ** 2 - (g.radius * 0.17) ** 2) + 0.004);
    gruppe.add(kappe);
  }
  // Speichenkreuz, Nabe, Welle
  for (const k of geo.kapseln) {
    if (k.teil === "nabe") {
      const n = new THREE.Mesh(new THREE.SphereGeometry(k.r, 24, 16), M.chrom);
      n.castShadow = true;
      gruppe.add(n);
    } else {
      const s = zylinderZwischen(k.a, k.b, k.r, M.chrom, 10);
      s.castShadow = true;
      gruppe.add(s);
      if (k.teil === "speiche") {
        const kopf = new THREE.Mesh(new THREE.SphereGeometry(k.r * 1.6, 10, 8), M.chrom);
        kopf.position.copy(V(k.b));
        gruppe.add(kopf);
      }
    }
  }
  // Auswerfschiene: Drahtkäfig (4 Längsdrähte + Ringe) innerhalb der Trommel, Hohlachse außerhalb massiv
  const sch = geo.schiene;
  const pkt = sch.punkte.map((p) => new THREE.Vector3(p.x, p.y, p.z));
  const { T, N, B } = rahmen(pkt);
  const innenGrenze = g.radius - 0.004;
  const imInnern = (i) => pkt[i].x > -g.radius + 0.01;
  const drahtR = g === CONFIG.superzahl ? 0.0013 : 0.0017;
  for (let w = 0; w < 4; w++) {
    const a = (w / 4) * Math.PI * 2 + Math.PI / 4;
    const kurve = [];
    for (let i = 0; i < pkt.length; i++) {
      if (!imInnern(i)) break;
      const r = sch.punkte[i].ri + drahtR;
      const p = pkt[i].clone().add(N[i].clone().multiplyScalar(Math.cos(a) * r)).add(B[i].clone().multiplyScalar(Math.sin(a) * r));
      if (p.length() > innenGrenze) p.setLength(innenGrenze); // Schaufel schmiegt sich an die Wand
      kurve.push(p);
    }
    const c = new THREE.CatmullRomCurve3(kurve);
    const t = new THREE.Mesh(new THREE.TubeGeometry(c, kurve.length * 4, drahtR, 6, false), M.chrom);
    t.castShadow = true;
    gruppe.add(t);
  }
  let sLetzt = -1;
  for (let i = 0; i < pkt.length; i++) {
    if (!imInnern(i)) break;
    const sp = sch.punkte[i];
    if (sp.s - sLetzt < 0.028 && i > 0) continue;
    sLetzt = sp.s;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(sp.ri + drahtR, drahtR, 6, 28), M.chrom);
    ring.position.copy(pkt[i]);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), T[i]);
    if (pkt[i].length() + sp.ri > innenGrenze) {
      // Ring der Schaufel: an der Wand abgeflacht
      const f = Math.max(0.55, (innenGrenze - pkt[i].length()) / sp.ri + 0.35);
      ring.scale.set(1, f, 1);
    }
    gruppe.add(ring);
  }
  // Taschenklappe
  const iK = sch.punkte.findIndex((p) => p.s >= sch.sKlappe);
  const klappeDreh = new THREE.Group();
  klappeDreh.position.copy(pkt[iK]);
  klappeDreh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), T[iK]);
  const klappeScharnier = new THREE.Group();
  klappeScharnier.position.set(0, CONFIG.haupt.schiene.innen, 0);
  const klappe = new THREE.Mesh(new THREE.CylinderGeometry(CONFIG.haupt.schiene.innen * 0.95, CONFIG.haupt.schiene.innen * 0.95, 0.002, 20), M.stahl);
  klappe.rotation.x = Math.PI / 2;
  klappe.position.set(0, -CONFIG.haupt.schiene.innen, 0);
  klappeScharnier.add(klappe);
  klappeDreh.add(klappeScharnier);
  gruppe.add(klappeDreh);
  // Hohlachse links (massiv sichtbar), rechte Achse
  const ax = g.achse;
  const achsL = zylinderZwischen([-g.radius + 0.004, 0, 0], [g.schiene.achsEnde, 0, 0], ax.aussen, M.stahl, 24);
  achsL.castShadow = true;
  gruppe.add(achsL);
  const muendung = new THREE.Mesh(new THREE.TorusGeometry(ax.aussen - 0.003, 0.003, 8, 24), M.chrom);
  muendung.rotation.y = Math.PI / 2;
  muendung.position.x = g.schiene.achsEnde;
  gruppe.add(muendung);
  const loch = new THREE.Mesh(new THREE.CircleGeometry(ax.aussen - 0.004, 24), new THREE.MeshBasicMaterial({ color: 0x050505 }));
  loch.rotation.y = -Math.PI / 2;
  loch.position.x = g.schiene.achsEnde - 0.0005;
  gruppe.add(loch);
  const achsR = zylinderZwischen([g.radius - 0.004, 0, 0], [ax.rechtsEnde, 0, 0], ax.aussen * 0.9, M.stahl, 24);
  achsR.castShadow = true;
  gruppe.add(achsR);
  // Lager-/Antriebsscheibe mit Schraubenkranz (macht die Drehung sichtbar)
  const L = g.lagerscheibe;
  const scheibe = new THREE.Mesh(new THREE.CylinderGeometry(L.radius, L.radius, L.dicke, 64), M.lack);
  scheibe.rotation.z = Math.PI / 2;
  scheibe.position.x = L.x;
  scheibe.castShadow = true;
  gruppe.add(scheibe);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(L.radius * 0.07, L.radius * 0.07, 0.006, 12), M.chrom);
    b.rotation.z = Math.PI / 2;
    b.position.set(L.x + L.dicke / 2 * (i % 2 ? 1 : -1), Math.cos(a) * L.radius * 0.72, Math.sin(a) * L.radius * 0.72);
    gruppe.add(b);
  }
  const markierung = new THREE.Mesh(new THREE.BoxGeometry(0.004, L.radius * 0.35, 0.01), new THREE.MeshStandardMaterial({ color: "#e8e2d0", roughness: 0.5 }));
  markierung.position.set(L.x + L.dicke / 2 + 0.001, L.radius * 0.72, 0);
  gruppe.add(markierung);

  // Einwurfluke
  let lukeDeckel = null;
  if (geo.luke) {
    const h = V(geo.luke.richtung);
    const lukeGr = new THREE.Group();
    lukeGr.position.copy(h.clone().multiplyScalar(g.radius + g.wand));
    lukeGr.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), h);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(geo.luke.radius + 0.004, 0.004, 8, 40), M.plexiKante);
    ring.rotation.x = Math.PI / 2;
    lukeGr.add(ring);
    const scharnier = new THREE.Group();
    scharnier.position.set(geo.luke.radius + 0.004, 0, 0);
    const deckel = new THREE.Mesh(new THREE.CylinderGeometry(geo.luke.radius + 0.006, geo.luke.radius + 0.006, 0.006, 40), M.plexiKante);
    deckel.position.set(-(geo.luke.radius + 0.004), 0.003, 0);
    scharnier.add(deckel);
    lukeGr.add(scharnier);
    gruppe.add(lukeGr);
    lukeDeckel = scharnier;
  }
  return { halter, gruppe, klappe: klappeScharnier, lukeDeckel, geo };
}

// ------------------------------------------------------------------ Bühne

export class Buehne {
  constructor(canvas) {
    this.canvas = canvas;
    this.hochwertig = true;
    this.post = true;
    this.tv = false;
    this.flimmern = false;
    this.warm = false;
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.renderer.pixelRatioMax));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = CONFIG.renderer.belichtung;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.autoClear = false;
    this.r = r;

    this.szene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    this.szene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.szene.environmentIntensity = 0.55;
    pmrem.dispose();

    this.kamera = new THREE.PerspectiveCamera(CONFIG.kamera.fov, 16 / 9, CONFIG.kamera.nah, CONFIG.kamera.fern);
    this.M = erzeugeMaterialien(true);
    this.lichter();
    this.studio();
    this.geraet();
    this.kugeln();
    this.lupeBauen();
    this.nachbearbeitung();
    this.rahmen = { x: 0, y: 0, w: 1, h: 1 };
  }

  lichter() {
    const L = CONFIG.renderer.lichter;
    const s = this.szene;
    s.add(new THREE.HemisphereLight(L.hemi.himmel, L.hemi.boden, L.hemi.staerke));
    const front = new THREE.DirectionalLight(L.front.farbe, L.front.staerke);
    front.position.set(...L.front.pos);
    front.target.position.set(0, 0.9, 0);
    front.castShadow = true;
    front.shadow.mapSize.set(CONFIG.renderer.schatten, CONFIG.renderer.schatten);
    const c = front.shadow.camera;
    c.left = -1.9; c.right = 1.9; c.top = 1.6; c.bottom = -1.2; c.near = 1; c.far = 9;
    front.shadow.bias = -0.002;
    front.shadow.normalBias = 0.035;
    front.shadow.radius = 4;
    s.add(front, front.target);
    this.frontLicht = front;
    const spitz = new THREE.DirectionalLight(L.spitz.farbe, L.spitz.staerke);
    spitz.position.set(...L.spitz.pos);
    s.add(spitz);
    const fuell = new THREE.DirectionalLight(L.fuell.farbe, L.fuell.staerke);
    fuell.position.set(...L.fuell.pos);
    s.add(fuell);
    // Spitzlicht direkt auf die Trommel (Glanz auf Acryl, Kugeln und Speichen)
    const spot = new THREE.SpotLight("#ffffff", 14, 6, 0.35, 0.6, 1.2);
    spot.position.set(0.9, 2.6, 1.6);
    spot.target.position.set(0, 1.15, 0);
    s.add(spot, spot.target);
  }

  studio() {
    const F = CONFIG.studio.farben.kalt;
    // Hintergrund: weicher Verlauf, flach ausgeleuchtet
    this.himmelUniforms = {
      oben: { value: new THREE.Color(F.oben) },
      mitte: { value: new THREE.Color(F.mitte) },
      unten: { value: new THREE.Color(F.unten) },
      licht: { value: new THREE.Vector2(0.55, 0.62) },
    };
    const himmel = new THREE.Mesh(
      new THREE.SphereGeometry(16, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: this.himmelUniforms,
        vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
        fragmentShader: `uniform vec3 oben; uniform vec3 mitte; uniform vec3 unten; varying vec3 vP;
          void main(){ vec3 d = normalize(vP); float h = d.y;
            vec3 c = h > 0.08 ? mix(mitte, oben, smoothstep(0.08, 0.7, h)) : mix(unten, mitte, smoothstep(-0.2, 0.08, h));
            float hof = exp(-pow(length(vec2(atan(d.x, -d.z) * 0.55, h - 0.18)) * 1.9, 2.0));
            c += vec3(0.07) * hof;
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    );
    himmel.renderOrder = -10;
    this.szene.add(himmel);
    this.szene.fog = new THREE.Fog(F.nebel, 5.5, 15);
    this.bodenMat = new THREE.MeshStandardMaterial({ color: F.boden, roughness: 0.92, metalness: 0 });
    const boden = new THREE.Mesh(new THREE.CircleGeometry(15, 64), this.bodenMat);
    boden.rotation.x = -Math.PI / 2;
    boden.receiveShadow = true;
    this.szene.add(boden);
    // Podest mit Kante
    const P = CONFIG.studio.podest;
    const pod = new THREE.Mesh(new THREE.BoxGeometry(P.breite, P.hoehe, P.tiefe), this.M.podest);
    pod.position.set(0.2, P.hoehe / 2, P.z);
    pod.receiveShadow = true;
    this.szene.add(pod);
    const kante = new THREE.Mesh(new THREE.BoxGeometry(P.breite + 0.02, 0.02, P.tiefe + 0.02), this.M.podestKante);
    kante.position.set(0.2, P.hoehe - 0.01, P.z);
    this.szene.add(kante);
  }

  setzeStudio(warm) {
    this.warm = warm;
    const F = warm ? CONFIG.studio.farben.warm : CONFIG.studio.farben.kalt;
    this.himmelUniforms.oben.value.set(F.oben);
    this.himmelUniforms.mitte.value.set(F.mitte);
    this.himmelUniforms.unten.value.set(F.unten);
    this.szene.fog.color.set(F.nebel);
    this.bodenMat.color.set(F.boden);
    this.M.podest.color.set(warm ? "#b3a58d" : "#9aa6b3");
  }

  geraet() {
    const M = this.M, s = this.szene;
    const oben = CONFIG.studio.gestellOben;
    const unten = CONFIG.studio.podest.hoehe;

    // ---------- Hauptgerät
    this.haupt = baueTrommel(CONFIG.haupt, M, true);
    s.add(this.haupt.halter);
    this.superG = baueTrommel(CONFIG.superzahl, M, false);
    s.add(this.superG.halter);

    // Gestellsockel
    const sockel = new THREE.Mesh(new THREE.BoxGeometry(1.42, oben - unten, 0.72), M.lack);
    sockel.position.set(-0.05, (oben + unten) / 2, 0.05);
    sockel.castShadow = true;
    s.add(sockel);
    const zier = new THREE.Mesh(new THREE.BoxGeometry(1.43, 0.012, 0.73), M.chrom);
    zier.position.set(-0.05, oben - 0.006, 0.05);
    s.add(zier);
    const hz = CONFIG.haupt.zentrum;
    // Lagerbock links (unter der Achse, zwischen Scheibe und Schacht)
    const bockX = CONFIG.haupt.lagerscheibe.x + 0.038;
    const bock = new THREE.Mesh(new THREE.BoxGeometry(0.045, hz[1] - oben - 0.02, 0.1), M.lack);
    bock.position.set(bockX, (hz[1] + oben) / 2 - 0.02, 0);
    bock.castShadow = true;
    s.add(bock);
    const lager = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 32), M.lack);
    lager.rotation.z = Math.PI / 2;
    lager.position.set(bockX, hz[1], 0);
    s.add(lager);
    const fuss = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.2), M.lack);
    fuss.position.set(bockX, oben + 0.015, 0);
    s.add(fuss);
    // Gestellbügel rechts: schwarzer geschwungener Bügel bis zur rechten Achse
    const re = CONFIG.haupt.achse.rechtsEnde;
    const buegel = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.36, oben, -0.12),
      new THREE.Vector3(0.62, oben + 0.18, -0.06),
      new THREE.Vector3(0.66, 0.78, 0),
      new THREE.Vector3(0.6, 1.04, 0),
      new THREE.Vector3(re + 0.02, hz[1], 0),
    ]);
    const bu = new THREE.Mesh(new THREE.TubeGeometry(buegel, 80, 0.024, 16), M.lack);
    bu.castShadow = true;
    s.add(bu);
    const buegel2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.36, oben, 0.12),
      new THREE.Vector3(0.62, oben + 0.18, 0.06),
      new THREE.Vector3(0.66, 0.78, 0),
    ]);
    const bu2 = new THREE.Mesh(new THREE.TubeGeometry(buegel2, 40, 0.02, 16), M.lack);
    s.add(bu2);
    const lagerR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 32), M.lack);
    lagerR.rotation.z = Math.PI / 2;
    lagerR.position.set(re + 0.02, hz[1], 0);
    s.add(lagerR);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 28), M.lackMatt);
    motor.rotation.z = Math.PI / 2;
    motor.position.set(re + 0.1, hz[1], 0);
    s.add(motor);

    // Steuerpult mit Tastern und Kontrollleuchten
    const pult = new THREE.Group();
    const pk = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.16), M.pult);
    pk.position.set(0, 0.05, 0);
    pult.add(pk);
    const schraeg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.012, 0.17), M.lackMatt);
    schraeg.position.set(0, 0.104, 0.0);
    schraeg.rotation.x = 0.35;
    pult.add(schraeg);
    this.leuchten = {};
    const taster = [["einwurf", "#e9e4d4", -0.12], ["mischen", "#2fbf5a", -0.06], ["ziehen", "#f2a93b", 0], ["stop", "#d23c2f", 0.06], ["super", "#3a7be0", 0.12]];
    for (const [name, farbe, x] of taster) {
      const mat = new THREE.MeshStandardMaterial({ color: farbe, emissive: farbe, emissiveIntensity: 0.05, roughness: 0.35 });
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 20), mat);
      t.position.set(x, 0.116, 0.0);
      t.rotation.x = 0.35;
      pult.add(t);
      this.leuchten[name] = mat;
    }
    pult.position.set(0.3, oben, 0.33);
    s.add(pult);

    // ---------- Feststehende Teile aus der Geometrie (gleiche Daten wie die Kollider)
    const st = statischeTeile();
    this.deckel = [];
    this.stifte = [];
    for (const bx of st.boxen) {
      if (bx.unsichtbar) continue;
      let mat = M.plexi;
      if (bx.name === "bahnA" || bx.name === "umlenkblech" || /^bahnB(\d|rest)/.test(bx.name)) mat = M.bahn;
      if (bx.teil === "sockel") mat = M.blau;
      if (bx.name.startsWith("deckel")) mat = M.stahl;
      const m = boxMesh(bx, mat);
      if (bx.teil === "sockel") { m.castShadow = true; m.receiveShadow = true; }
      if (mat === M.plexi) m.renderOrder = 3;
      s.add(m);
      if (bx.name.startsWith("deckel")) this.deckel.push({ mesh: m, basis: m.position.clone(), schalter: bx.schalter });
      // Kanten der Plexiglasteile betonen
      if (mat === M.plexi) {
        const kanten = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
        kanten.position.copy(m.position);
        kanten.quaternion.copy(m.quaternion);
        s.add(kanten);
      }
    }
    for (const kp of st.kapseln) {
      const m = zylinderZwischen(kp.a, kp.b, kp.r, kp.teil === "stift" ? M.chrom : M.stahl, 10);
      s.add(m);
      if (kp.schalter) this.stifte.push({ mesh: m, basis: m.position.clone(), schalter: kp.schalter });
    }
    // Einwurftrichter, Röhrchen
    for (const rohr of st.rohre) {
      const p = rohr.punkte;
      if (rohr.name === "einwurf") {
        const profil = p.map((q) => new THREE.Vector2(q.ri + 0.002, q.y - p[p.length - 1].y));
        const lathe = new THREE.Mesh(new THREE.LatheGeometry(profil, 48), M.plexi);
        lathe.position.set(p[0].x, p[p.length - 1].y, p[0].z);
        lathe.renderOrder = 3;
        s.add(lathe);
        const rand = new THREE.Mesh(new THREE.TorusGeometry(p[0].ri + 0.002, 0.003, 8, 48), M.plexiKante);
        rand.rotation.x = Math.PI / 2;
        rand.position.set(p[0].x, p[0].y, p[0].z);
        s.add(rand);
      } else {
        const oben2 = p[0].y, unten2 = p[p.length - 1].y;
        const aussen = p[p.length - 1].ro;
        const rohrM = new THREE.Mesh(new THREE.CylinderGeometry(aussen, aussen, oben2 - unten2 - 0.004, 40, 1, true), M.glas);
        rohrM.position.set(p[0].x, (oben2 + unten2) / 2 - 0.002, p[0].z);
        rohrM.renderOrder = 4;
        s.add(rohrM);
        const rand = new THREE.Mesh(new THREE.TorusGeometry(aussen, 0.0018, 8, 40), M.plexiKante);
        rand.rotation.x = Math.PI / 2;
        rand.position.set(p[0].x, oben2 - 0.004, p[0].z);
        s.add(rand);
        if (rohr.name === "superRoehrchen") {
          const trichter = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(p[1].ri + 0.002, 0), new THREE.Vector2(p[0].ri, p[0].y - p[1].y)], 40), M.plexi);
          trichter.position.set(p[0].x, p[1].y, p[0].z);
          s.add(trichter);
        }
      }
    }

    // ---------- Schütte: Muldenplatte mit 49 Mulden und Schieberplatte
    const S = CONFIG.schuette;
    const zA = lukenPunkt()[2];
    const neig = (S.neigungGrad * Math.PI) / 180;
    const rr = S.raster;
    const x0 = rr.x0 - rr.abstand * 0.75, x1 = rr.x0 + (rr.reihen - 1) * rr.abstand + rr.abstand * 0.75;
    const xm = (x0 + x1) / 2;
    const laenge = (x1 - x0) / Math.cos(neig);
    const nrm = new THREE.Vector3(-Math.sin(neig), Math.cos(neig), 0);
    const muldenGr = new THREE.Group();
    const basisPos = new THREE.Vector3(xm, rampenHoehe(xm), zA).add(nrm.clone().multiplyScalar(S.schieberHoehe + 0.006));
    muldenGr.position.copy(basisPos);
    muldenGr.rotation.z = neig;
    const breite = rr.spalten * rr.abstand + 0.03;
    const platte = new THREE.Mesh(new THREE.BoxGeometry(laenge, 0.012, breite), M.plexiKante);
    muldenGr.add(platte);
    const ringGeo = new THREE.TorusGeometry(CONFIG.kugel.radius + 0.002, 0.0025, 6, 28);
    const ringe = new THREE.InstancedMesh(ringGeo, M.chrom, rr.reihen * rr.spalten);
    const mm = new THREE.Matrix4(), qq = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    let n = 0;
    for (let i = 0; i < rr.reihen; i++) for (let j = 0; j < rr.spalten; j++) {
      const lx = (rr.x0 + i * rr.abstand - xm) / Math.cos(neig);
      const lz = (j - (rr.spalten - 1) / 2) * rr.abstand;
      mm.compose(new THREE.Vector3(lx, 0.0065, lz), qq, new THREE.Vector3(1, 1, 1));
      ringe.setMatrixAt(n++, mm);
    }
    muldenGr.add(ringe);
    this.szene.add(muldenGr);
    // Schieberplatte darunter (fährt beim Einwurf hangaufwärts heraus)
    this.schieber = new THREE.Mesh(new THREE.BoxGeometry(laenge, 0.004, breite - 0.01), new THREE.MeshPhysicalMaterial({ color: "#8fa6bb", roughness: 0.2, transparent: true, opacity: 0.55, depthWrite: false }));
    this.schieberGr = new THREE.Group();
    this.schieberGr.position.copy(new THREE.Vector3(xm, rampenHoehe(xm), zA).add(nrm.clone().multiplyScalar(S.schieberHoehe - 0.002)));
    this.schieberGr.rotation.z = neig;
    this.schieberGr.add(this.schieber);
    this.schieberLaenge = laenge;
    s.add(this.schieberGr);
    // Stützen der Schütte (hinten, damit sie das Bild nicht kreuzen)
    for (const xs of [S.oberkanteX - 0.05, S.leitwandBisX]) {
      const ys = rampenHoehe(xs) - 0.02;
      const zs = zA - S.breite - 0.02;
      const st1 = zylinderZwischen([xs, oben, zs], [xs, ys, zs], 0.007, M.stahl, 12);
      st1.castShadow = true;
      s.add(st1);
      s.add(zylinderZwischen([xs, ys, zs], [xs, ys, zA + S.breite], 0.006, M.stahl, 12));
    }

    // ---------- Superzahlgerät: kleiner Sockel, Lagerbock, Bügel
    const sz = CONFIG.superzahl.zentrum, sg = CONFIG.superzahl;
    const ssockel = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.1, 0.36), M.lack);
    ssockel.position.set(sz[0] - 0.12, unten + 0.05, sz[2]);
    ssockel.castShadow = true;
    s.add(ssockel);
    const sbockX = sz[0] + sg.lagerscheibe.x - 0.035;
    const sbock = new THREE.Mesh(new THREE.BoxGeometry(0.035, sz[1] - unten - 0.1, 0.07), M.lack);
    sbock.position.set(sbockX, (sz[1] + unten + 0.1) / 2, sz[2]);
    sbock.castShadow = true;
    s.add(sbock);
    const sbu = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sz[0] + 0.1, unten + 0.1, sz[2]),
      new THREE.Vector3(sz[0] + 0.28, 0.55, sz[2]),
      new THREE.Vector3(sz[0] + 0.28, 0.8, sz[2]),
      new THREE.Vector3(sz[0] + sg.achse.rechtsEnde + 0.01, sz[1], sz[2]),
    ]);
    const sbuM = new THREE.Mesh(new THREE.TubeGeometry(sbu, 60, 0.016, 12), M.lack);
    sbuM.castShadow = true;
    s.add(sbuM);
    const ssock2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), M.blau);
    ssock2.position.set(st.superRoehrchenX, unten + 0.05, st.superRoehrchenZ);
    s.add(ssock2);
  }

  kugeln() {
    this.kugelMeshes = [];
    const geo = new THREE.SphereGeometry(CONFIG.kugel.radius, 40, 28);
    const K = CONFIG.kugel;
    for (let i = 0; i < K.anzahl + K.superAnzahl; i++) {
      const haupt = i < K.anzahl;
      const nummer = haupt ? i + 1 : i - K.anzahl;
      // weiß bis leicht elfenbein, je Kugel minimal verschieden (rein optisch)
      const f = ((i * 37) % 11) / 10;
      const farbe = K.farbeWeiss.map((w, j) => w + (K.farbeElfenbein[j] - w) * f * 0.6);
      const m = new THREE.Mesh(geo, kugelMaterial(nummer, farbe));
      m.castShadow = true;
      this.kugelMeshes.push(m);
      this.szene.add(m);
    }
  }

  lupeBauen() {
    const L = CONFIG.lupe;
    this.lupeRT = new THREE.WebGLRenderTarget(L.aufloesung, L.aufloesung, { samples: 4, type: THREE.HalfFloatType });
    this.lupeKamera = new THREE.PerspectiveCamera(L.fov, 1, 0.01, 5);
    const g = new THREE.Group();
    g.position.copy(V(L.position));
    const bild = new THREE.Mesh(
      new THREE.CircleGeometry(L.radius, 64),
      new THREE.ShaderMaterial({
        uniforms: { map: { value: this.lupeRT.texture }, aktiv: { value: 0 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
        fragmentShader: `uniform sampler2D map; uniform float aktiv; varying vec2 vUv;
          void main(){ vec2 c = vUv - 0.5; float r = length(c) * 2.0;
            vec2 uv = 0.5 + c * (0.92 + 0.08 * r * r); // leichte Linsenwölbung
            vec3 col = texture2D(map, uv).rgb;
            col = mix(vec3(0.62, 0.68, 0.74), col, aktiv);
            col *= 1.0 - 0.35 * pow(r, 3.0);
            col += vec3(0.25) * smoothstep(0.55, 0.0, length(c - vec2(-0.16, 0.18))) * 0.35;
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    );
    bild.material.toneMapped = true;
    g.add(bild);
    this.lupeBild = bild;
    const glas = new THREE.Mesh(new THREE.SphereGeometry(L.radius * 1.02, 48, 24, 0, Math.PI * 2, 0, 0.5), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.12, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false }));
    glas.rotation.x = Math.PI / 2;
    glas.position.z = -L.radius * 0.88;
    glas.scale.set(1, 1, 1);
    g.add(glas);
    const rand = new THREE.Mesh(new THREE.TorusGeometry(L.radius + L.rand / 2, L.rand / 2, 16, 72), this.M.chrom);
    g.add(rand);
    const rand2 = new THREE.Mesh(new THREE.TorusGeometry(L.radius + L.rand * 1.2, L.rand * 0.45, 12, 72), this.M.lack);
    rand2.position.z = -0.006;
    g.add(rand2);
    // Ausrichtung: zur Totale hin
    const tot = V(CONFIG.kamera.totale.pos);
    g.lookAt(tot);
    this.szene.add(g);
    const stab = zylinderZwischen([L.position[0], CONFIG.studio.podest.hoehe, L.position[2]], [L.position[0], L.position[1] - L.radius - 0.01, L.position[2]], 0.012, this.M.lack, 16);
    stab.castShadow = true;
    this.szene.add(stab);
    const fuss = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.02, 32), this.M.lack);
    fuss.position.set(L.position[0], CONFIG.studio.podest.hoehe + 0.01, L.position[2]);
    this.szene.add(fuss);
    this.lupe = g;
    this.lupeZiel = null;
  }

  nachbearbeitung() {
    const opt = { samples: 4, type: THREE.HalfFloatType };
    this.rtA = new THREE.WebGLRenderTarget(4, 4, opt);
    this.rtB = new THREE.WebGLRenderTarget(4, 4, opt);
    this.blende = 0; // 1 → 0 für den weichen Schnitt
    const T = CONFIG.tvLook;
    this.postU = {
      bild: { value: this.rtA.texture },
      alt: { value: this.rtB.texture },
      blende: { value: 0 },
      aufloesung: { value: new THREE.Vector2(1, 1) },
      zeit: { value: 0 },
      tv: { value: 0 },
      flimmern: { value: 0 },
      scan: { value: T.scanlines },
      chroma: { value: T.chroma },
      rauschen: { value: T.rauschen },
      vignette: { value: T.vignette },
      unschaerfe: { value: T.unschaerfe },
    };
    this.postMat = new THREE.ShaderMaterial({
      uniforms: this.postU,
      depthTest: false,
      depthWrite: false,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: `precision highp float;
        uniform sampler2D bild; uniform sampler2D alt; uniform float blende; uniform vec2 aufloesung;
        uniform float zeit; uniform float tv; uniform float flimmern; uniform float scan; uniform float chroma;
        uniform float rauschen; uniform float vignette; uniform float unschaerfe;
        varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        vec3 probe(sampler2D t, vec2 uv){
          if (tv < 0.5) return texture2D(t, uv).rgb;
          vec2 px = 1.0 / aufloesung;
          float co = chroma * px.x;
          vec3 c;
          c.r = texture2D(t, uv + vec2(co, 0.0)).r;
          c.g = texture2D(t, uv).g;
          c.b = texture2D(t, uv - vec2(co, 0.0)).b;
          vec3 b = (texture2D(t, uv + vec2(px.x * 1.5, 0.0)).rgb + texture2D(t, uv - vec2(px.x * 1.5, 0.0)).rgb) * 0.5;
          return mix(c, b, unschaerfe * 0.5);
        }
        void main(){
          vec3 c = probe(bild, vUv);
          if (blende > 0.0) c = mix(c, probe(alt, vUv), blende);
          #ifdef TONE_MAPPING
          c = toneMapping(c);
          #endif
          vec2 q = vUv - 0.5;
          if (tv > 0.5) {
            float zeile = sin(vUv.y * aufloesung.y * 3.14159 * 0.5);
            c *= 1.0 - scan * (0.5 - 0.5 * zeile);
            c += (h(vUv * aufloesung + zeit * 61.0) - 0.5) * rauschen;
            c = mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, 0.86);
            c *= vec3(1.02, 1.0, 0.96);
            c *= 1.0 - flimmern * (0.5 + 0.5 * sin(zeit * 6.28318 * 25.0));
            c *= 1.0 - vignette * pow(length(q * vec2(1.1, 1.0)) * 1.55, 2.4);
          } else {
            c *= 1.0 - 0.14 * pow(length(q) * 1.45, 2.6);
          }
          gl_FragColor = linearToOutputTexel(vec4(clamp(c, 0.0, 1.0), 1.0));
        }`,
    });
    this.postSzene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat);
    quad.frustumCulled = false;
    this.postSzene.add(quad);
    this.postKamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /** Einfache Materialien, keine Nachbearbeitung, keine Schatten (unter 30 fps). */
  leistungsmodus() {
    if (!this.hochwertig) return;
    this.hochwertig = false;
    this.post = false;
    const alt = this.M;
    const neu = erzeugeMaterialien(false);
    this.szene.traverse((o) => {
      if (!o.isMesh) return;
      if (o.material === alt.acrylTrommel) o.material = neu.acrylTrommel;
      else if (o.material === alt.glas) o.material = neu.glas;
    });
    this.M.acrylTrommel = neu.acrylTrommel;
    this.M.glas = neu.glas;
    this.r.shadowMap.enabled = false;
    this.frontLicht.castShadow = false;
    this.r.setPixelRatio(1);
    this.groesse(this.breite, this.hoehe);
  }

  /** Bildausschnitt: 16:9 oder 4:3 (TV-Look) mittig im Fenster. */
  groesse(w, h, reserve = this.reserve ?? 0) {
    this.breite = w;
    this.hoehe = h;
    this.reserve = reserve;
    this.r.setSize(w, h, false);
    const ziel = this.tv ? CONFIG.tvLook.seitenverhaeltnis : 16 / 9;
    // Platz für das Bedienpult unten freihalten, solange das Bild dadurch nicht zu klein wird
    const hv = h - reserve > h * 0.72 ? h - reserve : h;
    let fw = w, fh = Math.round(w / ziel);
    if (fh > hv) { fh = hv; fw = Math.round(hv * ziel); }
    this.rahmen = { x: Math.round((w - fw) / 2), y: Math.round((hv - fh) / 2), w: fw, h: fh };
    this.kamera.aspect = fw / fh;
    this.kamera.updateProjectionMatrix();
    const pr = this.r.getPixelRatio();
    const tw = Math.max(4, Math.round(fw * pr)), th = Math.max(4, Math.round(fh * pr));
    this.rtA.setSize(tw, th);
    this.rtB.setSize(tw, th);
    this.postU.aufloesung.value.set(this.tv ? fw : tw, this.tv ? fh : th);
    return this.rahmen;
  }

  weicherSchnitt() {
    if (!this.post) return;
    // bisheriges Bild bleibt als „alt" stehen, neues Bild wird in das andere Ziel gerendert
    [this.rtA, this.rtB] = [this.rtB, this.rtA];
    this.blende = 1;
  }

  // ------------------------------------------------------------ Zustand übernehmen

  aktualisiere(z, vis) {
    const K = z.welt.kugeln;
    // Trommelwinkel (+ sichtbarer Nachlauf bei Stop)
    const wH = z.haupt.winkel + vis.offsetHaupt, wS = z.superT.winkel + vis.offsetSuper;
    this.haupt.gruppe.rotation.x = wH;
    this.superG.gruppe.rotation.x = wS;
    const qH = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), vis.offsetHaupt);
    const qS = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), vis.offsetSuper);
    const tmp = new THREE.Vector3();
    for (let i = 0; i < K.length; i++) {
      const k = K[i], m = this.kugelMeshes[i];
      m.position.set(k.px, k.py, k.pz);
      m.quaternion.set(k.qx, k.qy, k.qz, k.qw);
      // beim Anhalten drehen die Kugeln in der Trommel sichtbar mit aus
      const tr = k.geraet;
      if (tr && (vis.offsetHaupt !== 0 || vis.offsetSuper !== 0)) {
        const q = tr === z.haupt ? qH : qS;
        tmp.set(tr.cx, tr.cy, tr.cz);
        m.position.sub(tmp).applyQuaternion(q).add(tmp);
        m.quaternion.premultiply(q);
      }
    }
    // Klappen, Luke, Schieber, Deckschieber, Anschlagstifte
    const zielK = (tr, g) => {
      const soll = tr.schiene.klappe.offen ? -1.45 : 0;
      g.klappe.rotation.x += (soll - g.klappe.rotation.x) * 0.25;
    };
    zielK(z.haupt, this.haupt);
    zielK(z.superT, this.superG);
    if (this.haupt.lukeDeckel) {
      const soll = z.haupt.lukeOffen ? -1.9 : 0;
      const d = this.haupt.lukeDeckel;
      d.rotation.z += (soll - d.rotation.z) * 0.12;
    }
    const sst = z.schieberStand();
    this.schieber.position.x = sst * this.schieberLaenge * 0.98;
    for (const d of this.deckel) {
      const zu = z.welt.schalter[d.schalter] === true;
      const soll = zu ? 0 : 0.058;
      d.off = (d.off ?? soll) + (soll - (d.off ?? soll)) * 0.2;
      d.mesh.position.set(d.basis.x, d.basis.y, d.basis.z + d.off);
    }
    for (const s of this.stifte) {
      const auf = z.welt.schalter[s.schalter] === true;
      const soll = auf ? 0 : -0.016;
      s.off = (s.off ?? soll) + (soll - (s.off ?? soll)) * 0.2;
      s.mesh.position.set(s.basis.x, s.basis.y + s.off, s.basis.z);
    }
    // Kontrollleuchten am Pult
    const L = this.leuchten;
    const an = (m, v) => { m.emissiveIntensity += ((v ? 2.2 : 0.05) - m.emissiveIntensity) * 0.2; };
    an(L.einwurf, z.phase === "EINWURF");
    an(L.mischen, z.haupt.omega < -0.05 || z.superT.omega < -0.05);
    an(L.ziehen, z.haupt.omega > 0.05 || z.superT.omega > 0.05);
    an(L.stop, vis.angehalten);
    an(L.super, z.phase === "SUPERZAHL");
  }

  setzeLupe(pos) {
    this.lupeZiel = pos;
  }

  // ------------------------------------------------------------ Zeichnen

  render(zeit, dtReal) {
    const r = this.r;
    // Lupe: Nahaufnahme der zuletzt gezogenen Kugel im Röhrchen
    if (this.lupeZiel) {
      const L = CONFIG.lupe;
      const p = this.lupeZiel;
      this.lupeKamera.position.set(p[0] + 0.02, p[1] + 0.02, p[2] + L.abstand);
      this.lupeKamera.lookAt(p[0], p[1], p[2]);
      this.lupe.visible = false;
      r.setRenderTarget(this.lupeRT);
      r.setClearColor(0x000000, 1);
      r.clear();
      r.render(this.szene, this.lupeKamera);
      this.lupe.visible = true;
      this.lupeBild.material.uniforms.aktiv.value = Math.min(1, this.lupeBild.material.uniforms.aktiv.value + dtReal * 3);
    } else {
      this.lupeBild.material.uniforms.aktiv.value = Math.max(0, this.lupeBild.material.uniforms.aktiv.value - dtReal * 3);
    }

    const R = this.rahmen;
    r.setRenderTarget(null);
    r.setScissorTest(false);
    r.setViewport(0, 0, this.breite, this.hoehe);
    r.setClearColor(0x000000, 1);
    r.clear();
    if (this.post) {
      r.setRenderTarget(this.rtA);
      r.clear();
      r.render(this.szene, this.kamera);
      r.setRenderTarget(null);
      r.setViewport(R.x, this.hoehe - R.y - R.h, R.w, R.h);
      const U = this.postU;
      U.bild.value = this.rtA.texture;
      U.alt.value = this.rtB.texture;
      if (this.blende > 0) this.blende = Math.max(0, this.blende - dtReal / 0.7);
      U.blende.value = this.blende;
      U.zeit.value = zeit;
      U.tv.value = this.tv ? 1 : 0;
      U.flimmern.value = this.tv && this.flimmern ? CONFIG.tvLook.flimmern : 0;
      r.render(this.postSzene, this.postKamera);
    } else {
      r.setViewport(R.x, this.hoehe - R.y - R.h, R.w, R.h);
      r.setScissor(R.x, this.hoehe - R.y - R.h, R.w, R.h);
      r.setScissorTest(true);
      r.render(this.szene, this.kamera);
      r.setScissorTest(false);
    }
  }
}

export { achsauslassWelt, roehrchenX, bahnHoehe, muldenPosition };
