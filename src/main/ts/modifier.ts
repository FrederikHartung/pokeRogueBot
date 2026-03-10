import { ModifierTier, PokeballType, enumToString } from "./enums";
import type { ModifierTypeOption } from "../../../pokerogue/src/modifier/modifier-type";

type ModifierOptionDto = {
    group: unknown;
    id: number;
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
        const option: ModifierOptionDto = {
            //ModifierType
            id: container.modifierTypeOption.type.id,
            group: container.modifierTypeOption.type.group,
            tier: modifierApi.getModifierTierEnumString(container.modifierTypeOption.type.tier),
            name: container.modifierTypeOption.type.name,
            typeName: container.modifierTypeOption.type.constructor.name,
            x: container.x ?? 0,
            y: container.y ?? 0,

            //ModifierTypeOption
            cost: container.modifierTypeOption.cost,
            upgradeCount: container.modifierTypeOption.upgradeCount,
        }

        if (option.typeName === "AddPokeballModifierType"){
            option.count = container.modifierTypeOption.type.count;
            option.pokeballType = window.poru.modifier.getPokeBallTypeEnumString(container.modifierTypeOption.type.pokeballType);
        }
        else if (option.typeName === "AddVoucherModifierType"){
            option.vouchertype = container.modifierTypeOption.type.vouchertype;
            option.count = container.modifierTypeOption.type.count;
        }
        else if (option.typeName === "PokemonHpRestoreModifierType"){
            option.healStatus = container.modifierTypeOption.type.healStatus;
            option.restorePercent = container.modifierTypeOption.type.restorePercent;
            option.restorePoints = container.modifierTypeOption.type.restorePoints;
        }
        else if (option.typeName === "PokemonReviveModifierType"){
            option.restorePoints = container.modifierTypeOption.type.restorePoints;
            option.restorePercent = container.modifierTypeOption.type.restorePercent;
        }
        else if (option.typeName === "TmModifierType"){
            option.moveId = container.modifierTypeOption.type.moveId;
        }
        else if (option.typeName === "PokemonPpRestoreModifierType"){
            option.restorePoints = container.modifierTypeOption.type.restorePoints;
        }
        else if (option.typeName === "TempBattleStatBoosterModifierType"){
            option.tempBattleStat = container.modifierTypeOption.type.tempBattleStat;
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
            const option: ModifierOptionDto = {
                group: modifierTypeOption.type.group,
                id: modifierTypeOption.type.id,
                tier: modifierTypeOption.type.tier,
                name: modifierTypeOption.type.name,

                typeName: modifierTypeOption.type.constructor.name,

                cost: modifierTypeOption.cost,
                upgradeCount: modifierTypeOption.upgradeCount,
            };

        if (option.typeName === "AddPokeballModifierType"){
            option.count = modifierTypeOption.type.count;
            option.pokeballType = window.poru.modifier.getPokeBallTypeEnumString(modifierTypeOption.type.pokeballType);
        }
        else if (option.typeName === "AddVoucherModifierType"){
            option.vouchertype = modifierTypeOption.type.vouchertype;
            option.count = modifierTypeOption.type.count;
        }
        else if (option.typeName === "PokemonHpRestoreModifierType"){
            option.healStatus = modifierTypeOption.type.healStatus;
            option.restorePercent = modifierTypeOption.type.restorePercent;
            option.restorePoints = modifierTypeOption.type.restorePoints;
        }
        else if (option.typeName === "PokemonReviveModifierType"){
            option.restorePoints = modifierTypeOption.type.restorePoints;
            option.restorePercent = modifierTypeOption.type.restorePercent;
        }
        else if (option.typeName === "TmModifierType"){
            option.moveId = modifierTypeOption.type.moveId;
        }
        else if (option.typeName === "PokemonPpRestoreModifierType"){
            option.restorePoints = modifierTypeOption.type.restorePoints;
        }
        else if (option.typeName === "TempBattleStatBoosterModifierType"){
            option.tempBattleStat = modifierTypeOption.type.tempBattleStat;
        }

            modifierItemDtoArray.push(option);
        };

        return modifierItemDtoArray;
    }
};

poruRoot.modifier = modifierApi;
