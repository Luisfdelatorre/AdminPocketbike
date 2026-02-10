import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import './i18n'; // Initialize i18next

// Lazy Load Pages
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const DevicePinLogin = lazy(() => import('./pages/DevicePinLogin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const DeviceSelector = lazy(() => import('./pages/DeviceSelector'));
const Contracts = lazy(() => import('./pages/Contracts'));
const Payments = lazy(() => import('./pages/Payments'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Users = lazy(() => import('./pages/Users'));
const Companies = lazy(() => import('./pages/Companies'));
const Settings = lazy(() => import('./pages/Settings'));
const PaymentPage = lazy(() => import('./pages/PaymentPage'));

// Simple Loading Component
const LoadingSpinner = () => (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
);

function App() {
    return (
        <HashRouter>
            <AuthProvider>
                <Suspense fallback={<LoadingSpinner />}>
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/admin/login" element={<AdminLogin />} />
                        <Route path="/device/login" element={<DevicePinLogin />} />

                        {/* Public Device Payment Route (PIN protected only) */}
                        <Route path="/Id/:deviceId" element={<PaymentPage />} />

                        {/* Admin Routes */}
                        <Route path="/" element={<AdminLayout />}>
                            <Route index element={<AdminDashboard />} />
                            <Route path="devices" element={<DeviceSelector />} />
                            <Route path="contracts" element={<Contracts />} />
                            <Route path="payments" element={<Payments />} />
                            <Route path="invoices" element={<Invoices />} />
                            <Route path="users" element={<Users />} />
                            <Route path="companies" element={<Companies />} />
                            <Route path="settings" element={<Settings />} />
                        </Route>

                        {/* Default redirect */}
                        <Route path="*" element={<Navigate to="/admin/login" replace />} />
                    </Routes>
                </Suspense>
            </AuthProvider>
        </HashRouter>
    );
}

export default App;
