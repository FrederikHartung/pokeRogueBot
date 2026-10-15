# Modifier-Benchmark (Entwurf)

Status: **umgesetzt, erster Lauf `random_executable` gegen `heuristic_v1` gestartet** (2026-10-15). Misst, wie gut eine Modifier-Policy (Shop-Kaeufe und Gratis-Belohnungen in der `SelectModifierPhase`) ist, und vergleicht Policies fair miteinander. Grundlage: Strategic Collector mit `modifier-transition-v1` (`docs/modifier-state-v1-draft.md`), Remote-Pipeline `docs/modifier-strategic-seeded-remote.md`.

## 1. Fragen, die der Benchmark beantwortet

1. **Wie viel Spielraum haben Modifier-Entscheidungen?** `random` gegen eine einfache Regel (`heuristic_v1`). Ist die Regel klar besser, lohnt ein gelerntes Modell. Sind beide gleich, liegt der groessere Hebel woanders (Kampf-DQN, Fangen, Teamaufbau).
2. **Ist ein gelerntes Modell nuetzlich?** Erst wenn es `heuristic_v1` schlaegt, nicht schon, wenn es `random` schlaegt.
3. **Wo genau sind Policies besser oder schlechter?** Vor allem an den festen Rivalenkaempfen, an denen die meisten Runs scheitern.

## 2. Befunde aus dem ersten v1-Datensatz, die das Design praegen

Datensatz `modifier-strategic-seeded-remote-10seeds-20runs-wave30` (200 Runs, Policy `random_executable`, 2026-10-15):

- **Nur eine Welt:** Bis 2026-10-15 griff der Seed im Collector nicht; `generateStarters` im Testharness setzte ihn auf `"test"` zurueck (`docs/pokerogue-headless-test-harness-mechanics.md` 3.17). Alle 10 "Seeds" des Datensatzes sind dieselbe Welt, die 200 Runs unterscheiden sich nur durch den Entscheidungs-Zufall. Die Unterschiede zwischen den Seed-Mittelwerten (8,7 bis 11,8) sind damit Rauschen bei 20 Runs. Behoben mit `pinSceneSeed`; der erste Benchmark-Start wurde deshalb nach wenigen Runs abgebrochen und neu gestartet.
- **Deterministisch pro Seed:** PokeRogue setzt den Spiel-Zufall zu Beginn jeder Welle auf Seed + Wellennummer (`resetSeed(waveIndex)` in `pokerogue/src/battle-scene.ts`), und das Kampf-DQN entscheidet deterministisch. Alle Runs eines Seeds sehen dieselben Gegner; Unterschiede entstehen nur durch die Modifier-Entscheidungen. Eine deterministische Policy liefert auf demselben Seed daher immer dasselbe Ergebnis.
- **Klippen an festen Kaempfen:** `RIVAL_1` auf Welle 8 und `RIVAL_2` auf Welle 25 (`pokerogue/src/enums/fixed-boss-waves.ts`). In Seed s3 scheitern 11 von 20 Runs an Welle 8 oder 9; der beste Run aller Seeds endet auf Welle 25.
- **Streuung:** innerhalb eines Seeds etwa 4-5 Wellen Standardabweichung (s3: Welle 7 bis 23), Seed-Mittelwerte zwischen 8,7 und 11,8.
- **Wirkungslose Items:** Der Collector faengt nie; Poke Baelle (507 der gewaehlten Items) aendern nichts. Geld wirkt nur, wenn es ausgegeben wird.
- **Typischer Fehler von `random`:** mit Geld fuer weitere Traenke, aber verletztem Pokemon in den Rivalenkampf (2 der 3 schlechtesten Runs in s3).

## 3. Policies

| Policy | Art | Runs pro Seed | Status |
|---|---|---|---|
| `random_executable` | gleichverteilt ueber gueltige Optionen, dann ueber Ziele (heutiger Collector) | 2 | vorhanden |
| `heuristic_v1` | feste Regel, Abschnitt 4 | 1 | neu |
| `model_<name>` | gelerntes Modell ueber Python-Worker (Migrationsschritt 7) | 1 | spaeter |

