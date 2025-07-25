package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.dto.WaveAndTurnDto;
import com.sfh.pokeRogueBot.model.enums.*;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.decisions.AttackDecision;
import com.sfh.pokeRogueBot.model.decisions.AttackDecisionForDoubleFight;
import com.sfh.pokeRogueBot.model.decisions.AttackDecisionForPokemon;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.Brain;
import com.sfh.pokeRogueBot.service.JsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedList;
import java.util.List;

@Slf4j
@Component
public class CommandPhase extends AbstractPhase implements Phase {

    public static final String NAME = "CommandPhase";

    private final Brain brain;
    private final JsService jsService;

    public CommandPhase(Brain brain, JsService jsService) {
        this.brain = brain;
        this.jsService = jsService;
    }

    int lastWaveIndex = -1;

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(UiMode gameMode) throws NotSupportedException {

        WaveAndTurnDto waveAndTurnDto = this.jsService.getWaveAndTurnIndex();

        if(null == waveAndTurnDto){
            throw new IllegalStateException("waveAndTurnDto is null");
        }

        //when a new run started
        if(brain.shouldResetWaveIndex()){
            log.debug("Resetting wave index");
            this.lastWaveIndex = -1;
        }

        //if the wave has ended, inform the brain
        if (waveAndTurnDto.getWaveIndex() > lastWaveIndex) {
            brain.informWaveEnded(waveAndTurnDto.getWaveIndex());
            this.lastWaveIndex = waveAndTurnDto.getWaveIndex();
        }

        if (gameMode == UiMode.COMMAND) { //fight, ball, pokemon, run
            CommandPhaseDecision commandPhaseDecision = brain.getCommandDecision();
            String memory = "wave: " + waveAndTurnDto.getWaveIndex() + ", turn: " + waveAndTurnDto.getTurnIndex() + ", decision: " + commandPhaseDecision;
            brain.memorize(memory);

            if (commandPhaseDecision == CommandPhaseDecision.ATTACK) {
                log.debug("GameMode.COMMAND, Attack decision chosen");
                return new PhaseAction[]{
                        this.pressArrowUp,
                        this.waitBriefly,
                        this.pressArrowLeft,
                        this.waitBriefly,
                        this.pressSpace,
                };
            }
            else if(commandPhaseDecision == CommandPhaseDecision.BALL){
                log.debug("GameMode.COMMAND, Ball decision chosen");
                return new PhaseAction[]{
                        this.pressArrowRight,
                        this.waitBriefly,
                        this.pressSpace,
                };
            }
            else if(commandPhaseDecision == CommandPhaseDecision.SWITCH){
                log.debug("GameMode.COMMAND, Switch decision chosen");
                return new PhaseAction[]{
                        this.pressArrowDown,
                        this.waitBriefly,
                        this.pressSpace,
                };
            }
            else if(commandPhaseDecision == CommandPhaseDecision.RUN){
                log.debug("GameMode.COMMAND, Run decision chosen");
                return new PhaseAction[]{
                        this.pressArrowRight,
                        this.waitBriefly,
                        this.pressArrowDown,
                        this.waitBriefly,
                        this.pressSpace,
                };
            }
        }
        else if (gameMode == UiMode.FIGHT) { //which move to use

            log.debug("GameMode.FIGHT, getting attackDecision");
            AttackDecision attackDecision = brain.getAttackDecision();

            if(null == attackDecision && brain.tryToCatchPokemon()){
                log.debug("CapturePokemon decision chosen because attackDecision is null and is capture pokemon");
                return new PhaseAction[]{
                        this.pressBackspace, //go back to command menu
                        this.waitBriefly,
                        this.pressArrowRight, //go to ball menu
                        this.waitBriefly,
                        this.pressSpace, //open menu
                };
            }

            if(null == attackDecision){
                throw new IllegalStateException("cant find a attack move in the command phase");
            }

            List<PhaseAction> actionList = new LinkedList<>();
            if(attackDecision instanceof AttackDecisionForPokemon forSingleFight){
                log.debug("found attackDecision for single fight");
                actionList.add(this.pressArrowUp); //to go back to top left
                actionList.add(this.waitBriefly); //to go back to top left
                actionList.add(this.pressArrowLeft); //to go back to top left

                addActionsToList(forSingleFight.getOwnAttackIndex(), forSingleFight.getSelectedTarget(), actionList, forSingleFight.getMoveTargetAreaType());

                return actionList.toArray(new PhaseAction[0]);
            }
            else if(attackDecision instanceof AttackDecisionForDoubleFight forDoubleFight){
                log.debug("found attackDecision for double fight");
                actionList.add(this.pressArrowUp); //to go back to top left
                actionList.add(this.waitBriefly); //to go back to top left
                actionList.add(this.pressArrowLeft); //to go back to top left

                addActionsToList(forDoubleFight.getPokemon1().getOwnAttackIndex(), forDoubleFight.getPokemon1().getSelectedTarget(), actionList, forDoubleFight.getPokemon1().getMoveTargetAreaType()); //add the decisions for the first pokemon

                if(null != forDoubleFight.getPokemon1() && null != forDoubleFight.getPokemon2()){ //only when two player pokemon are available
                    actionList.add(this.waitLonger); //second pokemon is active now and the phase is back to command phase
                    actionList.add(this.pressSpace); //enter fight game mode again for the second pokemon

                    actionList.add(this.pressArrowUp);
                    actionList.add(this.waitBriefly);
                    actionList.add(this.pressArrowLeft); //to go back to top left

                    addActionsToList(forDoubleFight.getPokemon2().getOwnAttackIndex(), forDoubleFight.getPokemon2().getSelectedTarget(), actionList, forDoubleFight.getPokemon2().getMoveTargetAreaType()); //add the decisions for the second pokemon
                }

                return actionList.toArray(new PhaseAction[0]);
            }

            throw new NotSupportedException("AttackDecision not supported in CommandPhase: " + attackDecision);
        }
        else if (gameMode == UiMode.BALL){
            log.debug("GameMode.BALL, choosing strongest pokeball");
            jsService.addBallToInventory(); //add the ball to the inventory
            int pokeballIndex = brain.selectStrongestPokeball();
            log.debug("Selected pokeball index: " + pokeballIndex);
            if(pokeballIndex == -1){
                throw new IllegalStateException("No pokeballs left");
            }

            boolean success = jsService.setPokeBallCursor(pokeballIndex);
            if(success){
                return new PhaseAction[]{
                        this.pressSpace,
                };
            }

            throw new IllegalStateException("Could not set pokeball cursor to index: " + pokeballIndex);
        } else if (gameMode == UiMode.MESSAGE) {
            log.warn("GameMode.MESSAGE detected in CommandPhase. Expecting error...");
            return new PhaseAction[]{
                    this.pressSpace,
                    this.waitEvenLonger
            };
        }

        throw new NotSupportedException("GameMode not supported in CommandPhase: " + gameMode);
    }

