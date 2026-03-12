import { ModifierTier, PokeballType, enumToString } from "./enums";
import type { ModifierTypeOption } from "../../../pokerogue/src/modifier/modifier-type";

type ModifierOptionDto = {
    group: unknown;
    id: string;
    tier: string | number;
    name: string;
    typeName: string;
    cost: number;
    upgradeCount: number;
    x?: number;
    y?: number;
    count?: number;
    pokeballType?: string;
    vouchertype?: unknown;
    healStatus?: unknown;
    restorePercent?: number;
    restorePoints?: number;
    moveId?: number;
    tempBattleStat?: unknown;
};

type ModifierOptionLike = {
    modifierTypeOption: ModifierTypeOption;
    x?: number;
    y?: number;
};

type ModifierTypeMetadata = {
    id: string;
    group: unknown;
    tier: number;
    name: string;
    count?: number;
    pokeballType?: number;
    vouchertype?: unknown;
    healStatus?: unknown;
    restorePercent?: number;
    restorePoints?: number;
    moveId?: number;
    tempBattleStat?: unknown;
};

type ContainerLike = {
    type?: string;
    parentContainer?: { constructor: { name: string } } & ModifierOptionLike;
    list?: unknown[];
    _visible?: boolean;
    active?: boolean;
};

type ModifierApi = {
    getModifierTierEnumString: (tier: number) => string;
    getPokeBallTypeEnumString: (pokeBallIndex: number) => string;
    filterShopItems: (container: ContainerLike, modifierOption: Set<ModifierOptionLike>) => void;
    buildResult: (container: ModifierOptionLike, resultArray: ModifierOptionDto[]) => void;
    getSelectModifiers: () => ModifierOptionDto[];
    getSelectModifiersJson: () => string;
    getModifierItemDtoArray: (modifierItemArray: ModifierOptionLike[]) => ModifierOptionDto[];
};

type PoruRoot = {
    modifier?: ModifierApi;
    util?: {
        getBattleScene: () => { ui: { getAll: () => unknown[] } } | null;
    };
};

declare const window: Window & typeof globalThis & { poru?: PoruRoot };

if(!window.poru) window.poru = {};
const poruRoot = window.poru;

function getModifierTypeMetadata(modifierOption: ModifierTypeOption): ModifierTypeMetadata {
    return modifierOption.type as unknown as ModifierTypeMetadata;
}

