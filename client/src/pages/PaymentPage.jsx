import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUnpaidInvoices, getPaymentHistory, createPaymentIntent } from '../services/api';
import InvoicesList from '../components/InvoicesList';
import PaymentCard from '../components/PaymentCard';
import PaymentHistory from '../components/PaymentHistory';
import ContractStats from '../components/ContractStats';
import '../components/ContractStats.css';
import './PaymentPage.css';
import { showToast } from '../utils/toast';

const PaymentPage = () => {
    const { deviceId } = useParams();
    const navigate = useNavigate();
    const { hasDeviceAccess, loginDevice, authType } = useAuth();

    const [loading, setLoading] = useState(true);
    const [invoices, setInvoices] = useState([]);
    const [history, setHistory] = useState([]);
    const [paymentStatus, setPaymentStatus] = useState(null);

    // PIN authentication state
    const [showPinModal, setShowPinModal] = useState(false);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [authenticating, setAuthenticating] = useState(false);

    // Check if user has access to this device
    useEffect(() => {
        if (!hasDeviceAccess(deviceId)) {
            // No access, show PIN modal
            setShowPinModal(true);
        } else {
            // Has access, load data
            if (deviceId) {
                loadDeviceData();
            }
        }
    }, [deviceId, authType]);

    useEffect(() => {
        // Listen for payment updates from SSE
        const handlePaymentUpdate = (event) => {
            const data = event.detail;
            console.log('Payment update received:', data);

            if (data.paymentStatus === 'APPROVED') {
                showToast('success', 'Payment Approved', 'Your payment was successful!');
                setTimeout(() => {
                    loadDeviceData();
                    setPaymentStatus(null);
                }, 3000);
            } else if (data.paymentStatus === 'DECLINED') {
                showToast('error', 'Payment Declined', 'Payment was not successful');
                setTimeout(() => setPaymentStatus(null), 3000);
            }
        };

        window.addEventListener('payment-update', handlePaymentUpdate);

        return () => {
            window.removeEventListener('payment-update', handlePaymentUpdate);
        };
    }, []);

    const loadDeviceData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                loadUnpaidInvoices(),
                loadPaymentHistory()
            ]);
        } catch (error) {
            console.error('Error loading device data:', error);
            showToast('error', 'Loading Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const loadUnpaidInvoices = async () => {
        try {
            const result = await getUnpaidInvoices(deviceId);

            if (!result.success) {
                throw new Error(result.error);
            }

            setInvoices(result.data);
        } catch (error) {
            console.error('Error loading invoices:', error);
            showToast('error', 'Error', 'Failed to load invoices');
        }
    };

    const loadPaymentHistory = async () => {
        try {
            const result = await getPaymentHistory(deviceId, { limit: 20 });

            if (!result.success) {
                throw new Error(result.error);
            }

            setHistory(result.data);
        } catch (error) {
            console.error('Error loading history:', error);
        }
    };

    const handlePayment = async () => {
        try {
            setPaymentStatus({ type: 'pending', message: 'Processing...', details: 'Creating payment intent...' });

            const result = await createPaymentIntent({
                deviceId,
                customerEmail: 'customer@example.com',
            });

            if (!result.success) {
                throw new Error(result.error);
            }

            const { checkoutUrl, payment } = result.data;

            setPaymentStatus({
                type: 'pending',
                message: 'Payment Created',
                details: `Reference: ${payment.paymentReference}`,
            });

            // Open Wompi checkout
            window.open(checkoutUrl, '_blank');

            showToast('info', 'Payment Initiated', 'Complete payment in the new window');
        } catch (error) {
            console.error('Payment error:', error);
            showToast('error', 'Payment Error', error.message);
            setPaymentStatus(null);
        }
    };

    const handlePinSubmit = async (e) => {
        e.preventDefault();

        if (pin.length !== 4) {
            setPinError('PIN must be 4 digits');
            return;
        }

        setAuthenticating(true);
        setPinError('');

        const result = await loginDevice(deviceId, pin);

        if (result.success) {
            setShowPinModal(false);
            setPin('');
            loadDeviceData();
        } else {
            setPinError(result.error || 'Invalid PIN');
            setPin('');
        }

        setAuthenticating(false);
    };

    const handlePinChange = (value) => {
        // Only allow numbers
        if (/^\d*$/.test(value) && value.length <= 4) {
            setPin(value);
            setPinError('');
        }
    };

    // Show PIN modal if no access
    if (showPinModal) {
        return (
            <div style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }}>
                <div style={{
                    background: 'white',
                    borderRadius: '1rem',
                    padding: '2rem',
                    maxWidth: '400px',
                    width: '90%',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                }}>
                    <h2 style={{ color: '#1F2937', marginBottom: '0.5rem', fontSize: '1.5rem' }}>
                        🔒 Enter PIN
                    </h2>
                    <p style={{ color: '#6B7280', marginBottom: '1.5rem' }}>
                        Please enter the 4-digit PIN for device <strong>{deviceId}</strong>
                    </p>

                    <form onSubmit={handlePinSubmit}>
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={pin}
                            onChange={(e) => handlePinChange(e.target.value)}
                            placeholder="••••"
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '1rem',
                                fontSize: '2rem',
                                textAlign: 'center',
                                letterSpacing: '1rem',
                                border: `2px solid ${pinError ? '#EF4444' : '#D1D5DB'}`,
                                borderRadius: '0.5rem',
                                marginBottom: '1rem',
                                color: '#1F2937'
                            }}
                        />

                        {pinError && (
                            <p style={{ color: '#EF4444', fontSize: '0.875rem', marginBottom: '1rem' }}>
                                {pinError}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={authenticating || pin.length !== 4}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: authenticating || pin.length !== 4 ? '#9CA3AF' : '#03C9D7',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.5rem',
                                fontSize: '1rem',
                                fontWeight: '600',
                                cursor: authenticating || pin.length !== 4 ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {authenticating ? 'Verifying...' : 'Submit'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    const oldestInvoice = invoices.length > 0 ? invoices[0] : null;

    return (
        <div className="payment-page-container">
            <div className="payment-section" style={{
                width: '100%',
                maxWidth: '1200px',
                margin: '0 auto',
            }}>
                {/* Device Info */}
                <div className="info-card" style={{
                    marginBottom: '2rem',
                    background: 'white',
                    borderRadius: '0.75rem',
                    padding: '1.5rem',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    border: '1px solid #E5E7EB'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h2 className="section-title" style={{
                                marginBottom: '0.5rem',
                                color: '#1F2937',
                                fontSize: '1.5rem',
                                fontWeight: '700'
                            }}>
                                🏍️ Device: {deviceId}
                            </h2>
                            <p style={{
                                color: '#6B7280',
                                fontSize: '0.875rem',
                                margin: 0
                            }}>
                                {invoices.length} unpaid invoice{invoices.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                        {/* Only show Back to Devices button for admin users */}
                        {authType === 'admin' && (
                            <button
                                className="btn-secondary"
                                onClick={() => navigate('/devices')}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: '#F3F4F6',
                                    color: '#1F2937',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '0.5rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.target.style.background = '#E5E7EB'}
                                onMouseLeave={(e) => e.target.style.background = '#F3F4F6'}
                            >
                                ← Back to Devices
                            </button>
                        )}
                    </div>
                </div>
                {/* Payment Card */}
                <PaymentCard
                    oldestInvoice={oldestInvoice}
                    onPayment={handlePayment}
                    paymentStatus={paymentStatus}
                />
                {/* Contract Progress */}
                <ContractStats deviceId={deviceId} />

                {/* Invoices */}
                <InvoicesList invoices={invoices} />



                {/* History */}
                <PaymentHistory history={history} onRefresh={loadDeviceData} />
            </div>
        </div>
    );
};

export default PaymentPage;
