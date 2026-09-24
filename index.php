<?php
// Übersicht aller statischen Webseiten im Ordner tests/ (ein Unterordner je Projektstand, benannt nach dem LLM)

$base = 'tests';
$projects = [];
foreach (scandir(__DIR__ . "/$base") as $name) {
    if ($name[0] === '.' || !is_dir(__DIR__ . "/$base/$name")) {
        continue;
    }
    // Angaben aus manifest.json (Harness, LLM, Entstehungsdatum), falls vorhanden
    $manifest = [];
    $datei = __DIR__ . "/$base/$name/manifest.json";
    if (is_file($datei)) {
        $manifest = json_decode((string) file_get_contents($datei), true) ?: [];
    }
    $datum = '';
    if (isset($manifest['datum']) && preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $manifest['datum'], $d)) {
        $datum = "$d[3].$d[2].$d[1]";
    }
    $projects[] = [
        'name'    => $name,
        'url'     => "$base/$name/",
        'harness' => (string) ($manifest['harness'] ?? ''),
        'llm'     => (string) ($manifest['llm'] ?? ''),
        'datum'   => $datum,
        'sortier' => (string) ($manifest['datum'] ?? ''),
    ];
}
// neuester Stand zuerst (nach Datum im Manifest, sonst nach Ordnername)
usort($projects, fn($a, $b) => strcmp($b['sortier'], $a['sortier']) ?: strnatcmp($a['name'], $b['name']));

$h = fn($s) => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
?>
<!doctype html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Projektstände</title>
    <style>
        * { box-sizing: border-box; }
        html, body { margin: 0; height: 100%; font-family: system-ui, sans-serif; }
        body { display: flex; background: #0b1726; color: #e6edf3; }
        nav { width: 220px; flex-shrink: 0; overflow-y: auto; border-right: 1px solid #22344a; }
        nav h1 { margin: 0; padding: 16px; font-size: 14px; letter-spacing: .08em; text-transform: uppercase; color: #8aa0b8; }
        nav a { display: block; padding: 10px 16px; color: inherit; text-decoration: none; border-left: 3px solid transparent; }
        nav a:hover { background: #13243a; }
        nav a.active { background: #172a3a; border-left-color: #f5c542; font-weight: 600; }
        nav a dl { margin: 6px 0 0; display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; font-size: 11px; font-weight: 400; }
        nav a dt { color: #8aa0b8; }
        nav a dd { margin: 0; color: #c9d4e0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; overflow-wrap: anywhere; }
        nav p { padding: 0 16px; color: #8aa0b8; }
        iframe { flex: 1; border: 0; background: #fff; }
    </style>
</head>
<body>
<nav>
    <h1>Projektstände</h1>
    <?php if (!$projects): ?>
        <p>Keine Projektstände gefunden.</p>
    <?php endif; ?>
    <?php foreach ($projects as $p): ?>
        <a href="#<?= $h($p['name']) ?>" data-src="<?= $h($p['url']) ?>" target="view">
            <?= $h($p['llm'] !== '' ? $p['llm'] : 'Unbekanntes LLM') ?>
            <?php if ($p['harness'] !== '' || $p['datum'] !== ''): ?>
                <dl>
                    <?php if ($p['harness'] !== ''): ?><dt>Harness</dt><dd><?= $h($p['harness']) ?></dd><?php endif; ?>
                    <?php if ($p['datum'] !== ''): ?><dt>Datum</dt><dd><?= $h($p['datum']) ?></dd><?php endif; ?>
                </dl>
            <?php endif; ?>
        </a>
    <?php endforeach; ?>
</nav>
<iframe name="view" id="view" title="Projektvorschau"></iframe>
<script>
    const links = [...document.querySelectorAll('nav a')];
    const frame = document.getElementById('view');

    function show(link) {
        if (!link) return;
        links.forEach(l => l.classList.toggle('active', l === link));
        frame.src = link.dataset.src;
        history.replaceState(null, '', link.getAttribute('href'));
    }

    links.forEach(l => l.addEventListener('click', e => { e.preventDefault(); show(l); }));

    // Beim Laden: Auswahl aus dem Hash übernehmen, sonst neuesten Stand anzeigen
    const hash = decodeURIComponent(location.hash.slice(1));
    show(links.find(l => l.getAttribute('href') === '#' + hash) || links[0]);
</script>
</body>
</html>
