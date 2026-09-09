# Samstagsziehung · Studio 1993

Ein eigenständiges, deutschsprachiges 3D-Lottostudio mit 49 nummerierten Kugeln, einer separaten Superzahlmaschine, Kameraregie, synthetischem Ton und optionalem Fernsehbild. Keine offizielle Ziehung, kein Glücksspielangebot.

## Starten

Node.js ab 20.19 bzw. 22.12:

```sh
npm ci
npm run dev
```

Anschließend `http://localhost:5173` öffnen. `npm run build` erstellt die statische Website in `dist/`; `npm run preview` zeigt den Produktionsbuild. Zum Veröffentlichen genügt ein statischer Webserver. Es gibt kein Backend, keine externen Laufzeit-Downloads und kein `localStorage`.

## Deployment mit Docker

Im Projektverzeichnis das Image bauen und den Container starten:

```sh
docker build -t samstagsziehung .
docker run -d --name samstagsziehung --restart unless-stopped -p 8080:80 samstagsziehung
```

Die App ist anschließend unter `http://localhost:8080` erreichbar. Das Dockerfile baut die App mit Node.js und liefert den fertigen Build über Nginx auf Container-Port 80 aus. Für eine öffentliche Domain mit HTTPS kann ein Reverse Proxy diesen Port verwenden. Laufzeitvariablen und persistente Volumes sind nicht erforderlich.

**Engine-Wahl:** Three.js bietet kontrollierbare Beleuchtung, Acrylmaterialien und Kameras, während cannon-es die dynamischen Kugelkontakte und den kinematischen Drahtkorb mit einem festen Zeitschritt auch ohne WebAssembly abbildet.

## Bedienung

- **Start / Stop · Leertaste:** starten, pausieren und fortsetzen. Die Schaltflächen bleiben beim Scrollen erreichbar. Tastenkürzel greifen außerhalb fokussierter Formularelemente; fokussierte Buttons behalten die native Leertastenbedienung.
- **Reset · R:** Ausgangszustand ohne Neuladen, einschließlich Kugeln, Kamera und Ergebnisanzeige.
- **Seed:** vor dem Start ändern. Reset übernimmt den aktuellen Seed. Gleiche Anfangsbedingungen liefern innerhalb derselben Implementierung dieselbe Ziehung.
- **1× / 2×:** doppelt so viele Schritte, weiterhin exakt `dt = 1/120 s`.
- **Regie / Frei:** automatische Einstellungen oder Orbit-Kamera; im freien Modus ziehen und zoomen.
- **TV-Look 1993:** 4:3-Ausschnitt im 16:9-Studio, Pillarbox, Scanlines, prozedurales Rauschen, leichte Unschärfe und Vignette. Die zusätzliche Flimmeroption ist standardmäßig aus. Ihre Darstellung hängt von der Bildwiederholrate des Displays ab; echtes analoges 50-Hz-Halbbildvideo wird nicht emuliert.
- **Ton:** startet Web Audio erst durch einen Klick. Motorbrummen, kontaktabhängiges Rasseln und Einrastgeräusch entstehen synthetisch.

`prefers-reduced-motion` ersetzt Kamerafahrten durch Einstellungen ohne Fahrt und unterdrückt Flimmern. Phasen und Ergebnisse stehen in einer höflichen Live-Region. Ein unsichtbarer Browser-Tab pausiert die Verarbeitung; es gibt keinen Sprung durch nachgeholte Minuten.

## Physik und Ablauf

Die Anfangsvorbereitung erzeugt ausschließlich Massenabweichungen, Einwurfzeitabweichungen und räumliche Anfangsstörungen aus dem Seed. Nach dieser Vorbereitung läuft kein Zufallsgenerator in der Simulation. Die Nummer wird erst übernommen, wenn eine tatsächliche Kugel den geöffneten räumlichen Auslass erreicht. Ein Ergebnisplan oder eine nachträglich nummerierte Animationskugel existiert nicht.

