var wavePokemons = this.poru.wave.getWavePokemons();
var enemyParty = wavePokemons.enemyParty;
var ownParty = wavePokemons.ownParty;

for(let i = 0; i < enemyParty.length; i++) {
    let enemyPokemon = enemyParty[i];
    for(moveset of enemyPokemon.moveset) {
        target = window.poru.poke.getMoveTargetAsString(moveset.moveTarget)
        console.log("Enemy " + enemyPokemon.name + " move " + moveset.name + " target: " + target);
        
    }
}