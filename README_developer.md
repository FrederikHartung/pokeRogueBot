# developer dokumentation

## For Phases:
Make sure to add new phases with their name to the Phase interface.  
Also they have to be @Component and to be added to the PhaseProvider as a field and to the fromString method.

## For Modifier:
Modifier need to extends AbstractModifierItem and implement the ChooseModifierItem Interface.  
They also need the "@EqualsAndHashCode(callSuper = true)" and "@Data" Annotation.
Also they have to be added to the ChooseModifierItemDeserializer for Json parsing.  


## Open todo's with high priority:
- [ ] add all MotifierTypes as a model
- [ ] handel fainted pokemons in the own team
- [ ] learning of attacks 
- [ ] level up handling


## Open todo's with low priority:
- [ ] PokemonNatureChangeModifierItem: Add Nature
- [ ] AddVoucherModifierItem: Add Voucher
- [ ] BerryModifierItem: Add Berry