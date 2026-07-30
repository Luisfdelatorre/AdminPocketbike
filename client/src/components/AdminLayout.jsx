import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Home, Users, FileText, CreditCard, DollarSign, Image as ImageIcon, Settings as SettingsIcon, Database, RefreshCw, ArrowLeft, Menu } from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import './AdminLayout.css';

const AdminLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const contentRef = useRef(null);
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
    const [settingsTab, setSettingsTab] = useState('branding');

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth <= 768) {
                setSidebarOpen(false);
            } else {
                setSidebarOpen(true);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        contentRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [location.pathname]);

    useEffect(() => {
        const clientId = `admin-${Math.random().toString(36).substring(2, 9)}`;
        const sseUrl = `/apinode/sse/subscribe?clientId=${clientId}`;
        const eventSource = new EventSource(sseUrl);

        eventSource.addEventListener('connected', () => {
            console.log('✅ SSE Connected to Admin Portal');
        });

        eventSource.addEventListener('payment-updated', (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('💳 Payment Updated via SSE:', data);
                window.dispatchEvent(new CustomEvent('payment-update', { detail: data }));
            } catch (err) {
                console.error('Error parsing SSE event:', err);
            }
        });

        eventSource.addEventListener('device_update', (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📡 Device Updated via SSE:', data);
                window.dispatchEvent(new CustomEvent('device-update', { detail: data }));
            } catch (err) {
                console.error('Error parsing SSE device_update event:', err);
            }
        });

        eventSource.onerror = () => {
            console.error('❌ SSE Connection Error');
        };

        return () => {
            eventSource.close();
        };
    }, []);
    
    const { isAuthenticated, authType, user } = useAuth();

    // Redirect device users to their payment page
    if (isAuthenticated() && authType === 'device') {
        return <Navigate to={`/Id/${user.deviceId}`} replace />;
    }

    // Redirect unauthenticated users to login
    if (!isAuthenticated()) {
        return <Navigate to="/admin/login" replace />;
    }

    // Helper to check active path
    const isTabActive = (path) => {
        if (path === '/') {
            return location.pathname === '/';
        }
        return location.pathname.startsWith(path);
    };

    const isSettingsPage = location.pathname.startsWith('/settings');

    const getPageTitle = () => {
        const path = location.pathname;
        if (path === '/') return t('sidebar.dashboard');
        if (path.startsWith('/devices')) return t('sidebar.devices');
        if (path.startsWith('/contracts')) return t('sidebar.contracts');
        if (path.startsWith('/payments')) return t('sidebar.payments');
        if (path.startsWith('/invoices')) return t('sidebar.invoices');
        if (path.startsWith('/settings')) return t('sidebar.settings');
        if (path.startsWith('/reports')) return t('sidebar.reports');
        return 'PocketBike';
    };

    // Only admins can access this layout
    return (
        <div className="admin-layout">
            <header className="mobile-header">
                {isSettingsPage ? (
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

            <AdminSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

            <main ref={contentRef} className={`admin-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
                <Outlet context={{ settingsTab, setSettingsTab }} />
            </main>

            {/* Bottom Navigation Bar for Mobile viewports */}
            {isSettingsPage ? (
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
            ) : (
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
            )}
        </div>
    );
};

export default AdminLayout;
