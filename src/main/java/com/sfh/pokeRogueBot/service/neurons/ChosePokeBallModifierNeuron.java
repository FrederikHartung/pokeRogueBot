package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.enums.PokeBallType;
import com.sfh.pokeRogueBot.model.modifier.ModifierShop;
import com.sfh.pokeRogueBot.model.modifier.ModifierShopItem;
import com.sfh.pokeRogueBot.model.modifier.impl.AddPokeballModifierItem;
import com.sfh.pokeRogueBot.model.dto.WaveDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class ChosePokeBallModifierNeuron {

    public boolean priorityItemExists(ModifierShop shop, WaveDto waveDto){
        //if a special pokeball is available, pick it
        ModifierShopItem pokeBallModifier = shop.getFreeItems().stream()
                .filter(item -> item.getItem().getTypeName().equals(AddPokeballModifierItem.TARGET))
                .findFirst()
                .orElse(null);
        if(null != pokeBallModifier){
            int rogueBalls = waveDto.getPokeballCount()[PokeBallType.ROGUE_BALL.ordinal()];
            int ultraBalls = waveDto.getPokeballCount()[PokeBallType.ULTRA_BALL.ordinal()];
            int greatBalls = waveDto.getPokeballCount()[PokeBallType.GREAT_BALL.ordinal()];
            int pokeBalls = waveDto.getPokeballCount()[PokeBallType.POKEBALL.ordinal()];

            switch (((AddPokeballModifierItem)pokeBallModifier.getItem()).getPokeballType()){
                case MASTER_BALL, LUXURY_BALL: //always pick these
                    return true;
                case ROGUE_BALL:
                    if(rogueBalls <= 5){
                        return true;
                    }
                    break;
                case ULTRA_BALL:

                    if((rogueBalls + ultraBalls) <= 5){
                        return true;
                    }
                    break;
                case GREAT_BALL:
                    if((rogueBalls + ultraBalls + greatBalls) <= 5){
                        return true;
                    }
                    break;
                case POKEBALL:
                    if((rogueBalls + ultraBalls + greatBalls + pokeBalls) <= 5){
                        return true;
                    }
                    break;
            }
        }

        return false;
    }
}
