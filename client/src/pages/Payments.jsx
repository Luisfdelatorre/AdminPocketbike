import React, { useState, useEffect } from 'react';
import { DollarSign, Calendar, CreditCard, Check, X, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import './Payments.css';

const Payments = () => {
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
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString()
            });

            // Add status filter if not 'all'
            if (filter !== 'all') {
                const statusMap = {
                    'completed': 'APPROVED',
                    'pending': 'PENDING',
                    'failed': 'DECLINED'
                };
                if (statusMap[filter]) {
                    params.append('status', statusMap[filter]);
                }
            }

            const response = await fetch(`/api/payments/all?${params}`);
            const result = await response.json();

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
                    <h1>💳 Payments History</h1>
                    <p>View and manage all payment transactions</p>
                </div>
                <button className="btn-primary" onClick={loadPayments}>
                    🔄 Refresh
                </button>
            </div>

            {/* Summary Stats */}
            <div className="payment-stats">
                <div className="payment-stat-card">
                    <div className="stat-icon" style={{ background: '#03C9D7' }}>
                        <DollarSign size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Total Revenue (Current Page)</div>
                        <div className="stat-number">{formatCurrency(totalAmount)}</div>
                    </div>
                </div>
                <div className="payment-stat-card">
                    <div className="stat-icon" style={{ background: '#00C292' }}>
                        <Check size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Completed (Page)</div>
                        <div className="stat-number">{completedCount}</div>
                    </div>
                </div>
                <div className="payment-stat-card">
                    <div className="stat-icon" style={{ background: '#FB9678' }}>
                        <Clock size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Pending (Page)</div>
                        <div className="stat-number">{pendingCount}</div>
                    </div>
                </div>
                <div className="payment-stat-card">
                    <div className="stat-icon" style={{ background: '#7460EE' }}>
                        <CreditCard size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Total Transactions</div>
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
                        All
                    </button>
                    <button
                        className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
                        onClick={() => handleFilterChange('completed')}
                    >
                        Completed
                    </button>
                    <button
                        className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
                        onClick={() => handleFilterChange('pending')}
                    >
                        Pending
                    </button>
                    <button
                        className={`filter-btn ${filter === 'failed' ? 'active' : ''}`}
                        onClick={() => handleFilterChange('failed')}
                    >
                        Failed
                    </button>
                </div>
                <select
                    className="sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                >
                    <option value="date">Sort by Date</option>
                    <option value="amount">Sort by Amount</option>
                    <option value="device">Sort by Device</option>
                </select>
            </div>

            {/* Payments Table */}
            <div className="payments-table-container">
                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading payments...</p>
                    </div>
                ) : sortedPayments.length === 0 ? (
                    <div className="empty-state">
                        <CreditCard size={48} />
                        <h3>No payments found</h3>
                        <p>No transactions match your current filter</p>
                    </div>
                ) : (
                    <>
                        <table className="payments-table">
                            <thead>
                                <tr>
                                    <th>Payment ID</th>
                                    <th>Device</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Method</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedPayments.map(payment => (
                                    <tr key={payment.paymentId}>
                                        <td className="payment-id">
                                            <code>{payment.paymentId}</code>
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
                                            {payment.paymentMethod || 'N/A'}
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
                                    <ChevronLeft /> Previous
                                </button>
                                <span className="pagination-info">
                                    Page {pagination.page} of {pagination.totalPages}
                                    ({pagination.total} total)
                                </span>
                                <button
                                    className="pagination-btn"
                                    onClick={() => handlePageChange(pagination.page + 1)}
                                    disabled={!pagination.hasNext}
                                >
                                    Next <ChevronRight />
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
