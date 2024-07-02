package com.sfh.pokeRogueBot.model.poke;

import com.sfh.pokeRogueBot.model.enums.PokeBallType;
import lombok.Getter;

@Getter
public class PokeBallCatchRate {

    public static final PokeBallCatchRate POKEBALL = new PokeBallCatchRate(PokeBallType.POKEBALL, 1);
    public static final PokeBallCatchRate GREAT_BALL = new PokeBallCatchRate(PokeBallType.GREAT_BALL, 1.5f);
    public static final PokeBallCatchRate ULTRA_BALL = new PokeBallCatchRate(PokeBallType.ULTRA_BALL, 2);
    public static final PokeBallCatchRate ROGUE_BALL = new PokeBallCatchRate(PokeBallType.ROGUE_BALL, 3);
    public static final PokeBallCatchRate MASTER_BALL = new PokeBallCatchRate(PokeBallType.MASTER_BALL, 255);

    private final PokeBallType type;
    private final float catchRate;

    public PokeBallCatchRate(PokeBallType type, float catchRate) {
        this.type = type;
        this.catchRate = catchRate;
    }

    public static PokeBallCatchRate forBall(PokeBallType pokeBallType) {
        return switch (pokeBallType) {
            case POKEBALL -> POKEBALL;
            case GREAT_BALL -> GREAT_BALL;
            case ULTRA_BALL -> ULTRA_BALL;
            case ROGUE_BALL -> ROGUE_BALL;
            case MASTER_BALL -> MASTER_BALL;
            default -> throw new IllegalArgumentException("Unknown ball type: " + pokeBallType);
        };
    }
}
