package com.sfh.pokeRogueBot.model.enums;

public enum MoveTargetAreaType {

    /**
     * @see <a href="https://bulbapedia.bulbagarden.net/wiki/Category:Moves_that_target_the_user Moves that target the User>Source</a>
     */
    USER,
    OTHER,
    ALL_OTHERS,
    NEAR_OTHER,
    /**
     * @see <a href="https://bulbapedia.bulbagarden.net/wiki/Category:Moves_that_target_all_adjacent_Pok%C3%A9mon Moves that target all adjacent Pokemon>Source</a>
     */
    ALL_NEAR_OTHERS,
    NEAR_ENEMY,
    /**
     * @see <a href="https://bulbapedia.bulbagarden.net/wiki/Category:Moves_that_target_all_adjacent_foes Moves that target all adjacent foes>Source</a>
     */
    ALL_NEAR_ENEMIES,
    RANDOM_NEAR_ENEMY,
    ALL_ENEMIES,
    /**
     * @see <a href="https://bulbapedia.bulbagarden.net/wiki/Category:Counterattacks Counterattacks>Source</a>
     */
    ATTACKER,
    /**
     * @see <a href="https://bulbapedia.bulbagarden.net/wiki/Category:Moves_that_target_one_adjacent_ally Moves that target one adjacent ally>Source</a>
     */
    NEAR_ALLY,
    ALLY,
    USER_OR_NEAR_ALLY,
    USER_AND_ALLIES,
    /**
     * @see <a href="https://bulbapedia.bulbagarden.net/wiki/Category:Moves_that_target_all_Pok%C3%A9mon Moves that target all Pokemon>Source</a>
     */
    ALL,
    USER_SIDE,
    /**
     * @see <a href="https://bulbapedia.bulbagarden.net/wiki/Category:Entry_hazard-creating_moves Entry hazard-creating moves>Source</a>
     */
    ENEMY_SIDE,
    BOTH_SIDES,
    PARTY,
    CURSE
}
