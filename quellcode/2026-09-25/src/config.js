// Zentrale Konfiguration: alle Zahlenwerte der Simulation an einer Stelle.
// Einheiten: Meter, Kilogramm, Sekunden. Winkel in Grad, sofern der Name auf „Grad" endet.
// Koordinaten: x nach rechts (Drehachse der Trommel), y nach oben, z zur Kamera.
//
// Annahmen (nicht belegt, modelliert):
// - Drehzahlen, Phasendauern, Speichenzahl und -lage, Form der Auswerfschiene, Schachtverlauf.
// - Die Auswerfschiene ist als Rohrbogen (Drahtkäfig) mit knapp 43 mm Innenquerschnitt umgesetzt,
//   der als Spiralschöpfer arbeitet: in Ziehrichtung fördert er eine Kugel zur Achse, in
//   Mischrichtung läuft die Mündung rückwärts und eine eingefallene Kugel rollt wieder heraus.
// - Hinter der Schaufel sitzt eine Klappe: die Schaufeltasche fasst genau eine Kugel, die erst in
//   die Schiene rollen kann, wenn die Mündung in Ziehrichtung hoch genug steht und keine andere
//   Kugel in der Schiene läuft (Umsetzung von „nur eine Kugel zugleich").
// - Die hohle Achse ist innen konisch (Ø 43 → 60 mm), damit die Kugel zum Auslass rollt.
// - Kurz vor dem Achsende sitzt eine Sperre, die nur in der Phase ZIEHEN offen ist und hinter
//   der ersten ausgerollten Kugel sofort schließt.
// - Einwurf über eine Luke oben in der Trommel; die Schieberplatte gibt die Mulden gestaffelt frei.
// - Verteilerbahn mit Deckschieber und Anschlagstift je Röhrchen: nur das nächste freie ist offen.
// - Superzahlgerät: gleiches Prinzip im Kleinformat, Kugeln liegen bereits in der Trommel.

