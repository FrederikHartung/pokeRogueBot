package com.sfh.pokeRogueBot.model.browser.pokemonjson;

import com.sfh.pokeRogueBot.model.enums.Stat;
import lombok.Data;

@Data
public class Stats {

    private Integer hp;

    private Integer attack;
    private Integer defense;

    private Integer specialAttack;
    private Integer specialDefense;

    private Integer speed;

}
