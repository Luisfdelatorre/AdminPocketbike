import React, { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminSidebar from './AdminSidebar';
import './AdminLayout.css';

const AdminLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

    useEffect(() => {
        const handleResize = () => {
            // Only auto-close/open if crossing the breakpoint? 
            // Or just let user control it? 
            // Common pattern: if resizing to desktop, ensure it's open (or not, user pref).
            // For now, simpler is creating the initial state correctly.
            // If the user RESIZES, we might want to adapt, but just fixing the *initial* load is the main request.
            if (window.innerWidth <= 768) {
                setSidebarOpen(false);
            } else {
                setSidebarOpen(true);
            }
        };

        // Optional: Listen to resize to adapt dynamically
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

    // Only admins can access this layout
    return (
        <div className="admin-layout">
            <AdminSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

            <main className={`admin-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
                <Outlet />
            </main>
        </div>
    );
};

export default AdminLayout;
