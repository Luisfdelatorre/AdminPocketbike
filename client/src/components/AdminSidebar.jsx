import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
    Home, Users, CreditCard, DollarSign, FileText,
    Settings, LogOut, Menu, X, Building, Calendar, ChevronDown
} from 'lucide-react';
import { switchCompany } from '../services/api';
import './AdminSidebar.css';

const AdminSidebar = ({ isOpen, onToggle }) => {
    const { user, logout, isAdmin } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/admin/login');
    };

    const handleCompanySwitch = async (e) => {
        const targetCompanyId = e.target.value;
        if (!targetCompanyId || targetCompanyId === user.companyId) return;

        try {
            const res = await switchCompany(targetCompanyId);
            if (res.success && res.data.token) {
                localStorage.setItem('adminToken', res.data.token);
                localStorage.setItem('auth_token', res.data.token);
                
                // Update auth_user in storage to reflect the new company before reload
                const storage = localStorage.getItem('auth_user') ? localStorage : sessionStorage;
                const authUserStr = storage.getItem('auth_user');
                if (authUserStr) {
                    const authUser = JSON.parse(authUserStr);
                    authUser.companyId = res.data.companyId;
                    authUser.companyName = res.data.companyName;
                    storage.setItem('auth_user', JSON.stringify(authUser));
                }

                window.location.reload(); // Full reload to ensure clean state
            }
        } catch (error) {
            console.error('Failed to switch company', error);
            alert('Failed to switch company. Please try again.');
        }
    };

    const handleNavigation = (path) => {
        // Close sidebar on mobile BEFORE navigating to avoid race conditions
        // Use matchMedia for robust mobile detection (better than innerWidth in some browsers/inspectors)
        const isMobile = window.matchMedia('(max-width: 768px)').matches;

        if (isMobile && isOpen) {
            onToggle();
        }
        navigate(path);
    };

    // Strict path matching
    const isActive = (path) => location.pathname === path;

    return (
        <>
            {/* Overlay for mobile */}
            <div
                className={`sidebar-overlay ${isOpen ? 'active' : ''}`}
                onClick={onToggle}
            />

            {/* Sidebar Container */}
            <div className={`admin-sidebar ${isOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-header">
                    <div className="logo-container">
                        <button className="toggle-btn" onClick={onToggle}>
                            <Menu size={20} />
                        </button>
                    </div>
                    {user?.accessibleCompanies && user.accessibleCompanies.length > 1 && (
                        <div className="company-switcher-container" style={{ marginTop: '10px' }}>
                            <select
                                value={user.companyId || ''}
                                onChange={handleCompanySwitch}
                                className="company-switcher-select"
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#1e293b', fontSize: '14px', fontWeight: '500' }}
                            >
                                {user.accessibleCompanies.map(c => (
                                    <option key={c._id} value={c._id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <nav className="sidebar-nav">
                    {isAdmin() && (
                        <div className="nav-section">
                            <h4>{t('sidebar.main')}</h4>
                            <button
                                className={`nav-item ${isActive('/') ? 'active' : ''}`}
                                onClick={() => handleNavigation('/')}
                                title={t('sidebar.dashboard')}
                            >
                                <Home size={20} />
                                <span>{t('sidebar.dashboard')}</span>
                            </button>
                            <button
                                className={`nav-item ${isActive('/devices') ? 'active' : ''}`}
                                onClick={() => handleNavigation('/devices')}
                                title={t('sidebar.devices')}
                            >
                                <Users size={20} />
                                <span>{t('sidebar.devices')}</span>
                            </button>
                            <button
                                className={`nav-item ${isActive('/summary') ? 'active' : ''}`}
                                onClick={() => handleNavigation('/summary')}
                                title="Resumen de Pagos"
                            >
                                <Calendar size={20} />
                                <span>Resumen</span>
                            </button>
                        </div>
                    )}

                    <div className="nav-section">
                        <h4>{t('sidebar.management')}</h4>
                        {user?.role !== 'viewer' && (
                            <button
                                className={`nav-item ${isActive('/contracts') ? 'active' : ''}`}
                                onClick={() => handleNavigation('/contracts')}
                                title={t('sidebar.contracts')}
                            >
                                <FileText size={20} />
                                <span>{t('sidebar.contracts')}</span>
                            </button>
                        )}
                        <button
                            className={`nav-item ${isActive('/payments') ? 'active' : ''}`}
                            onClick={() => handleNavigation('/payments')}
                            title={t('sidebar.payments')}
                        >
                            <CreditCard size={20} />
                            <span>{t('sidebar.payments')}</span>
                        </button>

                        {user?.role !== 'viewer' && (
                            <button
                                className={`nav-item ${isActive('/reports') ? 'active' : ''}`}
                                onClick={() => handleNavigation('/reports')}
                                title="Reportes"
                            >
                                <FileText size={20} />
                                <span>Reportes</span>
                            </button>
                        )}
                        
                        {user?.role !== 'viewer' && isAdmin() && (
                            <button
                                className={`nav-item ${isActive('/company-invoices') ? 'active' : ''}`}
                                onClick={() => handleNavigation('/company-invoices')}
                                title="Facturación Empresas"
                            >
                                <Building size={20} />
                                <span>Fact. Empresas</span>
                            </button>
                        )}

                        {user?.role !== 'viewer' && (
                            <button
                                className={`nav-item ${isActive('/invoices') ? 'active' : ''}`}
                                onClick={() => handleNavigation('/invoices')}
                                title={t('sidebar.invoices')}
                            >
                                <DollarSign size={20} />
                                <span>{t('sidebar.invoices')}</span>
                            </button>
                        )}
                    </div>

                    <div className="nav-section">
                        <h4>{t('sidebar.system')}</h4>
                        {user?.role !== 'viewer' && (
                            <button
                                className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
                                onClick={() => handleNavigation('/settings')}
                                title={t('sidebar.settings')}
                            >
                                <Settings size={20} />
                                <span>{t('sidebar.settings')}</span>
                            </button>
                        )}
                        {user?.role !== 'viewer' && (
                            <button
                                className={`nav-item ${isActive('/users') ? 'active' : ''}`}
                                onClick={() => handleNavigation('/users')}
                                title={t('sidebar.users')}
                            >
                                <Users size={20} />
                                <span>{t('sidebar.users')}</span>
                            </button>
                        )}
                        {user?.isSuperAdmin && (
                            <button
                                className={`nav-item ${isActive('/companies') ? 'active' : ''}`}
                                onClick={() => handleNavigation('/companies')}
                                title={t('sidebar.companies')}
                            >
                                <Building size={20} />
                                <span>{t('sidebar.companies')}</span>
                            </button>
                        )}
                        <button
                            className="nav-item logout"
                            onClick={handleLogout}
                            title={t('sidebar.logout')}
                        >
                            <LogOut size={20} />
                            <span>{t('sidebar.logout')}</span>
                        </button>
                    </div>
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="user-avatar">
                            {user?.name?.charAt(0) || 'A'}
                        </div>
                        <div className="user-details">
                            <div className="user-name">{user?.name}</div>
                            <div className="user-role">
                                {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : (isAdmin() ? 'Admin' : 'User')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AdminSidebar;
