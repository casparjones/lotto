# AGENTS.md

## Ziel

Jeder Unterordner in `quellcode/` ist der Quellcode eines Projektstands, benannt nach Datum (`YYYY-MM-DD`, optional mit Zusatz, z. B. `2026-09-24_b`).

Das Ergebnis jedes Projektstands ist eine **statische Webseite**, die ohne Build-Schritt, ohne Node und ohne Dev-Server direkt im Browser läuft. Sie wird unter `../tests/<datum>/` abgelegt, wobei `<datum>` exakt dem Ordnernamen in `quellcode/` entspricht.

Die Übersichtsseite `../index.php` listet alle Ordner in `../tests/` auf und lädt `tests/<datum>/` in einem iframe.

## Anforderungen an die Ausgabe

- `../tests/<datum>/index.html` ist der Einstiegspunkt.
- Dort liegen nur statische Dateien: HTML, CSS, JS, Bilder, Audio, Fonts usw. Kein `src/`, kein `node_modules/`, keine `package.json`.
- **Alle Pfade sind relativ** (`./assets/...`), nie absolut (`/assets/...`). Die Seite läuft in einem Unterordner und in einem iframe.
- Die Seite ist in sich geschlossen und lädt nichts aus anderen `tests/<datum>`-Ordnern.
- Die Seite muss über einen normalen Webserver funktionieren, z. B. `php -S` im Ordner `lotto/`, Aufruf `http://localhost:8000/tests/<datum>/`.

## Build (Vite-Projekte)

In `vite.config.js` muss `base: "./"` gesetzt sein:

```js
export default defineConfig({
  base: "./",
  // ...
});
```

Bauen und ausgeben:

```sh
cd quellcode/<datum>
npm install
npx vite build --outDir ../../tests/<datum> --emptyOutDir
```

Danach prüfen, dass `../tests/<datum>/index.html` nur relative Pfade enthält:

```sh
grep -nE '(src|href)="/[^/]' ../../tests/<datum>/index.html   # darf nichts finden
```

## Neuen Projektstand anlegen

1. Den letzten Stand kopieren: `cp -r quellcode/<alt> quellcode/<neu>` (ohne `node_modules`, danach `npm install`).
2. Änderungen in `quellcode/<neu>` vornehmen.
3. Nach `../tests/<neu>/` bauen (siehe oben).
4. Bereits veröffentlichte Stände in `../tests/` nicht verändern.

## Abnahme

Ein Stand ist fertig, wenn `http://localhost:8000/tests/<datum>/` im Browser ohne Konsolenfehler läuft und alle Assets mit HTTP 200 geladen werden. Gleiches gilt für den Aufruf über die Übersicht `http://localhost:8000/`.
