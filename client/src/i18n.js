import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
    en: {
        translation: {
            common: {
                loading: 'Loading...',
                cancel: 'Cancel',
                create: 'Create',
                update: 'Update',
                delete: 'Delete',
                edit: 'Edit',
                actions: 'Actions',
                active: 'Active',
                inactive: 'Inactive',
                available: 'Available',
                search: 'Search',
                notes: 'Notes',
                copy: 'Copy',
                done: 'Done',
                gotIt: 'Got it!',
                ready: 'Ready',
                generate: 'Generate',
                status: 'Status',
                name: 'Name'
            },
            login: {
                adminTitle: 'Admin Login',
                adminSubtitle: 'Payments-Wompi Management System',
                deviceTitle: 'Device Access',
                deviceSubtitle: 'Enter your device ID and PIN',
                email: 'Email',
                password: 'Password',
                deviceId: 'Device ID',
                pinCode: 'PIN Code',
                loginBtn: 'Login',
                loggingIn: 'Logging in...',
                accessBtn: 'Access Device',
                verifying: 'Verifying...',
                customerLink: 'Customer? Access device with PIN',
                adminLink: 'Administrator? Login here',
                welcome: 'Welcome!',
                loginSuccess: 'Login successful',
                loginFailed: 'Login Failed',
                accessGranted: 'Access Granted!',
                accessDenied: 'Access Denied',
                invalidPin: 'Invalid PIN',
                rememberMe: 'Remember me'
            },
            sidebar: {
                main: 'Main',
                dashboard: 'Dashboard',
                devices: 'Devices',
                management: 'Management',
                contracts: 'Contracts',
                payments: 'Payments',
                invoices: 'Invoices',
                system: 'System',
                settings: 'Settings',
                settings: 'Settings',
                logout: 'Logout',
                users: 'Users',
                companies: 'Companies'
            },
            contracts: {
                title: 'Contract Management',
                subtitle: 'Manage 500-day rental contracts for all devices',
                newContract: 'New Contract',
                stats: {
                    total: 'Total Contracts',
                    active: 'Active',
                    completed: 'Completed',
                    totalValue: 'Total Value'
                },
                filters: {
                    all: 'All',
                    active: 'Active',
                    completed: 'Completed',
                    cancelled: 'Cancelled'
                },
                searchPlaceholder: 'Search by ID, name or email...',
                loading: 'Loading contracts...',
                empty: {
                    title: 'No contracts found',
                    subtitle: 'Create a new contract to get started'
                },
                card: {
                    customer: 'Customer',
                    dailyRate: 'Daily Rate',
                    totalDays: 'Total Days',
                    totalAmount: 'Total Amount',
                    edit: 'Edit',
                    complete: 'Complete',
                    cancel: 'Cancel',
                    progress: 'Progress: {{paid}} / {{total}} days',
                    paid: 'Paid:',
                    statusConfirm: 'Are you sure you want to change the status to {{status}}?'
                },
                modal: {
                    editTitle: 'Edit Contract',
                    addTitle: 'New Contract',
                    deviceId: 'Device ID *',
                    selectDevice: 'Select device...',
                    deviceWarning: 'Each device can only have one active contract. Cancel existing contracts before creating a new one.',
                    startDate: 'Start Date *',
                    customerPhone: 'Customer Phone',
                    devicePin: 'Device PIN',
                    devicePinCustom: 'Device PIN (Leave empty to keep current)',
                    usePhonePin: 'Use last 4 digits of phone',
                    usePhonePinError: 'Enter a valid cell phone number first',
                    customerName: 'Customer Name',
                    customerEmail: 'Customer Email',
                    customerDocument: 'Customer Document',
                    customerDocumentPlaceholder: 'ID/NIT',
                    dailyRateCop: 'Daily Rate (COP)',
                    contractDays: 'Contract Days',
                    initialFeeCop: 'Initial Fee (COP)',
                    freeDaysMonth: 'Free Days per Month',
                    exemptCutoff: 'Do not apply Automatic Cut-off',
                    notes: 'Notes',
                    notesPlaceholder: 'Additional notes...',
                    cancelBtn: 'Cancel',
                    saveBtn: 'Save Contract',
                    createBtn: 'Create Contract',
                    updateBtn: 'Update Contract',
                    savingBtn: 'Saving...',
                    successUpdate: 'Contract updated successfully!',
                    successCreate: 'Contract created successfully!',
                    errorSave: 'Error saving contract'
                }
            },
            dashboard: {
                title: 'Dashboard',
                welcome: 'Welcome back, {{name}}!',
                downloadReport: 'Download Report',
                stats: {
                    totalRevenue: 'Total Revenue',
                    activeContracts: 'Active Contracts',
                    pendingPayments: 'Pending Payments',
                    totalDevices: 'Total Devices'
                },
                charts: {
                    revenue: 'Revenue Overview',
                    deviceStatus: 'Device Status',
                    last6Months: 'Last 6 Months',
                    lastYear: 'Last Year'
                },
                recentPayments: {
                    title: 'Recent Payments',
                    viewAll: 'View All',
                    noPayments: 'No recent payments',
                    table: {
                        device: 'Device',
                        amount: 'Amount',
                        status: 'Status',
                        date: 'Date'
                    }
                },
                loading: 'Loading dashboard...'
            },
            devices: {
                title: 'Device Management',
                subtitle: 'Manage devices, PINs, and payment information',
                addDevice: 'Add Device',
                totalDevices: 'Total Devices',
                activeContracts: 'Active Contracts',
                available: 'Available',
                searchPlaceholder: 'Search devices by ID or name...',
                filterAll: 'All Devices',
                filterActive: 'Active',
                filterAvailable: 'Available',
                table: {
                    name: 'Name',
                    nequi: 'Nequi Number',
                    sim: 'SIM Card Number',
                    status: 'Status',
                    pin: 'PIN',
                    contract: 'Contract',
                    actions: 'Actions'
                },
                pin: {
                    set: 'Set',
                    generate: 'Generate',
                    regenerate: 'Regenerate PIN',
                    modalTitle: 'Set Device PIN',
                    modalSubtitle: 'Generate a random PIN or enter a custom 4-digit PIN for',
                    customLabel: 'Custom PIN (optional)',
                    customPlaceholder: 'Enter 4 digits or leave empty',
                    autoHelper: 'Leave empty to auto-generate a random PIN',
                    useCustom: 'Use Custom PIN',
                    autoGenerate: 'Auto-Generate PIN',
                    generatedTitle: 'Device PIN Generated',
                    saveWarning: 'Save this PIN! It won\'t be shown again.',
                    instruction1: '✓ Share this PIN with the device user',
                    instruction2: '✓ They\'ll use it to access payment page',
                    instruction3: '✓ You can regenerate it anytime'
                },
                share: {
                    title: 'Share Payment Link',
                    subtitle: 'Share this link with the user to access the payment page.',
                    copy: 'Copy',
                    note: 'Note:',
                    noteText: 'Users will need their 4-digit PIN to access this page.',
                    copySuccess: 'Link copied to clipboard!',
                    copySuccess2: 'Link copied to clipboard!'
                },
                form: {
                    editTitle: 'Edit Device',
                    addTitle: 'Add New Device',
                    deviceId: 'Device ID *',
                    name: 'Device Name *',
                    nequi: 'Nequi Number',
                    sim: 'SIM Card Number',
                    notes: 'Notes',
                    active: 'Active'
                },
                emptyState: 'No devices found. Add your first device to get started.'
            },
            invoices: {
                title: 'Invoices',
                subtitle: 'View and manage all invoices across devices',
                empty: 'No invoices found',
                searchPlaceholder: 'Search by invoice ID, device ID, contract ID...',
                filterAll: 'All Invoices',
                filterPaid: 'Paid',
                filterUnpaid: 'Unpaid',
                filterPending: 'Pending'
            },
            payments: {
                title: 'Payments History',
                subtitle: 'View and manage all payment transactions',
                refresh: 'Refresh',
                stats: {
                    revenue: 'Total Revenue (Page)',
                    completed: 'Completed (Page)',
                    pending: 'Pending (Page)',
                    total: 'Total Transactions'
                },
                filters: {
                    all: 'All',
                    completed: 'Completed',
                    pending: 'Pending',
                    failed: 'Failed'
                },
                sort: {
                    date: 'Sort by Date',
                    amount: 'Sort by Amount',
                    device: 'Sort by Device'
                },
                table: {
                    id: 'Payment ID',
                    device: 'Device',
                    amount: 'Amount',
                    status: 'Status',
                    reference: 'Reference',
                    date: 'Date'
                },
                empty: {
                    title: 'No payments found',
                    subtitle: 'No transactions match your current filter'
                },
                loading: 'Loading payments...',
                pagination: {
                    previous: 'Previous',
                    next: 'Next',
                    pageInfo: 'Page {{page}} of {{totalPages}} ({{total}} total)'
                }
            },
            settings: {
                title: 'Settings',
                subtitle: 'Configure your application preferences',
                tabs: {
                    branding: 'Company Branding',
                    business: 'Business Settings',
                    integrations: 'Integrations',
                    system: 'System'
                },
                branding: {
                    title: 'Company Branding',
                    displayName: 'Company Display Name',
                    displayNameDesc: 'This name will be displayed on the payment page.',
                    emailDomain: 'Default Email Domain',
                    emailDomainDesc: 'Domain used for auto-generated customer emails',
                    logo: 'Company Logo',
                    changeLogo: 'Change Logo',
                    uploadNew: 'Upload New Logo',
                    recommended: 'RECOMMENDED: 60X60PX, PNG OR JPG, MAX 2MB'
                },
                general: {
                    title: 'General Settings',
                    dailyRate: 'Default Daily Rate (COP)',
                    dailyRateDesc: 'Base rate per day in COP',
                    contractDays: 'Default Contract Days',
                    contractDaysDesc: 'Default duration for new contracts',
                    freeDayPolicy: 'Free Day Policy',
                    policyFlexible: 'Flexible Limit (Monthly Allowance)',
                    policyFixed: 'Fixed Day of the Week',
                    freeDayPolicyDesc: 'Determine if free days are a flexible monthly allowance or strictly applied on a specific day',
                    freeDaysLimit: 'Default Free Days Limit',
                    freeDaysLimitDesc: 'Default monthly free days allowance for new contracts',
                    fixedFreeDay: 'Fixed Free Day',
                    fixedFreeDayDesc: 'The specific day of the week that will automatically be marked as free',
                    days: {
                        sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday'
                    },
                    initialFee: 'Default Initial Fee',
                    initialFeeDesc: 'Default initial fee for new contracts',
                    currency: 'Currency',
                    currencyDesc: 'Display currency for amounts',
                    timezone: 'Timezone',
                    timezoneDesc: 'Timezone for dates and times'
                },
                integrations: {
                    gpsTitle: 'GPS Service Integration',
                    selectProvider: 'Select Provider',
                    megarastreoUsername: 'MegaRastreo Username',
                    megarastreoPassword: 'MegaRastreo Password',
                    traccarHost: 'Traccar Host',
                    traccarUser: 'Username',
                    traccarPass: 'Password',
                    traccarNotImplemented: 'Traccar (Not implemented yet)',
                    wompiTitle: 'Wompi Payments Configuration',
                    publicKey: 'Public Key',
                    privateKey: 'Private Key',
                    integritySecret: 'Integrity Secret',
                    eventsSecret: 'Events Secret'
                },
                cutoff: {
                    title: 'Automatic Cut-Off Control',
                    enable: 'Enable Automatic Engine Stop',
                    enableDesc: 'Automatically turn off engines at 11:59 PM for devices with unpaid invoices.',
                    strategy: 'Cut-Off Strategy',
                    strategy1: '1. Today\'s invoice is not paid',
                    strategy2: '2. Yesterday\'s invoice is not paid',
                    strategy3: '3. Do not turn off / Leave free',
                    strategyDesc: 'Choose which payment condition triggers the automatic cutoff.',
                    curfewTitle: 'Nightly Curfew',
                    curfewEnable: 'Enable Nightly Curfew',
                    curfewEnableDesc: 'Automatically turn off engines every night for security purposes.',
                    startTime: 'Curfew Start Time (Off)',
                    startTimeDesc: 'Time when all non-exempt devices will automatically turn off.',
                    endTime: 'Curfew End Time (On)',
                    endTimeDesc: 'Time when all non-exempt paid devices will automatically turn back on.'
                },
                system: {
                    title: 'System Information',
                    version: 'Application Version',
                    dbStatus: 'Database Status',
                    apiStatus: 'API Status',
                    lastBackup: 'Last Backup',
                    connected: 'Connected',
                    active: 'Active',
                    never: 'Never',
                    discoveryTitle: 'Device Discovery',
                    discoveryDesc: 'Force a synchronization with the configured GPS provider to discover new devices. Use this if a newly added device is not showing up in the platform.',
                    syncing: 'Syncing...',
                    syncNow: 'Sync Devices Now'
                },
                actions: {
                    saveSection: 'Saved',
                    saving: 'Saving...',
                    saveAll: 'Save All Settings',
                    allSaved: 'All Settings Saved!'
                },
                crop: {
                    title: 'Crop Your Logo',
                    hint: 'Drag to reposition • Use slider to zoom',
                    cancel: 'Cancel',
                    save: 'Crop & Save'
                }
            }
        }
    },
    es: {
        translation: {
            common: {
                loading: 'Cargando...',
                cancel: 'Cancelar',
                create: 'Crear',
                update: 'Actualizar',
                delete: 'Eliminar',
                edit: 'Editar',
                actions: 'Acciones',
                active: 'Activo',
                inactive: 'Inactivo',
                available: 'Disponible',
                search: 'Buscar',
                notes: 'Notas',
                copy: 'Copiar',
                done: 'Listo',
                gotIt: '¡Entendido!',
                ready: 'Listo',
                generate: 'Generar',
                status: 'Estado',
                name: 'Nombre'
            },
            login: {
                adminTitle: 'Acceso Admin',
                adminSubtitle: 'Sistema de Gestión Payments-Wompi',
                deviceTitle: 'Acceso a Pagos',
                deviceSubtitle: 'Ingresa tu ID de moto y PIN',
                email: 'Correo',
                password: 'Contraseña',
                deviceId: 'Placa',
                pinCode: 'Código PIN',
                loginBtn: 'Ingresar',
                loggingIn: 'Ingresando...',
                accessBtn: 'Ingresar',
                verifying: 'Verificando...',
                customerLink: '¿Eres cliente? Accede con PIN',
                adminLink: '¿Eres administrador? Ingresa aquí',
                welcome: '¡Bienvenido!',
                loginSuccess: 'Ingreso exitoso',
                loginFailed: 'Error de ingreso',
                accessGranted: '¡Acceso Concedido!',
                accessDenied: 'Acceso Denegado',
                invalidPin: 'PIN Inválido',
                rememberMe: 'Recuérdame'
            },
            sidebar: {
                main: 'Principal',
                dashboard: 'Inicio',
                devices: 'Dispositivos',
                management: 'Gestión',
                contracts: 'Contratos',
                payments: 'Pagos',
                invoices: 'Facturas',
                system: 'Sistema',
                settings: 'Configuración',
                logout: 'Salir',
                users: 'Usuarios',
                companies: 'Empresas'
            },
            contracts: {
                title: 'Gestión de Contratos',
                subtitle: 'Gestionar contratos de alquiler de 500 días para todos los dispositivos',
                newContract: 'Nuevo Contrato',
                stats: {
                    total: 'Total Contratos',
                    active: 'Activos',
                    completed: 'Completados',
                    totalValue: 'Valor Total'
                },
                filters: {
                    all: 'Todos',
                    active: 'Activos',
                    completed: 'Completados',
                    cancelled: 'Cancelados'
                },
                searchPlaceholder: 'Buscar por ID, nombre o email...',
                loading: 'Cargando contratos...',
                empty: {
                    title: 'No se encontraron contratos',
                    subtitle: 'Cree un nuevo contrato para comenzar'
                },
                card: {
                    customer: 'Cliente',
                    dailyRate: 'Tarifa Diaria',
                    totalDays: 'Días Totales',
                    totalAmount: 'Monto Total',
                    edit: 'Editar',
                    complete: 'Completar',
                    cancel: 'Cancelar',
                    progress: 'Progreso: {{paid}} / {{total}} días',
                    paid: 'Pagado:',
                    statusConfirm: '¿Está seguro de cambiar el estado a {{status}}?'
                },
                modal: {
                    editTitle: 'Editar Contrato',
                    addTitle: 'Nuevo Contrato',
                    deviceId: 'ID Dispositivo *',
                    selectDevice: 'Seleccionar dispositivo...',
                    deviceWarning: 'Cada dispositivo solo puede tener un contrato activo. Cancele los contratos existentes antes de crear uno nuevo.',
                    startDate: 'Fecha Inicio *',
                    customerPhone: 'Teléfono del Cliente',
                    devicePin: 'PIN del Dispositivo',
                    devicePinCustom: 'PIN del Dispositivo (Dejar vacío para mantener el actual)',
                    usePhonePin: 'Usa los últimos 4 del celular',
                    usePhonePinError: 'Ingrese un número de celular válido primero',
                    customerName: 'Nombre del Cliente',
                    customerEmail: 'Email del Cliente',
                    customerDocument: 'Documento del Cliente',
                    customerDocumentPlaceholder: 'Cédula/NIT',
                    dailyRateCop: 'Tarifa Diaria (COP)',
                    contractDays: 'Días de Contrato',
                    initialFeeCop: 'Cuota Inicial (COP)',
                    freeDaysMonth: 'Días Libres al Mes',
                    exemptCutoff: 'No aplicar Apagado Automático',
                    notes: 'Notas',
                    notesPlaceholder: 'Notas adicionales...',
                    cancelBtn: 'Cancelar',
                    saveBtn: 'Guardar Contrato',
                    createBtn: 'Crear Contrato',
                    updateBtn: 'Actualizar Contrato',
                    savingBtn: 'Guardando...',
                    successUpdate: '¡Contrato actualizado exitosamente!',
                    successCreate: '¡Contrato creado exitosamente!',
                    errorSave: 'Error al guardar contrato'
                }
            },
            dashboard: {
                title: 'Panel Principal',
                welcome: '¡Bienvenido de nuevo, {{name}}!',
                downloadReport: 'Descargar Reporte',
                stats: {
                    totalRevenue: 'Ingresos Totales',
                    activeContracts: 'Contratos Activos',
                    pendingPayments: 'Pagos Pendientes',
                    totalDevices: 'Total Dispositivos'
                },
                charts: {
                    revenue: 'Resumen de Ingresos',
                    deviceStatus: 'Estado de Dispositivos',
                    last6Months: 'Últimos 6 Meses',
                    lastYear: 'Último Año'
                },
                recentPayments: {
                    title: 'Pagos Recientes',
                    viewAll: 'Ver Todos',
                    noPayments: 'No hay pagos recientes',
                    table: {
                        device: 'Dispositivo',
                        amount: 'Monto',
                        status: 'Estado',
                        date: 'Fecha'
                    }
                },
                loading: 'Cargando panel...'
            },
            devices: {
                title: 'Gestión de Dispositivos',
                subtitle: 'Administra dispositivos, PINs e información de pago',
                addDevice: 'Nuevo',
                totalDevices: 'Total Dispositivos',
                activeContracts: 'Contratos Activos',
                available: 'Disponibles',
                searchPlaceholder: 'Buscar por ID o nombre...',
                filterAll: 'Todos',
                filterActive: 'Activos',
                filterAvailable: 'Disponibles',
                table: {
                    name: 'Nombre',
                    nequi: 'Nequi',
                    driver: 'Conductor',
                    status: 'Estado',
                    pin: 'PIN',
                    contract: 'Contrato',
                    actions: 'Acciones'
                },
                pin: {
                    set: 'Configurado',
                    generate: 'Generar',
                    regenerate: 'Regenerar PIN',
                    modalTitle: 'Configurar PIN',
                    modalSubtitle: 'Genera un PIN aleatorio o ingresa uno personalizado para',
                    customLabel: 'PIN Personalizado (opcional)',
                    customPlaceholder: 'Ingresa 4 dígitos o deja vacío',
                    autoHelper: 'Deja vacío para generar automáticamente',
                    useCustom: 'Usar PIN Propio',
                    autoGenerate: 'Generar Auto',
                    generatedTitle: 'PIN Generado',
                    saveWarning: '¡Guarda este PIN! No se mostrará de nuevo.',
                    instruction1: '✓ Comparte este PIN con el usuario',
                    instruction2: '✓ Lo usarán para ingresar a pagos',
                    instruction3: '✓ Puedes regenerarlo cuando quieras'
                },
                share: {
                    title: 'Compartir Link de Pago',
                    subtitle: 'Comparte este link para acceder a la página de pago.',
                    copy: 'Copiar',
                    note: 'Nota:',
                    noteText: 'El usuario necesitará su PIN de 4 dígitos.',
                    copySuccess: '¡Link copiado al portapapeles!',
                    copySuccess2: '¡Link copiado al portapapeles!'
                },
                form: {
                    editTitle: 'Editar Dispositivo',
                    addTitle: 'Agregar Dispositivo',
                    deviceId: 'Dispositivo *',
                    name: 'Nombre *',
                    nequi: 'Nequi',
                    sim: 'SIM',
                    notes: 'Notas',
                    active: 'Activo'
                },
                emptyState: 'No se encontraron dispositivos. Agrega el primero para comenzar.'
            },
            invoices: {
                title: 'Facturas',
                subtitle: 'Ver y gestionar todas las facturas de los dispositivos',
                empty: 'No se encontraron facturas',
                searchPlaceholder: 'Buscar por ID factura, dispositivo o contrato...',
                filterAll: 'Todas',
                filterPaid: 'Pagadas',
                filterUnpaid: 'Pendientes',
                filterPending: 'En Proceso'
            },
            payments: {
                title: 'Historial de Pagos',
                subtitle: 'Ver y gestionar todas las transacciones de pago',
                refresh: 'Actualizar',
                stats: {
                    revenue: 'Ingresos (Página)',
                    completed: 'Completados (Página)',
                    pending: 'Pendientes (Página)',
                    total: 'Total Transacciones'
                },
                filters: {
                    all: 'Todos',
                    completed: 'Completados',
                    pending: 'Pendientes',
                    failed: 'Fallidos'
                },
                sort: {
                    date: 'Ordenar por Fecha',
                    amount: 'Ordenar por Monto',
                    device: 'Ordenar por Dispositivo'
                },
                table: {
                    id: 'ID Pago',
                    device: 'Dispositivo',
                    amount: 'Monto',
                    status: 'Estado',
                    reference: 'Referencia',
                    date: 'Fecha'
                },
                empty: {
                    title: 'No se encontraron pagos',
                    subtitle: 'No hay transacciones con el filtro actual'
                },
                loading: 'Cargando pagos...',
                pagination: {
                    previous: 'Anterior',
                    next: 'Siguiente',
                    pageInfo: 'Página {{page}} de {{totalPages}} ({{total}} total)'
                }
            },
            settings: {
                title: 'Configuración',
                subtitle: 'Configura las preferencias de tu aplicación',
                tabs: {
                    branding: 'Perfil de Empresa',
                    business: 'Ajustes de Negocio',
                    integrations: 'Integraciones',
                    system: 'Sistema'
                },
                branding: {
                    title: 'Perfil de Empresa',
                    displayName: 'Nombre visible de la Empresa',
                    displayNameDesc: 'Este nombre se mostrará en la página de pagos.',
                    emailDomain: 'Dominio de Correo por Defecto',
                    emailDomainDesc: 'Dominio utilizado para correos autogenerados de clientes',
                    logo: 'Logo de la Empresa',
                    changeLogo: 'Cambiar Logo',
                    uploadNew: 'Subir Nuevo Logo',
                    recommended: 'RECOMENDADO: 60X60PX, PNG O JPG, MÁX 2MB'
                },
                general: {
                    title: 'Ajustes Generales',
                    dailyRate: 'Tarifa Diaria base (COP)',
                    dailyRateDesc: 'Tarifa base por día en COP',
                    contractDays: 'Días de Contrato por Defecto',
                    contractDaysDesc: 'Duración por defecto para nuevos contratos',
                    freeDayPolicy: 'Política de Días Libres',
                    policyFlexible: 'Límite Flexible (Mensual)',
                    policyFixed: 'Día Fijo de la Semana',
                    freeDayPolicyDesc: 'Determina si los días libres son un límite mensual o un día específico de la semana',
                    freeDaysLimit: 'Límite de Días Libres por Defecto',
                    freeDaysLimitDesc: 'Cantidad de días libres al mes por defecto para nuevos contratos',
                    fixedFreeDay: 'Día Libre Fijo',
                    fixedFreeDayDesc: 'El día específico de la semana que será libre',
                    days: {
                        sun: 'Domingo', mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes', sat: 'Sábado'
                    },
                    initialFee: 'Cuota Inicial por Defecto',
                    initialFeeDesc: 'Cuota inicial por defecto para nuevos contratos',
                    currency: 'Moneda',
                    currencyDesc: 'Moneda para mostrar cantidades',
                    timezone: 'Zona Horaria',
                    timezoneDesc: 'Zona horaria para fechas y horas'
                },
                integrations: {
                    gpsTitle: 'Integración de Servicio GPS',
                    selectProvider: 'Seleccionar Proveedor',
                    megarastreoUsername: 'Usuario MegaRastreo',
                    megarastreoPassword: 'Contraseña MegaRastreo',
                    traccarHost: 'Host Traccar',
                    traccarUser: 'Usuario',
                    traccarPass: 'Contraseña',
                    traccarNotImplemented: 'Traccar (Aún no implementado)',
                    wompiTitle: 'Configuración de Pagos Wompi',
                    publicKey: 'Llave Pública',
                    privateKey: 'Llave Privada',
                    integritySecret: 'Secreto de Integridad',
                    eventsSecret: 'Secreto de Eventos'
                },
                cutoff: {
                    title: 'Control de Corte Automático',
                    enable: 'Activar Corte Automático (Deuda)',
                    enableDesc: 'Apaga automáticamente los motores a las 11:59 PM para dispositivos con facturas sin pagar.',
                    strategy: 'Estrategia de Corte (11:59 PM)',
                    strategy1: '1. Apagar si debe hoy',
                    strategy2: '2. Apagar si debe ayer',
                    strategy3: '3. No apagar / Dejar libre',
                    strategyDesc: 'Elige qué condición de pago activa el corte automático.',
                    curfewTitle: 'Toque de Queda Nocturno',
                    curfewEnable: 'Habilitar Toque de Queda Nocturno',
                    curfewEnableDesc: 'Apaga automáticamente los motores todas las noches por seguridad.',
                    startTime: 'Hora Apagado',
                    startTimeDesc: 'Hora en la que todos los dispositivos no exentos se apagarán.',
                    endTime: 'Hora Encendido',
                    endTimeDesc: 'Hora en la que todos los dispositivos no exentos que estén al día se encenderán.'
                },
                system: {
                    title: 'Información del Sistema',
                    version: 'Versión de la Aplicación',
                    dbStatus: 'Estado de la Base de Datos',
                    apiStatus: 'Estado de la API',
                    lastBackup: 'Último Respaldo',
                    connected: 'Conectado',
                    active: 'Activo',
                    never: 'Nunca',
                    discoveryTitle: 'Descubrimiento de Dispositivos',
                    discoveryDesc: 'Fuerza una sincronización con el proveedor GPS para descubrir nuevos dispositivos. Úsalo si un dispositivo nuevo no aparece en la plataforma.',
                    syncing: 'Sincronizando...',
                    syncNow: 'Sincronizar Dispositivos Ahora'
                },
                actions: {
                    saveSection: 'Guardado',
                    saving: 'Guardando...',
                    saveAll: 'Guardar Toda la Configuración',
                    allSaved: '¡Toda la configuración guardada!'
                },
                crop: {
                    title: 'Recortar Logo',
                    hint: 'Arrastra para mover • Usa el control de zoom',
                    cancel: 'Cancelar',
                    save: 'Recortar y Guardar'
                }
            }
        }
    }
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: localStorage.getItem('app_language') || 'es', // Default to Spanish if no pref
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;
