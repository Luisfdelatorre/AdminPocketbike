import { CAPABILITIES, CAPABILITY_TYPES, getCapability } from './capabilities';

const UNKNOWN_REPLY = 'No entendí la solicitud. Prueba con "recaudo de hoy", "motos apagadas" o "abre contratos".';

const buildHelpReply = () => {
    const queries = CAPABILITIES.filter((c) => c.type === CAPABILITY_TYPES.QUERY).map((c) => c.label.toLowerCase());
    return `Puedo consultar ${queries.join(', ')}, y llevarte a cualquier sección del panel. Esta es una demo con datos de ejemplo.`;
};

/**
 * Executes a resolved intent.
 *
 * @param {object} intent - { capabilityId, reply?, data? } (data/reply present when the server already answered)
 * @param {object} ctx - { navigate: (route) => void, query: ({ capabilityId }) => Promise<{ reply, data }> }
 * @returns {Promise<{ capabilityId: string|null, reply: string, data: object|null, action: object|null }>}
 */
export async function dispatchIntent(intent, ctx) {
    const capability = getCapability(intent?.capabilityId);

    if (!capability) {
        return { capabilityId: null, reply: intent?.reply || UNKNOWN_REPLY, data: null, action: null };
    }

    switch (capability.type) {
        case CAPABILITY_TYPES.NAVIGATE: {
            ctx.navigate(capability.route);
            return {
                capabilityId: capability.id,
                reply: `Listo, abriendo ${capability.label}.`,
                data: null,
                action: { type: 'navigate', route: capability.route },
            };
        }

        case CAPABILITY_TYPES.QUERY: {
            // Reuse the server answer when present; otherwise fetch by capability ID.
            const answer = intent.reply ? intent : await ctx.query({ capabilityId: capability.id });
            return {
                capabilityId: capability.id,
                reply: answer.reply || UNKNOWN_REPLY,
                data: answer.data ?? null,
                action: { type: 'query' },
            };
        }

        case CAPABILITY_TYPES.HELP:
            return { capabilityId: capability.id, reply: buildHelpReply(), data: null, action: null };

        default:
            return { capabilityId: null, reply: UNKNOWN_REPLY, data: null, action: null };
    }
}
