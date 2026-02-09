import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import './i18n';
import './index.css';
import '../css/styles.css';

// Lazy load the Payment Page only
const PaymentPage = lazy(() => import('./pages/PaymentPage'));

// Simple spinner for the payment page load
const LoadingSpinner = () => (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
);

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <HashRouter>
            <AuthProvider>
                <Suspense fallback={<LoadingSpinner />}>
                    <Routes>
                        {/* Direct route for payment */}
                        <Route path="/Id/:deviceId" element={<PaymentPage />} />

                        {/* If they hit root or unknown, verify checking their session or redirect? 
                            Since this is a dedicated payment portal, maybe just show a generic 'Not Found' 
                            or redirect to main site? For now, let's just keep it focused. 
                            Users are expected to come in via /#/Id/xyz 
                        */}
                    </Routes>
                </Suspense>
            </AuthProvider>
        </HashRouter>
    </React.StrictMode>
);
