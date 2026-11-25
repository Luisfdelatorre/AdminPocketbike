/**
 * Dedicated Speech Normalization Layer for Colombian Pesos (COP) — Phase 9
 *
 * Converts Colombian peso currency expressions (e.g., `$703.000`, `$2.216.000`,
 * `$1`, `$1.500,50`, `$35.000 COP`) into natural spoken Colombian Spanish
 * (`setecientos tres mil pesos`, `dos millones doscientos dieciséis mil pesos`,
 * `un peso`, `mil quinientos pesos con cincuenta centavos`) BEFORE browser
 * `speechSynthesis` or neural TTS, while preserving the original numeric display
 * (`$703.000`) in React.
 *
 * Guarantees:
 *  - Never pronounces COP values as US dollars.
 *  - Supports singular ("un peso"), thousands, millions, billions, decimals & centavos.
 *  - Never corrupts license plates (DRS30I, DMO-101), dates (19/11/2026),
 *    percentages (85%), or non-currency identifiers.
 */

const UNITS_ES = [
    '',
    'uno',
    'dos',
    'tres',
    'cuatro',
    'cinco',
    'seis',
    'siete',
    'ocho',
    'nueve',
];

const TEENS_ES = [
    'diez',
    'once',
    'doce',
    'trece',
    'catorce',
    'quince',
    'dieciséis',
    'diecisiete',
    'dieciocho',
    'diecinueve',
];

const TWENTIES_ES = [
    'veinte',
    'veintiuno',
    'veintidós',
    'veintitrés',
    'veinticuatro',
    'veinticinco',
    'veintiséis',
    'veintisiete',
    'veintiocho',
    'veintinueve',
];

const TENS_ES = [
    '',
    'diez',
    'veinte',
    'treinta',
    'cuarenta',
    'cincuenta',
    'sesenta',
    'setenta',
    'ochenta',
    'noventa',
];

const HUNDREDS_ES = [
    '',
    'ciento',
    'doscientos',
    'trescientos',
    'cuatrocientos',
    'quinientos',
    'seiscientos',
    'setecientos',
    'ochocientos',
    'novecientos',
];

const underHundredToSpanish = (n, apocopateOne = false) => {
    if (n === 0) return '';
    if (n === 1) return apocopateOne ? 'un' : 'uno';
    if (n < 10) return UNITS_ES[n];
    if (n < 20) return TEENS_ES[n - 10];
    if (n < 30) {
        if (n === 21 && apocopateOne) return 'veintiún';
        return TWENTIES_ES[n - 20];
    }
    const tens = Math.floor(n / 10);
    const unit = n % 10;
    if (unit === 0) return TENS_ES[tens];
    const unitWord = unit === 1 && apocopateOne ? 'un' : UNITS_ES[unit];
    return `${TENS_ES[tens]} y ${unitWord}`;
};

const underThousandToSpanish = (n, apocopateOne = false) => {
    if (n === 0) return '';
    if (n === 100) return 'cien';
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    const hWord = HUNDREDS_ES[hundreds];
    const rWord = underHundredToSpanish(rest, apocopateOne);
    if (!hWord) return rWord;
    if (!rWord) return hWord;
    return `${hWord} ${rWord}`;
};

/**
 * Converts a non-negative integer into natural Spanish words (`es-CO`).
 * @param {number} num
 * @param {{ apocopateOne?: boolean }} options
 */
export const numberToSpanishWords = (num, { apocopateOne = false } = {}) => {
    const n = Math.floor(Math.abs(Number(num) || 0));
    if (n === 0) return 'cero';
    if (n < 1000) return underThousandToSpanish(n, apocopateOne);

    const parts = [];
    const billions = Math.floor(n / 1_000_000_000);
    const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
    const thousands = Math.floor((n % 1_000_000) / 1_000);
    const remainder = n % 1_000;

    if (billions > 0) {
        if (billions === 1) {
            parts.push('mil millones');
        } else {
            parts.push(`${underThousandToSpanish(billions, true)} mil millones`);
        }
    }

    if (millions > 0) {
        if (millions === 1) {
            parts.push('un millón');
        } else {
            parts.push(`${underThousandToSpanish(millions, true)} millones`);
        }
    }

    if (thousands > 0) {
        if (thousands === 1) {
            parts.push('mil');
        } else {
            parts.push(`${underThousandToSpanish(thousands, true)} mil`);
        }
    }

    if (remainder > 0) {
        parts.push(underThousandToSpanish(remainder, apocopateOne));
    }

    return parts.join(' ').trim();
};

/**
 * Parses a Colombian peso numeric string (e.g. "703.000", "2.216.000", "1.500,50", "1500.50")
 * into `{ integerPart: number, centavos: number }`.
 */
