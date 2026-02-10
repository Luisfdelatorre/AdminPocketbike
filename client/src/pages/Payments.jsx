import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, Calendar, CreditCard, Check, X, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import './Payments.css';
import { getAllPayments } from '../services/api';

const Payments = () => {
    const { t } = useTranslation();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, completed, pending, failed
    const [sortBy, setSortBy] = useState('date'); // date, amount, device
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
    });

    useEffect(() => {
        loadPayments();
    }, [pagination.page, filter]);

    const loadPayments = async () => {
        setLoading(true);
        try {
            // Build query params
            const queryParams = {
                page: pagination.page,
                limit: pagination.limit
            };

            // Add status filter if not 'all'
            if (filter !== 'all') {
                const statusMap = {
                    'completed': 'APPROVED',
                    'pending': 'PENDING',
                    'failed': 'DECLINED'
                };
                if (statusMap[filter]) {
                    queryParams.status = statusMap[filter];
                }
            }

            const result = await getAllPayments(queryParams);

            if (result.success) {
                setPayments(result.payments || []);
                setPagination(prev => ({
                    ...prev,
                    ...result.pagination
                }));
            } else {
                console.error('Failed to load payments:', result.error);
            }
        } catch (error) {
            console.error('Error loading payments:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return `$${(amount / 100).toLocaleString()} COP`;
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        // Optional: meaningful toast or feedback
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatInvoiceId = (invoiceId) => {
        if (!invoiceId) return 'N/A';
        // Format: DEVICE-YYYY-MM-DD (e.g., ZHJ46G-2026-02-02)
        const parts = invoiceId.split('-');
        if (parts.length >= 4) {
            const deviceName = parts[0];
            const year = parts[1];
            const month = parts[2];
            const day = parts[3];

            // Create date object to get month name
            // Note: month is 1-indexed in ID, but 0-indexed in Date constructor if using numbers
            // Using string "YYYY-MM-DD" works reliably
            const dateObj = new Date(`${year}-${month}-${day}T12:00:00`);
            const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });

            // Return "ZHJ46G Feb 2"
            return `${deviceName} ${monthName} ${parseInt(day)}`;
        }
        return invoiceId;
    };

    const getStatusIcon = (status) => {
        switch (status.toUpperCase()) {
            case 'APPROVED':
            case 'COMPLETED':
                return <Check />;
            case 'DECLINED':
            case 'FAILED':
            case 'ERROR':
                return <X />;
            case 'PENDING':
            case 'VERIFYING':
                return <Clock />;
            default:
                return <CreditCard />;
        }
    };

    const getStatusColor = (status) => {
        switch (status.toUpperCase()) {
            case 'APPROVED':
            case 'COMPLETED':
                return '#00C292';
            case 'DECLINED':
            case 'FAILED':
            case 'ERROR':
                return '#EF4444';
            case 'PENDING':
            case 'VERIFYING':
                return '#FB9678';
            default:
                return '#6B7280';
        }
    };

    // Client-side sorting (since backend returns all for current page)
    const sortedPayments = [...payments].sort((a, b) => {
        switch (sortBy) {
            case 'date':
                return new Date(b.createdAt) - new Date(a.createdAt);
            case 'amount':
                return b.amount - a.amount;
            case 'device':
                return a.deviceId.localeCompare(b.deviceId);
            default:
                return 0;
        }
    });

    const totalAmount = payments.reduce((sum, p) => {
        const status = p.status.toUpperCase();
        if (status === 'APPROVED' || status === 'COMPLETED') {
            return sum + p.amount;
        }
        return sum;
    }, 0);

    const completedCount = payments.filter(p => {
        const status = p.status.toUpperCase();
        return status === 'APPROVED' || status === 'COMPLETED';
    }).length;

    const pendingCount = payments.filter(p => {
        const status = p.status.toUpperCase();
        return status === 'PENDING' || status === 'VERIFYING';
    }).length;

    const handlePageChange = (newPage) => {
        setPagination(prev => ({ ...prev, page: newPage }));
    };

    const handleFilterChange = (newFilter) => {
        setFilter(newFilter);
        setPagination(prev => ({ ...prev, page: 1 })); // Reset to page 1 when filter changes
    };

    return (
        <div className="payments-page">
            <div className="page-header">
                <div>
                    <h1>💳 {t('payments.title')}</h1>
                    <p>{t('payments.subtitle')}</p>
                </div>
                <button className="btn-primary" onClick={loadPayments}>
                    🔄 {t('payments.refresh')}
                </button>
            </div>

            {/* Summary Stats */}
            <div className="payment-stats">
                <div className="payment-stat-card">
                    <div className="stat-icon" style={{ background: '#03C9D7' }}>
                        <DollarSign size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">{t('payments.stats.revenue')}</div>
                        <div className="stat-number">{formatCurrency(totalAmount)}</div>
                    </div>
                </div>
                <div className="payment-stat-card">
                    <div className="stat-icon" style={{ background: '#00C292' }}>
                        <Check size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">{t('payments.stats.completed')}</div>
                        <div className="stat-number">{completedCount}</div>
                    </div>
                </div>
                <div className="payment-stat-card">
                    <div className="stat-icon" style={{ background: '#FB9678' }}>
                        <Clock size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">{t('payments.stats.pending')}</div>
                        <div className="stat-number">{pendingCount}</div>
                    </div>
                </div>
                <div className="payment-stat-card">
                    <div className="stat-icon" style={{ background: '#7460EE' }}>
                        <CreditCard size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">{t('payments.stats.total')}</div>
                        <div className="stat-number">{pagination.total}</div>
                    </div>
                </div>
            </div>

            {/* Filters and Sort */}
            <div className="payment-controls">
                <div className="payment-filters">
                    <button
                        className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => handleFilterChange('all')}
                    >
                        {t('payments.filters.all')}
                    </button>
                    <button
                        className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
                        onClick={() => handleFilterChange('completed')}
                    >
                        {t('payments.filters.completed')}
                    </button>
                    <button
                        className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
                        onClick={() => handleFilterChange('pending')}
                    >
                        {t('payments.filters.pending')}
                    </button>
                    <button
                        className={`filter-btn ${filter === 'failed' ? 'active' : ''}`}
                        onClick={() => handleFilterChange('failed')}
                    >
                        {t('payments.filters.failed')}
                    </button>
                </div>
                <select
                    className="sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                >
                    <option value="date">{t('payments.sort.date')}</option>
                    <option value="amount">{t('payments.sort.amount')}</option>
                    <option value="device">{t('payments.sort.device')}</option>
                </select>
            </div>

            {/* Payments Table */}
            <div className="payments-table-container">
                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>{t('payments.loading')}</p>
                    </div>
                ) : sortedPayments.length === 0 ? (
                    <div className="empty-state">
                        <CreditCard size={48} />
                        <h3>{t('payments.empty.title')}</h3>
                        <p>{t('payments.empty.subtitle')}</p>
                    </div>
                ) : (
                    <>
                        <table className="payments-table">
                            <thead>
                                <tr>
                                    <th>{t('payments.table.id')}</th>
                                    <th>{t('payments.table.device')}</th>
                                    <th>{t('payments.table.amount')}</th>
                                    <th>{t('payments.table.status')}</th>
                                    <th>{t('payments.table.reference')}</th>
                                    <th>{t('payments.table.date')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedPayments.map(payment => (
                                    <tr key={payment.paymentId}>
                                        <td className="payment-id" title="Click to copy full ID" onClick={() => copyToClipboard(payment.paymentId)} style={{ cursor: 'pointer' }}>
                                            <code>...{payment.paymentId.split('-').pop()}</code>
                                        </td>
                                        <td><strong>{payment.deviceId}</strong></td>
                                        <td className="amount">{formatCurrency(payment.amount)}</td>
                                        <td>
                                            <span
                                                className="status-badge"
                                                style={{
                                                    background: `${getStatusColor(payment.status)}20`,
                                                    color: getStatusColor(payment.status)
                                                }}
                                            >
                                                {getStatusIcon(payment.status)}
                                                {payment.status}
                                            </span>
                                        </td>
                                        <td className="payment-method">
                                            {formatInvoiceId(payment.invoiceId || payment.unpaidInvoiceId || payment.paymentReference)}
                                        </td>
                                        <td className="date">{formatDate(payment.createdAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination Controls */}
                        {pagination.totalPages > 1 && (
                            <div className="pagination">
                                <button
                                    className="pagination-btn"
                                    onClick={() => handlePageChange(pagination.page - 1)}
                                    disabled={!pagination.hasPrev}
                                >
                                    <ChevronLeft /> {t('payments.pagination.previous')}
                                </button>
                                <span className="pagination-info">
                                    {t('payments.pagination.pageInfo', {
                                        page: pagination.page,
                                        totalPages: pagination.totalPages,
                                        total: pagination.total
                                    })}
                                </span>
                                <button
                                    className="pagination-btn"
                                    onClick={() => handlePageChange(pagination.page + 1)}
                                    disabled={!pagination.hasNext}
                                >
                                    {t('payments.pagination.next')} <ChevronRight />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default Payments;
