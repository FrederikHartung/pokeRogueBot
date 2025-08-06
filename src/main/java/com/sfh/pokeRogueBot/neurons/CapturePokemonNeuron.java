package com.sfh.pokeRogueBot.neurons;

import com.sfh.pokeRogueBot.model.dto.WaveDto;
import com.sfh.pokeRogueBot.model.enums.PokeBallType;
import com.sfh.pokeRogueBot.model.poke.PokeBallCatchRate;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import lombok.extern.slf4j.Slf4j;
import net.bytebuddy.asm.Advice;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class CapturePokemonNeuron {

    /**
     * @return if the pokemon should be captured
     */
    public boolean shouldCapturePokemon(WaveDto waveDto, Pokemon wildPokemon) {

        if (wildPokemon == null) {
            return false;
        }

        if (waveDto.isTrainerFight()) {
            log.debug("can't capture: trainer fight");
            return false;
        }

        if (!waveDto.hasPokeBalls()) {
            log.debug("can't capture: no pokeballs left");
            return false;
        }

        if (!waveDto.isOnlyOneEnemyLeft()) {
            log.debug("can't capture: more than one enemy left");
            return false;
        }

        if (wildPokemon.isBoss()) {
            boolean isBossCatchable = wildPokemon.getHp() <= (wildPokemon.getStats().getHp() / wildPokemon.getBossSegments());

            if (!isBossCatchable) {
                log.debug("can't capture: boss is not hurt enough");
                return false;
            }
        }

        if (wildPokemon.isShiny()) {
            throw new IllegalStateException("Shiny pokemon should be captured manualy");
        }

        if (((double) wildPokemon.getHp() / wildPokemon.getStats().getHp()) > 0.9) {
            log.debug("can't capture: pokemon is too healthy");
            return false;
        }

        log.debug("can capture: " + wildPokemon.getName());
        return true;
    }

    public int selectStrongestPokeball(WaveDto waveDto) {
        int[] pokeballs = waveDto.getPokeballCount();
        for (int i = pokeballs.length - 1; i >= 0; i--) {
            if (pokeballs[i] > 0) {
                pokeballs[i]--;
                return i;
            }
        }

        // when no poke balls are left, we should not try to capture
        return -1;
    }

    public int getCaptureChance(Pokemon wildPokemon, PokeBallType pokeBallType) {

        float pokeBallCatchRate = PokeBallCatchRate.forBall(pokeBallType).getCatchRate();

        float pokemonMaxHp = wildPokemon.getStats().getHp();
        float currentHp = wildPokemon.getHp();
        float hpFactor = (3f * pokemonMaxHp) - (2f * currentHp);
        float speciesCatchRate = wildPokemon.getSpecies().getCatchRate();
        float statusEffectModificator = wildPokemon.getStatus() != null ? wildPokemon.getStatus().getCatchRateModificatorForStatusEffect() : 1;
        float catchValue = (hpFactor * speciesCatchRate * pokeBallCatchRate) / (3 * pokemonMaxHp) * statusEffectModificator;

        if (catchValue > 255) {
            catchValue = 255;
        }

        int captureChancePercentage = Math.round((catchValue / 255) * 100);
        log.debug("capture chance: " + captureChancePercentage + "%");
        return captureChancePercentage;
    }
}