export const parseCOPAmountString = (rawNum = '') => {
    const trimmed = String(rawNum || '').trim();
    if (!trimmed) return null;

    let intStr = trimmed;
    let decStr = '';

    // Colombian locale: "." for thousands, "," for decimals (e.g. "1.500,50" or "35,50")
    if (trimmed.includes(',')) {
        const commaParts = trimmed.split(',');
        if (commaParts.length === 2 && /^\d{1,2}$/.test(commaParts[1])) {
            intStr = commaParts[0].replace(/\./g, '');
            decStr = commaParts[1];
        } else {
            // Comma used as thousands separator (e.g. "703,000")
            intStr = trimmed.replace(/,/g, '');
        }
    } else if (/^\d+\.\d{1,2}$/.test(trimmed)) {
        // Unambiguous dot-decimal (e.g. "1500.50" or "12.5") — NOT 3-digit Colombian thousands
        const [iPart, dPart] = trimmed.split('.');
        intStr = iPart;
        decStr = dPart;
    } else {
        // Colombian dot-thousands (e.g. "703.000", "2.216.000", "35.000")
        intStr = trimmed.replace(/\./g, '');
    }

    if (!/^\d+$/.test(intStr)) return null;
    const integerPart = Number(intStr);
    if (!Number.isSafeInteger(integerPart)) return null;

    let centavos = 0;
    if (decStr) {
        centavos = Number(decStr.length === 1 ? `${decStr}0` : decStr.slice(0, 2));
    }

    return { integerPart, centavos };
};

/**
 * Formats a parsed COP amount into spoken Colombian Spanish.
 */
export const formatCOPAmountForSpeech = (integerPart, centavos = 0, { lang = 'es-CO' } = {}) => {
    if (lang === 'en-US') {
        const base =
            integerPart === 1
                ? '1 Colombian peso'
                : `${integerPart.toLocaleString('en-US')} Colombian pesos`;
        if (centavos > 0) {
            return `${base} and ${centavos} ${centavos === 1 ? 'centavo' : 'centavos'}`;
        }
        return base;
    }

    const intWords = numberToSpanishWords(integerPart, { apocopateOne: true });
    let unit = 'pesos';
    if (integerPart === 1) {
        unit = 'peso';
    } else if (integerPart >= 1_000_000 && integerPart % 1_000_000 === 0) {
        unit = 'de pesos';
    }

    const mainPhrase = `${intWords} ${unit}`;
    if (centavos > 0) {
        const centWords = numberToSpanishWords(centavos, { apocopateOne: true });
        const centUnit = centavos === 1 ? 'centavo' : 'centavos';
        return `${mainPhrase} con ${centWords} ${centUnit}`;
    }

    return mainPhrase;
};

// Matches explicit COP currency patterns:
//  - "$703.000", "$ 2.216.000", "COP $35.000", "COP 35.000", "$1.500,50 COP", "$35.000 pesos"
//  - "703.000 COP" (explicit COP suffix)
// Deliberately avoids USD ("US$10", "$10 USD"), dates, plates, and percentages.
const COP_SYMBOL_PATTERN =
    /(?<![A-Za-z0-9])(?:COP\s*)?\$\s?(\d{1,3}(?:[.,]\d{3})+|\d+)(?:,(\d{1,2})|\.(\d{1,2})(?!\d))?(?:\s*(?:COP|pesos(?:\s+colombianos)?))?(?!\s*(?:USD|US\$|dólares|dolares))(?![A-Za-z0-9%])/gi;

const COP_EXPLICIT_CODE_PATTERN =
    /(?<![A-Za-z0-9$])(?:COP\s+(\d{1,3}(?:[.,]\d{3})+|\d+(?:,\d{1,2})?)|(\d{1,3}(?:[.,]\d{3})+|\d+(?:,\d{1,2})?)\s*COP)(?![A-Za-z0-9%])/gi;

/**
 * Normalizes Colombian Peso (COP) amounts in text for natural speech synthesis.
 * Preserves dates, plates, percentages, and non-currency numbers intact.
 */
export const normalizeCOPForSpeech = (text = '', { lang = 'es-CO' } = {}) => {
    let output = String(text || '');
    if (!output) return '';

    // 1. Normalize `$...` (and optional leading/trailing COP / pesos)
    output = output.replace(COP_SYMBOL_PATTERN, (fullMatch, numPart, commaDec, dotDec) => {
        // Reconstruct raw number string preserving decimal part if matched
        let raw = numPart;
        if (commaDec !== undefined) raw = `${numPart},${commaDec}`;
        else if (dotDec !== undefined) raw = `${numPart}.${dotDec}`;

        const parsed = parseCOPAmountString(raw);
        if (!parsed) return fullMatch;
        return formatCOPAmountForSpeech(parsed.integerPart, parsed.centavos, { lang });
    });

    // 2. Normalize explicit `COP 35.000` or `35.000 COP` without `$`
    output = output.replace(COP_EXPLICIT_CODE_PATTERN, (fullMatch, beforeNum, afterNum) => {
        const raw = beforeNum || afterNum;
        const parsed = parseCOPAmountString(raw);
        if (!parsed) return fullMatch;
        return formatCOPAmountForSpeech(parsed.integerPart, parsed.centavos, { lang });
    });

    return output;
};

export default {
    numberToSpanishWords,
    parseCOPAmountString,
    formatCOPAmountForSpeech,
    normalizeCOPForSpeech,
};