- Innenradius der Haupttrommel: **375 mm**, Kugelradius **20 mm**, Nennmasse **3,09 g**, Abweichung je Kugel **±3 %**.
- Cannon berechnet Kugel-Kugel- und Kugel-Draht-Kontakte. Der Drahtkorb besteht aus einem kinematischen Verbund dünner Kollisionssegmente. Darstellung und Kollisionsmodell beziehen seine Geometrie aus derselben Funktion.
- Die konkave Kugelinnenwand ist ein analytischer Kollisionsrand. Normalstoß und Coulomb-begrenzter Tangentialimpuls berücksichtigen die Wandgeschwindigkeit und die Kontaktgeschwindigkeit der rotierenden Kugel. Das Trägheitsmoment wird als dünne Hohlkugel angesetzt.
- Die Korbgeometrie bleibt in beiden Richtungen identisch. Es gibt keine Kontaktverriegelung, keine an den Arm geheftete Kugel und kein Abschalten des Korbs beim Mischen.
- Ein Sensor an der weltfesten Öffnung übergibt die erste dort ankommende Kugel an den Auslauf. Bereits ausgegebene Kugeln bleiben aus der Mischtrommel entfernt.
- Nach 20 Sekunden ohne Ausgabe folgen 15 % mehr Drehzahl und ein neuer Mischzyklus. Ein blockierter Auslauf wird nach sechs Sekunden mit sichtbarer Störungsmeldung bis zu seinem tatsächlichen Zielplatz geführt; die Nummer bleibt unverändert.

## Modellannahmen und Grenzen

Diese Umsetzung ist eine inszenierte, vereinfachte Mechaniksimulation, keine messtechnisch validierte Rekonstruktion des historischen Geräts. Folgende Entscheidungen sind ausdrücklich modelliert und nicht historisch belegt:

1. **Drahtarm, Lagerung, Schütte, Rohr und Studio:** Maße außerhalb der vorgegebenen Trommel und Kugeln, Reibwerte, Beleuchtung, Dekor und Kamerapositionen sind frei konstruiert. Das kleine Gerät hat 170 mm Innenradius. Die Zahlentextur verwendet eine fette lokale Sans-Serif-Schrift als Futura-Ersatz, mit zwölf Aufdrucken von etwa neun Millimetern Höhe.
2. **Auslasssteuerung:** Eine zeitgesteuerte Freigabe gibt den weltfesten Auslass nach 15 Sekunden Ziehvorlauf frei. Dadurch ergibt sich die gewünschte Sendedauer. Diese zusätzliche Wartezeit ist keine belegte Funktion des Originals. Sie bestimmt keine Zahl; bei geschlossener Öffnung bleiben alle Kugeln dynamisch in der Trommel.
3. **Einwurf:** Die einzelnen Kugeln werden über eine räumliche Führung von ihrer Mulde zur oberen Öffnung geleitet. Währenddessen sind sie kinematisch geführt. Der Einwurf ist daher **keine freie dreidimensionale Rigid-Body-Simulation der Schütte**.
4. **Auslauf:** Nach der tatsächlichen Ausgabe gilt ein eindimensionales Rollmodell entlang Rohr und Bahn, mit Hangabtrieb und begrenzter Geschwindigkeit. Danach rollen die Kugeln von rechts in den nächsten Schienenplatz. Die Führung ist **kein vollständiger 3D-Kollisionskörper des Rohrs**; natürliche Rohrverklemmungen werden damit nicht physikalisch erzeugt. Der zugehörige Störungswächter bleibt implementiert.
5. **Stop:** Physik, Ziehzeit und Kamera halten exakt an. Nur die sichtbare Trommel läuft gedämpft nach; dieser optische Winkel wird beim Fortsetzen weich angeglichen. Das trennt die widersprüchlichen Anforderungen „exakter Physikstillstand“ und „Trommel läuft aus“. Dieser Nachlauf beeinflusst das Ergebnis nicht.
6. **Laufzeit und Darstellung:** Die gemessenen 3–4 Minuten beziehen sich auf Simulationszeit. Zu langsame Geräte können mehr Echtzeit benötigen. Unter gemessenen 30 fps werden die TV-Effekte, Echtzeitschatten und Acryltransmission reduziert. Eine verbindliche 60-fps-Zusage auf nicht vorhandener Notebook-Hardware ist nicht geprüft.
7. **Reproduzierbarkeit:** Gleiche Version, gleicher Seed und gleicher numerischer Ausführungspfad sind geprüft. Bitidentische chaotische Langzeitverläufe zwischen unterschiedlichen Browserengines oder zukünftigen Engine-Versionen sind nicht zugesichert.

Damit sind insbesondere die uneingeschränkt geforderte 3D-Rigid-Body-Physik während Einwurf und Auslauf sowie die geräteübergreifende Leistungsabnahme noch nicht vollständig erfüllt.

## Aufbau

