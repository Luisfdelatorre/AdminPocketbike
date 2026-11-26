/**
 * Dual reply (chat text + spoken text) for the AI assistant.
 * Run via: `node --test server/tests/assistantDualReply.test.js`
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    isSpeechConsistentWithDisplay,
    reconcileSpeechTemplate,
    applyPlanOverride,
} from '../services/assistantSpeechTemplate.js';
import { validateActionPlan } from '../../client/src/services/voiceAssistant/schemaValidator.js';
import {
    streamAssistantTurn,
    ResponseTemplateJsonExtractor,
} from '../services/aiAssistantStreamService.js';

describe('Dual reply: speech reconciliation', () => {
    it('accepts speech whose figures and placeholders also appear in the chat text', () => {
        assert.equal(
            isSpeechConsistentWithDisplay(
                '¡Listo! Llevamos {{invoices.totalAmount}} este mes.',
                'Este mes se han recaudado {{invoices.totalAmount}} y quedan {{invoices.unpaidCount}} pendientes.'
            ),
            true
        );
        assert.equal(
            isSpeechConsistentWithDisplay('Mira, son 7 motos en mora.', 'Hay 7 motos en deuda por $1.395.000.'),
            true
        );
        assert.equal(
            isSpeechConsistentWithDisplay('Van $1.395.000 en mora.', 'Hay 7 motos que deben $1.395.000.'),
            true
        );
    });

    it('rejects speech with figures or placeholders missing from the chat text', () => {
        assert.equal(isSpeechConsistentWithDisplay('Son 9 motos.', 'Hay 7 motos en deuda.'), false);
        assert.equal(
            isSpeechConsistentWithDisplay('Van {{summary.debtTotal}}.', 'Hay {{summary.debtorsCount}} motos en mora.'),
            false
        );
    });

    it('humanizes valid speech, and drops empty or inconsistent speech', () => {
        const base = { responseTemplate: 'Hay 7 motos en deuda.', actions: [] };
        assert.deepEqual(
            reconcileSpeechTemplate({ ...base, speechTemplate: '  **Uy**, son 7 motos.  ' }, {
                humanize: (t) => t.replace(/\*\*/g, ''),
            }).speechTemplate,
            'Uy, son 7 motos.'
        );
        assert.equal('speechTemplate' in reconcileSpeechTemplate({ ...base, speechTemplate: '   ' }), false);
        assert.equal('speechTemplate' in reconcileSpeechTemplate({ ...base, speechTemplate: 'Son 8.' }), false);
    });

    it('discards speech when a guardrail override rewrites the chat text', () => {
        const plan = { responseTemplate: 'Hay 7 motos.', speechTemplate: 'Son 7 motos.' };
        const rewritten = applyPlanOverride(plan, { ...plan, responseTemplate: 'No pude consultar.' });
        assert.equal('speechTemplate' in rewritten, false);
        const kept = applyPlanOverride(plan, { ...plan, actions: [] });
        assert.equal(kept.speechTemplate, 'Son 7 motos.');
    });

    it('keeps speechTemplate through plan validation and omits it when empty', () => {
        const plan = {
            scope: 'current_screen',
            targetModule: 'dashboard',
            actions: [],
            speechTemplate: '¡Claro! Te cuento.',
            responseTemplate: 'Aquí está el resumen.',
            needsClarification: false,
        };
        const ok = validateActionPlan(plan, { currentModule: 'dashboard', user: { role: 'admin' } });
        assert.equal(ok.success, true);
        assert.equal(ok.data.speechTemplate, '¡Claro! Te cuento.');
        const empty = validateActionPlan({ ...plan, speechTemplate: '' }, {
            currentModule: 'dashboard',
            user: { role: 'admin' },
        });
        assert.equal('speechTemplate' in empty.data, false);
    });

    it('extracts any template field incrementally from streamed JSON', () => {
        const json = JSON.stringify({ actions: [], speechTemplate: 'Hola, ¿qué tal?', responseTemplate: 'Texto' });
        const speech = new ResponseTemplateJsonExtractor('speechTemplate');
        const display = new ResponseTemplateJsonExtractor();
        for (let i = 0; i < json.length; i += 5) {
            speech.feed(json.slice(i, i + 5));
            display.feed(json.slice(i, i + 5));
        }
        assert.equal(speech.extractedTemplate, 'Hola, ¿qué tal?');
        assert.equal(speech.templateDone, true);
        assert.equal(display.extractedTemplate, 'Texto');
    });
});

const buildMockOpenAi = (finalPlan) => ({
    responses: {
        create: async (params) => {
            if (!params.previous_response_id) {
                return (async function* () {
                    yield { type: 'response.created', response: { id: 'resp_r1' } };
                    yield {
                        type: 'response.output_item.added',
                        item: { id: 'fc_1', call_id: 'call_1', type: 'function_call', name: 'fetch_module_records', arguments: '' },
                    };
                    yield {
                        type: 'response.function_call_arguments.done',
                        item_id: 'fc_1',
                        name: 'fetch_module_records',
                        arguments: '{"module":"payments","status":"failed"}',
                    };
                    yield {
                        type: 'response.completed',
                        response: { id: 'resp_r1', usage: { input_tokens: 3100, output_tokens: 28 }, output: [] },
                    };
                })();
            }
            const finalJson = JSON.stringify(finalPlan);
            return (async function* () {
                yield { type: 'response.created', response: { id: 'resp_r2' } };
                for (let i = 0; i < finalJson.length; i += 11) {
                    yield { type: 'response.output_text.delta', delta: finalJson.slice(i, i + 11) };
                }
                yield {
                    type: 'response.completed',
                    response: { id: 'resp_r2', output_text: finalJson, usage: { input_tokens: 3450, output_tokens: 60 } },
                };
            })();
        },
    },
});

