package com.sfh.pokeRogueBot.stage;

import com.sfh.pokeRogueBot.stage.fight.DefaultFightStage;
import com.sfh.pokeRogueBot.stage.fight.FightStage;
import com.sfh.pokeRogueBot.stage.fight.ShopStage;
import com.sfh.pokeRogueBot.stage.fight.smallstages.EnemyFaintedStage;
import com.sfh.pokeRogueBot.stage.fight.trainer.TrainerFightDialogeStage;
import com.sfh.pokeRogueBot.stage.start.IntroStage;
import com.sfh.pokeRogueBot.stage.start.LoginScreenStage;
import com.sfh.pokeRogueBot.stage.start.MainMenuStage;
import com.sfh.pokeRogueBot.stage.start.PokemonselectionStage;
import com.sfh.pokeRogueBot.stage.fight.SwitchDecisionStage;
import com.sfh.pokeRogueBot.stage.fight.trainer.TrainerFightStartStage;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.stereotype.Component;

@Getter
@Component
@AllArgsConstructor
public class StageProvider {

    private final LoginScreenStage loginScreenStage;
    private final IntroStage introStage;
    private final MainMenuStage mainMenuStage;
    private final PokemonselectionStage pokemonselectionStage;
    private final SwitchDecisionStage switchDecisionStage;
    private final TrainerFightDialogeStage trainerFightDialogeStage;
    private final TrainerFightStartStage trainerFightStartStage;
    private final FightStage fightStage;
    private final ShopStage shopStage;
    private final DefaultFightStage defaultFightStage;
}
