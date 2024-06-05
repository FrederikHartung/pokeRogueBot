package com.sfh.pokeRogueBot.model.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Data;

@Data
@Entity
public class RunPropertyEntity {

    @Column(name = "run_number")
    @Id
    private int runNumber;

    @Column(name = "status")
    private String status;

    @Column(name = "round_number")
    private int roundNumber;
}
