# AGENTS.md

## Ziel

Jeder Unterordner in `src/` ist der Quellcode eines Projektstands, benannt nach dem LLM, das ihn erstellt hat (z. B. `claude-opus-5-5`, `gpt5-astra`; bei mehreren Ständen desselben LLM mit Zusatz, z. B. `claude-opus-5-5_b`).

Jeder Stand enthält `public/manifest.json` mit `harness`, `llm` und `datum` (`YYYY-MM-DD`, Tag der Erstellung). Vite kopiert die Datei beim Build nach `tests/<name>/`; die Übersicht `../index.php` zeigt diese Angaben an und sortiert nach `datum`.

Das Ergebnis jedes Projektstands ist eine **statische Webseite**, die ohne Build-Schritt, ohne Node und ohne Dev-Server direkt im Browser läuft. Sie wird unter `../tests/<name>/` abgelegt, wobei `<name>` exakt dem Ordnernamen in `src/` entspricht.

Die Übersichtsseite `../index.php` listet alle Ordner in `../tests/` auf und lädt `tests/<name>/` in einem iframe.

## Anforderungen an die Ausgabe

- `../tests/<name>/index.html` ist der Einstiegspunkt.
- Dort liegen nur statische Dateien: HTML, CSS, JS, Bilder, Audio, Fonts usw. Kein `src/`, kein `node_modules/`, keine `package.json`.
- **Alle Pfade sind relativ** (`./assets/...`), nie absolut (`/assets/...`). Die Seite läuft in einem Unterordner und in einem iframe.
- Die Seite ist in sich geschlossen und lädt nichts aus anderen `tests/<name>`-Ordnern.
- Die Seite muss über einen normalen Webserver funktionieren, z. B. `php -S` im Ordner `lotto/`, Aufruf `http://localhost:8000/tests/<name>/`.

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
cd src/<name>
npm install
npx vite build --outDir ../../tests/<name> --emptyOutDir
```

Danach prüfen, dass `../tests/<name>/index.html` nur relative Pfade enthält:

```sh
grep -nE '(src|href)="/[^/]' ../../tests/<name>/index.html   # darf nichts finden
```

## Neuen Projektstand anlegen

1. Den letzten Stand kopieren: `cp -r src/<alt> src/<neu>` (ohne `node_modules`, danach `npm install`).
2. Änderungen in `src/<neu>` vornehmen.
3. Nach `../tests/<neu>/` bauen (siehe oben).
4. Bereits veröffentlichte Stände in `../tests/` nicht verändern.

## Abnahme

Ein Stand ist fertig, wenn `http://localhost:8000/tests/<name>/` im Browser ohne Konsolenfehler läuft und alle Assets mit HTTP 200 geladen werden. Gleiches gilt für den Aufruf über die Übersicht `http://localhost:8000/`.