const modifierApi: ModifierApi = {

    getModifierTierEnumString: (tier: number) => {
        return enumToString(ModifierTier, tier, "COMMON");
    },

    getPokeBallTypeEnumString: (pokeBallIndex: number) => {
        return enumToString(PokeballType, pokeBallIndex, "POKEBALL");
    },

    filterShopItems: (container: ContainerLike, modifierOption: Set<ModifierOptionLike>) => {
        if (container.type === "Text" && container.parentContainer.constructor.name === "ModifierOption") {
            modifierOption.add(container.parentContainer);
        } else if (container.type === "Container" && container.list) {
            container.list.forEach((subElement) => modifierApi.filterShopItems(subElement as ContainerLike, modifierOption));
        }
    },

    buildResult: (container: ModifierOptionLike, resultArray: ModifierOptionDto[]) => {
        const modifierType = getModifierTypeMetadata(container.modifierTypeOption);
        const option: ModifierOptionDto = {
            //ModifierType
            id: modifierType.id,
            group: modifierType.group,
            tier: modifierApi.getModifierTierEnumString(modifierType.tier),
            name: modifierType.name,
            typeName: container.modifierTypeOption.type.constructor.name,
            x: container.x ?? 0,
            y: container.y ?? 0,

            //ModifierTypeOption
            cost: container.modifierTypeOption.cost,
            upgradeCount: container.modifierTypeOption.upgradeCount,
        }

        if (option.typeName === "AddPokeballModifierType"){
            option.count = modifierType.count;
            option.pokeballType = modifierType.pokeballType !== undefined
                ? window.poru.modifier.getPokeBallTypeEnumString(modifierType.pokeballType)
                : undefined;
        }
        else if (option.typeName === "AddVoucherModifierType"){
            option.vouchertype = modifierType.vouchertype;
            option.count = modifierType.count;
        }
        else if (option.typeName === "PokemonHpRestoreModifierType"){
            option.healStatus = modifierType.healStatus;
            option.restorePercent = modifierType.restorePercent;
            option.restorePoints = modifierType.restorePoints;
        }
        else if (option.typeName === "PokemonReviveModifierType"){
            option.restorePoints = modifierType.restorePoints;
            option.restorePercent = modifierType.restorePercent;
        }
        else if (option.typeName === "TmModifierType"){
            option.moveId = modifierType.moveId;
        }
        else if (option.typeName === "PokemonPpRestoreModifierType"){
            option.restorePoints = modifierType.restorePoints;
        }
        else if (option.typeName === "TempBattleStatBoosterModifierType"){
            option.tempBattleStat = modifierType.tempBattleStat;
        }

        resultArray.push(option);
    },

    getSelectModifiers: () => {
        const uiElements = poruRoot.util?.getBattleScene()?.ui.getAll() ?? [];
        const activeAndVisibleElements = uiElements.filter((element): element is ContainerLike => {
            const candidate = element as ContainerLike;
            return candidate._visible === true && candidate.active === true;
        });
        const modifierOption =  new Set<ModifierOptionLike>();
        const resultArray: ModifierOptionDto[] = [];

        activeAndVisibleElements.forEach((element) => {
            modifierApi.filterShopItems(element, modifierOption);
        });

        modifierOption.forEach((element) => {
            modifierApi.buildResult(element, resultArray);
        });

        return resultArray;
    },

    getSelectModifiersJson: () => {
        return JSON.stringify(modifierApi.getSelectModifiers());
    },

    getModifierItemDtoArray: (modifierItemArray: ModifierOptionLike[]) => {
        const modifierItemDtoArray: ModifierOptionDto[] = [];
        for(let i = 0; i < modifierItemArray.length; i++){
            const modifierTypeOption = modifierItemArray[i].modifierTypeOption;
            const modifierType = getModifierTypeMetadata(modifierTypeOption);
            const option: ModifierOptionDto = {
                group: modifierType.group,
                id: modifierType.id,
                tier: modifierType.tier,
                name: modifierType.name,

                typeName: modifierTypeOption.type.constructor.name,

                cost: modifierTypeOption.cost,
                upgradeCount: modifierTypeOption.upgradeCount,
            };

        if (option.typeName === "AddPokeballModifierType"){
            option.count = modifierType.count;
            option.pokeballType = modifierType.pokeballType !== undefined
                ? window.poru.modifier.getPokeBallTypeEnumString(modifierType.pokeballType)
                : undefined;
        }
        else if (option.typeName === "AddVoucherModifierType"){
            option.vouchertype = modifierType.vouchertype;
            option.count = modifierType.count;
        }
        else if (option.typeName === "PokemonHpRestoreModifierType"){
            option.healStatus = modifierType.healStatus;
            option.restorePercent = modifierType.restorePercent;
            option.restorePoints = modifierType.restorePoints;
        }
        else if (option.typeName === "PokemonReviveModifierType"){
            option.restorePoints = modifierType.restorePoints;
            option.restorePercent = modifierType.restorePercent;
        }
        else if (option.typeName === "TmModifierType"){
            option.moveId = modifierType.moveId;
        }
        else if (option.typeName === "PokemonPpRestoreModifierType"){
            option.restorePoints = modifierType.restorePoints;
        }
        else if (option.typeName === "TempBattleStatBoosterModifierType"){
            option.tempBattleStat = modifierType.tempBattleStat;
        }

            modifierItemDtoArray.push(option);
        };

        return modifierItemDtoArray;
    }
};

poruRoot.modifier = modifierApi;
