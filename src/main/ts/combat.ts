import type { BattleScene } from "../../../pokerogue/src/battle-scene";
import {
    buildCombatObservation,
    canBuildCombatObservation,
    type CombatDecisionContext,
    type DecisionKind,
} from "./lib/combat-observation";

/** Request des Kotlin-Livepfads; Verlauf und Entscheidungsart fuehrt Kotlin (DqnCombatSwitchPolicy). */
type CombatObservationRequest = {
    decisionKind: number;
    lastActionWasSwitch: boolean;
    consecutiveSwitchCount: number;
    lastSwitchOriginPartyIndex: number | null;
};

type CombatObservationResponse =
    | { ok: true; observation: ReturnType<typeof buildCombatObservation> }
    | { ok: false; error: string };

type CombatApi = {
    getObservationJson: (requestJson: string) => string;
};

type PoruRoot = {
    combat?: CombatApi;
    util?: {
        getBattleScene: () => BattleScene | null;
    };
};

declare const window: Window & typeof globalThis & { poru?: PoruRoot };

if (!window.poru) window.poru = {};
const poruRoot = window.poru;

function toDecisionKind(value: number): DecisionKind {
    return value === 1 || value === 2 ? value : 0;
}

function parseRequest(requestJson: string): CombatDecisionContext {
    const request = JSON.parse(requestJson) as Partial<CombatObservationRequest>;
    const origin = request.lastSwitchOriginPartyIndex;
    return {
        decisionKind: toDecisionKind(Number(request.decisionKind ?? 0)),
        lastActionWasSwitch: request.lastActionWasSwitch === true,
        consecutiveSwitchCount: Number.isFinite(request.consecutiveSwitchCount) ? Number(request.consecutiveSwitchCount) : 0,
        lastSwitchOriginPartyIndex: Number.isInteger(origin) ? Number(origin) : null,
    };
}

const combatApi: CombatApi = {
    getObservationJson: (requestJson: string): string => {
        let response: CombatObservationResponse;
        try {
            const scene = poruRoot.util?.getBattleScene() ?? null;
            if (!scene) {
                response = { ok: false, error: "battle scene unavailable" };
            } else if (scene.currentBattle?.double) {
                response = { ok: false, error: "double battle not supported by combat-v4" };
            } else if (!canBuildCombatObservation(scene)) {
                response = { ok: false, error: "missing active battlers" };
            } else {
                response = { ok: true, observation: buildCombatObservation(scene, parseRequest(requestJson)) };
            }
        } catch (error) {
            response = { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
        return JSON.stringify(response);
    },
};

poruRoot.combat = combatApi;
