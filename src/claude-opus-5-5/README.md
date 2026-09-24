# Ziehung der Lottozahlen · 6 aus 49 · Studio 1993

3D-Web-Simulation der Samstags-Lottoziehung „6 aus 49“, wie sie in den 1990ern im Fernsehen lief:
Acryltrommel mit Speichenkreuz und Auswerfschiene, Achsauslass, Fallschacht, Glasröhrchen auf blauem Sockel,
Schütte, Lupe und Superzahlgerät. Jede gezogene Zahl entsteht ausschließlich aus der Kugelphysik.

**Engine-Wahl:** Three.js für Darstellung (physikalische Materialien mit Transmission für Acryl, Schatten,
Umgebungsreflexion) plus eine eigene, schlanke Starrkörperphysik für Kugeln, weil die konkave Hohlkugel-Trommel,
mitrotierende Rohr- und Kapselkollider mit Wandgeschwindigkeit und eine bitgenau reproduzierbare Ziehung
(eigene Sinus-/Cosinus-Reihen statt `Math.sin`) mit Allzweck-Engines nicht sauber abbildbar sind.

## Start

```sh
npm install
npm run dev            # Entwicklung: http://localhost:5173
npm run build          # statische Seite nach ../../tests/claude-opus-5-5/
```

Die gebaute Seite ist rein statisch (relative Pfade, kein Backend) und läuft z. B. mit `php -S 127.0.0.1:8000`
im Ordner `lotto/` unter `http://127.0.0.1:8000/tests/claude-opus-5-5/` oder über die Übersicht `http://127.0.0.1:8000/`.

Tests:

```sh
npm test                               # Abnahme headless (Node): Zahlen, Seed, 1×/2×, Dauer, Richtungsumkehr
node tests/lauf.mjs <seed>             # einzelne Ziehung mit Protokoll
CHROME_VOLL=<chrome> node tests/stop.mjs   # Stop/Fortsetzen/Reset im Browser
CHROME_VOLL=<chrome> node tests/fps.mjs    # FPS-Messung mit GPU
```

## Bedienung

| Taste / Knopf | Wirkung |
|---|---|
| **Start** (Leertaste) | startet die Ziehung inkl. Kameraregie; nach Stop: Fortsetzen |
| **Stop** (Leertaste) | friert Physik und Kamera ein; die Trommeln laufen sichtbar aus |
| **Reset** (R) | Kugeln zurück auf die Schütte, Röhrchen leer, Totale – ohne Neuladen |
| Seed | gleicher Seed → gleiche Zahlen (wirkt vor dem Start bzw. bei Reset) |
| 1× / 2× | 2× rechnet doppelt so viele Physikschritte, `dt` bleibt 1/240 s |
| Regie / Frei | automatische Kameraregie oder Orbit-Kamera |
| TV-Look 1993 | 4:3 mit Pillarbox, Scanlines, Chroma-Unschärfe, Rauschen, Vignette; „50 Hz“ schaltet Flimmern zu |
| Studio warm | beiger statt bläulich-grauer Hintergrund |
| Ton | synthetischer Ton (Motor, Kugelrasseln, Klacken im Röhrchen), standardmäßig aus |

Eine Live-Region sagt Phasen und Zahlen an. Bei `prefers-reduced-motion` gibt es nur Schnitte, keine Fahrten.
Fällt die Bildrate über 2 × 3 s unter 30 fps, schaltet die Seite Nachbearbeitung, Brechung und Schatten ab.

## Aufbau

| Modul | Inhalt |
|---|---|
| `src/config.js` | `CONFIG` mit allen Zahlenwerten (Geometrie, Drehzahlen, Phasen, Kamera, Farben, Post-Processing) |
| `src/mathe.js` | deterministische Trigonometrie, Seed-Zufall (nur Anfangsstörungen) |
| `src/geometrie.js` | Geometrie als Daten: `trommel`, `speichenkreuz`, `auswerfschiene`, `achsauslass`, `fallschacht`, Bahn, `auffangroehrchen`, `schuette` – Grundlage für Kollider **und** Darstellung |
| `src/physik.js` | Starrkörperphysik: Kugeln, Hohlkugelwand, Kapseln, Quader, Rohre mit Sperren, sequentielle Impulse mit Reibung |
| `src/ablauf.js` | Zustandsautomat `BEREIT → EINWURF → MISCHEN → ZIEHEN → AUSLAUF → ANZEIGE → … → SUPERZAHL → ENDE`, Wächter, Eingriffe des Ziehungsleiters |
| `src/kamera.js` | Kameraregie (Push-in, Halbnah, Schwenk mit der Kugel, Close-up, weicher Schnitt) |
| `src/renderer.js` | Studio, Materialien, `lupe`, `superzahlgeraet`, TV-Look-Shader |
| `src/kugeltextur.js` | 12 Ziffern-Aufdrucke je Kugel als Shader-Decals |
| `src/ui.js`, `src/audio.js`, `src/main.js` | Oberfläche, Ton, Hauptschleife |

