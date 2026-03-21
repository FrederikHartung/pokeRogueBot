# PokeRogue Submodule Versioning

## Ziel

Diese Notiz beschreibt den empfohlenen Umgang mit eigenen Aenderungen im `pokerogue/`-Submodul, wenn diese:

- versioniert sein sollen
- auf dem Remote-Server reproduzierbar verfuegbar sein sollen
- und auch fuer andere Nutzer des Bots nachvollziehbar bleiben sollen

## Kurzfassung

Ein `dirty` Submodul-Stand ist nicht reproduzierbar.

Der Hauptrepo-Commit speichert nur:

- die `.gitmodules`-URL
- den Submodul-Commit-Pointer

Nicht gespeichert werden dabei:

- uncommitted Aenderungen im `pokerogue/`-Ordner
- lokale Branch-Namen
- lokale Remote-Overrides

Wenn eine Submodul-Aenderung fuer Remote oder andere Nutzer relevant ist, muss sie daher ueber einen der folgenden Wege versioniert werden:

1. eigener Fork des Submoduls
2. versionierte Patch-Dateien im Hauptrepo

## Empfehlung

Empfohlene Reihenfolge fuer dieses Projekt:

1. moeglichst viel Harness, Pipeline und RL-Logik im Hauptrepo halten
2. Submodul-Aenderungen nur dann vornehmen, wenn sie technisch wirklich unvermeidbar sind
3. kleine oder kurzlebige Submodul-Aenderungen zunaechst als Patch-Dateien versionieren
4. laengerfristige oder fuer andere Nutzer relevante Submodul-Aenderungen ueber einen eigenen Fork abbilden

## Option A: Eigener Fork des Submoduls

Diese Variante ist die bevorzugte Loesung, wenn:

- die Aenderung laenger bestehen bleibt
- Remote-Server und andere Nutzer denselben Stand direkt auschecken koennen sollen
- und der Stand nicht nur lokal experimentell ist

### Empfohlenes Remote-Setup

Im Submodul:

```bash
cd pokerogue
git remote rename origin upstream
git remote add origin git@github.com:<DEIN-USER>/pokerogue.git
git fetch upstream
git fetch origin
```

### Empfohlene Branch-Strategie

- `upstream-main`
  - lokaler Mirror des Upstream-Default-Branches
  - keine eigenen inhaltlichen Commits
- `feature/<thema>`
  - eigentliche Bot-/Harness-Aenderungen
- optional Tags oder Release-Branches fuer stabile Staende

Beispiel:

```bash
cd pokerogue
git checkout -B upstream-main upstream/main
git checkout -b feature/bot-harness upstream-main
```

Hinweis:

- Falls das Upstream-Repo nicht `main`, sondern einen anderen Default-Branch verwendet, `upstream/main` entsprechend ersetzen.

### Typischer Update-Workflow

Upstream aktualisieren:

```bash
cd pokerogue
git fetch upstream
git checkout upstream-main
git reset --hard upstream/main
```

Eigene Aenderungen auf neuen Upstream-Stand ziehen:

```bash
cd pokerogue
git checkout feature/bot-harness
git rebase upstream-main
```

Alternativ konservativer:

```bash
cd pokerogue
git checkout feature/bot-harness
git merge upstream-main
```

### Praktischer Submodul-Update-Workflow fuer dieses Repo

Fuer dieses Projekt ist der relevante Stand nicht einfach irgendein lokaler Branch, sondern:

- der im Hauptrepo versionierte Submodul-Pointer
- plus die in `.gitmodules` hinterlegte Submodul-URL

Der normale Update-Fall im Hauptrepo ist daher:

```bash
cd /path/to/pokeRogueBot
git pull
git submodule sync --recursive
git submodule update --init --recursive
```

Danach sollte geprueft werden:

```bash
git -C pokerogue remote -v
git -C pokerogue rev-parse --short HEAD
git -C pokerogue status --short --branch
```

Wichtig:

- `git submodule sync --recursive` ist wichtig, wenn `.gitmodules` geaendert wurde, z. B. von Upstream auf den eigenen Fork.
- `git submodule update --init --recursive` pinnt das Submodul auf den im Hauptrepo erwarteten Commit.
- `## HEAD (no branch)` im Submodul ist nach `git submodule update` normal und kein Fehler.

### Bekannter Fallstrick: `lefthook` / `post-checkout` / `pnpm`

Im `pokerogue/`-Submodul kann `git submodule update --init --recursive` scheinbar haengen bei:

```text
waiting: update-packages
```

Ursache ist typischerweise nicht Git selbst, sondern der `post-checkout`-Hook des Submoduls:

- `lefthook`
- Hook `update-packages`
- ruft `pnpm i` auf

Typische Symptome:

- `git submodule update` wirkt minutenlang blockiert
- `corepack` fragt interaktiv nach dem Download von `pnpm`
- auf einem frischen Remote-Server ist `pnpm` noch nicht aktiviert

Empfohlene Loesung:

1. Wenn `git submodule update` bei `waiting: update-packages` sichtbar haengt, abbrechen.
2. Im Submodul `corepack` und die passende `pnpm`-Version aus `pokerogue/package.json` vorbereiten.
3. `pnpm install` einmal manuell ausfuehren.
4. Danach `git submodule update` ohne Hook erneut laufen lassen.

