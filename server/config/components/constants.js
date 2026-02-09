export const ENGINERESUME = 'engineResume';
export const ENGINESTOP = 'engineStop';
export const LOGFILENAMEFORMAT = 'roll-<DATE>.log';
export const DATEFORMAT = 'YYYY.MM.DD';
export const TIMEFORMAT = 'YYYY-MM-DD HH:mm:ss.SSS';
export const TIMEZONE = 'America/Bogota';

export const PAYMENTMESSAGES = {
    M_INITIATED: 'Revisa tus notificaciones en Nequi',
    M_PAYMENT_RECEIVED: 'Pago recibido correctamente',
    M_ALREADY_PROCESSED: 'El pago ya había sido procesado anteriormente',
    M_APPROVED: 'Pago aprobado',
    M_TIMEOUT: 'La verificación ha tardado demasiado.',
    M_PENDING_ALT_1: 'Verificando estado del pago...',
    M_PENDING_ALT_2: 'Por favor, confirma la transacción en Nequi...',
    M_PROCESSING: 'Procesando tu pago...',
    M_INVOICE_NOT_FOUND: 'Factura no encontrada',
    M_ERROR_ACTIVATING_DEVICE: 'Error al activar el dispositivo',
    M_ERROR: 'Ha ocurrido un error inesperado',
    M_INVOICE_UPDATED: 'Factura actualizada',
    M_DEVICE_ACTIVATING: 'Activando dispositivo...',
    M_DEVICE_CHECKING: 'Verificando conexión del dispositivo...',
    M_DEVICE_ACTIVE: 'Dispositivo activado correctamente',
    M_DEVICE_QUEUED: 'Dispositivo en cola de activación',
    M_COMPLETED: 'Transacción completada exitosamente',
    M_DECLINED: 'El pago fue rechazado',
    M_PAYMENT_PROCESSED_ACTIVE: 'Pago procesado y dispositivo activo'
};

export const WOMPI_EVENTS = {
    TRANSACTION_UPDATED: 'transaction.updated'
};

export const WOMPI_STATUS_MAP = {
    APPROVED: 'APPROVED',
    DECLINED: 'DECLINED',
    VOIDED: 'VOIDED',
    ERROR: 'ERROR',
    PENDING: 'PENDING'
};

export const UI_MESSAGES = {
    MODAL: {
        FREE_DAY_TITLE: '¿Desea usar un día libre para pagar su factura pendiente?',
        FREE_DAY_CONFIRM: 'Sí, usar día libre',
        LOAN_TITLE: '¿Deseas solicitar un préstamo para trabajar hoy y pagar después?',
        LOAN_CONFIRM: 'Sí, solicitar préstamo',
        CANCEL: 'Cancelar'
    },
    BUTTONS: {
        FREE_DAY: 'Usar Día Libre',
        LOAN: 'Préstamo',
        PAY_NOW: 'Pagar Ahora',
        MORE_OPTIONS: 'Más Opciones',
        LOGOUT: 'Cerrar Sesión',
        LOGIN: 'Iniciar Sesión',
        PROCESSING: 'Procesando...'
    },
    SUCCESS: {
        FREE_DAY_APPLIED: 'Día libre aplicado correctamente',
        LOAN_APPLIED: 'Préstamo aplicado correctamente',
        PAYMENT_SUCCESS: 'Pago realizado con éxito',
        LOGIN_SUCCESS: 'Inicio de sesión exitoso'
    },
    ERRORS: {
        FREE_DAY_ERROR: 'No se pudo aplicar el día libre',
        LOAN_ERROR: 'No se pudo solicitar el préstamo',
        NO_FREE_DAYS: 'No tienes días libres disponibles',
        PENDING_INVOICE: 'Tienes una factura pendiente',
        INVALID_PHONE: 'Número de teléfono inválido',
        INVALID_AMOUNT: 'Monto inválido',
        PAYMENT_INIT_ERROR: 'Error al iniciar el pago'
    },
    STATUS: {
        PAID: 'Pagado',
        PENDING: 'Pendiente',
        FREE: 'Gratis',
        LOAN: 'Préstamo',
        DEBT: 'Deuda',
        VERIFYING: 'Verificando',
        CONFIRMING: 'Confirmando'
    },
    PAYMENT_SCREEN: {
        TITLE: 'Pago a PocketBike',
        DEVICE_LABEL: 'Dispositivo',
        AMOUNT_LABEL: 'Monto a Pagar',
        PHONE_PLACEHOLDER: 'Número Nequi',
        PAYMENT_METHOD: 'Pagar con Nequi'
    }
};
