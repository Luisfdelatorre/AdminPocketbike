import React, { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminSidebar from './AdminSidebar';
import './AdminLayout.css';

const AdminLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
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
