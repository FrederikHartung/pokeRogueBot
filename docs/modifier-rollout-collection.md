# Rollout-Sammlung fuer Modifier-Entscheidungen

Umsetzung von Phase 1-3 aus `docs/modifier-rollout-plan.md`. Ziel: Pro Entscheidung von `heuristic_v1` messen, welche erreichte Welle jede Alternative ergeben haette.

## 1. Bausteine

| Teil | Datei | Aufgabe |
|---|---|---|
| Rollout-Logik (ohne Spiel) | `src/main/ts/lib/modifier-rollout.ts` | Labels, State-Hash, Auswahl der Alternativen, Jobs, Spec, Replay-Steuerung |
| Ziel einer Alternative | `pickHeuristicV1TargetIndex` in `src/main/ts/lib/modifier-heuristic-policy.ts` | Ziel nach heuristic_v1-Regeln fuer ein Item, das die Heuristik selbst nicht waehlt |
| Collector-Policy | `rollout_replay_v1` im Strategic-Collector-Template | Referenz nachspielen, bei `branch_step` die Alternative, danach heuristic_v1 |
| Orchestrierung | `scripts/01-data-generation/pipeline/run-modifier-rollout-collection.ts` | Referenz → Jobs → Rollouts → Datensatz, parallel und wiederaufnehmbar |
| Datensatz und Auswertung | `scripts/01-data-generation/pipeline/modifier-rollout-records.ts` | `modifier_rollout_record_v1`, Validierung, Pilot-Kennzahlen |

## 2. Ablauf eines Rollouts

1. Der Referenzlauf ist ein normaler `heuristic_v1`-Run. Labels und Hashes werden nachtraeglich aus seinem Output berechnet, der Referenzlauf braucht daher kein Zusatzfeld.
   - Label: `kind|item_id|variant|reward_index|shop_row|shop_column|target_party|target_move`, Varianten-Schluessel sortiert.
   - Hash: cyrb53 ueber `JSON.stringify([decision_stage, state, candidates])`. Er ist fuer die Live-Observation und ihre JSON-Kopie im Output gleich.
2. Die Spec-Datei (`modifier_rollout_spec_v1`) enthaelt die Referenzschritte `0..branch_step` (Index, Label und Hash) sowie die Alternative.
   - Der Runner bekommt sie ueber die Env `POKEROGUE_MODIFIER_ROLLOUT_SPEC`.
   - Die Policy ist `rollout_replay_v1`.
3. Fuer die Schritte `<= branch_step` prueft der Collector, ob der State-Hash stimmt und ob am gespeicherten Index derselbe Kandidat mit Maske 1 liegt.
   - Weicht etwas ab, endet der Run als technischer Fehler `replay_divergence:state_hash:...` bzw. `replay_divergence:label:...`.
   - Endet ein Rollout vor der Verzweigung, gilt das ebenfalls als Abweichung: `replay_divergence:ended_before_branch`.
4. Bei `branch_step` waehlt der Collector die Alternative, danach `heuristic_v1` bis zum Run-Ende.
5. Der Output ist der normale Strategic-Output. Die Episode bekommt zusaetzlich das Feld `rollout` mit `reference_id`, `branch_step`, `alternative_label`, `alternative_candidate_index` und `replay_verified_steps`. Der Contract (`scripts/90-dev/rl/modifier-strategic-fixed-seed-contract.ts`) verlangt das Feld bei `rollout_replay_v1`.

**Alternativen** (`listRolloutAlternatives`, hoechstens `max_alternatives`, Default 5):

- Gratis-Belohnung: jedes andere gueltige Item einmal, mit dem Ziel nach Heuristik-Regel.
- Shop: nur die erste Shop-Entscheidung einer Welle. Kauft die Referenz dort etwas, ist `finish_shop` die Alternative. Beendet die Referenz den Shop, gibt es keine Alternative.
- Noch nicht umgesetzt (Plan, Phase 1):
  - zweites Ziel fuer Schluessel-Items (z. B. Sonderbonbon kurz vor der Entwicklung), braucht die State-Erweiterung aus Phase 0
  - "zweitbester Kauf" im Shop
  - Zusammenfassen gleichwertiger Kandidaten

