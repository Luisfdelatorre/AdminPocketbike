import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Home, FileText, CreditCard, DollarSign, Calendar,
    Image as ImageIcon, Settings as SettingsIcon, Database,
    RefreshCw, ArrowLeft, Building, Sliders
} from 'lucide-react';

const MobileBottomNav = ({ settingsTab, setSettingsTab, companiesTab, setCompaniesTab }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();

    const isSettingsPage = location.pathname.startsWith('/settings');
    const isCompaniesPage = location.pathname.startsWith('/companies');

    const isTabActive = (path) => {
        if (path === '/') {
            return location.pathname === '/';
        }
        return location.pathname.startsWith(path);
    };

    if (isSettingsPage) {
        const settingsTabs = ['branding', 'business', 'integrations', 'system'];
        const activeSettingsIdx = settingsTabs.indexOf(settingsTab);
        return (
            <nav className="mobile-bottom-nav" aria-label="Navegación de configuración">
                <div
                    className={`nav-active-pill ${activeSettingsIdx === -1 ? 'is-hidden' : ''}`}
                    style={{ '--active-index': Math.max(0, activeSettingsIdx), '--tab-count': 5 }}
                    aria-hidden="true"
                />
                <button
                    onClick={() => setSettingsTab('branding')}
                    className={`nav-btn ${settingsTab === 'branding' ? 'active' : ''}`}
                >
                    <ImageIcon size={20} />
                    <span>Perfil</span>
                </button>
                <button
                    onClick={() => setSettingsTab('business')}
                    className={`nav-btn ${settingsTab === 'business' ? 'active' : ''}`}
                >
                    <SettingsIcon size={20} />
                    <span>Negocio</span>
                </button>
                <button
                    onClick={() => setSettingsTab('integrations')}
                    className={`nav-btn ${settingsTab === 'integrations' ? 'active' : ''}`}
                >
                    <Database size={20} />
                    <span>Integración</span>
                </button>
                <button
                    onClick={() => setSettingsTab('system')}
                    className={`nav-btn ${settingsTab === 'system' ? 'active' : ''}`}
                >
                    <RefreshCw size={20} />
                    <span>Sistema</span>
                </button>
                <button
                    onClick={() => navigate(-1)}
                    className="nav-btn"
                    style={{ color: '#EF4444' }}
                >
                    <ArrowLeft size={20} />
                    <span>Volver</span>
                </button>
            </nav>
        );
    }

    if (isCompaniesPage) {
        const companyTabs = ['companies', 'adjustmentTypes', 'systemJobs', 'ocrTemplates'];
        const activeCompanyIdx = companyTabs.indexOf(companiesTab);
        return (
            <nav className="mobile-bottom-nav" aria-label="Navegación de Empresas">
                <div
                    className={`nav-active-pill ${activeCompanyIdx === -1 ? 'is-hidden' : ''}`}
                    style={{ '--active-index': Math.max(0, activeCompanyIdx), '--tab-count': 5 }}
                    aria-hidden="true"
                />
                <button
                    onClick={() => setCompaniesTab && setCompaniesTab('companies')}
                    className={`nav-btn ${companiesTab === 'companies' ? 'active' : ''}`}
                >
                    <Building size={20} />
                    <span>Empresas</span>
                </button>
                <button
                    onClick={() => setCompaniesTab && setCompaniesTab('adjustmentTypes')}
                    className={`nav-btn ${companiesTab === 'adjustmentTypes' ? 'active' : ''}`}
                >
                    <Sliders size={20} />
                    <span>Ajustes</span>
                </button>
                <button
                    onClick={() => setCompaniesTab && setCompaniesTab('systemJobs')}
                    className={`nav-btn ${companiesTab === 'systemJobs' ? 'active' : ''}`}
                >
                    <SettingsIcon size={20} />
                    <span>Rutinas</span>
                </button>
                <button
                    onClick={() => setCompaniesTab && setCompaniesTab('ocrTemplates')}
                    className={`nav-btn ${companiesTab === 'ocrTemplates' ? 'active' : ''}`}
                >
                    <FileText size={20} />
                    <span>Plantillas</span>
                </button>
                <button
                    onClick={() => navigate(-1)}
                    className="nav-btn"
                    style={{ color: '#EF4444' }}
                >
                    <ArrowLeft size={20} />
                    <span>Volver</span>
                </button>
            </nav>
        );
    }

    const mainRoutes = ['/', '/summary', '/contracts', '/payments', '/invoices'];
    const activeMainIdx = mainRoutes.findIndex((p) => isTabActive(p));

    return (
        <div className="mobile-bottom-nav-wrapper">
            <nav className="mobile-bottom-nav" aria-label="Navegación principal">
                <div
                    className={`nav-active-pill ${activeMainIdx === -1 ? 'is-hidden' : ''}`}
                    style={{ '--active-index': Math.max(0, activeMainIdx), '--tab-count': mainRoutes.length }}
                    aria-hidden="true"
                />
                <button onClick={() => navigate('/')} className={`nav-btn ${isTabActive('/') ? 'active' : ''}`} >
                    {isTabActive('/') ? (
                        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-house nav-icon-inverted" aria-hidden="true">
                            <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="currentColor" stroke="currentColor" />
                            <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" fill="none" stroke="#FFFFFF" strokeWidth={1.8} />
                        </svg>
                    ) : (
                        <Home size={20} strokeWidth={1.8} />
                    )}
                    <span>Inicio</span>
                </button>
                <button
                    onClick={() => navigate('/summary')}
                    className={`nav-btn ${isTabActive('/summary') ? 'active' : ''}`}
                >
                    <Calendar size={20} strokeWidth={isTabActive('/summary') ? 2 : 1.8} className={isTabActive('/summary') ? 'nav-icon-inverted' : ''} />
                    <span>{t('sidebar.summary', 'Resumen')}</span>
                </button>
                <button
                    onClick={() => navigate('/contracts')}
                    className={`nav-btn ${isTabActive('/contracts') ? 'active' : ''}`}
                >
                    <FileText size={20} strokeWidth={isTabActive('/contracts') ? 2 : 1.8} className={isTabActive('/contracts') ? 'nav-icon-inverted' : ''} />
                    <span>Contratos</span>
                </button>
                <button
                    onClick={() => navigate('/payments')}
                    className={`nav-btn ${isTabActive('/payments') ? 'active' : ''}`}
                >
                    <CreditCard size={20} strokeWidth={isTabActive('/payments') ? 2 : 1.8} className={isTabActive('/payments') ? 'nav-icon-inverted' : ''} />
                    <span>Pagos</span>
                </button>
                <button
                    onClick={() => navigate('/invoices')}
                    className={`nav-btn ${isTabActive('/invoices') ? 'active' : ''}`}
                >
                    <div className={isTabActive('/invoices') ? 'nav-icon-dollar-inverted' : 'nav-icon-dollar-wrap'}>
                        <DollarSign size={isTabActive('/invoices') ? 14 : 20} strokeWidth={isTabActive('/invoices') ? 2.5 : 1.8} />
                    </div>
                    <span>Facturas</span>
                </button>
            </nav>

        </div>
    );
};

export default MobileBottomNav;
