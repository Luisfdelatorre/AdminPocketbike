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

export function formatCompact(value) {
    if (value === null || value === undefined || isNaN(value)) return '$0';
    const num = Number(value);
    if (num === 0) return '$0';
    if (Math.abs(num) >= 1000000) {
        const millions = num / 1000000;
        return `$${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
    }
    if (Math.abs(num) >= 1000) {
        const thousands = num / 1000;
        return `$${Number.isInteger(thousands) ? thousands : Math.round(thousands)}k`;
    }
    return `$${num.toLocaleString('es-CO')}`;
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
                const str = String(cell);
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
