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
- [x] handel fainted pokemons in the own team
  - [x] get the info, which pokemon are not fainted
  - [x] select a not fainted pokemon
- [ ] give the heal item in dubble fights the correct pokemon
- [ ] add error handling for loop detection
- [ ] learning of attacks 
- [x] level up handling
- [ ] Wave Info:
  - [ ] is wild or trainer
  - [ ] is double or single


## Open todo's with low priority:
- [ ] Image Service refactoren
- [x] PokemonNatureChangeModifierItem: Add Nature
- [x] AddVoucherModifierItem: Add Voucher
- [x] BerryModifierItem: Add Berry
- [ ] Add getWaitTime() in Phase interface
- [x] Make PhaseProvider get the Phases with dependency injection
- [ ] Combine Start and fightconfig and remove the different configurations
- [ ] check which constants can be moved to the application.yml
- [ ] make the h2 database as default
- [ ] add login infos from .txt to .yml in application-default
- [ ] add an application-default.yml.backupp to the repo
- [ ] remove all the template and stages stuff
- [ ] merge file handler to one class and make it a component
- [ ] SelectTargetPhase: select correct target
- [ ] SimpleFightConfig: add configurable retry policy
- [x] MoveEffectPhase: check if waiting in message gamemode is correct or space has to be pressed
- [x] ExpPhase: check if waiting in message gamemode is correct or space has to be pressed
- [ ] pokemon status in js 
- [ ] add .getMove() properties to moveset