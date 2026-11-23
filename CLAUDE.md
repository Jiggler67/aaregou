# Aaregou — Statistik-Website FVBJ Junioren B

Statische Single-Page-Website (Vorbild footstats.ch) für die Junioren B des
Fussballverbands Bern/Jura (FVBJ). Zeigt Tabellen, Spiele, Spielberichte,
Spielerseiten, Statistiken und Chancen-Prognosen. Datenquelle: FVBJ Matchcenter
(matchcenter.fvbj-afbj.ch, oid=6, Saison s=2027).

## Aufbau

- **`index.html`** — die ganze App: ein `<style>`-Block und ein `<script>`-Block,
  kein Build-Schritt, keine Abhängigkeiten. Beim Laden holt sie per `fetch`
  `data.txt`, `logos.txt` und `corrections.txt`, parst sie und rendert alles
  client-seitig. Navigation über Hash-Routing (`#yl`, `#team-123`, `#sk1-stats`…),
  siehe die Funktion `route()`.
- **`data.txt`** — alle Wettbewerbsdaten, pipe-delimitiert (`|`), ein Block pro Zeile.
  Blocktypen:
  - `LEAGUE|key|Name|matchcenter-ln` — eine Liga/Gruppe
  - `ROUND|leagueKey|kind|Name` — Runde (`kind` = `hb` Herbst / `fj` Frühjahr)
  - `T|id|Name|short|leagueKey` — Team
  - `G|...` — ein Spiel (Datum, Teams, Resultat, Tore/Karten-Events, Aufstellung)
  - `SK|skKey|Name|ln` + `SKG|skKey|kind|rundenName|leagueKey|gruppenName` —
    Stärkeklassen und ihre Gruppen (Statistik wird pro Stärkeklasse über alle
    Gruppen zusammengefasst; `skOf(comp)` liefert die Stärkeklasse eines Spiels)
  - `PL` / `POS` / `LU` — kompakte Encodings für Spieler, Positionen und
    Aufstellungen pro Spiel (Spielercodes in base36). Format eines LU-Eintrags:
    `code[.pos][#nr][!cap][*out]`, wobei `*` = kein Einsatz.
- **`logos.txt`** — Vereinslogos als 40px-WebP, base64, ein Logo pro Zeile.
- **`corrections.txt`** — manuelle Korrekturen (z. B. im Matchcenter fehlende Tore),
  werden nach dem Parsen angewendet. Hier Einträge ergänzen, nicht in `data.txt`.
- **`updater/scrape.js`** — Scraper, der `data.txt`/`logos.txt` neu erzeugt.
  **Wichtig:** läuft in der Browser-Konsole auf matchcenter.fvbj-afbj.ch
  (nutzt same-origin `fetch` + `DOMParser`), **nicht** als reines Node-Script.
- **`icon.*` / `manifest.webmanifest`** — App-Icon (Home-Screen) + PWA-Manifest.
- **`rueckschau-herbstrunde.html`** — eigenständige Altseite, bleibt bestehen.

## Zentrale Funktionen in index.html

- `parse()` — baut das `S`-Objekt (`S.leagues`, `S.cups`, `S.sks`, `S.games`,
  `S.teams`, `S.logos`, `S.pl/pos/lu`).
- `leagueGames(comp, scope)` — Spiele eines Wettbewerbs; `comp` kann eine Liga,
  `"cup"`, `"all"`, `"liga"` oder ein Stärkeklasse-Key (`sk1`/`sk2`) sein.
- `statsBlock(o)` — Statistik-Ansicht; Wettbewerbs-Auswahl ist Mehrfachauswahl
  (`STATS.comp` ist ein Array; `"all"` ist exklusiv).
- Elo-Modell (`computeRatings`, `HOME_ADV`) + Monte-Carlo (`cupOdds`, `leagueOdds`,
  `verlaufData`) für die Chancen-Prognosen.

## Konventionen

- Reihenfolge immer **Liga vor Cup**. Farbschema 60-30-10 (Navy/Grau/Akzent),
  keine per-Liga-Farben.
- Ein- und Auswechslungen werden für **alle** Statistiken ignoriert.
- Nur **Lesezugriff** aufs Matchcenter. Keine CAPTCHA-/Cloudflare-Umgehung.

## Entwickeln & Deployen

1. `index.html` bearbeiten. Zum Testen lokal einen Server starten, damit `fetch`
   funktioniert (nicht per `file://` öffnen), z. B. `python -m http.server`
   und `http://localhost:8000` öffnen.
2. Commit + Push nach GitHub (`Jiggler67/aaregou`).
3. **Render** baut automatisch neu und deployed die Seite.

Daten aktualisieren (Scraping) passiert separat über `updater/scrape.js` in der
Browser-Konsole des Matchcenters; danach `data.txt`/`logos.txt` ersetzen und
committen.
