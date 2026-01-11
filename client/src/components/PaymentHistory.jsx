import React from 'react';
import { formatCurrency, getStatusIcon } from '../utils/helpers';

const PaymentHistory = ({ history, onRefresh }) => {
    return (
        <div className="history-card">
            <div className="card-header">
                <h3 className="card-title">📜 Payment History</h3>
                <button className="btn-secondary btn-refresh" onClick={onRefresh}>
                    <span className="btn-icon">🔄</span>
                    Refresh
                </button>
            </div>
            <div className="history-list">
                {history.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📜</div>
                        <div className="empty-state-text">No payment history</div>
                    </div>
                ) : (
                    history.map((item) => {
                        const statusIcon = getStatusIcon(item.status);
                        const statusText = item.payment ? item.payment.status : item.status;

                        return (
                            <div key={item.invoiceId} className="history-item">
                                <div className="history-icon">{statusIcon}</div>
                                <div className="history-info">
                                    <h4>📅 {item.date}</h4>
                                    <p>{item.invoiceId}</p>
                                </div>
                                <div className="history-amount">
                                    <span className="amount">{formatCurrency(item.amount)}</span>
                                    <span className="status">{statusText}</span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default PaymentHistory;
