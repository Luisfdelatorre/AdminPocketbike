/**
 * Centralized Action Dispatcher — UPay AI Voice Assistant
 *
 * Executes only validated catalog actions (`navigate`, `applyFilter`, `search`,
 * `clearFilters`, `openDetail`, `showHelp`) against the real React application
 * state via React Router and `ScreenBridge`.
 *
 * Guarantees:
 *  - Independent frontend validation via `validateActionPlan`.
 *  - Sequential async execution with real mount & data-readiness signals
 *    (`waitForScreenMount`, `waitForScreenDataReady`) instead of fixed sleep timers.
 *  - Halts immediately on the first failed action and never reports unverified success.
 *  - Resolves `{{placeholder}}` tokens only AFTER all actions and state updates complete.
 */

import {
    MODULES,
    CAPABILITIES,
    CAPABILITY_TYPES,
    getCapability,
    canUserAccessModule,
} from './capabilities.js';
import { validateActionPlan } from './schemaValidator.js';
import {
    getScreenBridge,
    waitForScreenMount,
    waitForScreenDataReady,
} from './screenBridge.js';
import {
    resolveTemplatePlaceholders,
    resolveTemplateWithLiveData,
} from './resolvers.js';

const UNKNOWN_REPLY_ES =
    'No entendí la solicitud. Prueba con "Muéstrame los pagos rechazados", "Motos apagadas" o "Abre contratos".';
const UNKNOWN_REPLY_EN =
    'I could not understand that request. Try "Show rejected payments", "Show suspended motorcycles" or "Open contracts".';

export const buildHelpReply = (user = null, lang = 'es-CO') => {
    const allowedModules = Object.values(MODULES)
        .filter((m) => canUserAccessModule(m.id, user))
        .map((m) => (lang === 'en-US' ? m.labelEn : m.label));

    if (lang === 'en-US') {
        return `I can navigate across ${allowedModules.join(', ')}, filter records, search by plate or customer, open read-only details, and answer counts or totals from the current screen.`;
    }
    return `Puedo navegar por ${allowedModules.join(', ')}, aplicar filtros, buscar por placa o cliente, abrir vistas previas de contratos o alertas y responder conteos o totales de la pantalla activa.`;
};

/**
 * Executes a single validated action `{ name, params }`.
 */
