# developer documentation

## Development Strategy
Focus on progress and not on perfection. It's better to stick to a bad implementation and improve it later than to try to make it perfect from the beginning.  
If a good idea comes up, write it down and implement it later. Focus on the current task. Order the tasks by their level of improvement and how easy they are to implement.  
Only refactor, when it's really necessary.


## Sprint 1, week 09.06-16.06.:
- [x] achieve first lost run

## Open todo's with high priority:
- [x] add all MotifierTypes as a model
- [x] make enums return only non null values in js
- [x] level up handling
- [x] handel fainted pokemons in the own team
  - [x] get the info, which pokemon are not fainted
  - [x] select a not fainted pokemon
- [x] if the first attack is blocked, the second attack is chosen
- [x] apply revive item
- [x] handling a failed run
- [ ] getting the attack move from the summary ui handler
- [ ] learn attack decision
- [ ] try to catch a pokemon
- [ ] check if the damage calculation is correct
- [ ] enemy health calculation
- [ ] if a exception is thrown, the run should be stopped, saved as error and then a new run should be started
- [ ] adding the savegame index to a runpropterty
- [ ] load savegame instead of continue
- [ ] give the heal item in double fights the correct pokemon
- [ ] add error handling for loop detection
- [ ] learning of attacks
- [ ] Wave Info:
  - [ ] is wild or trainer
  - [ ] is double or single
- [ ] API for stopping the app or let it run again
- 


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