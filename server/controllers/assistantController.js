import assistantDemoService from '../services/assistantDemoService.js';

const MAX_TEXT_LENGTH = 500;

/**
 * POST /api/v1/assistant/query
 * Body: { text?: string, capabilityId?: string }
 * Read-only demo endpoint: answers from a fictional dataset.
 */
export const queryAssistant = (req, res) => {
    const { text, capabilityId } = req.body || {};

    const hasText = typeof text === 'string' && text.trim().length > 0;
    const hasCapability = typeof capabilityId === 'string' && capabilityId.trim().length > 0;

    if (!hasText && !hasCapability) {
        return res.status(400).json({ success: false, error: 'text or capabilityId is required' });
    }

    if (hasText && text.length > MAX_TEXT_LENGTH) {
        return res.status(400).json({ success: false, error: `text must be at most ${MAX_TEXT_LENGTH} characters` });
    }

    if (hasCapability && !assistantDemoService.SUPPORTED_CAPABILITIES.has(capabilityId)) {
        return res.status(400).json({ success: false, error: 'Unknown capabilityId' });
    }

    try {
        const result = assistantDemoService.resolveQuery({
            text: hasText ? text.trim() : undefined,
            capabilityId: hasCapability ? capabilityId : undefined,
        });
        return res.json({ success: true, data: result });
    } catch (error) {
        console.error('Assistant query error:', error);
        return res.status(500).json({ success: false, error: 'Assistant query failed' });
    }
};