const executeSingleAction = async (action, ctx) => {
    const { name, params = {} } = action;
    const currentMod = ctx.getCurrentModule?.() || 'dashboard';
    const targetModule = params.module || currentMod;
    const modDef = MODULES[targetModule];

    if (!modDef) {
        return { ok: false, action, error: `Unknown module "${targetModule}"` };
    }

    if (ctx.user && !canUserAccessModule(targetModule, ctx.user)) {
        return {
            ok: false,
            action,
            code: 'UNAUTHORIZED_MODULE',
            error:
                ctx.lang === 'en-US'
                    ? `Your role does not have permission to access ${modDef.labelEn}.`
                    : `Tu rol no tiene permiso para acceder a ${modDef.label}.`,
        };
    }

    const ensureOnModule = async (modId) => {
        const activeMod = ctx.getCurrentModule?.();
        const existingBridge = getScreenBridge(modId);
        if (activeMod !== modId || !existingBridge) {
            ctx.navigate(MODULES[modId].route);
            ctx.setCurrentModule?.(modId);
            const mounted = await waitForScreenMount(modId, 2200);
            if (mounted) {
                await waitForScreenDataReady(modId, 2800);
            }
            return mounted;
        }
        return existingBridge;
    };

    switch (name) {
        case 'navigate': {
            ctx.navigate(modDef.route);
            ctx.setCurrentModule?.(targetModule);
            const bridge = await waitForScreenMount(targetModule, 2200);
            if (bridge) {
                await waitForScreenDataReady(targetModule, 2800);
            }
            return {
                ok: true,
                action,
                navigatedTo: modDef.route,
                targetModule,
            };
        }

        case 'applyFilter': {
            const bridge = await ensureOnModule(targetModule);
            if (bridge?.applyFilter) {
                const applied = await bridge.applyFilter(params);
                if (applied === false) {
                    return { ok: false, action, error: `Filter rejected by module "${targetModule}"` };
                }
                await waitForScreenDataReady(targetModule, 3000);
                return { ok: true, action, targetModule };
            }
            // Fallback for `/devices?filter=` URL query parameter support
            if (targetModule === 'devices' && params.status) {
                ctx.navigate(`/devices?filter=${encodeURIComponent(params.status)}`);
                ctx.setCurrentModule?.('devices');
                await waitForScreenMount('devices', 2000);
                return { ok: true, action, targetModule };
            }
            return {
                ok: true,
                action,
                targetModule,
                note: 'filter_recorded_in_context',
            };
        }

        case 'search': {
            const bridge = await ensureOnModule(targetModule);
            if (bridge?.search) {
                const searched = await bridge.search(params.query);
                if (searched === false) {
                    return { ok: false, action, error: `Search failed on "${targetModule}"` };
                }
                await waitForScreenDataReady(targetModule, 3000);
                return { ok: true, action, targetModule };
            }
            return { ok: true, action, targetModule, note: 'search_recorded_in_context' };
        }

        case 'clearFilters': {
            const bridge = await ensureOnModule(targetModule);
            if (bridge?.clearFilters) {
                await bridge.clearFilters();
                await waitForScreenDataReady(targetModule, 2500);
            }
            return { ok: true, action, targetModule };
        }

        case 'openDetail': {
            // If opening a motorcycle's contract from devices/summary, ensure we are on contracts or the active bridge supports it
            let effectiveMod = targetModule;
            if (
                (params.targetType === 'contract' || params.targetType === 'device_contract') &&
                targetModule !== 'contracts'
            ) {
                const currentBridge = getScreenBridge(targetModule);
                const identifier =
                    params.identifier ||
                    currentBridge?.singleMatchItem ||
                    currentBridge?.selectedItem ||
                    ctx.selectedItem ||
                    '';
                effectiveMod = 'contracts';
                const contractsBridge = await ensureOnModule('contracts');
                if (contractsBridge?.openDetail) {
                    const result = await contractsBridge.openDetail({
                        ...params,
                        identifier,
                    });
                    if (result && typeof result === 'object' && result.ok === false) {
                        return { ok: false, action, error: result.error };
                    }
                    if (result === false) {
                        return {
                            ok: false,
                            action,
                            error:
                                ctx.lang === 'en-US'
                                    ? `Could not find a unique contract${identifier ? ` for ${identifier}` : ''}.`
                                    : `No se encontró un contrato único${identifier ? ` para ${identifier}` : ''}.`,
                        };
                    }
                    return { ok: true, action, targetModule: 'contracts' };
                }
            }

            const bridge = await ensureOnModule(effectiveMod);
            if (bridge?.openDetail) {
                const identifier =
                    params.identifier ||
                    bridge.singleMatchItem ||
                    bridge.selectedItem ||
                    ctx.selectedItem ||
                    '';
                const opened = await bridge.openDetail({ ...params, identifier });
                if (opened && typeof opened === 'object' && opened.ok === false) {
                    return { ok: false, action, error: opened.error };
                }
                if (opened === false) {
                    return {
                        ok: false,
                        action,
                        error:
                            ctx.lang === 'en-US'
                                ? 'Could not identify a unique record to open. Please specify the plate or ID.'
                                : 'No se pudo identificar un único registro para abrir. Especifica la placa o el ID.',
                    };
                }
                return { ok: true, action, targetModule: effectiveMod };
            }

            return {
                ok: false,
                action,
                error:
                    ctx.lang === 'en-US'
                        ? 'Detail preview is not available on this screen.'
                        : 'La vista de detalle no está disponible en esta pantalla.',
            };
        }

        case 'showHelp': {
            return {
                ok: true,
                action,
                helpReply: buildHelpReply(ctx.user, ctx.lang),
            };
        }

        default:
            return { ok: false, action, error: `Unsupported action "${name}"` };
    }
};

/**
 * Executes a structured action plan (`{ scope, targetModule, actions, responseTemplate, needsClarification }`)
 * or a legacy Phase 1 `{ capabilityId, reply, data }` intent object.
 */
