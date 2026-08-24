import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Home, Users, FileText, CreditCard, DollarSign,
    Image as ImageIcon, Settings as SettingsIcon, Database,
    RefreshCw, ArrowLeft, Building, Sliders
} from 'lucide-react';

const MobileBottomNav = ({ settingsTab, setSettingsTab, companiesTab, setCompaniesTab }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const isSettingsPage = location.pathname.startsWith('/settings');
    const isCompaniesPage = location.pathname.startsWith('/companies');

    const isTabActive = (path) => {
        if (path === '/') {
            return location.pathname === '/';
        }
        return location.pathname.startsWith(path);
    };

    if (isSettingsPage) {
        return (
            <nav className="mobile-bottom-nav" aria-label="Navegación de configuración">
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
        return (
            <nav className="mobile-bottom-nav" aria-label="Navegación de Empresas">
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

    return (
        <nav className="mobile-bottom-nav" aria-label="Navegación principal">
            <button
                onClick={() => navigate('/')}
                className={`nav-btn ${isTabActive('/') ? 'active' : ''}`}
            >
                <Home size={20} />
                <span>Inicio</span>
            </button>
            <button
                onClick={() => navigate('/devices')}
                className={`nav-btn ${isTabActive('/devices') ? 'active' : ''}`}
            >
                <Users size={20} />
                <span>Equipos</span>
            </button>
            <button
                onClick={() => navigate('/contracts')}
                className={`nav-btn ${isTabActive('/contracts') ? 'active' : ''}`}
            >
                <FileText size={20} />
                <span>Contratos</span>
            </button>
            <button
                onClick={() => navigate('/payments')}
                className={`nav-btn ${isTabActive('/payments') ? 'active' : ''}`}
            >
                <CreditCard size={20} />
                <span>Pagos</span>
            </button>
            <button
                onClick={() => navigate('/invoices')}
                className={`nav-btn ${isTabActive('/invoices') ? 'active' : ''}`}
            >
                <DollarSign size={20} />
                <span>Facturas</span>
            </button>
        </nav>
    );
};

export default MobileBottomNav;
