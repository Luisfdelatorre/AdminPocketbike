import React from 'react';
import { formatCurrency } from '../utils/helpers';

const InvoicesList = ({ invoices }) => {
    if (invoices.length === 0) {
        return (
            <div className="invoices-card">
                <div className="card-header">
                    <h3 className="card-title">📄 Unpaid Invoices</h3>
                    <span className="invoice-count">0</span>
                </div>
                <div className="empty-state">
                    <div className="empty-state-icon">✅</div>
                    <div className="empty-state-text">No unpaid invoices</div>
                </div>
            </div>
        );
    }

    return (
        <div className="invoices-card">
            <div className="card-header">
                <h3 className="card-title">📄 Unpaid Invoices</h3>
                <span className="invoice-count">{invoices.length}</span>
            </div>
            <div className="invoices-list">
                {invoices.map((invoice) => (
                    <div key={invoice.invoiceId} className="invoice-item">
                        <div className="invoice-info">
                            <div className="invoice-date">📅 {invoice.date}</div>
                            <div className="invoice-id">{invoice.invoiceId}</div>
                        </div>
                        <div className="invoice-amount">{formatCurrency(invoice.amount)}</div>
                        <span className={`invoice-status ${invoice.status.toLowerCase()}`}>
                            {invoice.status}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default InvoicesList;
