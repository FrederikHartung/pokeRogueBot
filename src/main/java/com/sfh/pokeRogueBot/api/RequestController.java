package com.sfh.pokeRogueBot.api;

import com.sfh.pokeRogueBot.bot.WaveRunner;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api")
public class RequestController {

    private final WaveRunner waveRunner;

    public RequestController(WaveRunner waveRunner) {
        this.waveRunner = waveRunner;
    }

    @PostMapping("/start")
    public void startWaveRunner(@RequestParam boolean active) {
        log.debug("Setting WaveRunner active to {}", active);
        waveRunner.setActive(active);
    }

    @GetMapping("/hello")
    public String sayHello() {
        return "Hello, World!";
    }
}