export const CONFIG = {
  physik: {
    dt: 1 / 240, // fester Zeitschritt, nie verändert
    iterationen: 10,
    schwerkraft: 9.81,
    luftwiderstand: 0.12, // a = k·v² (Tischtennisball, cw ≈ 0,5)
    winkelDaempfung: 0.35, // 1/s, Rollwiderstand
    restitutionSchwelle: 0.12, // m/s, darunter kein Rückprall
    biasFaktor: 0.18,
    slop: 0.0004,
    maxBias: 0.35,
    maxSchritteProFrame: 40, // Schutz gegen Zeitlupe bei Ruckeln (nie größeres dt)
    materialien: {
      kugel: { e: 0.55, mu: 0.22 },
      acryl: { e: 0.5, mu: 0.28 },
      metall: { e: 0.45, mu: 0.22 },
      glas: { e: 0.3, mu: 0.3 },
      bahn: { e: 0.25, mu: 0.3 },
      sockel: { e: 0.2, mu: 0.4 },
    },
    ruheGeschwindigkeit: 0.03,
    ruheDauer: 0.25,
  },

  kugel: {
    anzahl: 49,
    superAnzahl: 10,
    radius: 0.02,
    masse: 0.00309,
    streuung: 0.03, // ±3 % je Satz
    farbeWeiss: [0.97, 0.96, 0.93],
    farbeElfenbein: [0.95, 0.91, 0.82],
    aufdrucke: 12,
    ziffernHoehe: 0.009,
    schrift: "900 {px}px Futura, 'Futura PT', 'Century Gothic', 'Avenir Next', 'Trebuchet MS', 'Arial Black', Arial, sans-serif",
  },

  seed: {
    standard: "19930403",
    positionsStoerung: 0.0015, // m, Lage in der Mulde
    zeitStoerung: 0.02, // s, Abwurfzeitpunkt
  },

  motor: {
    beschleunigung: 2.4, // rad/s²
    mischUpm: 30,
    ziehUpm: 20,
    nachlaufUpm: 9, // nach einer Ziehung: langsam in Mischrichtung, leert die Schiene
    waechterFaktor: 1.15,
    stopAuslauf: 0.5, // s, sichtbares Auslaufen der Trommel bei Stop
    superMischUpm: 36,
    superZiehUpm: 22,
  },

  ablauf: {
    einwurfDauer: 3.6, // Freigabe aller 49 Mulden
    einwurfWaechter: 9,
    lukeSchliessen: 0.6,
    mischenErstes: 9.5,
    mischen: 4.8,
    ziehenWaechter: 20,
    stoerungNach: 6,
    anzeige: 1.5,
    anzeigeRueckschnitt: 3.4,
    superVorlauf: 2.5,
    superMischen: 5,
    superAnzeige: 1.5,
    endeBremsen: 4,
    anzahlZiehungen: 7,
    tiefeSchiene: 0.06, // m hinter dem Trichter: ab hier gilt eine Kugel als aufgenommen
    skriptGeschwindigkeit: 0.3, // m/s, Eingriff des Ziehungsleiters
  },

  haupt: {
    name: "haupt",
    zentrum: [0, 1.15, 0],
    radius: 0.375,
    wand: 0.006,
    luke: { richtung: [0.3, 0.95, -0.1], radius: 0.062 },
    nabe: 0.028,
    welle: { rechts: 0.375, links: -0.185, radius: 0.008 },
    speichen: {
      laenge: 0.335,
      radius: 0.003,
      // [Winkel um die Achse in Grad, Neigung in x-Richtung]
      liste: [
        [0, 0],
        [90, 0],
        [180, 0],
        [270, 0],
        [45, 0.55],
        [135, 0.55],
        [225, 0.55],
        [315, 0.55],
      ],
    },
    schiene: {
      muendungX: -0.04, // Schaufel an der Wand nahe der Trommelmitte (dort liegen die Kugeln)
      ebeneX: -0.2, // Ebene der Spirale in der linken Trommelhälfte
      uebergang: 0.35, // Anteil der Spirale, auf dem die Schiene von muendungX nach ebeneX läuft
      wandRadius: 0.35, // Abstand der Mittellinie vom Zentrum entlang der Wand
      phiMuendungGrad: 20,
      bogenGrad: 200,
      bogenRadius: 0.05,
      punkte: 50,
      trichterLaenge: 0.045,
      trichterRadius: 0.032,
      trichterPunkte: 5,
      innen: 0.0215,
      wand: 0.0035,
      achsEnde: -0.56,
      achsInnenEnde: 0.03,
      achsPunkte: 8,
      eintritt: 0.007,
      taschenLaenge: 0.055, // Schaufeltasche: fasst genau eine Kugel
      klappeHoehe: 0.6, // Klappe öffnet, sobald die Mündung so hoch über der Achse steht (× Radius)
      sperreVorEnde: 0.045, // Auslasssperre im Achsrohr, so weit vor dem Achsende
    },
    achse: { aussen: 0.028, rechtsEnde: 0.47 },
    lagerscheibe: { x: -0.44, radius: 0.09, dicke: 0.025 },
  },

  superzahl: {
    name: "super",
    zentrum: [1.27, 0.95, 0.05],
    radius: 0.17,
    wand: 0.005,
    luke: null,
    nabe: 0.02,
    welle: { rechts: 0.17, links: -0.075, radius: 0.006 },
    speichen: {
      laenge: 0.135,
      radius: 0.003,
      liste: [
        [0, 0.35],
        [60, 0.35],
        [120, 0.35],
        [180, 0.35],
        [240, 0.35],
        [300, 0.35],
      ],
    },
    schiene: {
      muendungX: -0.015,
      ebeneX: -0.085,
      uebergang: 0.35,
      wandRadius: 0.146,
      phiMuendungGrad: 20,
      bogenGrad: 200,
      bogenRadius: 0.036,
      punkte: 34,
      trichterLaenge: 0.032,
      trichterRadius: 0.03,
      trichterPunkte: 4,
      innen: 0.0215,
      wand: 0.003,
      achsEnde: -0.33,
      achsInnenEnde: 0.027,
      achsPunkte: 6,
      eintritt: 0.007,
      taschenLaenge: 0.055,
      klappeHoehe: 0.6,
      sperreVorEnde: 0.045,
    },
    achse: { aussen: 0.024, rechtsEnde: 0.24 },
    lagerscheibe: { x: -0.225, radius: 0.06, dicke: 0.02 },
  },

  // Schütte oben rechts hinten: 7×7 Mulden über der Schieberplatte, darunter eine V-förmige
  // Sammelrinne, die zur Einwurfluke hin abfällt.
  schuette: {
    neigungGrad: 10, // Längsgefälle zur Luke
    querGrad: 20, // Neigung der beiden Rinnenflächen zur Mittellinie
    unterkanteX: 0.15,
    unterkanteY: 1.67,
    oberkanteX: 0.76,
    breite: 0.2, // halbe Breite der Rinne (Mittellinie = z der Luke)
    kanalBreite: 0.095, // breiter als zwei Kugeln: keine Brückenbildung
    kanalBisX: 0.15, // Führung über dem Trichter bis zum Rinnenende
    leitwandBisX: 0.4, // flach zulaufende Leitwände vom Kanal bis zur vollen Rinnenbreite
    prallwandAbstand: 0.045, // vor der Trichterachse
    raster: { reihen: 7, spalten: 7, abstand: 0.055, x0: 0.4 },
    schieberHoehe: 0.082,
    plattenDicke: 0.006,
    wandHoehe: 0.125, // über der Rinnensohle (die Muldenplatte liegt bei 0,09)
    einwurfTrichter: { oben: 1.648, mitte: 1.61, unten: 1.527, radiusOben: 0.066, radiusUnten: 0.047 }, // nie enger als 2,3 Kugeln: kein Verstopfen
  },

  fallschacht: {
    x: -0.555,
    z: 0,
    halbX: 0.05,
    halbZ: 0.038,
    oben: 1.243,
    unten: 0.615,
    rechteWandOben: 1.105,
    vorderwandUnten: 0.675,
    umlenkHinten: 0.648,
    umlenkVorn: 0.62,
    fuehrungsstaebe: 0.004,
  },

  bahn: {
    // Bahn A: vom Schachtfuß nach vorn, Bahn B: entlang der Röhrchenreihe nach rechts
    aBreite: 0.056,
    aEndeZ: 0.28,
    aEndeY: 0.584,
    bZ: 0.3,
    bBreite: 0.056,
    bStartX: -0.588,
    bEndeX: -0.115,
    bStartY: 0.586,
    bGefaelle: 0.07,
    loch: 0.05,
    stiftRadius: 0.004,
    stiftHoehe: 0.012,
    wandHoehe: 0.06,
  },

  roehrchen: {
    anzahl: 7,
    x0: -0.48,
    abstand: 0.056,
    innen: 0.0225,
    glas: 0.0022,
    trichter: 0.032,
    trichterTiefe: 0.02,
    boden: 0.4,
    eintritt: 0.01,
    sockel: { von: -0.52, bis: -0.1, unten: 0.3, tiefe: 0.07 },
  },

  superAuslauf: {
    schachtHalb: 0.05,
    schachtUnten: 0.578,
    schachtOben: 1.0,
    rechteWandOben: 0.915,
    roehrchenOben: 0.575,
    trichterUnten: 0.55,
    boden: 0.4,
  },

  studio: {
    boden: 0,
    podest: { breite: 3.4, tiefe: 1.7, hoehe: 0.2, z: 0.05 },
    gestellOben: 0.3,
    farben: {
      kalt: { oben: "#c9d3dd", mitte: "#aebccb", unten: "#8e9cab", boden: "#7f8b97", nebel: "#b5c2cf" },
      warm: { oben: "#e8dcc6", mitte: "#d6c6aa", unten: "#b8a78b", boden: "#a39479", nebel: "#d8cab0" },
    },
    metall: "#1b1d22",
    sockelBlau: "#1f4fa3",
    pultFarbe: "#2a2d33",
  },

  kamera: {
    fov: 36,
    nah: 0.02,
    fern: 40,
    // Einstellungen: Position, Blickziel, Brennweite (fov)
    totale: { pos: [0.08, 1.28, 3.35], ziel: [0.12, 0.95, 0], fov: 36 },
    einwurf: { pos: [0.22, 1.42, 2.7], ziel: [0.22, 1.3, 0], fov: 34 },
    pushIn: { pos: [0.02, 1.2, 2.05], ziel: [-0.02, 1.1, 0], fov: 34 },
    pushIn2: { pos: [0.0, 1.18, 1.85], ziel: [-0.04, 1.1, 0], fov: 34 },
    rueck: { pos: [0.1, 1.24, 2.95], ziel: [0.06, 0.93, 0], fov: 36 },
    schiene: { pos: [-0.62, 1.22, 1.05], ziel: [-0.26, 1.12, 0], fov: 32 },
    achse: { pos: [-0.72, 1.24, 0.72], ziel: [-0.52, 1.13, 0], fov: 32 },
    roehrchenAbstand: 0.24, // Close-up vor dem Röhrchen
    roehrchenHoehe: 0.035,
    roehrchenFov: 26,
    superzahl: { pos: [1.66, 1.1, 1.18], ziel: [1.17, 0.83, 0.05], fov: 32 },
    superNah: { abstand: 0.24, fov: 26 },
    schluss: { pos: [0.1, 1.3, 3.6], ziel: [0.15, 0.9, 0], fov: 38 },
    frei: { pos: [0.3, 1.4, 2.8], ziel: [0.1, 0.95, 0] },
    folgeGlaettung: 3.5, // 1/s, Schwenk entlang des Schachts
    folgeVersatz: [-0.16, 0.13, 0.78],
    superFolgeVersatz: [0.24, 0.12, 0.72],
    folgeFov: 30,
    dauer: { weich: 1.8, pushIn: 8, halbnah: 1.6, schwenk: 1.2, closeup: 1.0, rueck: 1.6, schluss: 2.4 },
  },

  lupe: {
    position: [0.7, 0.62, 0.52],
    radius: 0.12,
    rand: 0.012,
    aufloesung: 512,
    fov: 18,
    abstand: 0.2,
  },

  renderer: {
    pixelRatioMax: 2,
    schatten: 2048,
    belichtung: 1.05,
    fpsGrenze: 30,
    fpsMessdauer: 3,
    lichter: {
      hemi: { himmel: "#eef3ff", boden: "#7a7368", staerke: 0.9 },
      front: { farbe: "#fff6ea", staerke: 2.4, pos: [1.2, 3.2, 3.4] },
      spitz: { farbe: "#dfe9ff", staerke: 3.2, pos: [-1.6, 2.8, -2.4] },
      fuell: { farbe: "#ffffff", staerke: 0.7, pos: [-2.5, 1.6, 2.0] },
    },
  },

  tvLook: {
    seitenverhaeltnis: 4 / 3,
    scanlines: 0.16,
    chroma: 1.2, // Pixel
    rauschen: 0.05,
    vignette: 0.32,
    flimmern: 0.03,
    unschaerfe: 0.6,
  },

  audio: {
    motorBasis: 38, // Hz bei Stillstand + Anteil pro U/min
    motorProUpm: 2.2,
    motorLautstaerke: 0.05,
    rasselSchwelle: 0.12,
    rasselMax: 14, // Klicks pro Frame
    rasselLautstaerke: 0.35,
    klackLautstaerke: 0.6,
  },
};

export const upmZuRad = (upm) => (upm * 2 * 3.141592653589793) / 60;
