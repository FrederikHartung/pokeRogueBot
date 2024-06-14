# developer dokumentation

## For Phases:
Make sure to add new phases with their name to the Phase interface.  
Also they have to be @Component and to be added to the PhaseProvider as a field and to the fromString method.

## For Modifier:
Modifier need to extend ModifierItem and implement the ChooseModifierItem Interface.  
They also need the "@EqualsAndHashCode(callSuper = true)" and "@Data" Annotation.
If a modifier has extra fields, they need to be added to getModifierOptions.js to retrieve them from the browser with js.  
Also they have to be added to the ChooseModifierItemDeserializer for Json parsing.  

## Sprint 1, week 09.06-16.06.:
- [ ] achieve first lost run

## Open todo's with high priority:
- [x] add all MotifierTypes as a model
- [x] make enums return only non null values in js
- [ ] handel fainted pokemons in the own team
- [ ] learning of attacks 
- [ ] level up handling


## Open todo's with low priority:
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