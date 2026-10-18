# Estructura del Proyecto - AdminPocketbike (webApp2026)

Este documento detalla la estructura general del repositorio, organizando la arquitectura entre el cliente frontend (Vite/React), el servidor de API (Node.js/Express), el microservicio de tareas programadas (`cron-server`) y los módulos de integración con pasarelas (Wompi) y plataformas GPS (Traccar/MegaRastreo).

---

```text
webApp2026/
├── client/                               # Frontend de la aplicación (Vite + React)
│   ├── index.html                        # Entrada principal HTML del cliente de administración
│   ├── pay/                              # Pasarela estática / Interfaz web de pago para clientes
│   │   ├── index.html
│   │   └── components/                   # Vistas modulares de pago (Login, Métodos, QR, Recibo)
│   ├── public/                           # Activos estáticos públicos (logos, favicons, vendor PDF)
│   │   ├── nequi.png
│   │   ├── pocketbike_60x60.jpg
│   │   └── vendor/
│   └── src/                              # Código fuente principal de React
│       ├── main.jsx                      # Punto de montaje React
│       ├── App.jsx                       # Enrutador principal y layout
│       ├── i18n.js                       # Configuración de internacionalización (i18next)
│       ├── index.css                     # Sistema de estilos globales y variables CSS
│       ├── components/                   # Componentes reutilizables
│       │   ├── CompaniesGrid.jsx
│       │   ├── DayCell.jsx
│       │   ├── MatrixPaymentSummary.jsx  # Matriz interactiva de resumen de cobros
│       │   ├── MobileHeader.jsx
│       │   ├── PageHeader.jsx
│       │   ├── SearchAndFilterBar.jsx
│       │   ├── StatCard.jsx
│       │   ├── SystemJobs.jsx
│       │   └── modals/                   # Modales de interfaz (Ajustes, Contratos, Vista previa DOCX)
│       ├── context/                      # Contextos React (SSE realtime, estado global)
│       ├── hooks/                        # Custom React Hooks
│       ├── pages/                        # Páginas de la aplicación de administración
│       │   ├── AdminDashboard.jsx        # Tablero general de métricas e indicadores
│       │   ├── Companies.jsx             # Gestión de empresas y configuración de cobro
│       │   ├── CompanyInvoices.jsx       # Facturación B2B de empresas
│       │   ├── Contracts.jsx             # Gestión integral de contratos y tarjeta/SOAT
│       │   ├── Invoices.jsx              # Control de facturas diarias de clientes
│       │   ├── Payments.jsx              # Historial de pagos procesados
│       │   ├── Reports.jsx               # Reportes y exportaciones
│       │   ├── Settings.jsx              # Parámetros del sistema y reglas de negocio
│       │   └── Users.jsx                 # Control de usuarios y roles
│       ├── services/                     # Cliente de API Axios y conectores frontend
│       └── utils/                        # Utilidades (cálculos de contratos, generador PDF)
│
├── server/                               # Backend de la aplicación (Node.js + Express)
│   ├── server.js                         # Servidor principal de la API de producción (Puerto 8084)
│   ├── adapters/                         # Adaptadores de integración con terceros
│   │   ├── megaRastreo/                  # Integración con GPS MegaRastreo
│   │   ├── traccar/                      # Integración con Traccar GPS API
│   │   └── wompiAdapter/                 # Adaptador para pasarela de pagos Wompi
│   ├── config/                           # Configuraciones de la API, componentes y dayjs
│   │   ├── config.js
│   │   └── components/
│   ├── controllers/                      # Controladores de rutas HTTP
│   │   ├── contractController.js
│   │   ├── dashboardController.js
│   │   ├── deviceController.js
│   │   ├── invoiceController.js
│   │   ├── paymentController.js
│   │   ├── settingController.js
│   │   ├── sseController.js
│   │   ├── systemJobController.js
│   │   ├── userController.js
│   │   └── webhookController.js
│   ├── cron-server/                      # Microservicio de tareas programadas (PM2 / Cron)
│   │   ├── microCronServer.js            # Punto de entrada HTTP del servidor de Cron (Puerto 8085)
│   │   ├── cron.js                       # Programador principal Node-Cron
│   │   ├── ecosystem.config.js           # Archivo de despliegue PM2
│   │   ├── jobRegistry.js                # Registro de tareas programadas
│   │   └── jobs/                         # Tareas automáticas (Corte GPS, facturación diaria, sync KM)
│   │       ├── DeviceStatusUpdate.js
│   │       ├── generateDailyInvoices.js
│   │       ├── performCurfewEnd.js
│   │       ├── performCurfewStart.js
│   │       ├── performScheduledCutOff.js
│   │       ├── syncDailyKm.js
│   │       └── validatePayments.js
│   ├── database/                         # Conexión a MongoDB (Mongoose)
│   │   ├── connection.js
│   │   └── init.js
│   ├── models/                           # Modelos de datos Mongoose
│   │   ├── Company.js                    # Registro de empresas / flotas
│   │   ├── Contract.js                   # Contrato de arrendamiento/venta de moto
│   │   ├── Device.js                     # Dispositivo GPS asociado a vehículo
│   │   ├── Invoice.js                    # Factura diaria de cobro
│   │   ├── Payment.js                    # Registro de pago / transacción Wompi
│   │   ├── Setting.js                    # Configuraciones dinámicas de la aplicación
│   │   ├── SystemJob.js                  # Registro de ejecución de tareas automáticas
│   │   ├── User.js                       # Usuario administrador / operador
│   │   └── WebhookEvent.js               # Eventos de webhook recibidos
│   ├── repositories/                     # Capa de repositorios para consultas y operaciones atómicas
│   │   ├── companyRepository.js
│   │   ├── contractRepository.js
│   │   ├── deviceRepository.js
│   │   ├── invoiceRepository.js
│   │   ├── paymentRepository.js
│   │   ├── settingRepository.js
│   │   └── systemJobRepository.js
│   ├── routes/                           # Definición de rutas Express (`/apinode/...`)
│   ├── services/                         # Lógica de negocio principal (Pagos, Contratos, OCR, SSE)
│   │   ├── brandingService.js
│   │   ├── companyBillingService.js
│   │   ├── companyService.js
│   │   ├── contractDocumentService.js    # Generación y plantilla de contratos Word/PDF
│   │   ├── dashboardService.js
│   │   ├── deviceServices.js             # Comandos de corte/activación GPS
│   │   ├── documentOcrService.js         # Lectura inteligente OCR de Cédula/SOAT/Tarjeta de propiedad
│   │   ├── invoiceServices.js
│   │   ├── paymentService.js             # Procesamiento atómico de pagos e imputación de facturas
│   │   ├── traccarService.js
│   │   └── webhookService.js             # Procesamiento de webhooks entrantes de Wompi
│   ├── templates/                        # Plantillas Word para contratos y cartas
│   └── utils/                            # Funciones de soporte (Logger, SSE Service, polifills)
│
├── scripts/                              # Scripts utilitarios de mantenimiento y diagnóstico
│   ├── createAdmin.js
│   ├── createContracts.js
│   ├── fix_invoices.js
│   ├── generateInvoices.js
│   └── migrate_invoices_payments.js
│
├── DOCUMENTATION_INDEX.md                # Índice normativo de la documentación del proyecto
├── AGENTS.md                             # Normas obligatorias para agentes de IA y flujo Git
├── ARCHITECTURE.md                       # Arquitectura y componentes del sistema
├── CONTRACT_SYSTEM.md                    # Reglas de negocio de contratos
├── DATABASE_RELATIONSHIPS.md             # Relaciones y esquemas de la base de datos
├── INCOHERENCIAS_DISENO.md              # Registro y backlog de intervenciones UI/UX
├── README.md                             # Guía de operación, instalación y arranque
├── package.json                          # Scripts y dependencias del proyecto Node.js
└── vite.config.js                        # Configuración del empaquetador Vite y proxies de API
```
