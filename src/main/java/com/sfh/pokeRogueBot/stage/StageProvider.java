package com.sfh.pokeRogueBot.stage;

import com.sfh.pokeRogueBot.stage.fight.FightStage;
import com.sfh.pokeRogueBot.stage.intro.IntroStage;
import com.sfh.pokeRogueBot.stage.login.LoginScreenStage;
import com.sfh.pokeRogueBot.stage.mainmenu.MainMenuStage;
import com.sfh.pokeRogueBot.stage.pokemonselection.PokemonselectionStage;
import com.sfh.pokeRogueBot.stage.switchdesicion.SwitchDecisionStage;
import com.sfh.pokeRogueBot.stage.trainerfight.TrainerFightStage;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
import lombok.Getter;
import org.springframework.stereotype.Component;

@Getter
@Component
public class StageProvider {

    private final LoginScreenStage loginScreenStage;
    private final IntroStage introStage;
    private final MainMenuStage mainMenuStage;
    private final PokemonselectionStage pokemonselectionStage;
    private final SwitchDecisionStage switchDecisionStage;
    private final TrainerFightStage trainerFightStage;
    private final FightStage fightStage;

    public StageProvider(TemplatePathValidator templatePathValidator, LoginScreenStage loginScreenStage, IntroStage introStage, MainMenuStage mainMenuStage, PokemonselectionStage pokemonselectionStage, SwitchDecisionStage switchDecisionStage, TrainerFightStage trainerFightStage, FightStage fightStage) {
        this.loginScreenStage = loginScreenStage;
        this.introStage = introStage;
        this.mainMenuStage = mainMenuStage;
        this.pokemonselectionStage = pokemonselectionStage;
        this.switchDecisionStage = switchDecisionStage;
        this.trainerFightStage = trainerFightStage;
        this.fightStage = fightStage;
    }
}