## Physik und Ablauf

- 49 Kugeln Ø 40 mm, 3,09 g ± 3 %, Trägheitsmoment einer dünnen Hohlkugel; Kugel-Kugel-Kontakte, Coulomb-Reibung,
  Luftwiderstand. Fester Zeitschritt 1/240 s, 10 Löser-Iterationen.
- Der Seed bestimmt nur Masse, Lage in der Mulde (± 1,5 mm) und Abwurfzeitpunkt (± 20 ms). Danach läuft kein Zufall mehr.
- Die Zahl wird erst übernommen, wenn eine Kugel physikalisch das Ende der Hohlachse passiert.
- Wächter: 20 s ohne Kugel am Achsauslass → Drehzahl +15 %, neuer Mischzyklus. Hängt eine Kugel 6 s in Schiene,
  Schacht oder Bahn → sie wird per Skript weitergerollt („Störung — Ziehungsleiter greift ein“); die Nummer bleibt.

## Annahmen (nicht belegt, modelliert)

1. **Drehzahlen und Phasen:** Mischen 30 U/min (erstes Mal 9,5 s, danach 4,8 s), Ziehen 20 U/min, Beschleunigung 2,4 rad/s².
   Nach einer Ziehung läuft die Trommel langsam (9 U/min) in Mischrichtung. Ergibt 3:25–3:45 min bei 1×.
2. **Speichenkreuz:** 8 Stäbe Ø 6 mm, vier in der Mittelebene, vier zur rechten Seite geneigt; die linke Hälfte bleibt für die Schiene frei.
3. **Auswerfschiene:** Rohrbogen (Drahtkäfig) mit 43 mm Innenquerschnitt. Die Schaufel liegt an der Wand nahe der Trommelmitte,
   läuft in einer Spirale (200°) in die linke Hälfte, biegt zur Achse und mündet in die Hohlachse. Sie arbeitet als
   Spiralschöpfer: In Ziehrichtung fördert die Drehung die Kugel zur Achse, in Mischrichtung rollt sie wieder heraus.
4. **Taschenklappe:** Hinter der Schaufel fasst eine Tasche genau eine Kugel. Die Klappe öffnet nur in Ziehrichtung,
   wenn die Mündung hoch steht und keine andere Kugel in der Schiene läuft („nur eine Kugel zugleich“).
5. **Hohlachse:** innen konisch (Ø 43 → 60 mm), damit die Kugel zum Auslass rollt; kurz vor dem Ende eine Sperre,
   die nur in ZIEHEN öffnet und hinter der ersten Kugel sofort schließt.
6. **Einwurf:** Die Schieberplatte gibt die 49 Mulden gestaffelt frei (3,6 s); die Kugeln sammeln sich in einer V-Rinne und
   fallen durch einen Trichter und eine Luke (Ø 124 mm) oben in die stehende Trommel. Die Luke schließt vor dem Mischen.
7. **Fallschacht und Verteilerbahn:** Plexiglasschacht mit Führungsstäben, Umlenkblech, Bahn nach vorn und entlang der Röhrchen.
   Je Röhrchen ein Deckschieber und ein Anschlagstift; nur das nächste freie Röhrchen ist offen.
8. **Superzahlgerät:** gleiches Prinzip im Kleinformat (Ø 340 mm, 6 Speichen), die 10 Kugeln liegen bereits in der Trommel.
9. **Lupe:** runder Glaskörper rechts vorn, zeigt per Bild-in-Bild eine zweite Kamera auf die zuletzt gezogene Kugel.
10. **Stop:** Physik, Ablauf und Kamera stehen exakt still; nur optisch laufen Trommel und Inhalt 0,5 s aus.
    Beim Fortsetzen wird dieser Winkel in 0,35 s zurückgeführt, danach geht es exakt weiter.
11. **Schrift:** Futura, falls installiert, sonst fette Grotesk als Ersatz (keine Web-Fonts, keine Downloads).
12. Keine Sender-Logos, keine realen Personen, keine Musik, kein `localStorage`.