const runStreamTurn = async (finalPlan) => {
    const emitted = [];
    const synthesized = [];
    await streamAssistantTurn({
        turnId: `turn_dual_${Math.random().toString(36).slice(2)}`,
        text: '¿Cuántos pagos rechazados hay y cuánto suman?',
        lang: 'es-CO',
        applicationContext: { currentRoute: '/payments', currentModule: 'payments', activeFilters: { status: 'failed' } },
        ttsOptions: { enabled: true, neural: true },
        user: { role: 'admin', companyId: 'comp_dual' },
        openaiClient: buildMockOpenAi(finalPlan),
        toolExecutor: async () => ({
            module: 'payments',
            authorized: true,
            totalMatching: 2,
            totalAmountFormatted: '$ 450.000',
            scopeMetadata: { isCompleteCount: true, isCompleteTotal: true },
            records: [{ plate: 'PMQ44I', status: 'DECLINED', amount: '$ 225.000' }],
        }),
        ttsSynthesizer: async ({ text, onChunk }) => {
            synthesized.push(text);
            onChunk({ chunkIndex: 0, isFinalChunk: true, mimeType: 'audio/mpeg', audioBase64: 'AA==' });
        },
        emitEvent: (type, payload) => emitted.push({ type, payload }),
    });
    const shownText = emitted
        .filter((e) => e.type === 'text_delta')
        .map((e) => e.payload.delta)
        .join('');
    const completed = emitted.find((e) => e.type === 'turn_completed')?.payload;
    return { synthesized, shownText, completed };
};

describe('Dual reply: streaming turn', () => {
    it('shows the chat text and speaks the friendly spoken text', async () => {
        const display = 'Hay 2 pagos rechazados este mes por $450.000, el más alto es de PMQ44I.';
        const speech = 'Uy, mira, hay un par de pagos rechazados. Te dejé el detalle en pantalla.';
        const { synthesized, shownText, completed } = await runStreamTurn({
            scope: 'conversation_context',
            targetModule: 'payments',
            actions: [],
            speechTemplate: speech,
            responseTemplate: display,
            needsClarification: false,
        });

        assert.equal(shownText, display);
        assert.ok(synthesized.length > 0, 'neural TTS must run');
        const spoken = synthesized.join(' ');
        assert.match(spoken, /par de pagos rechazados/);
        assert.equal(/PMQ44I|450/.test(spoken), false, 'chat-only details must not be spoken');
        assert.equal(completed.plan.speechTemplate, speech);
    });

    it('falls back to speaking the chat text when the spoken text invents a figure', async () => {
        const display = 'Hay 2 pagos rechazados este mes por $450.000.';
        const { synthesized, completed } = await runStreamTurn({
            scope: 'conversation_context',
            targetModule: 'payments',
            actions: [],
            speechTemplate: 'Hay 5 pagos rechazados.',
            responseTemplate: display,
            needsClarification: false,
        });

        assert.equal('speechTemplate' in completed.plan, false);
        assert.match(synthesized.join(' '), /pagos rechazados este mes/);
        assert.equal(/\b5\b/.test(synthesized.join(' ')), false);
    });
});

describe('Dual reply: spoken amounts', async () => {
    const { roundCOPForSpeech, normalizeCOPForSpeech } = await import(
        '../../client/src/services/voiceAssistant/speechNormalization.js'
    );
    const { prepareSpokenResponse } = await import('../../client/src/services/voiceAssistant/tts.js');

    it('rounds COP amounts the way people say them', () => {
        assert.equal(roundCOPForSpeech(67_859_000), 68_000_000);
        assert.equal(roundCOPForSpeech(3_245_000), 3_200_000);
        assert.equal(roundCOPForSpeech(452_300), 450_000);
        assert.equal(roundCOPForSpeech(35_400), 35_000);
        assert.equal(roundCOPForSpeech(950), 950);
    });

    it('speaks approximate amounts only when asked, keeping exact ones otherwise', () => {
        assert.equal(
            normalizeCOPForSpeech('Ya vamos en $ 67.859.000.', { approximate: true }),
            'Ya vamos en casi sesenta y ocho millones de pesos.'
        );
        assert.equal(
            normalizeCOPForSpeech('Son $ 3.245.000.', { approximate: true }),
            'Son unos tres millones doscientos mil pesos.'
        );
        assert.equal(
            normalizeCOPForSpeech('Son $ 450.000.', { approximate: true }),
            'Son cuatrocientos cincuenta mil pesos.'
        );
        assert.match(normalizeCOPForSpeech('Son $ 67.859.000.'), /ochocientos cincuenta y nueve mil/);
        assert.match(
            prepareSpokenResponse('¡Bien! Ya vamos en $ 67.859.000.', { approximateAmounts: true }),
            /casi sesenta y ocho millones de pesos/
        );
    });
});
