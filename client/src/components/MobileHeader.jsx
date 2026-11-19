import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Menu, ChevronDown } from 'lucide-react';
import { switchCompany } from '../services/api';

const MobileHeader = ({ sidebarOpen, setSidebarOpen }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const { user, switchActiveCompany } = useAuth();
    const [customTitle, setCustomTitle] = useState(null);

    const path = location.pathname;

    useEffect(() => {
        const handleSetTitle = (e) => {
            setCustomTitle(e.detail || null);
        };
        window.addEventListener('set-mobile-header-title', handleSetTitle);
        return () => window.removeEventListener('set-mobile-header-title', handleSetTitle);
    }, []);

    useEffect(() => {
        setCustomTitle(null);
    }, [path]);

    // Sub-pages or secondary views that use Back button instead of Menu toggle
    const isSubPage = path.startsWith('/settings') ||
        path.startsWith('/companies') ||
        path.startsWith('/company-invoices');

    const hasMultipleCompanies = Boolean(user?.accessibleCompanies && user.accessibleCompanies.length > 1);
    const activeCompany = user?.accessibleCompanies?.find(c => c._id === user.companyId);
    const currentCompanyName = activeCompany?.name || user?.companyName || 'PocketBike';

    const handleCompanySwitch = async (e) => {
        const targetCompanyId = e.target.value;
        if (!targetCompanyId || targetCompanyId === user?.companyId) return;

        try {
            if (switchActiveCompany) {
                const res = await switchActiveCompany(targetCompanyId);
                if (!res?.success) {
                    alert(res?.error || 'Failed to switch company. Please try again.');
                }
                return;
            }

            const res = await switchCompany(targetCompanyId);
            if (res.success && res.data.token) {
                localStorage.setItem('adminToken', res.data.token);
                localStorage.setItem('auth_token', res.data.token);

                const storage = localStorage.getItem('auth_user') ? localStorage : sessionStorage;
                const authUserStr = storage.getItem('auth_user');
                if (authUserStr) {
                    const authUser = JSON.parse(authUserStr);
                    authUser.companyId = res.data.companyId;
                    authUser.companyName = res.data.companyName;
                    storage.setItem('auth_user', JSON.stringify(authUser));
                }

                window.location.reload();
            }
        } catch (error) {
            console.error('Failed to switch company', error);
            alert('Failed to switch company. Please try again.');
        }
    };

    const getPageTitle = () => {
        if (customTitle) return customTitle;
        if (path === '/') return t('sidebar.dashboard');
        if (path.startsWith('/devices')) return t('sidebar.devices');
        if (path.startsWith('/contracts')) return t('sidebar.contracts');
        if (path.startsWith('/payments')) return t('sidebar.payments');
        if (path.startsWith('/invoices')) return t('sidebar.invoices');
        if (path.startsWith('/users')) return t('sidebar.users', 'Usuarios');
        if (path.startsWith('/companies')) return t('sidebar.companies', 'Empresas');
        if (path.startsWith('/company-invoices')) return t('sidebar.companyInvoices', 'Facturas Empresa');
        if (path.startsWith('/settings')) return t('sidebar.settings');
        if (path.startsWith('/reports')) {
            const companyName = user?.companyName && user.companyName !== 'System' ? user.companyName : '';
            return companyName ? companyName : t('sidebar.reports');
        }
        if (path.startsWith('/summary')) return t('sidebar.summary');
        if (path.startsWith('/alerts') || path.startsWith('/alertas')) return t('sidebar.alerts', 'Alertas');
        if (path.startsWith('/commands')) return t('sidebar.commands', 'Comandos');
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
                {hasMultipleCompanies && path === '/' ? (
                    <div className="mobile-header-company-switcher">
                        <div className="company-switcher-title-pill">
                            <span className="company-switcher-title-text">
                                {currentCompanyName}
                            </span>
                            <ChevronDown size={16} className="company-switcher-chevron" />
                        </div>
                        <select
                            value={user?.companyId || ''}
                            onChange={handleCompanySwitch}
                            className="company-switcher-title-select"
                            aria-label="Seleccionar empresa"
                        >
                            {user.accessibleCompanies.map(c => (
                                <option key={c._id} value={c._id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <h2>{getPageTitle()}</h2>
                )}
            </div>
            <div id="mobile-header-actions" className="mobile-header-actions" />
        </header>
    );
};

export default MobileHeader;
