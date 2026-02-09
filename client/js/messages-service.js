/**
 * Messages Service - Centralized message management
 * Hardcoded messages for the application
 */

const MESSAGES = {
    MODAL: {
        FREE_DAY_TITLE: '¿Desea usar un día libre para pagar su factura pendiente?',
        FREE_DAY_CONFIRM: 'Sí, usar día libre',
        LOAN_TITLE: '¿Deseas solicitar un préstamo para trabajar hoy y pagar más tarde? Se creará una deuda que deberás pagar.',
        LOAN_CONFIRM: 'Sí, solicitar préstamo',
        CANCEL: 'Cancelar'
    },
    BUTTONS: {
        FREE_DAY: 'Usar Día Libre',
        LOAN: 'Préstamo',
        PAY_NOW: 'Pagar Ahora',
        MORE_OPTIONS: 'Más formas de pago',
        LOGOUT: 'Cerrar Sesión',
        LOGIN: 'Iniciar Sesión',
        PROCESSING: 'Procesando...'
    },
    SUCCESS: {
        FREE_DAY_APPLIED: '¡Día libre aplicado con éxito! Tu dispositivo se está reactivando.',
        LOAN_APPLIED: '¡Préstamo aplicado con éxito! Tu dispositivo se está reactivando. Recuerda que debes pagar más tarde.',
        PAYMENT_SUCCESS: 'Pago procesado exitosamente',
        LOGIN_SUCCESS: 'Inicio de sesión exitoso'
    },
    ERRORS: {
        FREE_DAY_ERROR: 'Error al aplicar día libre',
        LOAN_ERROR: 'Error al solicitar préstamo',
        PAYMENT_ERROR: 'Error al procesar el pago',
        LOGIN_ERROR: 'Error de autenticación',
        AUTH_FAILED: 'Autenticación fallida',
        NO_FREE_DAYS: 'No tienes días libres disponibles',
        PENDING_INVOICE: 'Ya tienes una factura pendiente.',
        NETWORK_ERROR: 'Error de conexión. Por favor intenta de nuevo.',
        INVALID_PHONE: 'Número celular inválido',
        INVALID_AMOUNT: 'Monto inválido',
        PAYMENT_INIT_ERROR: 'Error al iniciar el pago con Nequi',
        PAYMENT_TIMEOUT: 'El tiempo de espera del pago ha terminado',
        MISSING_CREDENTIALS: 'Por favor ingresa la placa y el PIN',
        INVALID_PIN_LENGTH: 'El PIN debe ser de 4 dígitos'
    },
    STATUS: {
        PAID: 'Pagado',
        PENDING: 'Pendiente',
        FREE: 'Gratis',
        LOAN: 'Préstamo',
        DEBT: 'Deuda',
        VERIFYING: 'Verificando',
        CONFIRMING: 'Confirmando',
        REQUESTING_PAYMENT: 'Solicitando pago a Nequi...',
        WAITING_NEQUI: 'Por favor acepta la notificación en tu celular...'
    },
    PAYMENT_SCREEN: {
        TITLE: 'Payment App',
        DEVICE_LABEL: 'Dispositivo:',
        AMOUNT_LABEL: 'Monto a pagar:',
        FREE_DAYS_LABEL: 'Días libres disponibles:',
        PHONE_PLACEHOLDER: 'Ingresa tu número Nequi',
        PAYMENT_HISTORY: 'Historial de Pagos',
        NO_HISTORY: 'No hay historial de pagos'
    }
};

const messagesService = {
    get: (path) => {
        const keys = path.split('.');
        let value = MESSAGES;

        for (const key of keys) {
            value = value?.[key];
            if (value === undefined) {
                console.warn(`Message not found: ${path}`);
                return `[${path}]`;
            }
        }

        return value;
    }
};

export default messagesService;