| Datei | Aufgabe |
| --- | --- |
| `src/config.js` | Physikparameter, Geometrie, Material- und Lichtwerte, Studiodekor, Zeiten, Kameras und Tonparameter |
| `src/physics.js` | Seed-Anfangsbedingungen, Cannon-Welt, analytische Trommelwand, Drahtkorb und Auslaufführung |
| `src/state.js` | Zustandsautomat, Ziehungsbuchhaltung und Störungswächter |
| `src/renderer.js` | Studio, Apparate, Acryl, Kugeltexturen und optischer Nachlauf |
| `src/camera.js` | Regie, Orbit-Kamera und reduzierte Bewegung |
| `src/ui.js` | Bedienung, Einblendungen und Live-Region |
| `src/audio.js` | Synthetische, kontaktabhängige Geräusche |
| `src/main.js` | Fester Simulationsschritt, Renderloop und adaptive Grafikqualität |

## Abnahme

```sh
npm test
npm run test:mechanics
# Bei laufendem Vite-Server und installiertem Chrome:
npm run test:browser
npm run build
```

Für andere Chrome-Installationen `CHROME_PATH` setzen. Der Browser-Test speichert Ansichten unter `/tmp/lotto-{ready,tv,close,end,tablet}.png`.

Gemessen mit dem implementierten Modell unter Node.js 22 (Linux):

| Seed | Reihenfolge: sechs Gewinnzahlen · Zusatzzahl | Superzahl | Simulationsdauer inklusive Ausbremsen |
| --- | --- | --- | --- |
| `1993` | 49, 37, 11, 18, 46, 16 · 29 | 6 | 206,28 s |
| `Samstag` | 36, 40, 6, 29, 38, 45 · 20 | 1 | 205,63 s |
| `2026` | 34, 28, 45, 38, 12, 10 · 14 | 2 | 205,88 s |
| `0` | 15, 7, 18, 33, 46, 10 · 8 | 8 | 205,67 s |

- Gültigkeit und Einzigartigkeit: alle vier Durchläufe bestanden.
- Seed `1993`: 1×, in Zweierschritten ausgeführtes 2× und wiederholtes Stop/Start liefern identische Zahlen und exakt dieselbe Anzahl Simulationsschritte.
- Die Störungswächter sind mit deaktivierter Auslass-Erkennung bzw. absichtlich blockierter Rohrführung geprüft: neuer Mischzyklus und Ausgabe derselben tatsächlich gefangenen Kugel.
- Kugelgrenzen werden im Simulationstest kontrolliert; Reset wird zehnmal samt vollständigen Anfangsbedingungen verglichen.
- Richtungsprüfung für `1993`: **0,00** Kugeln im Mittel am oberen Scheitel beim Mischen; **1,24** Kugeln im Mittel am Auslass beim Ziehen, beobachteter Bereich **1–3**. Die weiteren drei Seeds lagen bei 0,00–0,06 (Mischen) und 1,17–1,48 (Ziehen). Gezählt werden Kugelmittelpunkte im räumlichen Korbbereich bei der jeweiligen Winkelpassage. Dies prüft das implementierte Modell, nicht die historische Maschine.
- Chrome 152: vollständige Ziehung, identische Wiederholung nach Reset in Zweierschritten (2×), WebGL, Pause samt Kamerastillstand, 1×/2×-Umschalter, Ton, Regie/Frei, 4:3-Ausschnitt und Layouts bei 1440, 768 und 390 Pixeln Breite geprüft; keine JavaScript- oder Konsolenfehler. Die Nahaufnahme ist lesbar. Die automatische Grafikreduktion wurde im Software-Rendering ausgelöst. Chrome lieferte für `1993` die Reihenfolge **44, 13, 20, 21, 41, 28 · 27**, Superzahl **6**, in **206,10 s**. Damit ist eine Abweichung zwischen Node und Chrome ausdrücklich beobachtet; die Ergebnistabelle ist keine browserübergreifende Referenz.
- **Nicht geprüft:** echte Safari- und Firefox-Sitzungen, 60 fps auf einem definierten Mittelklasse-Notebook sowie jede denkbare Seed-Zeichenfolge. Die technische Nutzung von WebGL, ResizeObserver und Web Audio ist dafür ausgelegt, ersetzt aber keinen Gerätetest.

Verwendete technische Referenzen: [Three.js: Acrylmaterial und Transmission](https://threejs.org/docs/pages/MeshPhysicalMaterial.html), [cannon-es: starre Körper und Impulse](https://pmndrs.github.io/cannon-es/docs/classes/Body.html). Die historischen Angaben stammen aus der Aufgabenbeschreibung; daraus wird kein Anspruch auf eine exakte Museumsrekonstruktion abgeleitet.