Alle Policies sehen dieselbe Kandidatenliste mit denselben Masken (Builder plus Collector-Sperren). Reroll und Lock bleiben fuer den Vergleich `random` gegen `heuristic_v1` gesperrt (`POKEROGUE_MODIFIER_MAX_REROLLS=0`), damit beide denselben Aktionsraum haben; Reroll kommt in einer spaeteren Runde dazu.

## 4. `heuristic_v1`

Deterministisch, nur aus `state` und `candidates` der Observation; bei Gleichstand gewinnt der kleinere Kandidaten-Index.

**Shop-Stufe** (wiederholt, bis `finish_shop` oder Kaufgrenze):

1. Besiegtes Pokemon und gueltiger Beleber-Kandidat: guenstigsten Beleber fuer den besiegten Slot mit kleinstem Index kaufen.
2. Verletztes, nicht besiegtes Pokemon und gueltiger Heil-Kandidat: Slot mit dem niedrigsten `hp_ratio` waehlen; dort das guenstigste Item, dessen `effect.hp_restore_ratio` die fehlenden HP voll deckt, sonst das mit der groessten Heilung.
3. Statusproblem und gueltiges `FULL_HEAL`: kaufen.
4. Sonst `finish_shop`.

Kein Geld-Polster: Heilen vor dem naechsten Kampf geht vor Sparen. Die Kaufgrenze (`max_shop_purchases_per_phase`, Standard 3 pro Welle) gilt wie fuer `random`.

**Gratis-Wahl:**

1. Besiegtes Pokemon und gueltiger Beleber: nehmen.
2. Pokemon unter 50 % HP und gueltige Heilung: nehmen (Slot mit dem niedrigsten `hp_ratio`).
3. Sonst das erste gueltige Item nach Prioritaet:
   1. Dauerhafte Staerkung des Teams: `EXP_SHARE`, `SUPER_EXP_CHARM`, `EXP_CHARM`, `CANDY_JAR`, `RARER_CANDY`, `RARE_CANDY`
   2. Getragene Kampf-Items: `LEFTOVERS`, `SHELL_BELL`, `FOCUS_BAND`, `QUICK_CLAW`, `KINGS_ROCK`, `SCOPE_LENS`, `WIDE_LENS`, `MULTI_LENS`, `GRIP_CLAW`, `BASE_STAT_BOOSTER`, `ATTACK_TYPE_BOOSTER`, `GOLDEN_PUNCH`, `MYSTICAL_ROCK`, `REVIVER_SEED`, `BERRY`
   3. Temporaere Kampfhilfen: `TEMP_STAT_STAGE_BOOSTER`, `DIRE_HIT`
   4. PP: `ELIXIR`, `MAX_ELIXIR`, `ETHER`, `MAX_ETHER`, `PP_UP`, `PP_MAX` (nur gueltig, wenn PP fehlen bzw. erhoeht werden koennen)
   5. Geld: `AMULET_COIN`, `RELIC_GOLD`, `BIG_NUGGET`, `NUGGET`
   6. Sonstiges nach hoechstem Tier
   7. Zuletzt wirkungslos im Collector: Lockmittel (`LURE`, `SUPER_LURE`, `MAX_LURE`) und Baelle
4. `skip` nur, wenn kein Kandidat gueltig ist (ergibt sich aus der Skip-Maske).

Ziel bei Party-Items: das nicht besiegte Pokemon mit dem hoechsten Level, unter den gueltigen Zielen (wie `FreeModifierFallback` im Live-Bot fuer Sonderbonbons). Bei Attacken-Zielen die Attacke mit dem niedrigsten PP-Anteil.

Offene Punkte, bewusst einfach gehalten:
- Lockmittel: Im ersten Datensatz hatten Runs mit `LURE` auf Welle 1-7 einen leicht hoeheren Score (+0,22 bei 43 Runs). Kein belastbarer Effekt; die Regel nimmt sie zuletzt. Der Benchmark kann das mit einer Variante pruefen.
- Die Prioritaet weicht vom Live-Fallback ab (dort Baelle vor Geld, weil der Live-Bot faengt).

