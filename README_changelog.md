#Changelog

Work in Progress:

## 2.1 WIP
- added handling for different pokemon forms with different poketypes (now really working (hopefully...))
- added stop run, screenshot and logging for shiny, mystical, legendary and sub legendary pokemon
- fixed bug in target selection in double fight
- when a JavascriptException, NoSuchWindowException or UnreachableBrowserException occurs, the bot quits the app and doesn't log the error stacktrace
- fixed a bug, that the logback config was overridden with the test config
- added handling for the case that the wild enemy pokemon and the player pokemon faints on the same time
- deactivated picking lure modifier, because double fights are king of buggy and for the bot and not well implemented
- added picking of pokeball items in the shop in available and no other free item is interesting

## 2.0
- deactivated buying of pp restore items if a move ran out of pp because it's not currently working
- added missing phases and game modes
- fixed a bug in the attack decision-making that the bot tries to attack an already fainted pokemon

## 1.3
- fixed bug, that a status heal item is tried to be used as a revive item
- fixed a bug in the loop detection, when to many eggs are hatched in a row
- added more phases and reduced the default wait time between phases from 2000ms to 500ms
- fixed a bug in the loop detection, when a fight takes to long
- added switching to a pokemon with better type matching at the beginn of a wild pokemon fight
- changed egg id from int to long
- deactivated capturing pokemons with over 90% health left
- fixed the bug, that an attack without pp is tried to be executed
- added unit tests for DamageCalculatingNeuron
- made all Neurons non static and to components
- added logback config for unit tests
- added buying of pp restore items if a move ran out of pp
- added handling for different pokemon forms with different poketypes

## 1.2
- added log persistence to file system
- fixed a IndexOutOfBoundsException when an error occurred before a run is started
- added more phases
- if save and quit didn't work the page is reloaded
- added CapturePokemonNeuron
- made all Neurons static
- add handle if an enemy move forces the player to switch pokemon
- if a switch decision is made, the bots chooses the best available pokemon

## 1.1
- removed connection to a database
- refactored SimpleBot and moved some of its logic to a WaveRunner class
- The bot can now run in a loop of for a configurable number of runs
- Loop detection if the bot is stuck in a loop
- added Unit tests for SimpleBot and WaveRunner
- Get the save games with JS
- If save games are available, the bot tries to load the first save game
- If no save games are available, the bot starts a new game
- If an exception is thrown, the bot saves and goes back to the title screen to load/start a new game
- Save games where an error occurred are retried when the bot is started the next time

## 1.0
- added first implementation of the bot
- added choosing of starters in the app config
- added simple attack decision for single and double fights
- added catching of pokemons
- added selecting of free modifers and buying of modifers in the shop
- added loop for starting a new game if the last run failed because the player fainted
- added error screenshot persisting if an error occurs like a not detected phase
- added persisting of hatched eggs with a screenshot and the pokemon values to a .txt file