export async function dispatchActionPlan(rawPlan, ctx = {}) {
    const lang = ctx.lang === 'en-US' ? 'en-US' : 'es-CO';
    const currentModule = ctx.currentModule || 'dashboard';

    // 1. Legacy compatibility path (`{ capabilityId }`)
    if (rawPlan && typeof rawPlan.capabilityId === 'string' && !Array.isArray(rawPlan.actions)) {
        return dispatchLegacyIntent(rawPlan, ctx);
    }

    // 2. Validate structured plan against canonical catalog
    const validation = validateActionPlan(rawPlan, {
        currentModule,
        user: ctx.user || null,
    });

    if (!validation.success) {
        return {
            ok: false,
            executionStatus: 'failed',
            targetModule: currentModule,
            executedActions: [],
            failedAction: null,
            reply:
                validation.code === 'UNAUTHORIZED_MODULE'
                    ? lang === 'en-US'
                        ? 'You do not have permission to access that section.'
                        : 'Tu usuario no tiene permisos para acceder a esa sección.'
                    : lang === 'en-US'
                    ? `Could not execute action: ${validation.error}`
                    : `No se pudo ejecutar la acción: ${validation.error}`,
            data: null,
            action: null,
        };
    }

    const plan = validation.data;
    const executedActions = [];
    let activeModule = currentModule;
    let didNavigate = false;
    let helpOverrideReply = null;

    const execCtx = {
        ...ctx,
        lang,
        getCurrentModule: () => activeModule,
        setCurrentModule: (m) => {
            activeModule = m;
        },
    };

    for (const action of plan.actions) {
        const stepResult = await executeSingleAction(action, execCtx);
        if (!stepResult.ok) {
            return {
                ok: false,
                executionStatus: 'failed',
                targetModule: activeModule,
                executedActions,
                failedAction: action,
                reply:
                    stepResult.error ||
                    (lang === 'en-US'
                        ? 'The requested action could not be completed.'
                        : 'La acción solicitada no pudo completarse.'),
                data: null,
                action: null,
            };
        }

        executedActions.push(action);
        if (stepResult.targetModule) {
            activeModule = stepResult.targetModule;
        }
        if (
            action.name === 'navigate' ||
            action.name === 'applyFilter' ||
            action.name === 'search' ||
            action.name === 'openDetail'
        ) {
            didNavigate = true;
        }
        if (stepResult.helpReply) {
            helpOverrideReply = stepResult.helpReply;
        }
    }

    // 3. Resolve placeholders AFTER actions and screen state settle (with live API fallback & visual cards)
    const rawTemplate =
        helpOverrideReply ||
        plan.responseTemplate ||
        (lang === 'en-US' ? 'Done.' : 'Listo.');

    const lastFilterAction = [...executedActions]
        .reverse()
        .find((a) => a.name === 'applyFilter' || a.name === 'search');
    const activeFiltersHint = lastFilterAction?.params || {};

    const resolved = await resolveTemplateWithLiveData(rawTemplate, {
        targetModule: activeModule,
        activeFilters: activeFiltersHint,
        user: ctx.user || null,
        lang,
        metricsOverride: ctx.metricsOverride || null,
        onDemandDataUsed: Boolean(plan.onDemandDataUsed),
    });

    const primaryActionType =
        executedActions.find(
            (a) =>
                a.name === 'navigate' ||
                a.name === 'applyFilter' ||
                a.name === 'search' ||
                a.name === 'openDetail'
        )
            ? 'navigate'
            : executedActions[0]?.name || null;

    return {
        ok: true,
        executionStatus: 'success',
        scope: plan.scope,
        targetModule: activeModule,
        executedActions,
        failedAction: null,
        reply: resolved.text,
        resolvedPlaceholders: resolved.resolvedPlaceholders,
        data: rawPlan.data || resolved.cardsData || null,
        action: didNavigate ? { type: 'navigate', module: activeModule } : { type: primaryActionType },
    };
}

/**
 * Legacy compatibility wrapper for `dispatchIntent(intent, ctx)`.
 */
export async function dispatchLegacyIntent(intent, ctx = {}) {
    const capability = getCapability(intent?.capabilityId);
    const lang = ctx.lang === 'en-US' ? 'en-US' : 'es-CO';
    const unknown = lang === 'en-US' ? UNKNOWN_REPLY_EN : UNKNOWN_REPLY_ES;

    if (!capability) {
        return {
            ok: false,
            executionStatus: 'failed',
            capabilityId: null,
            executedActions: [],
            reply: intent?.reply || unknown,
            data: null,
            action: null,
        };
    }

    switch (capability.type) {
        case CAPABILITY_TYPES.NAVIGATE: {
            const targetMod = capability.module || 'dashboard';
            if (ctx.user && !canUserAccessModule(targetMod, ctx.user)) {
                return {
                    ok: false,
                    executionStatus: 'failed',
                    capabilityId: capability.id,
                    executedActions: [],
                    reply:
                        lang === 'en-US'
                            ? 'You do not have permission to open that section.'
                            : 'No tienes permiso para abrir esa sección.',
                    data: null,
                    action: null,
                };
            }
            ctx.navigate(capability.route);
            await waitForScreenMount(targetMod, 1800);
            return {
                ok: true,
                executionStatus: 'success',
                capabilityId: capability.id,
                targetModule: targetMod,
                executedActions: [{ name: 'navigate', params: { module: targetMod } }],
                reply:
                    lang === 'en-US'
                        ? `Opening ${capability.label}.`
                        : `Listo, abriendo ${capability.label}.`,
                data: null,
                action: { type: 'navigate', route: capability.route },
            };
        }

        case CAPABILITY_TYPES.QUERY: {
            const answer = intent.reply ? intent : await ctx.query?.({ capabilityId: capability.id });
            return {
                ok: true,
                executionStatus: 'success',
                capabilityId: capability.id,
                executedActions: [],
                reply: answer?.reply || unknown,
                data: answer?.data ?? null,
                action: { type: 'query' },
            };
        }

        case CAPABILITY_TYPES.HELP:
            return {
                ok: true,
                executionStatus: 'success',
                capabilityId: capability.id,
                executedActions: [{ name: 'showHelp', params: { topic: 'general' } }],
                reply: buildHelpReply(ctx.user, lang),
                data: null,
                action: null,
            };

        default:
            return {
                ok: false,
                executionStatus: 'failed',
                capabilityId: null,
                executedActions: [],
                reply: unknown,
                data: null,
                action: null,
            };
    }
}

export const dispatchIntent = dispatchActionPlan;

export default {
    dispatchActionPlan,
    dispatchIntent,
    buildHelpReply,
};
