> **This repository is only for educational purpose and can't be used on the original pokeRogue website.
> The PokeRogue game is included as a git submodule (v1.11.6, last stable release) and must be hosted locally to use the bot.**

# PokeRogueBot
This is a bot for the pokeRogue browser game. The Bot reads the current state of the game with the help of JavaScript out of the browser and reacts to it.

The bot does not cheat or write any values with JavaScript. If the current state of the game is read with JavaScript, the bot processes the information in the Java/Kotlin Part of the application.

After getting to a Result, the bot calculates which buttons are to press and sends the Commands with the help of Selenium to the browser.

## Documentation

- Remote-Telegram-Benachrichtigungen fuer laengere Pipeline-Laeufe:
  - `docs/telegram-notifications.md`

### How to get started
1. Clone this repository with submodules: `git clone --recurse-submodules <repo-url>`. If you already cloned without submodules, run `git submodule update --init --recursive`.
2. Install a Java 21 SDK, Maven (Java Build Tool), Node.js (for building JS bridge files), Intellij Idea (Java IDE) and Chrome (Browser).
3. Run `npm install` in the project root to install the esbuild dependency (used to compile the TypeScript JS bridge files).
4. Start the local PokeRogue game from the `pokerogue/` submodule:
   - `cd pokerogue`
   - `npm install`
   - `npm run start:dev`
   - Vite should report `Local: http://localhost:8000/`
5. Optional: Add a custom Chrome Profile to the bot. Read the section "How to add a chrome profile to persist the settings chosen in the title menu" to get more information.
6. This Bot only works with the english version of the game. Make sure to set the language to english in the game settings before starting.
7. Start the Spring Boot application from the project root:
   - `mvn spring-boot:run`
   - default runtime mode now uses the live DQN combat policy from `application.yml`
   - optional explicit random baseline: `mvn spring-boot:run -Dspring-boot.run.arguments=--bot.combat-policy-mode=random_move`
   - optional explicit DQN smoke path: `mvn spring-boot:run -Dspring-boot.run.arguments=--bot.combat-policy-mode=dqn`
8. Alternatively, open this repository in Intellij Idea and run the Application class. The bot should start and connect to the browser at `http://localhost:8000/`.

Note: The JS bridge files (`src/main/js/*.js`) are generated from TypeScript sources in `src/main/ts/`. Maven automatically rebuilds them during compilation. The TypeScript files import game enums and use `import type` for game classes (Pokemon, BattleScene, Move, etc.) directly from the PokeRogue submodule, so they stay in sync with the game version. For full IDE type support (autocomplete, type checking), install the submodule's dependencies: `cd pokerogue && pnpm install`.
Current runtime defaults:
- `bot.combat-policy-mode: dqn`
- `bot.dqn.infer-script: scripts/dqn_policy_infer_worker.py`
- `bot.dqn.combat-checkpoint: data/rl/models/dqn-combat-wave-library-bootstrap-combined-960.pt`
- `bot.capture.enabled: false` so the bot currently prioritizes defeating wild and trainer Pokemon over capture attempts
Static guardrails for bridge drift are covered by tests:
- `UiModeDriftTest`
- `UiHandlerCoverageTest`
- `UiHandlerMappingDriftTest`
- `PokemonBridgeContractTest`
- `WaveBridgeContractTest`
- `UiHandlerBridgeContractTest`
- `BridgeContractCoverageGuardTest`

## Offline RL Data Generation

There are now two separate paths and both should stay available:

- Local quick POC path:
  - use the existing collector commands for short local experiments and small/fast datasets
  - examples:
    - `npm run rl:collect:wave-lib:regression`
    - `npm run rl:collect:wave-lib:train:broad-shallow`
    - `npm run rl:collect:wave-lib:train:deep`
