# Claude-Session als Benchmark-Policy

Vierte Vergleichs-Policy im Combat-Benchmark neben `random`, `always_move_0` und `dqn`: Ein Claude-Modell (z. B. Haiku) spielt die Benchmark-Kaempfe wie ein Spieler. Jeder Kampf bekommt eine eigene, durchgehende Claude-Code-Session; das Modell sieht pro Zug, was ein Spieler auf dem Bildschirm sieht, und behaelt den Verlauf des Kampfes.

Der Lauf wird **einmal** lokal erzeugt und danach als gespeicherte Baseline in jeden Benchmark eingelesen (`--extra-baseline`), ohne die Kaempfe erneut zu spielen.

## Funktionsweise

- **Worker:** `scripts/03-benchmark/eval/claude-session-policy-worker.ts`, ein persistenter `external_command`-Worker des Combat-Collectors (gleiches Zeilenprotokoll wie der DQN-Worker).
  - Pro `episode_id` startet er `claude -p` im `stream-json`-Modus; jeder Zug ist eine Nachricht in dieser Session, die Antwort ist strukturiert (`{action, reason}` per `--json-schema`).
  - Bei einem neuen Kampf wird die alte Session beendet.
  - Prueft die Aktion gegen die Aktionsmaske; bei einer illegalen Aktion einmal Korrektur, danach Fehler. Fehler und Zeitueberschreitungen (90 s pro Zug) landen ueber die Fehlererfassung als technische Termination, nicht still als Ersatzaktion.
  - Abgeschottet: `--tools ""`, `--strict-mcp-config` mit leerer MCP-Konfiguration (sonst laedt Claude Code die claude.ai-Connectors des Accounts, z. B. Gmail), `--setting-sources ""`, leeres Arbeitsverzeichnis (keine Projektanweisungen), keine Session-Persistenz.
  - Schreibt pro Kampf ein Transkript (Prompt, Antwort mit Begruendung, Dauer, Tokens).
- **Kampfkontext:** Der Collector schickt bei `policy.include_battle_context: true` zusaetzlich `battle_context` (`buildBattleContext` im Helper-Template). Er enthaelt das eigene Team komplett (Spezies, Level, HP, Status, Typen, Faehigkeit, Werteveraenderungen, Attacken mit Typ, Kategorie, Staerke, Genauigkeit, AP), vom Gegner nur Spezies, Level, HP in Prozent, Typen, Status, Werteveraenderungen und Boss-Status, dazu Wetter, Terrain, bei Trainern die Zahl verbleibender Gegner und die Kampfmeldungen seit dem letzten Zug. Gegnerische Attacken und Teams sind unbekannt, bis sie in den Meldungen auftauchen. Die gespeicherten Transitions (`state`) bleiben unveraendert.
  - Meldungen werden erst ab dem fertig aufgebauten Szenario gesammelt (die Intro-Meldung nennt sonst den vom Spiel gewuerfelten statt des Szenario-Gegners); unuebersetzte i18n-Schluessel werden gefiltert.
  - Alternative `--context-mode state`: das Modell bekommt nur den Feature-Zustand des DQN (fairer, aber abstrakter Vergleich).
- **Erzeugung:** `scripts/03-benchmark/eval/run-claude-session-baseline.ts` verteilt die Szenarien des Benchmark-Collector-Configs auf parallele Collectors und fuehrt die Ergebnisse zusammen.

## Voraussetzungen

- Lokaler Claude-Code-Login (`claude`, dann `/login`). Kein API-Key; die Aufrufe zaehlen gegen das Kontingent des Claude-Plans. `total_cost_usd` in Transkript und Meta-Datei ist ein rechnerischer Wert (pro Session kumulativ).
- Start aus einem normalen Terminal: Claude Code verweigert `claude` innerhalb einer Claude-Code-Session (`CLAUDECODE`). Ein Agent startet den Lauf deshalb ueber das Terminal-Panel bzw. bittet den User darum, statt die Sperre zu umgehen.
- Lokal lauffaehiger Collector (Submodul-Dependencies installiert).

