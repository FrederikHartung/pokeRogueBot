#Changelog

Work in Progress:

## 1.2
- added log persistence to file system
- fixed a IndexOutOfBoundsException when an error occurres before a run is started
- added more phases
- if save and quit didn't work the page is reloaded

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