## 3. Orchestrierung

```bash
node scripts/01-data-generation/pipeline/run-modifier-rollout-collection.ts data/rl/modifier-rollout-pilot-5seeds.json
```

- `--stage reference` laesst nur die Referenzlaeufe laufen, `--stage jobs` erzeugt zusaetzlich die Jobs (nuetzlich fuer eine Kostenabschaetzung).
- Wiederaufnehmbar: Vorhandene regulaere Outputs (Referenz und Rollouts) werden uebersprungen, fehlgeschlagene werden neu gestartet.
- Jeder Run ist ein Aufruf des Strategic-Collector-Runners.
  - Laeuft ein Run technisch fehl, wird er einmal wiederholt, nach `replay_divergence` bis zu zweimal (die Abweichung ist nicht reproduzierbar, siehe Abschnitt 7).
  - Logs bleiben nur bei Fehlern erhalten (`<seed>/logs/`).
- Notausschalter, gezaehlt wird das Endergebnis je Job nach den Wiederholungen, jeweils nach mindestens 20 Jobs: Anteil `replay_divergence` ueber `max_replay_divergence_share` (Default 25 %) oder Anteil sonstiger technischer Fehler ueber `max_technical_failure_share` (Default 10 %). Laufende Runs werden dann beendet. Beim Fortsetzen laufen frueher gescheiterte Jobs zuletzt. `rollout-summary.json` enthaelt `job_results` und `retry_attempts`.
- Ein Seed und alle seine Rollouts muessen auf demselben Rechner laufen.

**Config-Felder:**

| Feld | Bedeutung |
|---|---|
| `seeds` | Liste der Seeds; alternativ `seed_prefix`, `seed_start_index` und `seed_count` |
| `output_root` | Ausgabeordner, ignoriert unter `data/rl/modifier-rollouts/` |
| `max_waves`, `parallelism` | Pflicht |
| `max_alternatives` | Default 5 |
| `max_branch_wave` | nur Entscheidungen bis zu dieser Welle verzweigen |
| `max_jobs_per_seed` | nur fuer Tests |
| `max_shop_purchases_per_phase`, `max_rerolls_per_wave` | Default 3 bzw. 0, wie Runs 22-24 |
| `step_timeout_ms`, `run_process_timeout_ms` | Default 15000 bzw. 2400000 |
| `combat_dqn_checkpoint`, `combat_dqn_device`, `combat_dqn_python` | Combat-Policy, Defaults wie im Runner |
| `max_replay_divergence_share`, `max_technical_failure_share` | Notausschalter |

**Ausgabe** unter `output_root`:

```
config.json
<seed>/reference.json          heuristic_v1-Run
<seed>/jobs.json               Jobs (branch_step, Welle, Stufe, Alternative)
<seed>/specs/<job>.json        Rollout-Specs
<seed>/rollouts/<job>.json     Rollout-Outputs
<seed>/logs/<run>.log          nur bei Fehlern
rollout-records.jsonl          modifier_rollout_record_v1, ein Record pro Entscheidung
rollout-summary.json / .md     Pilot-Kennzahlen und Fehlerliste
```

## 4. Datensatz `modifier_rollout_record_v1`

Ein Record pro Entscheidung der Referenz, fuer die mindestens ein Rollout regulaer endete:

- `seed`, `reference_id`, `step_index`, `wave_index`, `decision_stage`
- `observation`: modifier-v1-Observation (`schema_version`, `decision_stage`, `state`, `candidates`) aus dem Referenzlauf
- `reference_candidate_index`, `reference_label`, `reference_wave_reached`, `reference_final_party_level_sum`
- `alternatives[]`: `job_id`, `candidate_index`, `label`, `wave_reached`, `final_party_level_sum`, `advantage_waves` (= Welle der Alternative minus Welle der Referenz), `termination_reason`
- `failed_job_ids[]`: Alternativen ohne regulaeres Ergebnis, nicht fuer das Training