    private void addActionsToList(OwnAttackIndex ownAttackIndex, SelectedTarget selectedTarget, List<PhaseAction> actionList, MoveTargetAreaType moveTarget) {
        actionList.add(this.waitBriefly);
        switch (ownAttackIndex) {
            case TOP_LEFT:
                actionList.add(this.pressSpace);
                break;
            case TOP_RIGHT:
                actionList.add(this.pressArrowRight);
                actionList.add(this.waitBriefly);
                actionList.add(this.pressSpace);
                break;
            case BOTTOM_LEFT:
                actionList.add(this.pressArrowDown);
                actionList.add(this.waitBriefly);
                actionList.add(this.pressSpace);
                break;
            case BOTTOM_RIGHT:
                actionList.add(this.pressArrowRight);
                actionList.add(this.waitBriefly);
                actionList.add(this.pressArrowDown);
                actionList.add(this.waitBriefly);
                actionList.add(this.pressSpace);
                break;
        }

        if(moveTarget == MoveTargetAreaType.ALL_ENEMIES){
            return; //no need to select target
        }
        else if(moveTarget != MoveTargetAreaType.NEAR_OTHER){
            log.warn("unchecked MoveTargetAreaType found: " + moveTarget);
        }

        actionList.add(this.waitBriefly); //now choose the target

        switch (selectedTarget) {
            case ENEMY:
                log.debug("Enemy target selected");
                break;
            case LEFT_ENEMY:
                log.debug("Left enemy target selected");
                actionList.add(this.waitBriefly);
                actionList.add(this.pressArrowLeft);
                actionList.add(this.waitBriefly);
                actionList.add(this.pressSpace);
                break;
            case RIGHT_ENEMY:
                log.debug("Right enemy target selected");
                actionList.add(this.waitBriefly);
                actionList.add(this.pressArrowRight);
                actionList.add(this.waitBriefly);
                actionList.add(this.pressSpace);
                break;
        }
    }
}
