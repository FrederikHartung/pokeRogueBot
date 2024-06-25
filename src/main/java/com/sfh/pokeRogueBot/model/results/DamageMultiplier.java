package com.sfh.pokeRogueBot.model.results;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class DamageMultiplier {

    private float playerDamageMultiplier1;
    private Float playerDamageMultiplier2;

    private float enemyDamageMultiplier1;
    private Float enemyDamageMultiplier2;
}
