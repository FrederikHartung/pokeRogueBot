if(!window.poru) window.poru = {};
window.poru.egg = {
    getHatchedPokemon: () => {
        const eggPhase = window.poru.util.getPhase();

        if(eggPhase.pokemon){
            const hatchedPokemon = eggPhase.pokemon;
            if(hatchedPokemon){
                return window.poru.poke.getPokemonDto(hatchedPokemon);
            }
        }

        return null;
    },

    getHatchedPokemonJson: () => {
        return JSON.stringify(window.poru.egg.getHatchedPokemon());
    },

    getEggId: () => {
        const eggPhase = window.poru.util.getPhase();
        if(eggPhase.egg){
            return eggPhase.egg.id;
        }
        return null;
    },
}