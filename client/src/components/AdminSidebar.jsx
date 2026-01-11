import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
    Home, Users, CreditCard, DollarSign, FileText,
    Settings, LogOut, Menu, X
} from 'lucide-react';
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
            {/* Mobile Header (Replaces floating button) */}
            <div className="mobile-header">
                <button className="toggle-btn" onClick={onToggle}>
                    <Menu size={24} />
                </button>
                <div className="logo-container">
                    <h2>PocketBike</h2>
                </div>
                <div style={{ width: 40 }}></div> {/* Spacer for balance */}
            </div>

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
                        <h2>PocketBike</h2>
                    </div>
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
                        </div>
                    )}

                    <div className="nav-section">
                        <h4>{t('sidebar.management')}</h4>
                        <button
                            className={`nav-item ${isActive('/contracts') ? 'active' : ''}`}
                            onClick={() => handleNavigation('/contracts')}
                            title={t('sidebar.contracts')}
                        >
                            <FileText size={20} />
                            <span>{t('sidebar.contracts')}</span>
                        </button>
                        <button
                            className={`nav-item ${isActive('/payments') ? 'active' : ''}`}
                            onClick={() => handleNavigation('/payments')}
                            title={t('sidebar.payments')}
                        >
                            <CreditCard size={20} />
                            <span>{t('sidebar.payments')}</span>
                        </button>
                        <button
                            className={`nav-item ${isActive('/invoices') ? 'active' : ''}`}
                            onClick={() => handleNavigation('/invoices')}
                            title={t('sidebar.invoices')}
                        >
                            <DollarSign size={20} />
                            <span>{t('sidebar.invoices')}</span>
                        </button>
                    </div>

                    <div className="nav-section">
                        <h4>{t('sidebar.system')}</h4>
                        <button
                            className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
                            onClick={() => handleNavigation('/settings')}
                            title={t('sidebar.settings')}
                        >
                            <Settings size={20} />
                            <span>{t('sidebar.settings')}</span>
                        </button>
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
                            <div className="user-role">{isAdmin() ? 'Admin' : 'User'}</div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AdminSidebar;
