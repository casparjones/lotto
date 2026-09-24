# Lotto-3D-Ziehung — Prompt für eine filmreife Web-Simulation (Stand 1990er)

Prompt für eine KI, die eine 3D-Web-Simulation der deutschen Samstags-Lottoziehung „6 aus 49" baut, wie sie in den 1990ern im Fernsehen lief. Ergänzt [[lotto-one-shot-prompt]] (2D, Eigenphysik, Benchmark) um eine Nutzvariante mit Engine-Freiheit und Inszenierung.
Bitte achte die Verzeichnisstruktur, die du unter STRUCTURE.md beschrieben wird.

Siehe auch: [[Lottoziehungssimulation]]

## Recherchestand (Quellen: lotto.de, Lotto Niedersachsen, Wikipedia, fernsehserien.de, DE1948531U, DE1944722U, TV-Standbilder 90er)

**Gerät (bis Jan. 2023 im Einsatz, in den 90ern baugleich):**
- Mischtrommel: Kugel aus Acrylglas, Ø 750 mm, horizontale Drehachse, Elektromotor, auf dunklem Metallgestell
- Innen: Speichenkreuz aus Metallstäben, die von einer Zentralnabe radial zur Wand laufen (Mitnehmer)
- Auswerfschiene: gebogener Drahtbügel/Rohrbogen innen, führt von der Trommelwand zur Achse und mündet dort nach außen (Stand der Technik laut DE1948531U, 1966: „kurvenförmig ausgebildete Auswerfschiene, die in Achsnähe nach außen mündet")
- Links neben der Trommel: schwarze Lager-/Antriebsscheibe an der Achse, daneben ein senkrechter Plexiglasschacht mit Führungsstäben; die Kugel fällt dort nach unten
- Unten links vorn: Reihe aufrecht stehender Glasröhrchen auf blauem Sockel, je eine gezogene Kugel pro Röhrchen
- Schütte: geneigte transparente Rampe oben rechts hinter der Trommel, 49 halboffene Ausfräsungen über einer Schieberplatte; Taster am Steuerpult gibt die Kugeln frei
- Rechts: schwarzer, geschwungener Gestellbügel; rechts vorn erscheint die gezogene Kugel groß in einem runden transparenten Körper (Lupe oder Bildeinblendung — nicht eindeutig)
- Kugeln: 49 Tischtennisbälle, Ø 40 mm, 3,09 g, weiß bis elfenbein, schwarze Ziffern (Futura extra fett, 9 mm, 12× rundum), Toleranz je Satz max. 3 %
- Richtungsumkehr schaltet zwischen Mischen und Ziehen
- Pannen belegt: Kugel zerbrochen (1999), Kugel im Greifarm hängen geblieben (1999), Kugel im Rohr stecken (2010)

**Sendung (ARD, Samstag, HR Frankfurt):**
- 6 Gewinnzahlen + Zusatzzahl (7. Kugel aus derselben Trommel); ab 1991 zusätzlich Superzahl (0–9) aus separatem kleinem Gerät
- Ab 3.4.1993 Sendeplatz 19:55 Uhr, ca. 5 Minuten, live
- Lottofee moderiert; Eröffnungssatz zum Aufsichtsbeamten; Ziehungsleiter überwacht
- Heller, flach ausgeleuchteter Studiohintergrund (bläulich-grau bzw. warm-beige je nach Jahr), ruhige Kameraführung

**Modelliert, nicht belegbar:** Drehzahlen, genaue Form der Auswerfschiene, Speichenzahl, Schachtverlauf, Phasendauern, Aussehen des Superzahl-Geräts, Funktion des runden Körpers rechts vorn.

---

# Der Prompt

Baue eine 3D-Web-Simulation der deutschen Samstags-Lottoziehung „6 aus 49", wie sie in den 1990er Jahren im Fernsehen lief. Ziel ist eine filmreife, physikalisch glaubwürdige Nachbildung genau dieses Geräts, kein Zufallszahlen-Widget. Arbeite ohne Rückfragen; dokumentiere Annahmen als Code-Kommentar.

## 1. Technik
- Engine deiner Wahl (z. B. Three.js + Rapier/cannon-es, Babylon.js + Havok, PlayCanvas). Begründe die Wahl in einem Satz in der README.
- Läuft im Browser (Chrome, Firefox, Safari), Desktop und Tablet, 60 fps auf Mittelklasse-Hardware.
- Ein Repository mit Vite-Build oder eine einzelne HTML-Datei mit ESM-CDN-Imports. Kein Backend.
- Kein `localStorage`. Keine Sender-Logos, keine realen Personen, keine geschützte Musik.
- UI-Texte und Kommentare auf Deutsch.

## 2. Bedienung
Drei Buttons, immer sichtbar, Tastenkürzel in Klammern:
- **Start** (Leertaste): startet die komplette Ziehung inkl. Kamerachoreografie.
- **Stop** (Leertaste): friert Physik und Kamera ein; Trommel läuft realistisch aus. Erneut Start = Fortsetzen.
- **Reset** (R): alle Kugeln zurück auf die Schütte, Röhrchen leer, Kamera in Totale. Kein Neuladen.
  Zusätzlich: Seed-Feld (gleicher Seed → gleiche Zahlen), Geschwindigkeit 1×/2×, Umschalter „Regie"/„Frei" (Orbit-Kamera), Umschalter „TV-Look 1993" (siehe 6).

## 3. Das Gerät — verbindlicher Aufbau (Blick von vorn)
- **Trommel (Mitte):** transparente Acryl-Kugel, Innen-Ø 750 mm, horizontale Drehachse links–rechts, auf dunklem Metallgestell mit Steuerpult.
- **Speichenkreuz:** 6–8 dünne Metallstäbe (Ø ca. 6 mm) von einer Zentralnabe radial bis kurz vor die Wand, fest mit der Trommel verbunden. Sie wirken als Mitnehmer und sind deutlich sichtbar.
- **Auswerfschiene (Greifarm):** gebogener Drahtbügel bzw. Rohrbogen in der linken Trommelhälfte, fest mit der Trommel verbunden. Er beginnt an der Innenwand als Schaufel und führt in einer Kurve zur Achse, wo er durch die hohle Achse nach links austritt. In Mischrichtung läuft die Schaufel „rückwärts" und nimmt nichts auf; in Ziehrichtung nimmt sie am tiefsten Punkt eine Kugel auf, die beim Anheben entlang der Kurve zur Achse rollt. Die Richtungsumkehr muss sichtbar sein.
- **Achse links:** schwarze Lager-/Antriebsscheibe (Ø ca. 180 mm) an der Achse; der Auslass liegt in der Achse, nicht am Trommelumfang.
- **Fallschacht links:** senkrechter Plexiglasschacht mit Führungsstäben neben der Achse; die Kugel fällt darin nach unten auf eine kurze Verteilerbahn.
- **Auffangröhrchen (unten links vorn):** 7 aufrecht stehende Glasröhrchen (Innen-Ø ca. 45 mm) in einer Reihe auf blauem Sockel; jede gezogene Kugel landet im nächsten freien Röhrchen.
- **Schütte (oben rechts hinten):** geneigte transparente Rampe mit 49 Mulden über einer Schieberplatte; bei Start öffnet die Platte, die Kugeln rollen nacheinander in die Trommel (ca. 3–4 s).
- **Gestellbügel rechts:** schwarzer, geschwungener Bügel als Teil des Gestells.
- **Lupe (rechts vorn):** runder transparenter Körper, in dem die zuletzt gezogene Kugel groß erscheint. Umsetzen als kreisrunder Bild-in-Bild-Ausschnitt mit Glasrand, der die Kugel im Röhrchen in Nahaufnahme zeigt.
- **Kugeln:** 49 Stück, Ø 40 mm, 3,09 g (±3 % Streuung), weiß bis leicht elfenbein, matt, schwarze fette Ziffern rundum lesbar (Textur, kein Sprite).
- **Superzahl:** kleines zweites Gerät gleichen Prinzips (Kugel mit Speichen und Auswerfschiene, 10 Kugeln 0–9), rechts neben dem Hauptgerät. Aussehen ist nicht belegt, deshalb schlicht halten.

## 4. Physik
- Echte Rigid-Body-Simulation für alle Kugeln; Trommelwand, Speichen und Auswerfschiene als mitrotierende Kollider mit Wandgeschwindigkeit; Kugel-Kugel-Kontakte.
- Fester Zeitschritt, entkoppelt vom Frame; 2× rechnet mehr Schritte, ändert nie `dt`.
- Seed steuert nur die Anfangsstörungen (Abwurfzeitpunkt, Position, Masse). Danach kein Zufallsgenerator mehr.
- **Die gezogene Zahl entsteht ausschließlich aus der Simulation.** Vorab würfeln und die Animation nachstellen ist verboten.
- Die Auswerfschiene darf nur eine Kugel zugleich aufnehmen (Querschnitt knapp über 40 mm).
- Wächter: fängt die Schiene 20 s lang nichts, Drehzahl +15 % und neuer Mischzyklus. Bleibt eine Kugel in Schiene oder Schacht hängen → nach 6 s per Skript ausrollen, Anzeige „Störung — Ziehungsleiter greift ein". Nie abbrechen, nie eine Zahl erfinden.

## 5. Ablauf (Zustandsautomat, Phase im UI sichtbar)
1. `BEREIT` — Kugeln auf der Schütte, Studio-Totale.
2. `EINWURF` — Schieberplatte öffnet, Kugeln fallen ein.
3. `MISCHEN` — Trommel rampt auf ca. 30 U/min in Mischrichtung, 8–10 s beim ersten Mal, danach 4–5 s.
4. `ZIEHEN` — Umkehr auf ca. 20 U/min; die Auswerfschiene schöpft eine Kugel und führt sie zur Achse.
5. `AUSLAUF` — Kugel tritt links aus der Achse, fällt durch den Schacht in das nächste freie Röhrchen.
6. `ANZEIGE` — Kugel erscheint in der Lupe, Zahl in der Einblendung, 1,5 s halten.
7. Zurück zu 3, bis 7 Kugeln gezogen sind (Röhrchen 1–6 = Gewinnzahlen, Röhrchen 7 = Zusatzzahl).
8. `SUPERZAHL` — kleines Gerät mischt 5 s, zieht eine Kugel.
9. `ENDE` — Trommel bremst aus; Schlusstafel: 6 Zahlen aufsteigend sortiert, Zusatzzahl, Superzahl. Reset aktiv.
   Gesamtdauer bei 1×: 3–4 Minuten.

## 6. Inszenierung — „filmreif, wie damals"
**Studio:** Heller, flach ausgeleuchteter Hintergrund mit weichem Verlauf, Standard bläulich-grau (Umschalter „warm" für beige). Gerät auf Podest, Steuerpult mit wenigen Tastern und Kontrollleuchten. Materialien: Acrylglas mit Fresnel-Reflexion und leichter Refraktion, dunkles lackiertes Metall für Gestell und Bügel, blauer Sockel, matte Kugeln. Weiches Frontlicht plus Spitzlicht auf der Trommel; Kugeln und Speichen müssen im Acryl sichtbar glänzen.

**Kamerachoreografie (Modus „Regie"):**
- Totale beim Start (Bildaufbau wie Referenz: Trommel mittig, Schacht und Röhrchen links unten, Schütte rechts oben), langsamer Push-in während `MISCHEN`.
- Halbnah auf die Auswerfschiene beim Richtungswechsel.
- Schwenk von der Achse den Fallschacht hinab zu den Röhrchen, während die Kugel fällt (kein Schnitt).
- Close-up der Kugel im Röhrchen, Ziffer scharf lesbar, 1,5 s Halt, gleichzeitig Lupe rechts vorn; dann weicher Schnitt zurück.
- Schwenk zum Superzahl-Gerät, Schlusstotale mit Ergebnistafel.
- Alle Kamerafahrten mit Ease-in/out; harte Schnitte nur zwischen Phasen.

**Grafik:** Bauchbinde in 90er-TV-Optik: serifenlose fette Ziffern, weiß auf halbtransparentem Dunkelblau, 7 Kästchen füllen sich nacheinander; Superzahl separat. Unauffällig „19:55" oben rechts als Stilzitat.

**TV-Look 1993 (Umschalter):** 4:3 mit Pillarbox, leichte Scanlines, minimale Chroma-Unschärfe und Bildrauschen, Vignette, 50-Hz-Flimmern deaktivierbar. Standard ist sauberes 16:9.

**Ton (Web Audio, synthetisch):** Motorbrummen abhängig von der Drehzahl, Kugelrasseln aus den Kollisionsereignissen (Lautstärke ~ Aufprallgeschwindigkeit), hohles Klacken beim Fall ins Glasröhrchen. Kein Musikbett. Ton standardmäßig aus, Button „Ton".

## 7. Barrierefreiheit und Robustheit
- Live-Region (`aria-live="polite"`) sagt jede Zahl und Phase an.
- `prefers-reduced-motion`: keine Kamerafahrten, nur Schnitte; Physik unverändert.
- Keine Konsolenfehler, kein hängender Zustand, Fenstergröße ändern ohne Neuladen.

## 8. Code-Qualität
- Ein `CONFIG`-Objekt mit allen Zahlenwerten (Geometrie, Speichenzahl, Schienenkurve, Drehzahlen, Phasendauern, Kamerapositionen, Farben, Post-Processing). Keine magischen Zahlen im Code.
- Klare Module: Physik, Zustandsautomat, Kameraregie, Renderer/Materialien, UI, Audio.
- Bezeichner nach Originalteilen: `trommel`, `speichenkreuz`, `auswerfschiene`, `achsauslass`, `fallschacht`, `auffangroehrchen`, `schuette`, `lupe`, `superzahlgeraet`.
- README: Start-Anleitung, Engine-Begründung, Liste der getroffenen Annahmen.

## 9. Abnahme (selbst prüfen, Ergebnis berichten)
1. Ein Durchlauf liefert 7 verschiedene Zahlen aus 1–49 und eine Superzahl 0–9.
2. Gleicher Seed → gleiche Zahlen; bei 1× und 2× identisch. Seed wird beim Start Klick automatisch per Zufall gefüllt, wenn leer.
3. Keine Kugel verlässt die Trommel außer durch Einwurföffnung oder Achsauslass.
4. Stop friert alles ein, Start setzt exakt fort, Reset stellt `BEREIT` wieder her, beliebig oft.
5. Im Modus „Regie" ist die Ziffer jeder gezogenen Kugel im Close-up ohne Zoom lesbar.
6. Gesamtdauer bei 1× zwischen 3 und 4 Minuten.
7. 60 fps in Chrome auf Mittelklasse-Notebook; unter 30 fps schaltet Post-Processing automatisch ab.
8. Funktionstest Richtungsumkehr: in `MISCHEN` nimmt die Auswerfschiene im Mittel < 0,1 Kugeln pro Umdrehung auf; in `ZIEHEN` erreicht spätestens nach 3 Umdrehungen eine Kugel den Achsauslass. Schienengeometrie und Reibung so lange justieren, bis das stimmt.
9. Die Totale entspricht im Bildaufbau der Referenz: Trommel mit Speichen mittig, Achsscheibe und Schacht links, Röhrchenreihe links unten, Schütte rechts oben, Lupe rechts vorn.

## 10. Nicht tun
- Keine vorab gewürfelte Ziehung mit nachgestellter Animation.
- Kein Auslass am Trommelumfang, keine geneigte Rollbahn mit Schiene statt Glasröhrchen.
- Keine Sender-Logos, keine Namen realer Moderatorinnen, keine geschützte Musik.
- Keine Platzhalter, keine TODOs. Beim ersten Öffnen vollständig funktionsfähig.
- Keine Rückfrage vor Beginn.