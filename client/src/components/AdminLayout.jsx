import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useSSE } from '../context/SSEContext';
import AdminSidebar from './AdminSidebar';
import MobileHeader from './MobileHeader';
import MobileBottomNav from './MobileBottomNav';
import './AdminLayout.css';

const AdminLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const contentRef = useRef(null);
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
    const [settingsTab, setSettingsTab] = useState('branding');
    const [companiesTab, setCompaniesTab] = useState('companies');

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

    const { subscribe } = useSSE();

    useEffect(() => {
        contentRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [location.pathname]);

    useEffect(() => {
        const unsub1 = subscribe('payment-updated', (event) => {
            try {
                const data = event.parsedData;
                console.log('💳 Payment Updated via SSE:', data);
                window.dispatchEvent(new CustomEvent('payment-update', { detail: data }));
            } catch (err) {
                console.error('Error parsing SSE event:', err);
            }
        });

        const unsub2 = subscribe('device_update', (event) => {
            try {
                const data = event.parsedData;
                console.log('📡 Device Updated via SSE:', data);
                window.dispatchEvent(new CustomEvent('device-update', { detail: data }));
            } catch (err) {
                console.error('Error parsing SSE device_update event:', err);
            }
        });

        return () => {
            unsub1();
            unsub2();
        };
    }, [subscribe]);

    const { isAuthenticated, authType, user } = useAuth();

    // Redirect device users to their payment page
    if (isAuthenticated() && authType === 'device') {
        return <Navigate to={`/Id/${user.deviceId}`} replace />;
    }

    // Redirect unauthenticated users to login
    if (!isAuthenticated()) {
        return <Navigate to="/admin/login" replace />;
    }

    return (
        <div className="admin-layout">
            <MobileHeader sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

            <AdminSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

            <main ref={contentRef} className={`admin-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
                <Outlet context={{ settingsTab, setSettingsTab, companiesTab, setCompaniesTab }} />
            </main>

            <MobileBottomNav
                settingsTab={settingsTab}
                setSettingsTab={setSettingsTab}
                companiesTab={companiesTab}
                setCompaniesTab={setCompaniesTab}
            />
        </div>
    );
};

export default AdminLayout;
