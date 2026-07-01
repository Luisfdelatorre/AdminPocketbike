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
