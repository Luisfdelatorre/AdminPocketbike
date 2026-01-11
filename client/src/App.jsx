import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import './i18n'; // Initialize i18next
import AdminLayout from './components/AdminLayout';
import AdminLogin from './pages/AdminLogin';
import DevicePinLogin from './pages/DevicePinLogin';
import AdminDashboard from './pages/AdminDashboard';
import DeviceSelector from './pages/DeviceSelector';
import Contracts from './pages/Contracts';
import Payments from './pages/Payments';
import Invoices from './pages/Invoices';
import Settings from './pages/Settings';
import PaymentPage from './pages/PaymentPage';

function App() {
    return (
        <HashRouter>
            <AuthProvider>
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
                        <Route path="settings" element={<Settings />} />
                    </Route>

                    {/* Default redirect */}
                    <Route path="*" element={<Navigate to="/admin/login" replace />} />
                </Routes>
            </AuthProvider>
        </HashRouter>
    );
}

export default App;
