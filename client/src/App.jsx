import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SSEProvider } from './context/SSEContext';
import { StatusConfigProvider } from './context/StatusConfigContext';
import { pageLoaders } from './routes/pageLoaders';
import './i18n'; // Initialize i18next

// Lazy Load Pages
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const DevicePinLogin = lazy(() => import('./pages/DevicePinLogin'));
const AdminDashboard = lazy(pageLoaders.AdminDashboard);
const DeviceSelector = lazy(pageLoaders.DeviceSelector);
const Contracts = lazy(pageLoaders.Contracts);
const Payments = lazy(pageLoaders.Payments);
const PaymentSummary = lazy(pageLoaders.PaymentSummary);
const Invoices = lazy(pageLoaders.Invoices);
const Users = lazy(pageLoaders.Users);
const Companies = lazy(pageLoaders.Companies);
const Settings = lazy(pageLoaders.Settings);
const PaymentPage = lazy(() => import('./pages/PaymentPage'));
const Reports = lazy(pageLoaders.Reports);
const CompanyInvoices = lazy(pageLoaders.CompanyInvoices);
const CommandHistory = lazy(pageLoaders.CommandHistory);
const Alerts = lazy(pageLoaders.Alerts);
const AiTelemetry = lazy(pageLoaders.AiTelemetry);

// Full-screen loader: only for the login page and the first load of the admin layout.
// Tab pages suspend inside AdminLayout's content area instead.
const LoadingSpinner = () => (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
);

function App() {
    return (
        // v7_startTransition: tab navigations run in a transition, so React keeps the
        // current tab on screen instead of flashing a loader while the next one loads.
        <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
                <SSEProvider>
                    <StatusConfigProvider>
                        <Suspense fallback={<LoadingSpinner />}>
                            <Routes>
                                {/* Public Routes */}
                                <Route path="/admin/login" element={<AdminLogin />} />
                                {/* <Route path="/device/login" element={<DevicePinLogin />} />

                                Public Device Payment Route (PIN protected only) 
                                <Route path="/Id/:deviceId" element={<PaymentPage />} />
                                */}

                                {/* Admin Routes */}
                                <Route path="/" element={<AdminLayout />}>
                                    <Route index element={<AdminDashboard />} />
                                    <Route path="devices" element={<DeviceSelector />} />
                                    <Route path="contracts" element={<Contracts />} />
                                    <Route path="payments" element={<Payments />} />
                                    <Route path="summary" element={<PaymentSummary />} />
                                    <Route path="invoices" element={<Invoices />} />
                                    <Route path="users" element={<Users />} />
                                    <Route path="companies" element={<Companies />} />
                                    <Route path="settings" element={<Settings />} />
                                    <Route path="reports" element={<Reports />} />
                                    <Route path="company-invoices" element={<CompanyInvoices />} />
                                    <Route path="commands" element={<CommandHistory />} />
                                    <Route path="historial-comandos" element={<Navigate to="/commands" replace />} />
                                    <Route path="alerts" element={<Alerts />} />
                                    <Route path="alertas" element={<Navigate to="/alerts" replace />} />
                                    <Route path="ai-telemetry" element={<AiTelemetry />} />
                                </Route>

                                {/* Default redirect */}
                                <Route path="*" element={<Navigate to="/admin/login" replace />} />
                            </Routes>
                        </Suspense>
                    </StatusConfigProvider>
                </SSEProvider>
            </AuthProvider>
        </HashRouter>
    );
}

export default App;
