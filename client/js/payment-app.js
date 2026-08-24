import { login, getPaymentStatus, getInvoiceHistory, createNequiPayment, requestFreeDay, requestLoan, createPaymentStream, getDeviceStatus, getAdjustmentTypes } from './api.js';
import messagesService from './messages-service.js';
import { Templates } from './templates.js';



// ============================================================================
// Constants & Configuration
// ============================================================================
let CONFIG = {
    TIMEZONE: 'America/Bogota',
    MAX_TIMEOUT: 15 * 60 * 1000, // 15 minutos
    PIN_LENGTH: 4,
    PHONE_LENGTH: 10,
    PROGRESS_WARNING: 75,
    PROGRESS_CRITICAL: 90,
    DRAG_THRESHOLD: 100,
    TRANSITION_DURATION: 500
};

// Dynamic status class mapping loaded dynamically from DB API (/apinode/invoices/history)
let STATUS_CLASS_MAP = {};

// ============================================================================
// State Management
// ============================================================================
const STATE = {
    authToken: null,
    paymentData: null,
    currentPin: '',
    fromLogin: false,
    eventSource: null,
    historyMonth: null,   // null = current month
    historyYear: null,    // null = current year
    urlDeviceId: null
};

// ============================================================================
// DOM Manager - Handles all DOM element references
// ============================================================================
class DOMManager {
    constructor() {
        this.elements = {};
        this.isInitialized = false;
    }

    initialize() {
        if (this.isInitialized) return;

        // Lazy load templates
        this.loadTemplates();

        this.elements.screens = {
            login: document.getElementById('loginScreen'),
            loading: document.getElementById('loadingScreen'),
            payment: document.getElementById('paymentScreen'),
            success: document.getElementById('successScreen')
        };

        this.elements.inputs = {
            deviceId: document.getElementById('deviceId'),
            pin: document.getElementById('devicePin'),
            phone: document.getElementById('phoneNumber')
        };

        this.elements.buttons = {
            nequiPay: document.getElementById('nequiPayBtn'),
            freeDay: document.getElementById('useFreeDayBtn'),
            loan: document.getElementById('loanBtn'),
            logout: document.getElementById('logoutBtn'),
            morePayment: document.getElementById('morePaymentOptions'),
            confirm: document.getElementById('confirmPaymentBtn'),
            cancel: document.getElementById('cancelPaymentBtn'),
            done: document.getElementById('doneBtn')
        };

        this.elements.displays = {
            deviceId: document.getElementById('deviceIdDisplay'),
            device: document.getElementById('deviceDisplay'),
            paymentAmount: document.getElementById('paymentAmount'),
            paymentDueDate: document.getElementById('paymentDueDate'),
            freeDaysCount: document.getElementById('freeDaysCount'),
            loginError: document.getElementById('loginError'),
            cuotasPagadas: document.getElementById('cuotasPagadas'),
            totalCuotas: document.getElementById('totalCuotas')
        };

        this.elements.loading = {
            message: document.getElementById('loadingMessage'),
            amount: document.getElementById('loadingAmount'),
            statusLabel: document.getElementById('paymentStatusLabelLoading'),
            progressBar: document.querySelector('#loadingScreen .progress-bar-animated'),
            nequiGuide: document.getElementById('nequiGuide'),
            qrGuide: document.getElementById('qrGuide'),
            qrImageDisplay: document.getElementById('qrImageDisplay')
        };

        this.elements.pendingPayment = {
            container: document.getElementById('pendingPaymentReminder'),
            reference: document.getElementById('pendingPaymentRef'),
            amount: document.getElementById('pendingPaymentAmount'),
            time: document.getElementById('pendingPaymentTime'),
            statusLabel: document.getElementById('paymentStatusLabelReminder'),
            progressBar: document.getElementById('pendingPaymentReminder')?.querySelector('.progress-bar-animated'),
            normal: document.getElementById('normalReminder')
        };

        this.elements.sections = {
            moreOptions: document.getElementById('moreOptionsSection'),
            payment: document.getElementById('paymentSection')
        };

        this.elements.tables = {
            historyBody: document.getElementById('historyTableBody')
        };

        this.elements.modal = {
            confirmation: document.getElementById('confirmationModal'),
            text: document.querySelector('#confirmationModal p'),
            close: document.querySelector('.close-modal')
        };

        this.elements.keypad = {
            buttons: document.querySelectorAll('.keypad-btn:not(.empty)'),
            pinBoxes: document.querySelectorAll('.pin-box'),
            clear: document.getElementById('keypadClear'),
            backspace: document.getElementById('keypadBackspace'),
            logo: document.querySelector('.device-header img')
        };

        this.elements.success = {
            deviceId: document.getElementById('successDeviceId'),
            reference: document.getElementById('successReference'),
            date: document.getElementById('paymentDate'),
            amount: document.getElementById('successAmount'),
            invoice: document.getElementById('successInvoice')
        };

        // Setup initial plate from SSR
        const deviceIdInput = this.elements.inputs.deviceId;
        const initialValue = deviceIdInput ? deviceIdInput.value : '';
        if (initialValue && !initialValue.includes('{{') && !initialValue.includes('DEVICE_ID')) {
            STATE.urlDeviceId = initialValue;
        } else {
            STATE.urlDeviceId = null;
            // Ensure input is visible if no SSR plate was provided
            if (deviceIdInput) {
                deviceIdInput.disabled = false;
                deviceIdInput.classList.remove('hidden');
                deviceIdInput.style.display = 'block';
            }
        }

        this.isInitialized = true;
    }

