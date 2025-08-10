# developer documentation

## Development Strategy
Focus on progress and not on perfection. It's better to stick to a bad implementation and improve it later than to try to make it perfect from the beginning.  
If a good idea comes up, write it down and implement it later. Focus on the current task. Order the tasks by their level of improvement and how easy they are to implement.  
Only refactor, when it's really necessary.

## Current Task:
Add Support for UI Validation of a Phase.
Some Phases have a UI, which needs an UI Handler to set a Cursor. The uiValidatedPhases should be persisted to the FileSystem in Json format and on App start loaded in to the LongTermMemory.  
Also the LongTermMemory should remember, if a new Phase was validated and if so, the result should also be persisted to the FileSystem on App Termination.  
Todos:
- [x] Add UiValidatedPhases to LongTermMemory
- [x] Added loading of UiValidatedPhases on Appstart from Json File
- [x] Added FeatureFlag to toggle remembering of Items and UiValidatedPhases
- [x] Add function to LongTermMemory to check if a Phase is UI validated
- [x] Add UiValidator
- [ ] Write Logic for UiValidator

## Open todo's with high priority:
- [x] remove the db and spring data
- [x] if an exception is thrown, save and go back to title screen
- [x] load the first save game 
- [x] add handle if an enemy move forces the player to switch pokemon
- [x] when no pp are left, the attack can't be used
- [x] hyper healer is not used as a revive item
- [x] get in js the current form index and apply its data to the pokemon
- [ ] make attack decision not in the attack menu
- [ ] don't buy revive items before waveDto 10
- [ ] getting the attack move from the summary ui handler
- [ ] modifier shop refactoring
- [ ] learn attack decision
- [ ] adding the savegame index to a runpropterty
- [ ] give the heal item in double fights the correct pokemon
- [ ] learning of attacks
- [ ] API for stopping the app or let it run again
- [ ] ChooseRareModifierNeuron

## Open todo's with low priority:
- [x] make the h2 database as default
- [x] PokemonNatureChangeModifierItem: Add Nature
- [x] AddVoucherModifierItem: Add Voucher
- [x] BerryModifierItem: Add Berry
- [x] Make PhaseProvider get the Phases with dependency injection
- [x] MoveEffectPhase: check if waiting in message gamemode is correct or space has to be pressed
- [x] ExpPhase: check if waiting in message gamemode is correct or space has to be pressed
- [ ] Add getWaitTime() in Phase interface
- [ ] Combine Start and fightconfig and remove the different configurations
- [ ] Image Service refactoren
- [ ] check which constants can be moved to the application.yml
- [ ] add login infos from .txt to .yml in application-default
- [ ] add an application-default.yml.backupp to the repo
- [ ] remove all the template and stages stuff
- [ ] merge file handler to one class and make it a component
- [ ] SelectTargetPhase: select correct target
- [ ] SimpleFightConfig: add configurable retry policy
- [ ] pokemon status in js 
- [ ] add .getMove() properties to moveset
- [ ] FileManager: Refactor the bad OS dependent get temp Screenshot file path Implementation and corresponding Unit Tests