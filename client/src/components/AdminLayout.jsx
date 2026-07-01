import React, { useState, useEffect } from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, Users, FileText, CreditCard, DollarSign, Image as ImageIcon, Settings as SettingsIcon, Database, RefreshCw, ArrowLeft } from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import './AdminLayout.css';

const AdminLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
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

    // Only admins can access this layout
    return (
        <div className="admin-layout">
            <AdminSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

            <main className={`admin-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
                <Outlet context={{ settingsTab, setSettingsTab }} />
            </main>

            {/* Bottom Navigation Bar for Mobile viewports */}
            {isSettingsPage ? (
                <div className="mobile-bottom-nav">
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
                </div>
            ) : (
                <div className="mobile-bottom-nav">
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
                </div>
            )}
        </div>
    );
};

export default AdminLayout;