- Remote long-run path:
  - use the iterative 5-iteration pipeline for remote smoke tests and longer data-generation jobs on a remote Linux server
  - entrypoint:
    - smoke test: `scripts/run-wave-library-bootstrap-remote.sh start-smoke`
    - larger overnight run: `scripts/run-wave-library-bootstrap-remote.sh start-overnight`
  - this path checks dependencies first and then starts the pipeline detached via `nohup`
  - the run continues even if the SSH session is closed
  - smoke config:
    - `data/rl/wave-library-iterative-pipeline-remote-smoke.json`
    - mini-smoke with exactly `1` scenario from each wave `1-8`, `1` episode per scenario, `2` collect workers and `1` benchmark worker
  - overnight config:
    - `data/rl/wave-library-iterative-pipeline-remote-10ep.json`
    - full `w1-8` iterative run with `60` episodes per scenario, `batch_size = 60`, `2` collect workers and `1` benchmark worker
  - after the run, use the `artifacts-summary.json` inside the selected runtime directory as the central index for downloading the final model and reports
  - helper commands:
    - `scripts/run-wave-library-bootstrap-remote.sh status`
    - `scripts/run-wave-library-bootstrap-remote.sh logs`
    - `scripts/run-wave-library-bootstrap-remote.sh issues`
    - `scripts/run-wave-library-bootstrap-remote.sh notify-test`
    - `scripts/run-wave-library-bootstrap-remote.sh telegram-control-start`
    - `scripts/run-wave-library-bootstrap-remote.sh telegram-control-status`
    - `scripts/run-wave-library-bootstrap-remote.sh telegram-control-stop`
    - `scripts/run-wave-library-bootstrap-remote.sh stop`
  - `status` also reports scenario count, episodes per scenario and total/completed episode counts
  - the iterative pipeline can resume from an existing runtime directory; already completed batches and steps stay reusable after a restart
  - deleting `data/rl/pipeline-runs/...` is only needed for a clean restart, not for every resume after a code fix
  - if Telegram env vars are available, the iterative pipeline sends notifications for completed benchmark iterations, failures and full completion
  - optional Telegram control bot:
    - accepts `/status`, `/benchmarks`, `/issues`, `/last`, `/help`
    - polls Telegram every `600` seconds by default
    - `/status` is formatted as a compact mobile summary instead of raw shell output
    - starts automatically with `start-smoke` or `start-overnight` when Telegram is configured
    - stops automatically again when the pipeline exits, whether successful or failed

Large dataset note:

- for larger local or remote JSONL datasets, the pipeline now avoids loading or joining whole files into one giant string during merge/report/sanity steps
- this specifically hardens:
  - iterative phase merging
  - dataset sanity checks
  - generic JSONL dataset merges
  - dataset reporting
- offline DQN training now also avoids loading the full JSONL dataset into RAM at once
- `train_dqn_offline.py` now uses a JSONL-backed PyTorch `Dataset` plus `DataLoader`, so samples are read and moved to the device batch by batch
- this reduces peak memory pressure substantially for larger cumulative iterative datasets
- the trainer now also logs a short `training_start ...` summary plus epoch progress regularly; default is every `2` epochs and can be overridden with `log_every_epochs`
- the iterative and bootstrap pipelines now prefer the repo virtualenv interpreter from `.venv/bin/python3` or `.venv/bin/python` for Python stages; `POKEROGUE_PYTHON_BIN` can override this explicitly
- practical implication:
  - prefer larger `batch_size` values for long collection runs when `episodes_per_instance` is high, so fewer long collector batches are created
  - the current remote overnight profile therefore uses `60/60` instead of many smaller sub-batches

The remote helper currently checks:

- `node`
- `npm`
- `python3`
- Python `torch`
- root `node_modules`
- `pokerogue/node_modules`
- `pokerogue/locales/en`

## Ubuntu Server Setup

For future remote runs on a fresh Ubuntu server, this is the recommended order.

1. Prepare SSH access on the server:
   - create or register a GitHub SSH key for the server user
   - verify access:
     - `ssh -T git@github.com`
2. Clone the private repo via SSH into a writable working directory:
   - `mkdir -p ~/repos`
   - `cd ~/repos`
   - `git clone --recurse-submodules -b develop git@github.com:FrederikHartung/pokeRogueBot.git`
   - `cd pokeRogueBot`
3. If the local machine has uncommitted `pokerogue/` submodule changes, transfer them separately:
   - local patch creation from inside the submodule:
     - `cd pokerogue`
     - `git diff -- src/battle-scene.ts src/overrides.ts > ../pokerogue-local-clean.patch`
   - copy the patch to the server
   - apply it on the server:
     - `cd ~/repos/pokeRogueBot/pokerogue`
     - `git apply --check ../pokerogue-local-clean.patch`
     - `git apply ../pokerogue-local-clean.patch`
     - `git status`
4. Copy the productive wave library runtime data to the server if the remote run should use the current locally collected snapshots:
   - create target directory on the server:
     - `mkdir -p ~/repos/pokeRogueBot/data/offline-wave-library`
   - example copy command from the local Mac:
     - `scp -i ~/.ssh/id_rsa_github_privat /Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/data/offline-wave-library/productive-wave-snapshots-v1.jsonl SFH-Frederik@152.53.176.72:~/repos/pokeRogueBot/data/offline-wave-library/`
   - optional fingerprint copy:
     - `scp -i ~/.ssh/id_rsa_github_privat /Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/data/offline-wave-library/productive-wave-fingerprints-v1.txt SFH-Frederik@152.53.176.72:~/repos/pokeRogueBot/data/offline-wave-library/`
5. Install base system dependencies:
   - `sudo apt update`
   - `sudo apt install -y nodejs npm python3-pip python3-venv`
