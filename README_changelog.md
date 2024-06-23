#Changelog

## 1.1
- removed connection to a database
- refactored SimpleBot and moved some of its logic to a WaveRunner class
- The bot can now run in a loop of for a configurable number of runs
- Loop detection if the bot is stuck in a loop
- added Unit tests for SimpleBot and WaveRunner
- If a run fails because of an exception, the bot tries to save and quit to title menu
- If the bot can't save and quit, it reloads the page
- Get the save games with JS

Work in Progress:


## 1.0
- added first implementation of the bot
- added choosing of starters in the app config
- added simple attack decision for single and double fights
- added catching of pokemons
- added selecting of free modifers and buying of modifers in the shop
- added loop for starting a new game if the last run failed because the player fainted
- added error screenshot persisting if an error occurs like a not detected phase
- added persisting of hatched eggs with a screenshot and the pokemon values to a .txt file