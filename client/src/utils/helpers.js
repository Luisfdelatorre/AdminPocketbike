export function formatCurrency(amountInCents) {
    return (amountInCents / 100).toLocaleString('es-CO', {
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
