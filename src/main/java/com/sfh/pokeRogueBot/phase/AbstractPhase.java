package com.sfh.pokeRogueBot.phase;

import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.phase.actions.*;

public abstract class AbstractPhase implements Phase {

    protected final PressKeyPhaseAction pressSpace = new PressKeyPhaseAction(KeyToPress.SPACE);
    protected final PressKeyPhaseAction pressBackspace = new PressKeyPhaseAction(KeyToPress.BACK_SPACE);
    protected final PressKeyPhaseAction pressEscape = new PressKeyPhaseAction(KeyToPress.ESCAPE);
    protected final PressKeyPhaseAction pressArrowUp = new PressKeyPhaseAction(KeyToPress.ARROW_UP);
    protected final PressKeyPhaseAction pressArrowRight = new PressKeyPhaseAction(KeyToPress.ARROW_RIGHT);
    protected final PressKeyPhaseAction pressArrowDown = new PressKeyPhaseAction(KeyToPress.ARROW_DOWN);
    protected final PressKeyPhaseAction pressArrowLeft = new PressKeyPhaseAction(KeyToPress.ARROW_LEFT);
    protected final WaitPhaseAction waitAction = new WaitPhaseAction();
    protected final WaitForTextRenderPhaseAction waitForTextRenderAction = new WaitForTextRenderPhaseAction();
    protected final WaitForStageRenderPhaseAction waitForStageRenderPhaseAction = new WaitForStageRenderPhaseAction();
    protected final QuitRunAction quitRunAction = new QuitRunAction();

    @Override
    public String toString() {
        return this.getPhaseName();
    }

    @Override
    public int getWaitAfterStage2x() {
        return 1000;
    }
}
