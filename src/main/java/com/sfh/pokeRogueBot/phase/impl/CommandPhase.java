package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.dto.WaveAndTurnDto;
import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.enums.CommandPhaseDecision;
import com.sfh.pokeRogueBot.model.enums.MoveDecision;
import com.sfh.pokeRogueBot.model.enums.MoveTarget;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.run.AttackDecision;
import com.sfh.pokeRogueBot.model.run.AttackDecisionForDoubleFight;
import com.sfh.pokeRogueBot.model.run.AttackDecisionForPokemon;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.DecisionService;
import com.sfh.pokeRogueBot.service.JsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedList;
import java.util.List;

@Slf4j
@Component
public class CommandPhase extends AbstractPhase implements Phase {

    public static final String NAME = "CommandPhase";

    private final DecisionService decisionService;
    private final JsService jsService;

    public CommandPhase(DecisionService decisionService, JsService jsService) {
        this.decisionService = decisionService;
        this.jsService = jsService;
    }

    int lastWaveIndex = -1;
    int lastTurnIndex = -1;

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {

        WaveAndTurnDto waveAndTurnDto = this.jsService.getWaveAndTurnIndex();
        if(null != waveAndTurnDto) {

            if (waveAndTurnDto.getWaveIndex() > lastWaveIndex) {
                decisionService.informWaveEnded();
                this.lastWaveIndex = waveAndTurnDto.getWaveIndex();
                this.lastTurnIndex = waveAndTurnDto.getTurnIndex();
            }
            else if(waveAndTurnDto.getTurnIndex() > lastTurnIndex){
                decisionService.informTurnEnded();
            }
        }

        if (gameMode == GameMode.COMMAND) { //fight, ball, pokemon, run
            CommandPhaseDecision commandPhaseDecision = decisionService.getCommandDecision();
            if (commandPhaseDecision == CommandPhaseDecision.ATTACK) {
                log.debug("GameMode.COMMAND, Attack decision chosen");
                return new PhaseAction[]{
                        this.pressArrowUp,
                        this.waitAction,
                        this.pressArrowLeft,
                        this.waitAction,
                        this.pressSpace,
                };
            }
            else if(commandPhaseDecision == CommandPhaseDecision.BALL){
                log.debug("GameMode.COMMAND, Ball decision chosen");
                return new PhaseAction[]{
                        this.pressArrowRight,
                        this.waitAction,
                        this.pressSpace,
                };
            }
            else if(commandPhaseDecision == CommandPhaseDecision.SWITCH){
                log.debug("GameMode.COMMAND, Switch decision chosen");
                return new PhaseAction[]{
                        this.pressArrowDown,
                        this.waitAction,
                        this.pressSpace,
                };
            }
            else if(commandPhaseDecision == CommandPhaseDecision.RUN){
                log.debug("GameMode.COMMAND, Run decision chosen");
                return new PhaseAction[]{
                        this.pressArrowRight,
                        this.waitAction,
                        this.pressArrowDown,
                        this.waitAction,
                        this.pressSpace,
                };
            }
        }
        else if (gameMode == GameMode.FIGHT) { //which move to use
            log.debug("GameMode.FIGHT, getting attackDecision");
            AttackDecision attackDecision = decisionService.getAttackDecision();

            if(null == attackDecision && decisionService.isCapturePokemon()){
                log.debug("CapturePokemon decision chosen");
                return new PhaseAction[]{
                        this.pressBackspace, //go back to command menu
                        this.waitAction,
                        this.pressArrowRight, //go to ball menu
                        this.waitAction,
                        this.pressSpace, //open menu
                };
            }

            List<PhaseAction> actionList = new LinkedList<>();
            if(attackDecision instanceof AttackDecisionForPokemon forSingleFight){
                log.debug("found attackDecision for single fight");
                actionList.add(this.pressArrowUp); //to go back to top left
                actionList.add(this.waitAction); //to go back to top left
                actionList.add(this.pressArrowLeft); //to go back to top left

                addActionsToList(forSingleFight.getMoveDecision(), forSingleFight.getMoveTarget(), actionList);

                return actionList.toArray(new PhaseAction[0]);
            }
            else if(attackDecision instanceof AttackDecisionForDoubleFight forDoubleFight){
                log.debug("found attackDecision for double fight");
                actionList.add(this.pressArrowUp); //to go back to top left
                actionList.add(this.waitAction); //to go back to top left
                actionList.add(this.pressArrowLeft); //to go back to top left

                addActionsToList(forDoubleFight.getPokemon1().getMoveDecision(), forDoubleFight.getPokemon1().getMoveTarget(), actionList); //add the decisions for the first pokemon

                if(null != forDoubleFight.getPokemon1() && null != forDoubleFight.getPokemon2()){ //only when two player pokemon are available
                    actionList.add(this.waitAction); //second pokemon is active now and the phase is back to command phase
                    actionList.add(this.pressSpace); //enter fight game mode again for the second pokemon

                    actionList.add(this.pressArrowUp);
                    actionList.add(this.waitAction);
                    actionList.add(this.pressArrowLeft); //to go back to top left

                    addActionsToList(forDoubleFight.getPokemon2().getMoveDecision(), forDoubleFight.getPokemon2().getMoveTarget(), actionList); //add the decisions for the second pokemon
                }

                return actionList.toArray(new PhaseAction[0]);
            }

            throw new NotSupportedException("AttackDecision not supported in CommandPhase: " + attackDecision);
        }
        else if (gameMode == GameMode.BALL){
            log.debug("GameMode.BALL, choosing strongest pokeball");
            int pokeballIndex = decisionService.selectStrongestPokeball();
            log.debug("Selected pokeball index: " + pokeballIndex);
            if(pokeballIndex == -1){
                return new PhaseAction[]{
                        this.pressBackspace, //go back to command menu and fight
                };
            }

            boolean success = jsService.setPokeBallCursor(pokeballIndex);
            if(success){
                return new PhaseAction[]{
                        this.pressSpace,
                };
            }

            throw new IllegalStateException("Could not set pokeball cursor to index: " + pokeballIndex);
        }

        throw new NotSupportedException("GameMode not supported in CommandPhase: " + gameMode);
    }

    private void addActionsToList(MoveDecision moveDecision, MoveTarget moveTarget, List<PhaseAction> actionList){
        switch (moveDecision) {
            case TOP_LEFT:
                actionList.add(this.pressSpace);
                break;
            case TOP_RIGHT:
                actionList.add(this.pressArrowRight);
                actionList.add(this.waitAction);
                actionList.add(this.pressSpace);
                break;
            case BOTTOM_LEFT:
                actionList.add(this.pressArrowDown);
                actionList.add(this.waitAction);
                actionList.add(this.pressSpace);
                break;
            case BOTTOM_RIGHT:
                actionList.add(this.pressArrowRight);
                actionList.add(this.waitAction);
                actionList.add(this.pressArrowDown);
                actionList.add(this.waitAction);
                actionList.add(this.pressSpace);
                break;
        }

        actionList.add(this.waitAction); //now choose the target

        switch (moveTarget) {
            case ENEMY:
                log.debug("Enemy target selected");
                break;
            case LEFT_ENEMY:
                log.debug("Left enemy target selected");
                actionList.add(this.waitAction);
                actionList.add(this.pressArrowLeft);
                actionList.add(this.waitAction);
                actionList.add(this.pressSpace);
                break;
            case RIGHT_ENEMY:
                log.debug("Right enemy target selected");
                actionList.add(this.waitAction);
                actionList.add(this.pressArrowRight);
                actionList.add(this.waitAction);
                actionList.add(this.pressSpace);
                break;
        }
    }
}
