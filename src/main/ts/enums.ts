export { AbilityId } from "../../../pokerogue/src/enums/ability-id";
export { MoveTarget } from "../../../pokerogue/src/enums/move-target";
export { Nature } from "../../../pokerogue/src/enums/nature";
export { PokemonType } from "../../../pokerogue/src/enums/pokemon-type";
export { Gender } from "../../../pokerogue/src/data/gender";
export { StatusEffect } from "../../../pokerogue/src/enums/status-effect";
export { MoveCategory } from "../../../pokerogue/src/enums/move-category";
export { BiomeId } from "../../../pokerogue/src/enums/biome-id";
export { BattleType } from "../../../pokerogue/src/enums/battle-type";
export { BattleStyle } from "../../../pokerogue/src/enums/battle-style";
export { ModifierTier } from "../../../pokerogue/src/enums/modifier-tier";
export { PokeballType } from "../../../pokerogue/src/enums/pokeball";

/**
 * Reverse-lookup a numeric enum value to its string name.
 * Works with TypeScript numeric enums which have reverse mappings (e.g. EnumName[0] === "MEMBER_NAME").
 */
export function enumToString(enumObj: Record<number, string>, id: number, fallback = "UNKNOWN"): string {
    return enumObj[id] ?? fallback;
}
