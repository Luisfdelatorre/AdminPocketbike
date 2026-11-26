export function formatCurrency(amount) {
    if (!amount) return '-';
    if (amount >= 1000) {
        return `$${(amount / 1000).toFixed(0)}k`;
    }
    return `$${amount}`;
}

export function getStatusIcon(status) {
    const icons = {
        UNPAID: '⏳',
        PENDING: '⏳',
        PAID: '✅',
        APPROVED: '✅',
        DECLINED: '❌',
        ERROR: '❌',
        FAILED: '❌',
    };
    return icons[status] || '❓';
}

/**
 * Format amount as Colombian Pesos with thousand separators.
 * Supports compact formatting (e.g., "$1.588M", "$350K") and optional " COP" suffix.
 * 
 * @param {number|string} amount 
 * @param {boolean|object} [withSuffixOrOptions=true] - Appends " COP" suffix if true, or options object { withSuffix, compact }
 * @param {boolean} [compact=false] - Formats number compactly if true
 */
export function formatCurrencyCOP(amount, withSuffixOrOptions = true, compact = false) {
    let withSuffix = true;
    let isCompact = false;

    if (typeof withSuffixOrOptions === 'object' && withSuffixOrOptions !== null) {
        withSuffix = withSuffixOrOptions.withSuffix !== false;
        isCompact = Boolean(withSuffixOrOptions.compact);
    } else {
        withSuffix = Boolean(withSuffixOrOptions);
        isCompact = Boolean(compact);
    }

    if (amount === null || amount === undefined || isNaN(amount)) {
        return withSuffix ? '$0 COP' : '$0';
    }

    const num = Number(amount) || 0;

    if (isCompact) {
        let compactStr;
        if (Math.abs(num) >= 1000000) {
            const millions = num / 1000000;
            const formatted = Math.abs(millions) >= 100
                ? Math.round(millions).toLocaleString('es-CO')
                : (Number.isInteger(millions) ? millions.toLocaleString('es-CO') : millions.toFixed(1).replace('.', ','));
            compactStr = `$${formatted}M`;
        } else if (Math.abs(num) >= 1000) {
            const thousands = Math.round(num / 1000);
            compactStr = `$${thousands.toLocaleString('es-CO')}K`;
        } else {
            compactStr = `$${Math.round(num).toLocaleString('es-CO')}`;
        }
        return withSuffix ? `${compactStr}` : compactStr;
    }

    const formatted = `$${(Math.round(num)).toLocaleString('es-CO')}`;
    return withSuffix ? `${formatted} COP` : formatted;
}

export function formatCompact(value) {
    return formatCurrencyCOP(value, false, true);
}

export function formatCompactCOP(value) {
    return formatCurrencyCOP(value, true, true);
}

/**
 * Format date input string or Date object into standard "YYYY-MM-DD" format.
 */
export function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        return dateStr;
    }
}


/**
 * Format last update date into relative offline duration string (e.g., "4h offline", "35m offline").
 * Uses 3 minutes threshold matching DEVICE_ONLINE_TIMEOUT.
 */
export function formatOfflineTime(lastUpdateDate) {
    if (!lastUpdateDate) return null;
    let lastMs = typeof lastUpdateDate === 'number' ? lastUpdateDate : new Date(lastUpdateDate).getTime();
    if (isNaN(lastMs)) {
        lastMs = new Date(String(lastUpdateDate).replace(' ', 'T')).getTime();
    }
    if (isNaN(lastMs)) return null;

    const diffMs = Date.now() - lastMs;
    if (diffMs < 3 * 60 * 1000) return null; // less than 3 minutes is considered online

    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    if (diffMinutes < 60) return `${diffMinutes}m offline`;

    const diffHours = Math.floor(diffMinutes / 60);
    const remMinutes = diffMinutes % 60;
    if (diffHours < 24) return `${diffHours}h ${remMinutes > 0 ? remMinutes + 'm ' : ''}offline`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d offline`;
}

/**
 * Format last update date into short offline duration string (e.g., "19h", "35m", "2d").
 * Uses 3 minutes threshold matching DEVICE_ONLINE_TIMEOUT.
 */
export function formatOfflineTimeShort(lastUpdateDate) {
    if (!lastUpdateDate) return null;
    let lastMs = typeof lastUpdateDate === 'number' ? lastUpdateDate : new Date(lastUpdateDate).getTime();
    if (isNaN(lastMs)) {
        lastMs = new Date(String(lastUpdateDate).replace(' ', 'T')).getTime();
    }
    if (isNaN(lastMs)) return null;

    const diffMs = Date.now() - lastMs;
    if (diffMs < 3 * 60 * 1000) return null; // less than 3 minutes is considered online

    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    if (diffMinutes < 60) return `${diffMinutes}m`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
}

/**
 * Export array of rows or CSV string to file and trigger browser download with UTF-8 BOM.
 * Uses Blob and URL.createObjectURL for secure, compliant browser downloading across HTTP/HTTPS.
 */
export function exportToCSV(filename, contentOrRows) {
    if (!contentOrRows) return;
    let csvString = '';
    if (Array.isArray(contentOrRows)) {
        csvString = contentOrRows.map(row =>
            row.map(cell => {
                if (cell === null || cell === undefined) return '""';
                let str = String(cell);
                // Neutralize spreadsheet formulas in text cells (CSV injection)
                if (typeof cell === 'string' && /^[=+\-@\t\r]/.test(str)) {
                    str = `'${str}`;
                }
                if (str.includes(',') || str.includes('\n') || str.includes('"')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            }).join(',')
        ).join('\n');
    } else {
        csvString = String(contentOrRows);
    }

    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 500);
}

/**
 * Format raw string input into standard 10-digit Colombian phone number representation (e.g., "300 756 0069").
 */
export function formatPhoneNumber(value) {
    if (!value) return '';
    const digits = String(value).replace(/\D/g, '').slice(0, 10);
    if (digits.length > 6) {
        return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
    if (digits.length > 3) {
        return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    }
    return digits;
}
