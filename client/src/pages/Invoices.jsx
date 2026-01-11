import React, { useState, useEffect } from 'react';
import { FileText, Calendar, DollarSign, Check, X, Search, Filter } from 'lucide-react';
import './Invoices.css';

const Invoices = () => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, paid, unpaid, pending
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadInvoices();
    }, []);

    const loadInvoices = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/invoices/all?page=1&limit=1000');
            const result = await response.json();

            if (result.success) {
                setInvoices(result.invoices || []);
            } else {
                console.error('Error loading invoices:', result.error);
            }
        } catch (error) {
            console.error('Error loading invoices:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return `$${(amount / 100).toLocaleString()} COP`;
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getStatusColor = (status) => {
        const colors = {
            'PAID': '#00C292',
            'UNPAID': '#EF4444',
            'PENDING': '#FB9678',
            'CANCELLED': '#6B7280'
        };
        return colors[status] || '#6B7280';
    };

    // Filter invoices
    const filteredInvoices = invoices.filter(invoice => {
        // Status filter
        if (filter !== 'all' && invoice.status.toLowerCase() !== filter.toLowerCase()) {
            return false;
        }

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                invoice.invoiceId.toLowerCase().includes(query) ||
                invoice.deviceId.toLowerCase().includes(query) ||
                invoice.contractId?.toLowerCase().includes(query) ||
                invoice.paymentReference?.toLowerCase().includes(query)
            );
        }

        return true;
    });

    const stats = {
        total: invoices.length,
        paid: invoices.filter(i => i.status === 'PAID').length,
        unpaid: invoices.filter(i => i.status === 'UNPAID').length,
        totalAmount: invoices.reduce((sum, i) => sum + i.amount, 0)
    };

    return (
        <div className="invoices-page">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1>💰 Invoices</h1>
                    <p>View and manage all invoices across devices</p>
                </div>
            </div>

            {/* Stats */}
            <div className="invoices-stats">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#03C9D7' }}>
                        <FileText />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Total Invoices</div>
                        <div className="stat-number">{stats.total}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#00C292' }}>
                        <Check />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Paid</div>
                        <div className="stat-number">{stats.paid}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#EF4444' }}>
                        <X />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Unpaid</div>
                        <div className="stat-number">{stats.unpaid}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#7460EE' }}>
                        <DollarSign />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Total Amount</div>
                        <div className="stat-number">{formatCurrency(stats.totalAmount)}</div>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="invoices-search">
                <div className="search-box">
                    <Search className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search by invoice ID, device ID, contract ID, or payment reference..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            className="clear-search"
                            onClick={() => setSearchQuery('')}
                        >
                            <X />
                        </button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="invoices-filters">
                <button
                    className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    <Filter /> All
                </button>
                <button
                    className={`filter-btn ${filter === 'paid' ? 'active' : ''}`}
                    onClick={() => setFilter('paid')}
                >
                    Paid
                </button>
                <button
                    className={`filter-btn ${filter === 'unpaid' ? 'active' : ''}`}
                    onClick={() => setFilter('unpaid')}
                >
                    Unpaid
                </button>
                <button
                    className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
                    onClick={() => setFilter('pending')}
                >
                    Pending
                </button>
            </div>

            {/* Invoices List */}
            {loading ? (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading invoices...</p>
                </div>
            ) : filteredInvoices.length === 0 ? (
                <div className="empty-state">
                    <FileText size={48} />
                    <h3>No Invoices Found</h3>
                    <p>
                        {searchQuery
                            ? `No invoices match "${searchQuery}"`
                            : filter === 'all'
                                ? 'No invoices have been created yet'
                                : `No ${filter} invoices`}
                    </p>
                </div>
            ) : (
                <>
                    <div className="invoices-table">
                        <div className="table-header">
                            <div>Invoice ID</div>
                            <div>Contract ID</div>
                            <div>Device</div>
                            <div>Date</div>
                            <div>Amount</div>
                            <div>Status</div>
                        </div>
                        {filteredInvoices.map((invoice) => (
                            <div key={invoice.invoiceId} className="table-row">
                                <div className="invoice-id">{invoice.invoiceId}</div>
                                <div className="contract-id">
                                    {invoice.contractId || '-'}
                                </div>
                                <div className="device-id">{invoice.deviceId}</div>
                                <div className="invoice-date">
                                    <Calendar size={14} />
                                    {formatDate(invoice.date)}
                                </div>
                                <div className="invoice-amount">
                                    {formatCurrency(invoice.amount)}
                                </div>
                                <div className="invoice-status">
                                    <span
                                        className="status-badge"
                                        style={{
                                            background: `${getStatusColor(invoice.status)}20`,
                                            color: getStatusColor(invoice.status)
                                        }}
                                    >
                                        {invoice.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="results-info">
                        Showing {filteredInvoices.length} of {invoices.length} invoices
                    </div>
                </>
            )}
        </div>
    );
};

export default Invoices;