## Ablauf

```bash
# Smoke (26 Kaempfe, gleichmaessig ueber die Waves verteilt)
node scripts/03-benchmark/eval/run-claude-session-baseline.ts --model haiku --label claude-haiku-smoke --limit 26 --parallelism 3

# Voller Lauf (alle Szenarien des v3-Full-Benchmarks)
node scripts/03-benchmark/eval/run-claude-session-baseline.ts --model haiku --label claude-haiku-v3-full --parallelism 4
```

Ergebnis unter `data/rl/benchmark-baselines/`:

- `<label>.jsonl`: Transitions wie bei den anderen Policies (nicht versioniert)
- `<label>.meta.json`: Modell, Kontextmodus, Prompt-Version, Commits, Kaempfe, technische Fehler, Entscheidungen, Laufzeit, rechnerische Kosten (versioniert)
- `<label>/`: Teil-Laeufe, Logs und Transkripte mit Begruendung pro Zug (nicht versioniert)

Einlesen im Benchmark:

```bash
python3 scripts/03-benchmark/eval/eval_policy_compare.py --collector-config ./data/rl/collector-run-benchmarked-wave-library-v3-full.json \
  --checkpoint <checkpoint> --reuse-baselines --extra-baseline claude-haiku=data/rl/benchmark-baselines/claude-haiku-v3-full.jsonl
```

Im Remote-Benchmark (`run-dqn-benchmark-compare-remote.sh`) per Config-Feld `"extra_baselines": [{"label": "claude-haiku", "path": "./data/rl/benchmark-baselines/claude-haiku-v3-full.jsonl"}]`; die JSONL vorher per `scp` auf den Server kopieren. Der Report enthaelt dann `dqn_vs_<label>` und die Meta-Daten der Baseline.

## Gueltigkeit der gespeicherten Baseline

Eine gespeicherte Baseline bleibt nur vergleichbar, solange Szenario-Set, Reward-Berechnung sowie Zustand- und Masken-Semantik gleich bleiben (Commits stehen in der Meta-Datei). Nach solchen Aenderungen neu erzeugen. Das gilt genauso fuer die gecachten `random`-/`always_move_0`-Baselines.

Die Szenarien haben keinen Seed; ein Lauf ist eine Stichprobe (wie bei `random`).

## Messwerte

Smoke-Lauf 2026-10-12 (`claude-haiku-smoke`, Haiku 5.5, Kontextmodus `battle`, 26 Kaempfe je eine Wave 1-24 plus zwei, `parallelism` 3):

| Kaempfe | technisch | Siege | Win Rate | Avg Reward | Avg Turns | Entscheidungen | Wechsel | Laufzeit | Ø pro Entscheidung | rechnerische Kosten |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 26 | 0 | 24 | 0.923 | 8.75 | 3.81 | 99 | 8 | 2 min 34 s | 2,3 s | 0,045 $ |

Nicht direkt mit dem Full-Benchmark vergleichbar (andere Stichprobe, 26 statt 311 Szenarien).

Voller Lauf 2026-10-12 (`claude-haiku-v3-full`, alle 311 Szenarien, `parallelism` 4):

| Kaempfe | technisch | Win Rate | Avg Reward | Avg Turns | Entscheidungen | Laufzeit | Ø pro Entscheidung | rechnerische Kosten |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 311 | 0 | 0.916 | 9.04 | 4.33 | 1348 | 16 min 15 s | 2,3 s | 0,59 $ |

Vergleich mit `random`, `always_move_0` und den DQN-Checkpoints: `docs/benchmark-history.md`, Run 19.

Beobachtungen aus den Transkripten: das Modell nutzt Typvorteile (Wechsel auf Squirtle gegen Feuer), reagiert auf Meldungen im Verlauf ("Attack fell" -> spezielle statt physischer Attacke) und kennt bekannte Gegnerattacken aus frueheren Zuegen.