Hinweis:

- Fuer den aktuell verwendeten, auf `v1.11.6` basierten Bot-Stand ist dies derzeit `pnpm@10.24.0`.
- Trotzdem im Zweifel immer `pokerogue/package.json` als Source of Truth behandeln.

Konkreter Ablauf:

```bash
cd /path/to/pokeRogueBot/pokerogue
corepack enable
corepack prepare pnpm@<VERSION-AUS-package.json> --activate
hash -r
pnpm --version
pnpm install

cd /path/to/pokeRogueBot
LEFTHOOK=0 git submodule update --init --recursive
```

Danach erneut pruefen:

```bash
git -C pokerogue rev-parse --short HEAD
git -C pokerogue status --short --branch
git -C pokerogue submodule status --recursive
```

Falls `assets` oder `locales` vorher als modified auftauchten, werden sie durch den erneuten rekursiven Submodul-Checkout normalerweise auf den erwarteten Stand gezogen.

### Empfohlener Remote-Server-Ablauf

Wenn ein Remote-Server auf den versionierten Hauptrepo- und Submodul-Stand gebracht werden soll:

```bash
cd ~/repos/pokeRogueBot
git pull
git submodule sync --recursive

cd pokerogue
corepack enable
corepack prepare pnpm@<VERSION-AUS-package.json> --activate
hash -r
pnpm install
cd ..

LEFTHOOK=0 git submodule update --init --recursive

git -C pokerogue rev-parse --short HEAD
git -C pokerogue status --short --branch
```

Wenn der Server danach sauber ist, koennen erst danach Hauptrepo-Dependencies, Smoke-Runs oder Remote-Pipelines gestartet werden.

### Wie der Stand fuer Remote und andere Nutzer reproduzierbar wird

Es gibt zwei saubere Varianten:

#### Variante A1: `.gitmodules` zeigt auf den Fork

Diese Variante ist am einfachsten, wenn andere Nutzer beim normalen Clone automatisch deinen Fork verwenden sollen.

Im Hauptrepo:

```bash
git submodule set-url pokerogue git@github.com:<DEIN-USER>/pokerogue.git
git add .gitmodules pokerogue
git commit -m "Point pokerogue submodule to custom fork"
```

Voraussetzung:

- der ausgecheckte Submodul-Commit muss in deinem Fork vorhanden sein

#### Variante A2: `.gitmodules` bleibt upstream, Remote nutzt lokalen Override

Diese Variante ist gut fuer temporaere Tests auf deinem eigenen Remote-Server.

Auf dem Remote-Server:

```bash
cd /path/to/pokeRogueBot
git -C pokerogue remote set-url origin git@github.com:<DEIN-USER>/pokerogue.git
git -C pokerogue fetch origin
git -C pokerogue checkout <DEIN-COMMIT-ODER-BRANCH>
```

Wichtig:

- Diese Variante ist nicht automatisch fuer andere Nutzer reproduzierbar.
- Sie eignet sich vor allem fuer serverseitige Tests oder Zwischenstaende.

## Option B: Versionierte Patch-Dateien im Hauptrepo

Diese Variante ist sinnvoll, wenn:

- du keinen eigenen Fork pflegen willst
- die Aenderung klein und klar abgegrenzt ist
- oder du zunaechst schnell reproduzierbar bleiben willst

### Ablageort

Patch-Dateien liegen unter:

- `patches/pokerogue/`

Der Hauptrepo enthaelt dafuer einen Helper:

- `scripts/ops/apply-pokerogue-patches.sh`

### Patch erzeugen

Beispiel:

```bash
git -C pokerogue diff > patches/pokerogue/0001-bot-harness.patch
```

### Patch pruefen

```bash
bash scripts/ops/apply-pokerogue-patches.sh check
```

### Patch anwenden

```bash
bash scripts/ops/apply-pokerogue-patches.sh apply
```

Optional ueber `npm`:

```bash
npm run ops:pokerogue:check-patches
npm run ops:pokerogue:apply-patches
```

### Vorteile

- keine Schreibrechte auf Upstream noetig
- voll im Hauptrepo versionierbar
- gut fuer kleine, gezielte Anpassungen

### Nachteile

- bei Upstream-Aenderungen koennen Patches brechen
- fuer laengerfristige divergierende Aenderungen ist ein Fork meist angenehmer

## Entscheidungshilfe

Nutze bevorzugt:

- `Fork`, wenn die Aenderung laengerfristig, fuer Remote und andere Nutzer direkt reproduzierbar sein soll
- `Patches`, wenn die Aenderung klein, gezielt oder noch experimentell ist

## Praktische Projektregel

Fuer dieses Repo gilt:

- ein `dirty` `pokerogue/`-Stand reicht nicht fuer reproduzierbare Remote-Pipelines
- wenn Remote-Laeufe oder andere Nutzer genau denselben Stand brauchen, muss der Submodul-Stand versioniert werden
- bevorzugt ueber:
  - eigenen Fork fuer stabile laengerfristige Aenderungen
  - Patch-Dateien fuer kleinere oder temporaere Anpassungen