    loadTemplates() {
        console.log('Loading templates...');
        // Confirmation Modal -> Append to Body
        if (!document.getElementById('confirmationModal')) {
            document.body.insertAdjacentHTML('beforeend', Templates.confirmationModal);
        }

        // Read the server-side rendered company branding from the DOM
        const loginLogo = document.getElementById('loginLogo');
        const loginTitle = document.getElementById('loginTitle');
        const logoUrl = loginLogo ? loginLogo.getAttribute('src') : '/pocketbike_60x60.jpg';
        const displayName = loginTitle ? loginTitle.textContent.replace('Pago a ', '') : 'PocketBike';

        // Loading Screen -> Append to Body (Lazy loaded)
        if (!document.getElementById('loadingScreen')) {
            const loadingHtml = Templates.loadingScreen
                .replace(/{{COMPANY_LOGO}}/g, logoUrl)
                .replace(/{{COMPANY_NAME}}/g, displayName);
            document.body.insertAdjacentHTML('beforeend', loadingHtml);
        }

        // Success Screen -> Append to Body (Lazy loaded)
        if (!document.getElementById('successScreen')) {
            const successHtml = Templates.successScreen
                .replace(/{{COMPANY_LOGO}}/g, logoUrl)
                .replace(/{{COMPANY_NAME}}/g, displayName)
                .replace(/{{COMPANY_NAME_UPPER}}/g, displayName.toUpperCase());
            document.body.insertAdjacentHTML('beforeend', successHtml);
        }

        // Components needing insertion into specific locations
        const paymentSection = document.getElementById('paymentSection');
        if (paymentSection) {
            // Pending Payment Reminder -> Insert after 'more-options' (or specifically before/after logic)
            // Based on ORIGINAL HTML: It was after <div class="important-reminder" id="normalReminder">
            if (!document.getElementById('pendingPaymentReminder')) {
                const normalReminder = document.getElementById('normalReminder');
                if (normalReminder) {
                    normalReminder.insertAdjacentHTML('afterend', Templates.pendingPaymentReminder);
                }
            }

            // More Options Section -> Insert at the end of paymentSection (before WompiSafe/Logout if they are outside, but they are inside .container)
            // ORIGINAL: <div id="moreOptionsSection"> was after <div class="important-reminder hidden" id="pendingPaymentReminder">
            if (!document.getElementById('moreOptionsSection')) {
                // Insert after pendingPaymentReminder (which we just added or already exists)
                const pendingReminder = document.getElementById('pendingPaymentReminder');
                if (pendingReminder) {
                    pendingReminder.insertAdjacentHTML('afterend', Templates.moreOptionsSection);
                }
            }
        }
    }

    get(path) {
        const parts = path.split('.');
        let value = this.elements;
        for (const part of parts) {
            value = value?.[part];
        }
        return value;
    }
}