6. Upgrade Node.js to a current supported version via `nvm` if the system Node is too old:
   - the remote collector path failed on Ubuntu system Node `18.19.1` with a Vitest/jsdom `ERR_REQUIRE_ESM`
   - recommended target: Node `24`
   - install `nvm` if needed:
     - `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash`
     - `source ~/.bashrc`
   - install and select Node `24`:
     - `nvm install 24`
     - `nvm use 24`
     - `nvm alias default 24`
   - verify:
     - `node -v`
     - `npm -v`
7. Create and use a Python virtual environment in the repo root:
   - `cd ~/repos/pokeRogueBot`
   - `python3 -m venv .venv`
   - `source .venv/bin/activate`
   - `python -m pip install --upgrade pip`
   - `python -m pip install torch numpy`
8. Reinstall Node dependencies after the Node upgrade:
   - in repo root:
     - `rm -rf node_modules`
     - `npm install`
   - in submodule:
     - `rm -rf pokerogue/node_modules`
     - `cd pokerogue`
     - `npm install`
     - `cd ..`
9. Sanity checks:
   - `node -v`
   - `npm -v`
   - `python -c "import torch, numpy; print(torch.__version__); print(numpy.__version__)"`
   - `git submodule status`
10. Materialize scenarios from the copied wave library:
   - `npm run rl:gen:scenarios:wave-lib`
11. Optional smoke-first workflow:
   - the prepared mini-smoke config uses exactly `8` scenarios:
     - one scenario from each wave `1-8`
   - reset stale smoke state if needed:
     - `rm -rf data/rl/pipeline-runs/wave-library-iterative-remote-smoke`
   - start smoke:
     - `bash scripts/run-wave-library-bootstrap-remote.sh start-smoke`
12. Start the longer iterative overnight run:
   - reset stale overnight state only if you want a completely fresh run:
     - `rm -rf data/rl/pipeline-runs/wave-library-iterative-remote-10ep`
   - start overnight:
     - `bash scripts/run-wave-library-bootstrap-remote.sh start-overnight`
   - after a code fix, a plain restart is usually enough because the pipeline resumes from the recorded manifest state
   - optional Telegram test before a long run:
     - `bash scripts/run-wave-library-bootstrap-remote.sh notify-test`
   - if Telegram is configured, the control bot is started automatically together with the run
13. Monitor or inspect the run:
   - `bash scripts/run-wave-library-bootstrap-remote.sh status`
   - `bash scripts/run-wave-library-bootstrap-remote.sh logs`
   - `bash scripts/run-wave-library-bootstrap-remote.sh issues`
   - use `tail -n 50 data/rl/pipeline-runs/wave-library-iterative-remote-smoke/remote-iterative.log` or `tail -n 50 data/rl/pipeline-runs/wave-library-iterative-remote-10ep/remote-iterative.log` for a short snapshot instead of continuous log streaming

After the run finishes, the central download index is:

- smoke:
  - `data/rl/pipeline-runs/wave-library-iterative-remote-smoke/artifacts-summary.json`
- overnight:
  - `data/rl/pipeline-runs/wave-library-iterative-remote-10ep/artifacts-summary.json`

Use that file to identify which reports and model artifacts to download via SFTP/SCP.

## Hows does the bot work
Current live-bot status:
- Combat and switch decisions default to the live DQN policy in single battles
- DQN inference uses a persistent local Python worker instead of starting a new process for every action
- Double battles still fall back to heuristic combat behavior
- Wild-Pokemon capture is currently disabled by default so the bot focuses on ending battles quickly
- Modifier/item decisions still use the separate Kotlin RL path (`ModifierRLNeuron`)

## How to add a chrome profile to persist the settings chosen in the title menu
It is possible to add a Chrome Profile to the bot. The advantage is, that you can open the browser with the profile and choose the settings in the title menu like game speed or show tutorials.  
I recommend it to give the bot a Chrome Profile.

### How to add a Chrome Profile:
Create a new "application-default.yml" file in the resources folder of the bot repository. This default file overrides the values in the application.yml file.  
You can add your own configurations in this file. The application-default file won't be pushed to the repository or won't be overriden on pulling changes.  
1. Open Chrome, click on the profile icon in the top right corner and click on "Add". Follow the steps to create a new Chrome Profile.
2. If the profile is created, make sure to switch to the new profile.
3. Type "chrome://version/" in the address bar and press enter. You find the Profile path there. The last part of the path is the name of the Chrome Profile. 

Add following text to the application-default.yml file. Replace the values with your values. This value are just an example:
browser:
  pathChromeUserDir: "/Users/yourUserName/Library/Application Support/Google/Chrome/" #profile path without the profile name!!!
  chromeProfile: "Profile 5" #profile name without the directory path!!!

On windows OS: Make sure to "escape" the slashes correctly like this: "C:\\Users\\yourUserName\\AppData\\Local\\Google\\Chrome\\User Data\\"
Use the proper indentation like in the "application.yml" file. If you don't add this property, the bot will start a new Chrome Profile.
After that, you can switch back to your normal Chrome Profile and start the bot. The bot should open the browser with the new profile you added.








   
