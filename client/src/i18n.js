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
                deviceId: 'ID Dispositivo',
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
                companies: 'Compañías'
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
