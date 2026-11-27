/**
 * Builds the spoken variant of a reply that comes with data cards, for replies
 * that have no model-written `speechTemplate` (local matcher, deterministic plans).
 *
 * The chat keeps the full text ("Hay 3 motos apagadas: ABC123, DEF456, GHI789."),
 * while the voice drops the enumeration already visible in the cards and points
 * to the screen ("Hay 3 motos apagadas. Te dejé el detalle en pantalla.").
 *
 * Returns null when there is nothing to shorten, so callers keep the default speech.
 */
export const deriveSpeechFromCards = (reply = '', data = null, lang = 'es-CO') => {
    const text = String(reply || '').trim();
    const items = Array.isArray(data?.items) ? data.items : [];
    if (!text || items.length === 0) return null;

    const titles = items
        .map((item) => String(item?.title || '').trim())
        .filter((title) => title.length >= 2);
    if (titles.length === 0) return null;

    // Enumeration introduced by ":" that mentions at least one card title
    const colonIdx = text.lastIndexOf(':');
    if (colonIdx <= 0) return null;
    const head = text.slice(0, colonIdx).trim();
    const tail = text.slice(colonIdx + 1);
    if (!head || !titles.some((title) => tail.includes(title))) return null;

    const pointer = lang === 'en-US' ? 'I left the details on screen.' : 'Te dejé el detalle en pantalla.';
    return `${head.replace(/[.,;]+$/, '')}. ${pointer}`;
};

export default deriveSpeechFromCards;
