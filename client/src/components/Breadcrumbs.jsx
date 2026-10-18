import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Default hierarchy mapping by route.
 * Can be overridden by passing explicit `items` prop.
 */
const getRouteHierarchy = (pathname, t) => {
    const cleanPath = pathname.split('?')[0].replace(/\/$/, '') || '/';

    const hierarchyMap = {
        '/': [
            { label: t('sidebar.dashboard', 'Dashboard'), isCurrent: true }
        ],
        '/devices': [
            { label: 'Flota' },
            { label: t('sidebar.devices', 'Dispositivos'), isCurrent: true }
        ],
        '/contracts': [
            { label: 'Operaciones' },
            { label: t('sidebar.contracts', 'Contratos'), isCurrent: true }
        ],
        '/payments': [
            { label: 'Cobranza' },
            { label: t('sidebar.payments', 'Pagos'), isCurrent: true }
        ],
        '/summary': [
            { label: 'Cobranza' },
            { label: t('sidebar.summary', 'Estatus de Pagos'), isCurrent: true }
        ],
        '/invoices': [
            { label: 'Facturación' },
            { label: t('sidebar.invoices', 'Facturas Clientes'), isCurrent: true }
        ],
        '/company-invoices': [
            { label: t('sidebar.companies', 'Empresas'), path: '/companies' },
            { label: t('sidebar.companyInvoices', 'Facturas Empresa'), isCurrent: true }
        ],
        '/companies': [
            { label: 'Gestión' },
            { label: t('sidebar.companies', 'Empresas'), isCurrent: true }
        ],
        '/reports': [
            { label: 'Analítica' },
            { label: t('sidebar.reports', 'Reporte de Conciliación'), isCurrent: true }
        ],
        '/users': [
            { label: 'Administración' },
            { label: t('sidebar.users', 'Usuarios'), isCurrent: true }
        ],
        '/settings': [
            { label: 'Configuración' },
            { label: t('sidebar.settings', 'Sistema'), isCurrent: true }
        ]
    };

    return hierarchyMap[cleanPath] || [
        { label: 'PocketBike' },
        { label: cleanPath.replace('/', ''), isCurrent: true }
    ];
};

/**
 * Breadcrumbs Component (Estilo 2: Inline compacto)
 * 
 * Renders a single-line modern navigation path where the last element
 * acts as the primary page title (wrapped semantically in <h1>).
 * 
 * @param {Array} items - Optional list of { label, path, icon } segments.
 * @param {string|ReactNode} fallbackTitle - Title to use for the active leaf if items not provided.
 */
const Breadcrumbs = ({ items, fallbackTitle }) => {
    const location = useLocation();
    const { t } = useTranslation();

    let breadcrumbList = items;

    if (!breadcrumbList || breadcrumbList.length === 0) {
        breadcrumbList = getRouteHierarchy(location.pathname, t);
        if (fallbackTitle && breadcrumbList.length > 0) {
            // Replace or update the last segment with the explicit title
            const updated = [...breadcrumbList];
            updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                label: fallbackTitle,
                isCurrent: true
            };
            breadcrumbList = updated;
        }
    }

    const isHome = location.pathname === '/' || location.pathname === '';

    return (
        <nav aria-label="Ruta de navegación" className="breadcrumbs-nav">
            <ol className="breadcrumbs-list">
                {/* Root Home Item */}
                <li className="breadcrumb-item">
                    <Link to="/" className="breadcrumb-link breadcrumb-home" title="Inicio">
                        <Home size={15} className="breadcrumb-home-icon" />
                        <span className="breadcrumb-home-text">Inicio</span>
                    </Link>
                </li>

                {/* Breadcrumb Trail */}
                {breadcrumbList.map((item, index) => {
                    const isLast = index === breadcrumbList.length - 1;

                    // On dashboard root, avoid duplicate "Inicio > Dashboard" if preferred, or display smoothly
                    if (isHome && item.label === t('sidebar.dashboard', 'Dashboard') && index === 0) {
                        return (
                            <React.Fragment key="root-dashboard">
                                <li className="breadcrumb-separator" aria-hidden="true">
                                    <ChevronRight size={13} />
                                </li>
                                <li className="breadcrumb-item breadcrumb-current" aria-current="page">
                                    <span className="breadcrumb-text">{item.label}</span>
                                </li>
                            </React.Fragment>
                        );
                    }

                    return (
                        <React.Fragment key={`bc-${index}-${item.label}`}>
                            <li className="breadcrumb-separator" aria-hidden="true">
                                <ChevronRight size={13} />
                            </li>
                            <li
                                className={`breadcrumb-item ${isLast ? 'breadcrumb-current' : ''}`}
                                aria-current={isLast ? 'page' : undefined}
                            >
                                {isLast ? (
                                    <span className="breadcrumb-text">
                                        {item.icon && <span className="breadcrumb-item-icon">{item.icon}</span>}
                                        {item.label}
                                    </span>
                                ) : item.path ? (
                                    <Link to={item.path} className="breadcrumb-link">
                                        {item.icon && <span className="breadcrumb-item-icon">{item.icon}</span>}
                                        {item.label}
                                    </Link>
                                ) : (
                                    <span className="breadcrumb-text">
                                        {item.icon && <span className="breadcrumb-item-icon">{item.icon}</span>}
                                        {item.label}
                                    </span>
                                )}
                            </li>
                        </React.Fragment>
                    );
                })}
            </ol>
        </nav>
    );
};

export default Breadcrumbs;
