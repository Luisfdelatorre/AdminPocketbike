import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Menu } from 'lucide-react';

const MobileHeader = ({ sidebarOpen, setSidebarOpen }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();

    const path = location.pathname;

    // Sub-pages or secondary views that use Back button instead of Menu toggle
    const isSubPage = path.startsWith('/settings') || 
                      path.startsWith('/companies') || 
                      path.startsWith('/company-invoices');

    const getPageTitle = () => {
        if (path === '/') return t('sidebar.dashboard');
        if (path.startsWith('/devices')) return t('sidebar.devices');
        if (path.startsWith('/contracts')) return t('sidebar.contracts');
        if (path.startsWith('/payments')) return t('sidebar.payments');
        if (path.startsWith('/invoices')) return t('sidebar.invoices');
        if (path.startsWith('/users')) return t('sidebar.users', 'Usuarios');
        if (path.startsWith('/companies')) return t('sidebar.companies', 'Empresas');
        if (path.startsWith('/company-invoices')) return t('sidebar.companyInvoices', 'Facturas Empresa');
        if (path.startsWith('/settings')) return t('sidebar.settings');
        if (path.startsWith('/reports')) return t('sidebar.reports');
        if (path.startsWith('/summary')) return t('sidebar.summary');
        return 'PocketBike';
    };

    return (
        <header className="mobile-header">
            {isSubPage ? (
                <button className="toggle-btn" onClick={() => navigate(-1)} aria-label="Volver">
                    <ArrowLeft size={24} />
                </button>
            ) : (
                <button className="toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Abrir menú">
                    <Menu size={24} />
                </button>
            )}
            <div className="logo-container">
                <h2>{getPageTitle()}</h2>
            </div>
            <div id="mobile-header-actions" className="mobile-header-actions" />
        </header>
    );
};

export default MobileHeader;
