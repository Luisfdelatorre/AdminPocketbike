export function showToast(typeOrMsg, titleOrType, maybeMessage) {
    let type = 'info';
    let title = '';
    let message = '';

    const validTypes = ['success', 'error', 'warning', 'info'];

    if (validTypes.includes(typeOrMsg)) {
        type = typeOrMsg;
        title = titleOrType || '';
        message = maybeMessage || '';
    } else if (validTypes.includes(titleOrType)) {
        type = titleOrType;
        title = type.charAt(0).toUpperCase() + type.slice(1);
        message = typeOrMsg || '';
    } else {
        type = 'info';
        title = typeOrMsg || '';
        message = titleOrType || '';
    }

    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // Ensure it always sits above all modals (modals use z-index 10000)
    container.style.zIndex = '99999';

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️',
    };

    toast.innerHTML = `
    <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
    <div class="toast-content">
      ${title ? `<div class="toast-title">${title}</div>` : ''}
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
  `;

    container.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

