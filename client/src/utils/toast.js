// Modern iOS-style Toast Notification System with Swipe-Up to Dismiss
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

    container.style.zIndex = '999999';

    const toast = document.createElement('div');
    toast.className = `toast-ios toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');

    const svgIcons = {
        success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
        error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF9500" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    };

    toast.innerHTML = `
        <div class="toast-icon-wrap">${svgIcons[type] || svgIcons.info}</div>
        <div class="toast-content">
            ${title ? `<span class="toast-title">${title}</span>` : ''}
            ${title && message ? `<span class="toast-sep">•</span>` : ''}
            ${message ? `<span class="toast-message">${message}</span>` : ''}
        </div>
        <button type="button" class="toast-action-btn" aria-label="Cerrar notificación" title="Cerrar">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
    `;

    // Global synthetic ghost-click shield to prevent touch/click events from bleeding through to underlying elements
    const shieldGhostClicks = (durationMs = 400) => {
        const blockClick = (ev) => {
            ev.stopPropagation();
            ev.preventDefault();
        };
        window.addEventListener('click', blockClick, true);
        window.addEventListener('touchend', blockClick, true);
        setTimeout(() => {
            window.removeEventListener('click', blockClick, true);
            window.removeEventListener('touchend', blockClick, true);
        }, durationMs);
    };

    // Prevent any direct click/pointer/touch events on the toast from propagating to background elements
    const stopPropagation = (e) => {
        e.stopPropagation();
    };
    toast.addEventListener('click', stopPropagation);
    toast.addEventListener('mousedown', stopPropagation);
    toast.addEventListener('mouseup', stopPropagation);
    toast.addEventListener('touchstart', stopPropagation, { passive: true });
    toast.addEventListener('touchend', stopPropagation, { passive: true });

    // Interactive Swipe-Up to Dismiss
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    let autoDismissTimer = null;

    const dismiss = () => {
        if (autoDismissTimer) clearTimeout(autoDismissTimer);
        shieldGhostClicks(450);
        toast.style.pointerEvents = 'none';
        toast.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease';
        toast.style.transform = 'translateY(-140%) scale(0.92)';
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 250);
    };

    autoDismissTimer = setTimeout(dismiss, 4500);

    const closeBtn = toast.querySelector('.toast-action-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            dismiss();
        });
    }

    toast.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        isDragging = true;
        startY = e.clientY;
        currentY = e.clientY;
        try { toast.setPointerCapture(e.pointerId); } catch (_) {}
        toast.style.transition = 'none';
        if (autoDismissTimer) clearTimeout(autoDismissTimer);
    });

    toast.addEventListener('pointermove', (e) => {
        e.stopPropagation();
        if (!isDragging) return;
        currentY = e.clientY;
        const deltaY = currentY - startY;
        if (deltaY < 0) {
            // Dragging upwards
            toast.style.transform = `translateY(${deltaY}px)`;
            toast.style.opacity = `${Math.max(0.15, 1 + deltaY / 110)}`;
        } else {
            // Rubber band resistance when dragging down
            toast.style.transform = `translateY(${deltaY * 0.22}px)`;
        }
    });

    const onPointerEnd = (e) => {
        if (!isDragging) return;
        e.stopPropagation();
        isDragging = false;
        try { toast.releasePointerCapture(e.pointerId); } catch (_) {}
        const deltaY = currentY - startY;
        if (deltaY < -20) {
            dismiss();
        } else {
            toast.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease';
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
            autoDismissTimer = setTimeout(dismiss, 3500);
        }
    };

    toast.addEventListener('pointerup', onPointerEnd);
    toast.addEventListener('pointercancel', onPointerEnd);

    container.appendChild(toast);
}
export default showToast;
