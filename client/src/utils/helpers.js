export function formatCurrency(amountInCents) {
    const amount = amountInCents;
    if (amount >= 1000) {
        // Show in thousands with K suffix
        return `${(amount / 1000).toFixed(0)}K`;
    }
    return amount.toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
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
 * Export array of rows or CSV string to file and trigger browser download with UTF-8 BOM.
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

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + csvString;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