## 5. Seeds und Rahmenbedingungen

- **Eigene Test-Seeds:** Praefix `modifier-strategic-eval-s`, Indizes 1-100. Trainingsdaten nutzen `modifier-strategic-remote-train-s`; Eval-Seeds duerfen nie ins Training (Benchmark-Configs mit `postprocess.enabled: false`).
- **Gepaart:** Alle Policies laufen auf denselben 100 Seeds.
- **Viele Seeds statt Wiederholungen:** Deterministische Policies 1 Run pro Seed. `random` 2 Runs pro Seed; der Seed-Mittelwert senkt das Rauschen im gepaarten Vergleich.
- **Fest fuer alle Policies:** Kampf-DQN-Checkpoint, Starter (`starter_config_id`), Kaufgrenze 3, Reroll aus.
- **`max_waves: 50`:** deckt `RIVAL_2` (Welle 25) und `EVIL_GRUNT_1` (Welle 35) ab; bessere Policies sollen nicht an der Obergrenze haengen bleiben. Erreicht eine Policy oft 50, wird die Grenze erhoeht.
- **Determinismus-Probe:** 5 Seeds der deterministischen Policy zweimal laufen lassen; die Ergebnisse muessen identisch sein.

## 6. Messgroessen

Pro Policy:
- **Erreichte Welle:** Mittelwert, Median, Verteilung.
- **Ueberlebensquote an festen Kaempfen:** Anteil der Runs, die `TOWN_YOUNGSTER` (5), `RIVAL_1` (8), `RIVAL_2` (25) und `EVIL_GRUNT_1` (35) ueberstehen.
- **HP beim Start fester Kaempfe:** Summe der HP-Anteile der Party beim Kampfbeginn. Dafuer schreibt der Collector pro Episode `fixed_battle_entries: [{ wave_index, party_hp_ratio_sum, alive_count }]` (neues optionales Feld im Output, Contract und Schema im selben Schritt).
- **Geld am Ende** und Anteil wirkungsloser Picks (Baelle, Lockmittel), um Verschwendung sichtbar zu machen.

Gepaarter Vergleich A gegen B:
- Differenz der erreichten Welle pro Seed (bei `random` der Mittelwert der 2 Runs), Mittelwert mit 95-%-Konfidenzintervall per Bootstrap ueber Seeds (10.000 Ziehungen).
- Siege / Gleichstaende / Niederlagen pro Seed.
- Ueberlebensquoten der festen Kaempfe nebeneinander.

Entscheidungsregel: B ist "klar besser", wenn die untere Grenze des Konfidenzintervalls ueber 0 liegt. Bei einer Streuung der Seed-Differenzen um 4-5 Wellen ergibt sich mit 100 Seeds ein Standardfehler von etwa 0,5; Unterschiede ab etwa einer Welle werden sichtbar. Reicht das nicht, mehr Seeds statt mehr Runs pro Seed.

## 7. Ablauf und Artefakte

1. Configs `data/rl/modifier-benchmark-eval-100seeds-<policy>.json` (Seeds, `runs_per_seed`, `modifier_policy`, `max_waves: 50`, `postprocess.enabled: false`, eigener `output_root`).
2. Lauf ueber den bestehenden Remote-Helper (`run-modifier-strategic-seeded-remote.sh start <config>`), vorher `start-smoke`.
3. Auswertung `scripts/03-benchmark/eval/compare-modifier-policies.ts <runtime-A> <runtime-B>`: liest die Roh-Outputs (`collect_dataset/batches/*.json`), schreibt `modifier-benchmark-compare.json` und eine Markdown-Tabelle.
4. Eintrag in `docs/benchmark-history.md` mit `Benchmark-Typ: modifier`, Commit, Configs, Kampf-Checkpoint und Ergebnis.

