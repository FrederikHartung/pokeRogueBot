if(!window.poru) window.poru = {};
window.poru.egg = {
    getHatchedPokemon: () => {
        var eggPhase = window.poru.util.getPhase();

        if(eggPhase.pokemon){
            var hatchedPokemon = eggPhase.pokemon;
            if(hatchedPokemon){
                return window.poru.poke.getPokemonDto(hatchedPokemon);
            }
        }

        return null;
    },

    getHatchedPokemonJson: () => {
        return JSON.stringify(window.poru.egg.getHatchedPokemon());
    }
}