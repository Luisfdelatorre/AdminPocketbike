import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Calendar, DollarSign, Check, X, Search, Filter } from 'lucide-react';
import './Invoices.css';
import { getAllInvoices, getInvoiceStats } from '../services/api';

const Invoices = () => {
    const { t } = useTranslation();
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, paid, unpaid, pending
    const [searchQuery, setSearchQuery] = useState('');

    const [stats, setStats] = useState({
        total: 0,
        paid: 0,
        unpaid: 0,
        totalAmount: 0
    });

    useEffect(() => {
        loadInvoices();
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const result = await getInvoiceStats();
            if (result.success) {
                setStats(result.stats);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const loadInvoices = async () => {
        setLoading(true);
        try {
            const result = await getAllInvoices({ page: 1, limit: 50 });

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
        return `$${(amount).toLocaleString()} COP`;
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
            'PAID': '#3b64c6',
            'DEBT': '#EF4444',
            'LOAN': '#00c292',
            'FREE': '#00c292',
            'PENDING': '#FB9678',
            'CANCELLED': '#6B7280'
        };
        return colors[status] || '#6B7280';
    };

    // Filter invoices
    const filteredInvoices = invoices.filter(invoice => {
        // Status filter
        if (filter !== 'all' && invoice.dayType.toLowerCase() !== filter.toLowerCase()) {
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

    return (
        <div className="invoices-page">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1>{t('invoices.title')}</h1>
                </div>
            </div>

            {/* Stats */}
            <div className="invoices-stats">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#03C9D7' }}>
                        <FileText />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Total</div>
                        <div className="stat-number">{stats.total}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#00C292' }}>
                        <Check />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">{t('invoices.filterPaid')}</div>
                        <div className="stat-number">{stats.paid}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#EF4444' }}>
                        <X />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">{t('invoices.filterUnpaid')}</div>
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



            {/* Filters */}
            <div className="invoices-filters">
                <button
                    className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    <Filter /> {t('invoices.filterAll')}
                </button>
                <button
                    className={`filter-btn ${filter === 'paid' ? 'active' : ''}`}
                    onClick={() => setFilter('paid')}
                >
                    {t('invoices.filterPaid')}
                </button>
                <button
                    className={`filter-btn ${filter === 'unpaid' ? 'active' : ''}`}
                    onClick={() => setFilter('unpaid')}
                >
                    {t('invoices.filterUnpaid')}
                </button>
                <button
                    className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
                    onClick={() => setFilter('pending')}
                >
                    {t('invoices.filterPending')}
                </button>
                <div className="search-box">
                    <Search className="search-icon" />
                    <input
                        type="text"
                        placeholder={t('invoices.searchPlaceholder')}
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

            {/* Invoices List */}
            {loading ? (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>{t('common.loading')}</p>
                </div>
            ) : filteredInvoices.length === 0 ? (
                <div className="empty-state">
                    <FileText size={48} />
                    <h3>{t('invoices.empty')}</h3>
                    <p>
                        {searchQuery
                            ? `"${searchQuery}"`
                            : t('invoices.empty')}
                    </p>
                </div>
            ) : (
                <>
                    <div className="invoices-table">
                        <div className="table-header">
                            <div>ID Factura</div>
                            <div>{t('login.deviceId')}</div>
                            <div>Date</div>
                            <div>Amount</div>
                            <div>{t('common.status')}</div>
                        </div>
                        {filteredInvoices.map((invoice) => (
                            <div key={invoice.invoiceId} className="table-row">
                                <div className="invoice-id">{invoice.invoiceId}</div>
                                <div className="device-id">{invoice.deviceIdName}</div>
                                <div className="invoice-date">
                                    <Calendar size={14} />
                                    {formatDate(invoice.date)}
                                </div>
                                <div className="invoice-amount">
                                    {formatCurrency(invoice.paidAmount)}
                                </div>
                                <div className="invoice-status">
                                    <span
                                        className="status-badge"
                                        style={{
                                            background: `${getStatusColor(invoice.dayType)}20`,
                                            color: getStatusColor(invoice.dayType)
                                        }}
                                    >
                                        {invoice.dayType}
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