`final_party_level_sum` ist die Summe der Party-Level bei der letzten Modifier-Entscheidung des Runs. Sie loest Gleichstaende in der Welle auf, die Welle bleibt das Hauptkriterium. Validierung: `validateRolloutRecord`, sie prueft unter anderem Labels gegen die Kandidaten, doppelte Alternativen und `advantage_waves`.

## 5. Auswertung (Pilot, Plan Phase 3)

`rollout-summary.md` enthaelt:

- Anteil der Entscheidungen mit besserer Alternative, nur schlechteren oder nur gleichen Alternativen, sowie den mittleren Gewinn der besten Alternative
- beste einzelne Abweichung pro Seed im Mittel: untere Schranke dessen, was eine Policy mit Rollout-Wissen auf diesen Seeds erreicht
- Vorteil je Item-Familie der Alternative und je Wellen-Bereich

## 6. Tests

- `npm run rl:test:modifier:rollout`: Unit-Tests fuer Labels, Hash (JSON-Roundtrip), Alternativen, Jobs, Replay-Steuerung, Records und Auswertung.
- `npm run rl:test:modifier:rollout-replay`: Spieltest, rund 1,5 min. Er umfasst:
  - einen Referenzlauf ueber 2 Wellen
  - einen Rollout, der beim letzten Schritt die Referenzwahl nimmt: Hashes und Wahlen muessen identisch sein
  - einen Rollout mit echter Alternative
  - eine manipulierte Spec, die mit `replay_divergence` abbrechen muss

## 7. Bekannte Grenzen

- **Nicht vollstaendig deterministisch (Pilot 2026-10-16).** Auf `modifier-rollout-train-s4` wurde Welle 35, ein fester Kampf gegen ein Team-Grunt mit Slugma und Torkoal, in 4 von rund 20 Rollouts zum Doppelkampf. In der Referenz war es ein Einzelkampf.
  - Die Rollouts hatten die Schritte 0-41 mit identischem Hash nachgespielt. Der Hash bei Schritt 42 wich trotzdem ab, und zwar viermal gleich.
  - Die Ursache ist nicht geklaert. Vermutung: Der Harness-Code in `pokerogue/test/porubot/harness/battle-command-advance.ts` faehrt zeitabhaengig Recovery-Pfade (z. B. nach 250 ms festhaengender TurnInitPhase). Er koennte unter Last Zufallszahlen in anderer Menge verbrauchen, ohne dass sich der beobachtete State aendert.
  - Folgen:
    - Die Hash-Pruefung faengt solche Faelle vor der Verzweigung ab.
    - Nach der Verzweigung kann derselbe Zufall das Ergebnis eines Rollouts zusaetzlich verrauschen.
  - Messung (je 4 Wiederholungen der 5 Pilot-Referenzen, 10 parallel): s1, s2, s3 und s5 waren 16 von 16-mal identisch, jeder Hash gleich. s4 wich 3 von 4-mal an genau dieser Stelle ab und erreichte Welle 50 statt 48.
  - Die Abweichung ist also selten und ortsfest, an dieser Stelle aber haeufig. Auf s4 sind Rollouts mit Verzweigung vor Schritt 42 fuer die Welle verrauscht (Auswertung: `docs/modifier-learning-findings.md`, Abschnitt 7).
  - Moegliche Abhilfe: nach der Verzweigung je Rollout mehrere Wiederholungen, oder Seeds mit solchen Stellen markieren bzw. ausschliessen.
- **Reproduzierbare Harness-Timeouts.** Manche Pfade enden auch bei Wiederholung mit `step_timeout` (z. B. `advance_double_combat_after_action`, `combat_turn_limit:200`). Diese Jobs fehlen im Datensatz und stehen in `failed_job_ids`.
