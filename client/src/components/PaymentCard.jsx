import React from 'react';
import { formatCurrency } from '../utils/helpers';

const PaymentCard = ({ oldestInvoice, onPayment, paymentStatus }) => {
    const amount = oldestInvoice ? oldestInvoice.amount : 0;
    const hasInvoices = oldestInvoice !== null;

    return (
        <div className="payment-card">
            <div className="payment-header">
                <h3 className="card-title">💰 Payment</h3>
                <div className="payment-amount">
                    <span className="currency">COP $</span>
                    <span className="amount">{formatCurrency(amount)}</span>
                </div>
            </div>

            <div className="payment-body">
                <div className="payment-info">
                    {hasInvoices ? (
                        <>
                            <p className="info-text">📅 Oldest unpaid invoice: {oldestInvoice.date}</p>
                            <p className="info-text">💰 Amount: {formatCurrency(amount)} COP</p>
                        </>
                    ) : (
                        <p className="info-text">✅ All invoices are paid!</p>
                    )}
                </div>

                <button
                    className="btn-primary btn-pay"
                    onClick={onPayment}
                    disabled={!hasInvoices || paymentStatus !== null}
                >
                    <span className="btn-icon">🚀</span>
                    <span className="btn-text">
                        {paymentStatus ? 'Processing...' : 'Pay Now'}
                    </span>
                </button>
            </div>

            {/* Payment Status */}
            {paymentStatus && (
                <div className="payment-status">
                    <div className="status-content">
                        <div className="status-icon">
                            {paymentStatus.type === 'pending' ? '⏳' : paymentStatus.type === 'success' ? '✅' : '❌'}
                        </div>
                        <div className="status-message">{paymentStatus.message}</div>
                        <div className="status-details">{paymentStatus.details}</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentCard;
