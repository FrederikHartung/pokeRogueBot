import { ShinyRateBoosterModifier} from '../pokerogue/src/modifier/modifier';
import { modifierTypes } from '../pokerogue/src/modifier/modifier-type';

function setMaxShinyRate(battleScene) {
    const modifiers = battleScene.modifiers;
    const searchString = 'modifierType:ModifierType.SHINY_CHARM';
    const maxStackCount = 20;

    let index = modifiers.findIndex(({ type: { localeKey } }) => localeKey === searchString);

    const addItemToPlayer = (newItemModifier, playSound = true, instant = true) => {
        return battleScene.updateModifiers(true, instant).then(() => battleScene.addModifier(newItemModifier, false, playSound, false, instant).then(() => battleScene.updateModifiers(true, instant)));
    };

    if (index === -1) {
        const shinyCharmModifier = new ShinyRateBoosterModifier(modifierTypes.SHINY_CHARM());
        return addItemToPlayer(shinyCharmModifier, false, true).then(() => {
            index = modifiers.findIndex(({ type: { localeKey } }) => localeKey === searchString);
            if (index === -1) {
                console.error('Error: Modifier was not added correctly.');
                return;
            }
            console.log(`Added new object with stack count ${maxStackCount}`);
            modifiers[index].stackCount = maxStackCount;
            return battleScene.updateModifiers(true, true).then(() => console.log(`Updated stack count to ${maxStackCount}`));
        });
    }

    if (modifiers[index].stackCount !== maxStackCount) {
        modifiers[index].stackCount = maxStackCount;
        return battleScene.updateModifiers(true, true).then(() => console.log(`Found at index: ${index}. Updated stack count to ${maxStackCount}`));
    } else {
        console.log(`Wild shiny is already at max.`);
    }
}