// ============================================================================
// UI Utilities
// ============================================================================
class UIUtils {
    static showToast(message, type = 'error') {
        const existing = document.querySelector('.toast-notification');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        toast.offsetHeight;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    static showError(message) {
        this.showToast(message, 'error');
    }

    static formatMoney(amount) {
        if (!amount) return '0';
        return new Intl.NumberFormat('es-CO', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    }

    static formatPhone(phone) {
        if (!phone) return '';
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
    }

    static formatDate(dateString) {
        if (!dateString) return '---';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '---';

        const parts = new Intl.DateTimeFormat('es-CO', {
            timeZone: 'UTC',
            day: 'numeric',
            month: 'numeric'
        }).formatToParts(date);

        const day = parts.find(p => p.type === 'day').value;
        const monthVal = parts.find(p => p.type === 'month').value;
        const monthIndex = parseInt(monthVal) - 1;

        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${day} ${months[monthIndex]}`;
    }

    static formatDateTime(dateString, plainText = false) {
        const date = new Date(dateString);
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: CONFIG.TIMEZONE,
            day: 'numeric',
            month: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        }).formatToParts(date);

        const day = parts.find(p => p.type === 'day').value;
        const monthVal = parts.find(p => p.type === 'month').value;
        const hours = parts.find(p => p.type === 'hour').value;
        const minutes = parts.find(p => p.type === 'minute').value;
        const ampm = parts.find(p => p.type === 'dayPeriod').value.toLowerCase();

        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const monthName = months[parseInt(monthVal) - 1];

        const dateStr = `${day} ${monthName}`;
        const timeStr = `${hours}:${minutes}${ampm}`;

        if (plainText) {
            return `${dateStr} ${timeStr}`;
        }

        return `<div class="fecha-pago"><div class="fecha">${dateStr}</div><div class="hora">${timeStr}</div></div>`;
    }
    static updateDeviceStatusUI(statusData) {
        const deviceData = statusData?.data || statusData;
        const loadingMsg = document.getElementById('loadingMessage');
        if (loadingMsg && deviceData?.name) {
            loadingMsg.textContent = deviceData.name;
        }

        const statusRing = document.getElementById('deviceStatusRing');
        const batterySvg = document.getElementById('batteryStatusSvg');
        const motorSvg = document.getElementById('motorStatusSvg');
        if (statusRing) {
            // Reset classes
            statusRing.classList.remove('online', 'offline');

            // Add new status class
            if (statusData.online) {
                statusRing.classList.add('online');
            } else {
                statusRing.classList.add('offline');
                batterySvg.classList.remove('high', 'medium', 'low');
                motorSvg.classList.remove('red', 'green');

            }
        }


        if (motorSvg) {
            motorSvg.classList.remove('red', 'green');
            if (statusData.cutOff) {
                motorSvg.classList.add('red');
            } else if (statusData.ignition) {
                motorSvg.classList.add('green');
            } else {
                motorSvg.classList.remove('red', 'green');
            }
        }


        if (batterySvg && statusData.batteryLevel !== undefined) {
            const level = statusData.batteryLevel;

            batterySvg.classList.remove('high', 'medium', 'low');
            if (level > 60) {
                batterySvg.classList.add('high');
            } else if (level > 20) {
                batterySvg.classList.add('medium');
            } else {
                batterySvg.classList.add('low');
            }
            // Optional: Tooltip on container or handle separately
        }
    }
}

// ============================================================================
// PIN Manager
// ============================================================================
class PINManager {
    constructor(dom) {
        this.dom = dom;
    }

    updateDisplay() {
        const pinBoxes = this.dom.get('keypad.pinBoxes');
        if (!pinBoxes) return;

        const len = STATE.currentPin.length;

        pinBoxes.forEach((box, index) => {
            if (index < len) {
                box.value = '';
                box.classList.add('filled');
            } else {
                box.value = '';
                box.classList.remove('filled');
            }

            if (index === len) {
                box.classList.add('active');
            } else {
                box.classList.remove('active');
            }
        });
    }

    addDigit(digit) {
        if (STATE.currentPin.length < CONFIG.PIN_LENGTH) {
            STATE.currentPin += digit;
            this.updateDisplay();

            if (STATE.currentPin.length === CONFIG.PIN_LENGTH) {
                return true;
            }
        }
        return false;
    }

    removeDigit() {
        if (STATE.currentPin.length > 0) {
            STATE.currentPin = STATE.currentPin.slice(0, -1);
            this.updateDisplay();
        }
    }

    clear() {
        STATE.currentPin = '';
        this.updateDisplay();
    }

    getValue() {
        return STATE.currentPin;
    }
}

// ============================================================================
// Screen Manager
// ============================================================================
class ScreenManager {
    constructor(dom) {
        this.dom = dom;
    }

    switchScreen(toScreen, direction = 'forward') {
        const screens = this.dom.elements.screens;
        const fromScreen = Object.values(screens).find(s => s?.classList.contains('active'));

        // Clear any inline display styles potentially set by initial script
        toScreen.style.display = '';
        if (fromScreen) fromScreen.style.display = '';

        if (!fromScreen) {
            toScreen.classList.add('active');
            return;
        }

        if (fromScreen === toScreen) return;

        toScreen.classList.add('active');
        toScreen.style.visibility = 'visible';
        toScreen.style.position = 'absolute';
        fromScreen.style.position = 'absolute';

        fromScreen.style.transition = 'transform 0.4s ease';
        toScreen.style.transition = 'transform 0.4s ease';

        const enterStart = direction === 'forward' ? '100%' : '-100%';
        const exitEnd = direction === 'forward' ? '-100%' : '100%';

        fromScreen.style.transform = 'translateX(0)';
        toScreen.style.transform = `translateX(${enterStart})`;

        void fromScreen.offsetHeight;
        void toScreen.offsetHeight;

        fromScreen.style.transform = `translateX(${exitEnd})`;
        toScreen.style.transform = 'translateX(0)';

        setTimeout(() => {
            fromScreen.classList.remove('active');
            fromScreen.style.visibility = '';
            fromScreen.style.position = '';
            fromScreen.style.transform = '';
            fromScreen.style.transition = '';
            fromScreen.style.display = ''; // Ensure no inline display remains

            toScreen.style.position = 'relative';
            toScreen.style.transition = '';
            toScreen.style.display = ''; // Ensure no inline display remains
        }, CONFIG.TRANSITION_DURATION);
    }
}

// ============================================================================
// Modal Manager
// ============================================================================
class ModalManager {
    constructor(dom) {
        this.dom = dom;
        this.dragInitialized = false;
    }

    async show(titleKey, confirmKey) {
        const modal = this.dom.get('modal.confirmation');
        const modalText = this.dom.get('modal.text');

        if (!modal) return;


        modalText.textContent = messagesService.get(titleKey);

        this.dom.get('buttons.confirm').textContent = messagesService.get(confirmKey);

        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        void modal.offsetWidth;
        modal.classList.add('active');
        console.log('Modal show');

        return new Promise((resolve) => {
            const cleanup = () => {
                modal.classList.remove('active');
                setTimeout(() => {
                    modal.style.display = 'none';
                    modal.classList.add('hidden');
                    const content = modal.querySelector('.modal-content');
                    if (content) content.style.transform = '';
                }, 300);

                this.dom.get('buttons.confirm').onclick = null;
                this.dom.get('buttons.cancel').onclick = null;
                const closeBtn = this.dom.get('modal.close');
                if (closeBtn) closeBtn.onclick = null;
                window.onclick = null;
            };

            const onConfirm = () => {
                cleanup();
                resolve(true);
            };

            const onCancel = () => {
                cleanup();
                resolve(false);
            };

            this.dom.get('buttons.confirm').onclick = onConfirm;
            this.dom.get('buttons.cancel').onclick = onCancel;

            const closeBtn = this.dom.get('modal.close');
            if (closeBtn) closeBtn.onclick = onCancel;

            window.onclick = (event) => {
                if (event.target === modal) onCancel();
            };

            this._setupDrag(modal, onCancel);
        });
    }

    // Removed _createCleanup as it is no longer used/needed separate from show context

    _setupDrag(modal, closeCallback) {
        const content = modal.querySelector('.modal-content');
        if (!content || content.dataset.dragInitialized) return;

        content.dataset.dragInitialized = 'true';

        let startY = 0;
        let currentY = 0;
        let isDragging = false;

        content.addEventListener('touchstart', (e) => {
            if (content.scrollTop > 0) return;
            startY = e.touches[0].clientY;
            isDragging = true;
            content.style.transition = 'none';
        }, { passive: true });

        content.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;

            if (deltaY > 0) {
                e.preventDefault();
                content.style.transform = `translateY(${deltaY}px)`;
            }
        }, { passive: false });

        content.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;
            content.style.transition = '';

            const deltaY = currentY - startY;
            if (deltaY > CONFIG.DRAG_THRESHOLD) {
                closeCallback();
            } else {
                content.style.transform = '';
            }

            startY = 0;
            currentY = 0;
        });
    }
}

// ============================================================================
// Payment Manager
// ============================================================================
class PaymentManager {
    constructor(dom, screen, modal) {
        this.dom = dom;
        this.screen = screen;
        this.modal = modal;
    }

    // --- Core Data Loading ---


    async loadData(skipTransition = false, initialData = null) {
        try {

            if (initialData) {
                STATE.paymentData = initialData;
            } else {
                const response = await getPaymentStatus();
                STATE.paymentData = response.data;
            }
            console.log("Loading data", STATE.paymentData);

            try {
                const typesRes = await getAdjustmentTypes();
                if (typesRes && typesRes.data) {
                    Object.entries(typesRes.data).forEach(([k, cfg]) => {
                        const isFree = cfg.isFree !== undefined ? cfg.isFree : (cfg.autoAmount === 0 || !cfg.isRealPayment);
                        STATUS_CLASS_MAP[k] = {
                            textClass: isFree ? 'status-free' : 'status-paid',
                            badgeClass: isFree ? 'badge-free' : 'badge-paid',
                            rowClass: isFree ? 'row-free' : 'row-paid',
                            color: cfg.color,
                            bg: cfg.bg,
                            badgeLabel: cfg.badgeLabel
                        };
                    });
                }
            } catch (e) {
                // Ignore API fetch errors on client side, fallbacks remain intact
            }

            const dom = this.dom;

            // Update UI
            const deviceIdName = dom.get('displays.device');
            if (deviceIdName) {
                deviceIdName.textContent = STATE.paymentData.deviceIdName;
                deviceIdName.classList.remove('text-muted');
                deviceIdName.classList.add('text-primary');
            }
            const loadingMsg = dom.get('loading.message') || document.getElementById('loadingMessage');
            if (loadingMsg && STATE.paymentData.deviceIdName) {
                loadingMsg.textContent = STATE.paymentData.deviceIdName;
            }

            // Update loading screen metadata (Date, Time, Cuota Number)
            const loadingDateEl = document.getElementById('loadingDate');
            const loadingCuotaEl = document.getElementById('loadingCuota');
            const metaSeparatorEl = document.getElementById('loadingMetaSeparator');

            if (loadingDateEl) {
                const invoiceDate = STATE.paymentData.pendingInvoiceDate || new Date();
                const invoiceDateStr = UIUtils.formatDate(invoiceDate);
                const timeOnlyStr = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
                loadingDateEl.textContent = `📅 ${invoiceDateStr} (${timeOnlyStr})`;
            }

            if (loadingCuotaEl) {
                const pagadas = STATE.paymentData.cuotasPagadas !== undefined ? STATE.paymentData.cuotasPagadas : null;
                const total = STATE.paymentData.cuotasTotal || STATE.paymentData.contractDays || 500;
                if (pagadas !== null) {
                    loadingCuotaEl.textContent = `🏷️ Cuota ${pagadas + 1} de ${total}`;
                    if (metaSeparatorEl) metaSeparatorEl.style.display = 'inline';
                }
            }
            const dueDate = dom.get('displays.paymentDueDate');
            if (dueDate) {
                dueDate.classList.add('text-muted');
                dueDate.textContent = "   ";

                // Handle Due Date
                if (STATE.paymentData.pendingInvoiceDate) {
                    dueDate.textContent = UIUtils.formatDate(STATE.paymentData.pendingInvoiceDate);

                    if (STATE.paymentData.isOverdue) {
                        dueDate.classList.remove('text-muted');
                        dueDate.classList.add('text-danger');
                        if (dom.get('displays.paymentAmount')?.parentElement) {
                            dom.get('displays.paymentAmount').parentElement.classList.add('text-danger');
                        }
                    } else {
                        dueDate.classList.remove('text-danger');
                        if (dom.get('displays.paymentAmount')?.parentElement) {
                            dom.get('displays.paymentAmount').parentElement.classList.remove('text-danger');
                        }
                    }
                }
            }

            // Update Amounts & Phone
            const amountDisplay = dom.get('displays.paymentAmount');
            if (amountDisplay) {
                amountDisplay.textContent = UIUtils.formatMoney(STATE.paymentData.amount || STATE.paymentData.dailyRate);
            }
            const phoneInput = dom.get('inputs.phone') || document.getElementById('phoneNumber');
            if (phoneInput) {
                phoneInput.value = UIUtils.formatPhone(STATE.paymentData.customerPhone);
            }

            // Adapt UI for BANCOLOMBIA_QR vs NEQUI_PUSH
            const phoneGroup = document.getElementById('phoneInputGroup') || dom.get('inputs.phone')?.closest('.phone-input-group');
            const nequiBtnText = document.getElementById('paymentBtnText') || dom.get('buttons.nequiPay')?.querySelector('.nequi-text');
            const nequiIcon = document.getElementById('paymentBtnIcon') || dom.get('buttons.nequiPay')?.querySelector('.nequi-icon-box img');
            const normalReminder = document.getElementById('normalReminder') || dom.get('pendingPayment.normal');
            const normalTitle = normalReminder?.querySelector('.reminder-title');
            const normalText = normalReminder?.querySelector('.reminder-text');
            const isQrMode = STATE.paymentData.paymentMethod === 'BANCOLOMBIA_QR';

            if (isQrMode) {
                if (phoneGroup) phoneGroup.style.setProperty('display', 'none', 'important');
                if (nequiBtnText) nequiBtnText.textContent = 'Generar código QR Bancolombia / Nequi';
                if (nequiIcon) nequiIcon.src = '/nequi.png';
                if (normalTitle) normalTitle.textContent = 'Pago con Código QR';
                if (normalText) normalText.textContent = 'Haz clic en "Generar código QR" para obtener el código QR y escanearlo desde la app de Bancolombia o Nequi.';
            } else {
                if (phoneGroup) phoneGroup.style.setProperty('display', 'flex', 'important');
                if (nequiBtnText) nequiBtnText.textContent = 'Pagar con tu cuenta Nequi';
                if (nequiIcon) nequiIcon.src = '/nequi.png';
                if (normalTitle) normalTitle.textContent = 'Cómo pagar';
                if (normalText) normalText.textContent = 'Después de hacer clic en "Pagar", completa tu transacción en el centro de notificaciones de Nequi.';
            }

            const cuotasPagadasDisplay = dom.get('displays.cuotasPagadas') || document.getElementById('cuotasPagadas');
            const totalCuotasDisplay = dom.get('displays.totalCuotas') || document.getElementById('totalCuotas');

            if (cuotasPagadasDisplay && STATE.paymentData.cuotasPagadas !== undefined) {
                cuotasPagadasDisplay.textContent = STATE.paymentData.cuotasPagadas;
            }
            if (totalCuotasDisplay) {
                totalCuotasDisplay.textContent = STATE.paymentData.cuotasTotal || STATE.paymentData.contractDays || 500;
            }

            const freeDaysCount = STATE.paymentData.freeDaysAvailable || 0;
            const badge = dom.get('displays.freeDaysCount');
            const useFreeDayBtn = dom.get('buttons.freeDay');
            const loanBtn = dom.get('buttons.loan');

            if (badge && useFreeDayBtn) {
                if (STATE.paymentData.freeDayPolicy === 'FIXED_WEEKDAY') {
                    // Hide entirely because Fixed Days are applied automatically by the backend
                    badge.style.display = 'none';
                    useFreeDayBtn.style.display = 'none';
                    useFreeDayBtn.parentElement.style.display = 'none';
                    loanBtn.style.display = 'none';
                    loanBtn.parentElement.style.display = 'none';
                } else {
                    // Flexible policy: Show based on count availability
                    badge.textContent = freeDaysCount;
                    badge.style.display = freeDaysCount > 0 ? 'block' : 'none';
                    useFreeDayBtn.style.display = freeDaysCount > 0 ? '' : 'none';
                    useFreeDayBtn.parentElement.style.display = freeDaysCount > 0 ? '' : 'none';
                    loanBtn.style.display = '';
                    loanBtn.parentElement.style.display = '';
                }
            }

            // Check for pending payment
            if (STATE.paymentData.pendingPayment && STATE.paymentData.pendingPayment.reference) {
                console.log('✅ Found pending payment, resuming monitoring');

                const pending = dom.get('pendingPayment.container');
                const normal = dom.get('pendingPayment.normal');

                if (pending && normal) {
                    const pendingRefEl = dom.get('pendingPayment.reference') || document.getElementById('pendingPaymentRef');
                    const pendingAmtEl = dom.get('pendingPayment.amount') || document.getElementById('pendingPaymentAmount');
                    const pendingTimeEl = dom.get('pendingPayment.time') || document.getElementById('pendingPaymentTime');

                    if (pendingRefEl) pendingRefEl.textContent = STATE.paymentData.pendingPayment.reference || '';
                    if (pendingAmtEl) pendingAmtEl.textContent = UIUtils.formatMoney(STATE.paymentData.pendingPayment.amount || 0);
                    if (pendingTimeEl) pendingTimeEl.textContent = UIUtils.formatDateTime(STATE.paymentData.pendingPayment.createdAt || new Date(), true);

                    if (typeof this._updatePendingProgress === 'function') {
                        this._updatePendingProgress(STATE.paymentData.pendingPayment.createdAt);
                    }

                    pending.dataset.shouldShow = 'true';
                    normal.dataset.shouldShow = 'false';
                    pending.classList.remove('hidden');
                    pending.style.display = 'flex';
                    normal.style.display = 'none';
                }

                const isQrMode = STATE.paymentData.paymentMethod === 'BANCOLOMBIA_QR';
                if (isQrMode) {
                    this.screen.switchScreen(this.dom.elements.screens.loading);
                    if (STATE.paymentData.pendingPayment.qrImage) {
                        this._displayQrCode(STATE.paymentData.pendingPayment.qrImage);
                    }
                }

                // Update loading screen amount just in case
                const loadingAmount = dom.get('loading.amount');
                if (loadingAmount) {
                    loadingAmount.textContent = `$${UIUtils.formatMoney(STATE.paymentData.pendingPayment.amount)} COP`;
                }

                this._startCountdownTimer(STATE.paymentData.pendingPayment.createdAt);
                this.monitorStatus(STATE.paymentData.pendingPayment.transactionId);
            } else {
                // No pending payment
                const pending = dom.get('pendingPayment.container');
                const normal = dom.get('pendingPayment.normal');
                const moreSection = dom.get('sections.moreOptions');
                const isExpanded = moreSection?.classList.contains('expanded');

                if (pending && normal) {
                    pending.dataset.shouldShow = 'false';
                    normal.dataset.shouldShow = 'true';

                    // Only show normal reminder if NOT expanded
                    pending.style.display = 'none';
                    normal.style.display = isExpanded ? 'none' : 'flex';
                }
            }
            // Check device online status
            try {
                // then in background:
                setTimeout(() => this.loadHistory(STATE.historyMonth, STATE.historyYear), 0);

                // device status can also be background:
                setTimeout(async () => {
                    try {
                        const statusRes = await getDeviceStatus();
                        UIUtils.updateDeviceStatusUI(statusRes.data);
                    } catch { }
                }, 0);
            } catch (err) {
                console.warn('Failed to load device status', err);
            }




        } catch (error) {
            console.error('Error loading payment data:', error);
            this.logout();
        }
    }

    async loadHistory(month = null, year = null) {
        const historyBody = this.dom.get('tables.historyBody');
        const prevBtn = document.getElementById('monthPrevBtn');
        const nextBtn = document.getElementById('monthNextBtn');

        // ── Guard: disable nav while loading to prevent rapid-click flooding ──
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;

        try {
            // Show skeleton while loading
            if (historyBody) {
                historyBody.innerHTML = '<tr><td colspan="4" class="history-loading"><span class="history-skeleton"></span></td></tr>';
            }

            const response = await getInvoiceHistory({ month, year });
            const { history, month: resMonth, year: resYear, adjustmentTypes } = response.data?.data || {};

            if (adjustmentTypes && typeof adjustmentTypes === 'object') {
                STATUS_CLASS_MAP = adjustmentTypes;
            }

            // Sync STATE with server-confirmed values
            STATE.historyMonth = resMonth;
            STATE.historyYear = resYear;

            this._updateMonthSelector(resMonth, resYear); // also handles nextBtn.disabled
            this.renderHistory(history);
        } catch (error) {
            console.error('Load history error:', error);
            if (historyBody) {
                historyBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Error al cargar historial</td></tr>';
            }
        } finally {
            // Always re-enable prevBtn; _updateMonthSelector controls nextBtn
            if (prevBtn) prevBtn.disabled = false;
        }
    }

    /** Update the month selector label and enable/disable the forward button */
    _updateMonthSelector(month, year) {
        const label = document.getElementById('monthLabel');
        const nextBtn = document.getElementById('monthNextBtn');
        if (!label) return;

        const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
            'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        label.textContent = `${MONTH_NAMES[month - 1]} ${year}`;

        // Disable next button if already on current month
        if (nextBtn) {
            const now = new Date();
            const isCurrentMonth = (month === now.getMonth() + 1 && year === now.getFullYear());
            nextBtn.disabled = isCurrentMonth;
            nextBtn.classList.toggle('month-nav-disabled', isCurrentMonth);
        }
    }

    renderHistory(history) {
        const historyBody = this.dom.get('tables.historyBody');
        if (!historyBody) return;

        if (!history || history.length === 0) {
            historyBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 16px; color: #9ca3af;">Sin pagos en este mes</td></tr>';
            return;
        }

        historyBody.innerHTML = history.map(item => {
            const key = item.adjustmentType || item.dayType;
            const fallbackConfig = STATUS_CLASS_MAP[key] || STATUS_CLASS_MAP[item.dayType] || { badgeClass: 'badge-pending', rowClass: '' };

            const rowClass = item.rowClass || fallbackConfig.rowClass || '';
            const badgeClass = item.badgeClass || fallbackConfig.badgeClass || 'badge-pending';
            const badgeLabel = item.badgeLabel || item.status || fallbackConfig.badgeLabel || 'Pendiente';
            const color = item.color || fallbackConfig.color;
            const bg = item.bg || fallbackConfig.bg;

            let paymentTimeHtml = '<span style="color: #9ca3af; font-size: 13px;">---</span>';

            if (item.paymentDate) {
                const pDate = new Date(item.paymentDate);
                const pDateStr = UIUtils.formatDate(pDate);
                const pTimeStr = pDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
                paymentTimeHtml = `
                    <div style="display: flex; flex-direction: column; align-items: center; line-height: 1.2;">
                        <span style="font-size: 11px; font-weight: 500; color: #1f2937;">${pDateStr}</span>
                        <span style="font-size: 10px; color: #6b7280;">${pTimeStr}</span>
                    </div>
                `;
            }

            const customStyle = (color && bg) ? `color: ${color}; background-color: ${bg};` : '';

            return `
            <tr class="${rowClass}">
                <td style="font-weight: 600; color: #374151;">${UIUtils.formatDate(item.date)}</td>
                <td style="font-weight: 400; color: #111827; text-align: right;">$${UIUtils.formatMoney(item.paidAmount)}</td>
                <td style="text-align: center;">${paymentTimeHtml}</td>
                <td style="text-align: right; padding-right: 8px;">
                    <span class="badge-status ${badgeClass}" style="${customStyle}">${badgeLabel}</span>
                </td>
            </tr>
            `;
        }).join('');
    }

    logout() {
        STATE.authToken = null;
        STATE.paymentData = null;
        localStorage.removeItem('paymentAuthToken');

        // Reset inputs
        const deviceIdInput = this.dom.get('inputs.deviceId');
        const deviceIdDisplay = this.dom.get('displays.deviceId');
        const urlDeviceId = STATE.urlDeviceId;

        if (!urlDeviceId) {
            // Keep the previously typed deviceId, do not clear it
            deviceIdInput.disabled = false;
            deviceIdInput.style.display = 'block';
            if (deviceIdDisplay) deviceIdDisplay.style.display = 'none';
        } else {
            deviceIdInput.style.display = 'none';
            if (deviceIdDisplay) {
                deviceIdDisplay.textContent = urlDeviceId;
                deviceIdDisplay.style.display = 'block';
            }
        }

        // Clear other UI
        const loginError = this.dom.get('displays.loginError');
        if (loginError) loginError.textContent = '';
        this.screen.switchScreen(this.dom.get('screens.login'), 'back');
    }

    _updatePendingProgress(createdAt) {
        const progressBar = this.dom.get('pendingPayment.progressBar');
        if (!progressBar) return;

        const created = new Date(createdAt).getTime();
        const now = Date.now();
        const elapsed = now - created;
        const percentage = Math.min(100, Math.max(0, (elapsed / CONFIG.MAX_TIMEOUT) * 100));

        progressBar.style.width = `${percentage}%`;

        if (percentage > CONFIG.PROGRESS_CRITICAL) {
            progressBar.style.background = 'linear-gradient(90deg, #dc2626 0%, #991b1b 100%)';
        } else if (percentage > CONFIG.PROGRESS_WARNING) {
            progressBar.style.background = 'linear-gradient(90deg, #ea580c 0%, #c2410c 100%)';
        }
    }

    // --- Actions ---

    async processNequi() {
        const isQrMode = STATE.paymentData?.paymentMethod === 'BANCOLOMBIA_QR';
        const phoneInput = this.dom.get('inputs.phone')?.value || '';
        const phone = phoneInput.replace(/\D/g, '');
        const amountStr = this.dom.get('displays.paymentAmount').textContent.replace(/\D/g, '');
        const amount = parseInt(amountStr, 10);

        if (!isQrMode && (!phone || phone.length !== CONFIG.PHONE_LENGTH)) {
            UIUtils.showError(messagesService.get('ERRORS.INVALID_PHONE'));
            return;
        }

        if (!amount || amount <= 0) {
            UIUtils.showError(messagesService.get('ERRORS.INVALID_AMOUNT'));
            return;
        }

        await this._updateLoadingScreen(amount);
        this.screen.switchScreen(this.dom.elements.screens.loading);

        const statusLabel = this.dom.get('loading.statusLabel');
        if (statusLabel) {
            statusLabel.textContent = isQrMode
                ? 'Generando código QR...'
                : messagesService.get('STATUS.REQUESTING_PAYMENT');
        }

        try {
            const response = await createNequiPayment({ phone });
            const data = response.data;

            if (statusLabel) {
                statusLabel.textContent = isQrMode
                    ? 'Generando código QR...'
                    : messagesService.get('STATUS.WAITING_NEQUI');
            }

            if (data.paymentData?.qrImage) {
                this._displayQrCode(data.paymentData.qrImage);
            }

            if (data.paymentData?.id) {
                this._startCountdownTimer(new Date());
                this.monitorStatus(data.paymentData.id);
            } else {
                this.screen.switchScreen(this.dom.elements.screens.payment, 'back');
            }
        } catch (error) {
            const msg = error.response?.data?.error || error.response?.data?.message || messagesService.get('ERRORS.PAYMENT_INIT_ERROR');
            UIUtils.showError(msg);
            this.screen.switchScreen(this.dom.elements.screens.payment, 'back');
        }
    }

    _displayQrCode(qrImage) {
        if (!qrImage) return;
        const qrGuide = document.getElementById('qrGuide');
        const nequiGuide = document.getElementById('nequiGuide');
        const logoContainer = document.getElementById('companyLogoContainer');
        const qrImg = document.getElementById('qrImageDisplay');
        const statusLabel = this.dom.get('loading.statusLabel');

        if (nequiGuide) nequiGuide.classList.add('hidden');
        if (logoContainer) logoContainer.classList.add('hidden');
        if (qrGuide) qrGuide.classList.remove('hidden');
        if (statusLabel) statusLabel.textContent = 'Escanea el código QR con Bancolombia o Nequi';

        if (qrImg) {
            qrImg.src = qrImage.startsWith('data:')
                ? qrImage
                : `data:image/svg+xml;base64,${qrImage}`;
        }
    }

    async processFreeDayRequest() {
        const btn = this.dom.get('buttons.freeDay');
        const badge = this.dom.get('displays.freeDaysCount');
        const originalText = btn.innerHTML;

        btn.disabled = true;
        btn.classList.add('btn-processing');
        // Keep the badge hidden or remove it temporary by replacing content
        btn.innerHTML = `${messagesService.get('BUTTONS.PROCESSING')} <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>`;

        try {
            await requestFreeDay();
            // alert(messagesService.get('SUCCESS.FREE_DAY_APPLIED'));
        } catch (error) {
            const msg = error.response?.data?.error || error.message || messagesService.get('ERRORS.FREE_DAY_ERROR');
            UIUtils.showError(msg);
        } finally {
            btn.disabled = false;
            btn.classList.remove('btn-processing');
            btn.innerHTML = originalText;
            // Load data AFTER restoring the button HTML so the badge exists
            await this.loadData();
        }
    }

    async processLoanRequest() {
        const btn = this.dom.get('buttons.loan');
        const originalText = btn.innerHTML;

        btn.disabled = true;
        btn.innerHTML = `${messagesService.get('BUTTONS.PROCESSING')} <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>`;

        try {
            const response = await requestLoan();
            const data = response.data;

            if (data && data.success === false) {
                UIUtils.showError(data.message || 'No puedes solicitar un préstamo en este momento');
                return;
            }

            await this.loadData();
            UIUtils.showToast(messagesService.get('SUCCESS.LOAN_APPLIED'), 'success');
        } catch (error) {
            console.error('Loan request failed:', error);
            const msg = error.response?.data?.error || error.message || messagesService.get('ERRORS.LOAN_ERROR');
            UIUtils.showError(msg);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    monitorStatus(reference) {
        if (STATE.eventSource) {
            STATE.eventSource.close();
        }

        STATE.eventSource = createPaymentStream(reference);
        let progress = 5;

        STATE.eventSource.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            const loadingBar = this.dom.get('loading.progressBar');
            const pendingBar = this.dom.get('pendingPayment.progressBar');

            if (data.status === 'APPROVED') {
                progress = 60;
            } else {
                progress += 5;
                if (progress > 100) progress = 5;
            }

            const width = `${progress}%`;
            if (loadingBar) loadingBar.style.width = width;
            if (pendingBar) pendingBar.style.width = width;

            if (data.message) {
                const loadingLabel = this.dom.get('loading.statusLabel');
                const pendingLabel = this.dom.get('pendingPayment.statusLabel');

                if (loadingLabel) loadingLabel.textContent = data.message;
                if (pendingLabel) pendingLabel.textContent = data.message;
            }

            // ── DIAGNOSTIC ──────────────────────────────────────────────────
            console.log('[SSE]', data.status, data.message || '');
            if (data.qrImage) {
                console.log('[SSE-QR] qrImage prefix (80 chars):', String(data.qrImage).substring(0, 80));
            }
            // ────────────────────────────────────────────────────────────────

            if (data.status === 'QR_READY' && data.qrImage) {
                this._displayQrCode(data.qrImage);
            }

            if (data.status === 'COMPLETED') {
                await this._handlePaymentSuccess(data);
            } else if (['DECLINED', 'ERROR', 'VOIDED'].includes(data.status)) {
                await this._handlePaymentFailure(data);
            } else if (data.status === 'TIMEOUT') {
                await this._handlePaymentTimeout();
            }
        };

        STATE.eventSource.onerror = (err) => {
            console.error('Stream Error:', err);
            STATE.eventSource.close();
            STATE.eventSource = null;
        };
    }

    async _updateLoadingScreen(amount) {
        const message = this.dom.get('loading.message');
        const amountDisplay = this.dom.get('loading.amount');

        if (message) {
            message.textContent = STATE.paymentData?.deviceIdName || '';
            if (STATE.paymentData?.pendingInvoiceDate) {
                message.textContent = `${STATE.paymentData?.deviceIdName} -  ${UIUtils.formatDate(STATE.paymentData.pendingInvoiceDate)}`;
            }
        }

        if (amountDisplay) {
            amountDisplay.innerHTML = `$${UIUtils.formatMoney(amount)} <span class="text-black">COP</span>`;
        }
    }

    _startCountdownTimer(createdAt) {
        if (STATE.countdownInterval) {
            clearInterval(STATE.countdownInterval);
            STATE.countdownInterval = null;
        }

        const startTime = createdAt ? new Date(createdAt).getTime() : Date.now();
        const durationMs = CONFIG.MAX_TIMEOUT; // 15 minutos = 900,000 ms

        const updateTimer = () => {
            const now = Date.now();
            const elapsedMs = now - startTime;
            const remainingMs = Math.max(0, durationMs - elapsedMs);
            const remainingSeconds = Math.floor(remainingMs / 1000);

            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            const timerValEl = document.getElementById('loadingTimerVal');
            if (timerValEl) {
                timerValEl.textContent = formattedTime;
            }

            if (remainingSeconds <= 0) {
                if (STATE.countdownInterval) {
                    clearInterval(STATE.countdownInterval);
                    STATE.countdownInterval = null;
                }
                if (timerValEl) {
                    timerValEl.textContent = 'Expirado';
                }
            }
        };

        updateTimer();
        STATE.countdownInterval = setInterval(updateTimer, 1000);
    }

    async _handlePaymentSuccess(data) {
        if (STATE.countdownInterval) {
            clearInterval(STATE.countdownInterval);
            STATE.countdownInterval = null;
        }
        STATE.eventSource.close();
        STATE.eventSource = null;

        this.dom.get('success.deviceId').textContent = data?.deviceIdName || '';
        this.dom.get('success.invoice').textContent = data?.invoiceId || '';
        this.dom.get('success.reference').textContent = data?.reference || '';
        this.dom.get('success.date').textContent = UIUtils.formatDate(data?.finalized_at || '');
        this.dom.get('success.amount').textContent = `$${UIUtils.formatMoney(data?.amount)} COP`;

        const doneBtn = this.dom.get('buttons.done');
        if (doneBtn) {
            doneBtn.onclick = async () => {
                this.screen.switchScreen(this.dom.elements.screens.payment, 'back');
                this.loadData(true).catch(err => {
                    console.warn('loadData failed', err);
                    this.logout();
                });

            };
        }

        this.screen.switchScreen(this.dom.elements.screens.success);
    }

    async _handlePaymentFailure(data) {
        if (STATE.countdownInterval) {
            clearInterval(STATE.countdownInterval);
            STATE.countdownInterval = null;
        }
        STATE.eventSource.close();
        STATE.eventSource = null;

        UIUtils.showError(`El pago fue: ${data.status}`);
        await this.loadData();
        this.screen.switchScreen(this.dom.elements.screens.payment, 'back');
    }

    async _handlePaymentTimeout() {
        if (STATE.countdownInterval) {
            clearInterval(STATE.countdownInterval);
            STATE.countdownInterval = null;
        }
        STATE.eventSource.close();
        STATE.eventSource = null;

        UIUtils.showError(messagesService.get('ERRORS.PAYMENT_TIMEOUT'));
        await this.loadData();
        this.screen.switchScreen(this.dom.elements.screens.payment, 'back');
    }
}

// ============================================================================
// Event Handler
// ============================================================================
class EventHandler {
    constructor(dom, pinManager, screen, modal, payment) {
        this.dom = dom;
        this.pinManager = pinManager;
        this.screen = screen;
        this.modal = modal;
        this.payment = payment;
    }

    setup() {
        this._setupKeypad();
        this._setupPhoneInput();
        this._setupButtons();
        this._setupFullscreen();
        this._setupKeyboardShortcuts();
    }

    _setupKeypad() {
        const buttons = this.dom.get('keypad.buttons');
        if (buttons) {
            buttons.forEach(btn => {
                btn.removeAttribute('disabled'); // Enable button
                btn.addEventListener('click', () => {
                    const val = btn.dataset.val;
                    const isReady = this.pinManager.addDigit(val);
                    if (isReady) {
                        this._handleLogin();
                    }
                });
            });
        }

        const clearBtn = this.dom.get('keypad.clear');
        if (clearBtn) {
            clearBtn.removeAttribute('disabled'); // Enable button
            clearBtn.addEventListener('click', () => this.pinManager.clear());
        }

        const backspaceBtn = this.dom.get('keypad.backspace');
        if (backspaceBtn) {
            backspaceBtn.removeAttribute('disabled'); // Enable button
            backspaceBtn.addEventListener('click', () => this.pinManager.clear());
        }

        const pin = this.dom.get('inputs.pin');
        if (pin) {
            pin.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this._handleLogin();
            });
        }
    }

    _setupPhoneInput() {
        const phone = this.dom.get('inputs.phone');
        if (phone) {
            phone.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length > CONFIG.PHONE_LENGTH) value = value.slice(0, CONFIG.PHONE_LENGTH);
                e.target.value = UIUtils.formatPhone(value);
            });
        }
    }

    _setupButtons() {
        const nequi = this.dom.get('buttons.nequiPay');
        if (nequi) nequi.addEventListener('click', () => this.payment.processNequi());

        const freeDay = this.dom.get('buttons.freeDay');
        if (freeDay) freeDay.addEventListener('click', () => this._handleFreeDay());

        const loan = this.dom.get('buttons.loan');
        if (loan) loan.addEventListener('click', () => this._handleLoan());

        const logout = this.dom.get('buttons.logout');
        if (logout) logout.addEventListener('click', () => this._handleLogout());

        const more = this.dom.get('buttons.morePayment');
        if (more) more.addEventListener('click', (e) => {
            e.preventDefault();
            this._toggleMoreOptions();
        });

        // Month navigation — buttons are in the static HTML so use direct listeners
        const prevBtn = document.getElementById('monthPrevBtn');
        const nextBtn = document.getElementById('monthNextBtn');

        const navigateMonth = (delta) => {
            const now = new Date();
            let m = STATE.historyMonth || (now.getMonth() + 1);
            let y = STATE.historyYear || now.getFullYear();
            m += delta;
            if (m < 1) { m = 12; y--; }
            if (m > 12) { m = 1; y++; }
            STATE.historyMonth = m;
            STATE.historyYear = y;
            this.payment.loadHistory(m, y);
        };

        if (prevBtn) prevBtn.addEventListener('click', () => navigateMonth(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => { if (!nextBtn.disabled) navigateMonth(1); });
    }

    _setupFullscreen() {
        const logo = this.dom.get('keypad.logo');
        if (logo) {
            logo.addEventListener('click', () => this._toggleFullscreen());
        }
    }

    _setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const loginScreen = this.dom.get('screens.login');
            if (!loginScreen?.classList.contains('active')) return;

            if (/\d/.test(e.key)) {
                const btn = document.querySelector(`.keypad-btn[data-val="${e.key}"]`);
                if (btn) btn.click();
            }
            if (e.key === 'Backspace') {
                this.pinManager.removeDigit();
            }
        });
    }

    async _handleLogin() {
        const deviceId = this.dom.get('inputs.deviceId').value.trim();
        const pin = this.pinManager.getValue();
        console.log(deviceId, pin);

        if (!deviceId || !pin) {
            UIUtils.showError(messagesService.get('ERRORS.MISSING_CREDENTIALS'));
            return;
        }
        if (pin.length !== CONFIG.PIN_LENGTH) {
            UIUtils.showError(messagesService.get('ERRORS.INVALID_PIN_LENGTH'));
            return;
        }
        // Optimistic Transition: Show payment screen immediately
        //

        try {
            const response = await login(deviceId, pin);
            const data = response.data;

            STATE.authToken = data.token;
            localStorage.setItem('paymentAuthToken', STATE.authToken);
            STATE.fromLogin = true;
            this.screen.switchScreen(this.dom.get('screens.payment'));

            await this.payment.loadData(false, data.paymentData);
        } catch (error) {
            // Rollback: Go back to login screen on error
            // this.screen.switchScreen(this.dom.get('screens.login'));

            const msg = error.response?.data?.error || error.message || messagesService.get('ERRORS.LOGIN_ERROR');
            UIUtils.showError(msg);

            this.pinManager.clear();
            this._shakeAndVibrate();
        }
    }

    async _handleFreeDay() {
        console.log('Free day clicked');
        const confirmed = await this.modal.show('MODAL.FREE_DAY_TITLE', 'MODAL.FREE_DAY_CONFIRM');
        console.log('Free day confirmed', confirmed);
        if (confirmed) {
            await this.payment.processFreeDayRequest();
        }
    }

    async _handleLoan() {
        console.log('Loan button clicked');
        const confirmed = await this.modal.show('MODAL.LOAN_TITLE', 'MODAL.LOAN_CONFIRM');
        if (confirmed) {
            await this.payment.processLoanRequest();
        }
    }

    _handleLogout() {
        this.pinManager.clear();
        this.payment.logout();
    }

    _toggleMoreOptions() {
        const moreSection = this.dom.get('sections.moreOptions');
        const paymentSection = this.dom.get('sections.payment');
        const container = paymentSection?.closest('.container');
        const monthSelector = document.getElementById('monthSelector');

        moreSection?.classList.toggle('expanded');
        paymentSection?.classList.toggle('compact');
        container?.classList.toggle('compact-mode');

        const isExpanded = moreSection?.classList.contains('expanded');

        // Show/hide the inline month selector alongside the toggle
        if (monthSelector) {
            monthSelector.classList.toggle('month-selector-hidden', !isExpanded);
        }

        this._updateReminderVisibility(isExpanded);

        const btn = this.dom.get('buttons.morePayment');
        if (btn) {
            btn.textContent = isExpanded ? messagesService.get('BUTTONS.MORE_OPTIONS') + ' ▲' : messagesService.get('BUTTONS.MORE_OPTIONS') + ' ▼';
        }
    }

    _updateReminderVisibility(isExpanded) {
        const pending = this.dom.get('pendingPayment.container');
        const normal = this.dom.get('pendingPayment.normal');
        const cuotasBadge = document.querySelector('.cuotas-pill-badge');

        if (pending) {
            pending.style.display = isExpanded ? 'none' : (pending.dataset.shouldShow === 'true' ? 'flex' : 'none');
        }
        if (normal) {
            normal.style.display = isExpanded ? 'none' : (normal.dataset.shouldShow === 'true' ? 'flex' : 'none');
        }
        if (cuotasBadge) {
            cuotasBadge.style.display = isExpanded ? 'none' : 'flex';
        }
    }

    _toggleFullscreen() {
        const doc = document.documentElement;
        const request = doc.requestFullscreen || doc.webkitRequestFullscreen || doc.mozRequestFullScreen || doc.msRequestFullscreen;
        const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;

        if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
            request?.call(doc).catch(err => console.log(`Fullscreen error: ${err.message}`));
        } else {
            exit?.call(document);
        }
    }

    _shakeAndVibrate() {
        const display = document.getElementById('pinDisplay');
        if (display) {
            display.classList.remove('shake');
            void display.offsetWidth;
            display.classList.add('shake');

            if (navigator.vibrate) {
                navigator.vibrate([50, 30, 50, 30, 50]);
            }

            setTimeout(() => {
                display.classList.remove('shake');
            }, 500);
        }
    }


}

// ============================================================================
// Initialization
// ============================================================================
async function initPaymentApp() {
    const dom = new DOMManager();
    dom.initialize();


    const pinManager = new PINManager(dom);
    const screen = new ScreenManager(dom);
    const modal = new ModalManager(dom);
    const payment = new PaymentManager(dom, screen, modal);
    const events = new EventHandler(dom, pinManager, screen, modal, payment);

    // Show screen ASAP
    const savedToken = localStorage.getItem('paymentAuthToken');
    if (savedToken) {
        STATE.authToken = savedToken;
        screen.switchScreen(dom.get('screens.payment'));
        payment.loadData(true).catch(() => payment.logout());
    } else {
        screen.switchScreen(dom.get('screens.login'));
    }

    // Enable keypad & interactions immediately
    events.setup();
    pinManager.updateDisplay();

    // Background preload (DO NOT await)
    // const bg = () => ComponentLoader.preloadRemainingScreens().catch(console.warn);
    // if ('requestIdleCallback' in window) requestIdleCallback(bg, { timeout: 1500 });
    // else setTimeout(bg, 300);
}


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPaymentApp);
} else {
    initPaymentApp();
}