Aufwand: Bei etwa 0,75 Runs pro Minute (Parallelitaet 2, erster Datensatz) braucht `random` mit 200 Runs rund 4,5 h und `heuristic_v1` mit 100 Runs rund 2,5 h, eher mehr, wenn die Runs weiter kommen.

## 8. Umsetzung und Befehle

| Teil | Datei |
|---|---|
| Regel `heuristic_v1` (reine Funktion ueber die Observation) | `src/main/ts/lib/modifier-heuristic-policy.ts`, Tests `npm run rl:test:modifier:heuristic` |
| Policy-Auswahl im Collector | `scripts/90-dev/rl/templates/modifier-fixed-seed-collector.test.template.ts` (`selectModifierCandidateIndex`) |
| HP zu Beginn fester Kaempfe | Episode-Feld `fixed_battle_entries` (optional in Contract und `docs/rl-schema/modifier-strategic-fixed-seed-output.schema.json`) |
| Kauf- und Reroll-Grenze per Config | `collect.max_shop_purchases_per_phase`, `collect.max_rerolls_per_wave` (Pipeline setzt die Env des Runners) |
| Configs | `data/rl/modifier-benchmark-eval-100seeds-random.json`, `data/rl/modifier-benchmark-eval-100seeds-heuristic-v1.json` (Parallelitaet 3) |
| Auswertung | `scripts/03-benchmark/eval/compare-modifier-policies.ts`, Tests `npm run rl:test:modifier:benchmark-compare` |
| Kette auf dem Server | `scripts/03-benchmark/eval/run-modifier-benchmark-remote.sh` |

Auf dem Server (Repo-Clone, nach `start-smoke`):

```bash
bash scripts/03-benchmark/eval/run-modifier-benchmark-remote.sh start
bash scripts/03-benchmark/eval/run-modifier-benchmark-remote.sh status
```

Die Kette startet die Configs nacheinander ueber `run-modifier-strategic-seeded-remote.sh start <config>` (mit dessen Preflight-Tests und Telegram-Meldungen je Lauf), wartet jeweils auf das Ende, ueberspringt bereits abgeschlossene Configs und schickt zum Schluss den Vergleich (`modifier-benchmark-telegram.txt`) per Telegram (`send-pipeline-notification.mjs --text-file`). Ergebnis-Dateien: `data/rl/pipeline-runs/modifier-benchmark-control/compare/`. Bei einem Fehler meldet sie den Abbruch per Telegram.

Lokal gegen fertige Laufordner:

```bash
node scripts/03-benchmark/eval/compare-modifier-policies.ts --policy random_executable=<runtime-dir> --policy heuristic_v1=<runtime-dir> --baseline random_executable --out data/temp/rl/modifier-benchmark
```

Messdetail: `wave_reached` zaehlt abgeschlossene Wellen. Einen festen Kampf auf Welle W hat ein Run erreicht, wenn `wave_reached >= W - 1`, und ueberstanden, wenn `wave_reached >= W`.

## 9. Umsetzungsschritte (Stand)

1. Erledigt: `heuristic_v1` als Modifier-Policy im Collector-Template (`ModifierPolicy`-Typ erweitern), Auswahl als eigene Funktion ueber Observation und Kandidaten; gezielte Spieltests ueber `rl:test:modifier:collector-actions` (z. B. heilt vor dem Rivalen, kauft nicht ueber die Grenze).
2. Erledigt: `fixed_battle_entries` im Collector-Output plus Contract, Schema, Beispiel.
3. Erledigt: Benchmark-Configs und Auswertungsskript mit Unit-Tests (gepaarte Differenz, Bootstrap, Ueberlebensquoten).
4. Lokaler Mini-Lauf (5 Seeds je Policy), dann `start-smoke` und die beiden Remote-Laeufe.
5. Ergebnis dokumentieren und entscheiden: Modell trainieren, Daten verbessern (Mischung aus `heuristic_v1` und Zufall, mehr Seeds) oder Prioritaet verschieben.
