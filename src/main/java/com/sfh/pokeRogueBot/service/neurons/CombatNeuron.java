package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.service.ImageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class CombatNeuron {

    private final ImageService imageService;

    public CombatNeuron(ImageService imageService) {
        this.imageService = imageService;
    }

}
