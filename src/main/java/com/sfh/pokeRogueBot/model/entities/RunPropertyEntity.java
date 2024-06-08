package com.sfh.pokeRogueBot.model.entities;

import jakarta.persistence.*;
import lombok.Data;

@Data
//@Entity
@Table(name = "run_property")
public class RunPropertyEntity {

    @Id
    @Column(name = "run_number")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int runNumber;

    @Column(name = "status")
    private int status;

    @Column(name = "round_number")
    private int roundNumber;

    @Column(name = "defeated_wild_pokemon")
    private int defeatedWildPokemon;

    @Column(name = "caughtPokemon_pokemon")
    private int caughtPokemon;

    @Column(name = "defeatedTrainer")
    private int defeatedTrainer;
}
