import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Search, DollarSign, Calendar, CreditCard, Check, X, Clock, ChevronLeft, ChevronRight, Download, ListFilter, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import './Payments.css';
import Amount from '../components/Amount';
import DateDisplay from '../components/DateDisplay';
import StatusBadge from '../components/StatusBadge';
import { getAllPayments } from '../services/api';

const Payments = () => {
    const { t } = useTranslation();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, completed, pending, failed
    const [sortBy, setSortBy] = useState('date'); // date, amount, device
    const [searchQuery, setSearchQuery] = useState(''); // NEW search state
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
    });

    const [showFilters, setShowFilters] = useState(false);
    const [portalElement, setPortalElement] = useState(null);

    useEffect(() => {
        setPortalElement(document.getElementById('mobile-header-actions'));
    }, []);

    useEffect(() => {
        let lastScrollY = window.scrollY;

        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            const diff = currentScrollY - lastScrollY;

            // If scrolling down, hide the filter panel
            if (diff > 10) {
                if (showFilters) {
                    setShowFilters(false);
                }
            }
            // If scrolling up (swipe down), show the filter panel
            else if (diff < -15) {
                if (!showFilters) {
                    setShowFilters(true);
                }
            }

            lastScrollY = currentScrollY;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [showFilters]);

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
                    ...result.pagination,
                    page: Number(result.pagination.page || 1)
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

    const downloadCSV = () => {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        window.open(`/api/payments/export?month=${month}&year=${year}`, '_blank');
    };


    // Legacy formatting functions removed; handled by Amount component

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        // Optional: meaningful toast or feedback
    };

    // Legacy date formatting removed; use DateDisplay component

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
            return `${deviceName}-${monthName}-${parseInt(day)}`;
        }
        return invoiceId;
    };

    // Legacy status helpers removed; use StatusBadge component


    // Client-side filtering and sorting
    const sortedPayments = [...payments]
        .filter(p => {
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            const deviceMatch = p.deviceId && p.deviceId.toLowerCase().includes(query);
            const invoiceMatch = (p.invoiceId || p.unpaidInvoiceId || p.paymentReference || '').toLowerCase().includes(query);
            return deviceMatch || invoiceMatch;
        })
        .sort((a, b) => {
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
        setPagination(prev => ({ ...prev, page: Number(newPage) }));
    };

    const handleFilterChange = (newFilter) => {
        setFilter(newFilter);
        setPagination(prev => ({ ...prev, page: 1 })); // Reset to page 1 when filter changes
    };

    const totalPagePayments = payments.length;
    const totalBilledOnPage = payments.reduce((sum, p) => sum + p.amount, 0);
    const revenuePercentage = totalBilledOnPage > 0 ? Math.round((totalAmount / totalBilledOnPage) * 100) : 0;
    const completedPercentage = totalPagePayments > 0 ? Math.round((completedCount / totalPagePayments) * 100) : 0;
    const pendingPercentage = totalPagePayments > 0 ? Math.round((pendingCount / totalPagePayments) * 100) : 0;

    return (
        <div className="payments-page">
            {portalElement && createPortal(
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {pagination.totalPages > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f3f4f6', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, color: '#4b5563' }}>
                            <button
                                type="button"
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={!pagination.hasPrev}
                                style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: pagination.hasPrev ? '#1f2937' : '#9ca3af' }}
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <span>{pagination.page}/{pagination.totalPages}</span>
                            <button
                                type="button"
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={!pagination.hasNext}
                                style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: pagination.hasNext ? '#1f2937' : '#9ca3af' }}
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    )}
                    <button
                        type="button"
                        className={`p-2 rounded-full transition-colors flex items-center justify-center ${showFilters ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                        onClick={() => setShowFilters(!showFilters)}
                        id="filterToggle"
                        style={{ border: 'none', background: 'none', padding: '8px' }}
                    >
                        <ListFilter size={20} />
                    </button>
                </div>,
                portalElement
            )}

            <div className="page-header hidden md:flex">
                <div>
                    <h1>💳 {t('payments.title')}</h1>
                    <p>{t('payments.subtitle')}</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-primary" onClick={loadPayments} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <RefreshCw size={16} /> {t('payments.refresh')}
                    </button>
                    <button className="btn-primary" onClick={downloadCSV} style={{ background: '#00C292' }}>
                        <Download size={16} style={{ marginRight: 4 }} /> CSV
                    </button>
                </div>
            </div>

            {/* Mobile Collapsible Filter Section (Mobile only) */}
            <div className={`collapsible-content max-w-[380px] mx-auto md:hidden ${showFilters ? 'expanded' : ''}`} id="filterSection">
                <div className="pt-2 pb-1">
                    {/* Search Box */}
                    <div className="search-box" style={{ maxWidth: 'none', marginBottom: '.5rem' }}>
                        <Search className="search-icon" size={18} />
                        <input
                            type="text"
                            placeholder={t('invoices.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                className="clear-search"
                                onClick={() => setSearchQuery('')}
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* Filter Badges (Horizontal scroll, compact) */}
                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', }}>
                        <button
                            type="button"
                            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filter === 'all'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            style={{
                                padding: '4px 12px',
                                borderRadius: '9999px',
                                fontSize: '12px',
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                                border: filter === 'all' ? '1px solid #2563eb' : '1px solid #e5e7eb',
                                backgroundColor: filter === 'all' ? '#2563eb' : 'white',
                                color: filter === 'all' ? 'white' : '#4b5563'
                            }}
                            onClick={() => handleFilterChange('all')}
                        >
                            {t('payments.filters.all')}
                        </button>
                        <button
                            type="button"
                            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filter === 'completed'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            style={{
                                padding: '4px 12px',
                                borderRadius: '9999px',
                                fontSize: '12px',
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                                border: filter === 'completed' ? '1px solid #2563eb' : '1px solid #e5e7eb',
                                backgroundColor: filter === 'completed' ? '#2563eb' : 'white',
                                color: filter === 'completed' ? 'white' : '#4b5563'
                            }}
                            onClick={() => handleFilterChange('completed')}
                        >
                            {t('payments.filters.completed')}
                        </button>
                        <button
                            type="button"
                            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filter === 'pending'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            style={{
                                padding: '4px 12px',
                                borderRadius: '9999px',
                                fontSize: '12px',
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                                border: filter === 'pending' ? '1px solid #2563eb' : '1px solid #e5e7eb',
                                backgroundColor: filter === 'pending' ? '#2563eb' : 'white',
                                color: filter === 'pending' ? 'white' : '#4b5563'
                            }}
                            onClick={() => handleFilterChange('pending')}
                        >
                            {t('payments.filters.pending')}
                        </button>
                        <button
                            type="button"
                            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filter === 'failed'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            style={{
                                padding: '4px 12px',
                                borderRadius: '9999px',
                                fontSize: '12px',
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                                border: filter === 'failed' ? '1px solid #2563eb' : '1px solid #e5e7eb',
                                backgroundColor: filter === 'failed' ? '#2563eb' : 'white',
                                color: filter === 'failed' ? 'white' : '#4b5563'
                            }}
                            onClick={() => handleFilterChange('failed')}
                        >
                            {t('payments.filters.failed')}
                        </button>
                    </div>

                    {/* Sort & Action Items */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select
                            className="sort-select"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            style={{ flexGrow: 1, padding: '8px 12px' }}
                        >
                            <option value="date">{t('payments.sort.date')}</option>
                            <option value="amount">{t('payments.sort.amount')}</option>
                            <option value="device">{t('payments.sort.device')}</option>
                        </select>
                        <button className="filter-action-btn" onClick={loadPayments} style={{ height: '38px', width: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={t('payments.refresh')}>
                            <RefreshCw size={18} />
                        </button>
                        <button className="filter-action-btn" onClick={downloadCSV} style={{ height: '38px', width: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Descargar CSV">
                            <Download size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="payment-stats">
                <div className="payment-stat-card">
                    <div className="stat-icon" style={{ background: '#03C9D7' }}>
                        <DollarSign size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">{t('payments.stats.revenue')}</div>
                        <div className="stat-value-container">
                            <span className="stat-number"><Amount value={totalAmount} /></span>
                            {revenuePercentage > 0 && (
                                <span className="stat-change-inline positive">
                                    <TrendingUp size={14} />
                                    {revenuePercentage}%
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="payment-stat-card">
                    <div className="stat-icon" style={{ background: '#00C292' }}>
                        <Check size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">{t('payments.stats.completed')}</div>
                        <div className="stat-value-container">
                            <span className="stat-number">{completedCount}</span>
                            {completedPercentage > 0 && (
                                <span className="stat-change-inline positive">
                                    <TrendingUp size={14} />
                                    {completedPercentage}%
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="payment-stat-card">
                    <div className="stat-icon" style={{ background: '#FB9678' }}>
                        <Clock size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">{t('payments.stats.pending')}</div>
                        <div className="stat-value-container">
                            <span className="stat-number">{pendingCount}</span>
                            {pendingPercentage > 0 && (
                                <span className="stat-change-inline negative">
                                    <TrendingDown size={14} />
                                    {pendingPercentage}%
                                </span>
                            )}
                        </div>
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

            {/* Filters and Sort (Desktop only) */}
            <div className="payment-controls hidden md:flex">
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
                                    <th className="desktop-only">{t('payments.table.id')}</th>
                                    <th className="desktop-only">{t('payments.table.device')}</th>
                                    <th>{t('payments.table.date')}</th>
                                    <th>{t('payments.table.amount')}</th>
                                    <th>{t('payments.table.status')}</th>
                                    <th>{t('payments.table.reference')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedPayments.map(payment => (
                                    <tr key={payment.paymentId}>
                                        <td className="payment-id desktop-only" title="Click to copy full ID" onClick={() => copyToClipboard(payment.paymentId)} style={{ cursor: 'pointer' }}>
                                            <code>...{payment.paymentId.split('-').pop()}</code>
                                        </td>
                                        <td className="desktop-only"><strong>{payment.deviceId}</strong></td>
                                        <td className="date"><DateDisplay dateString={payment.createdAt} /></td>
                                        <td className="amount"><Amount value={payment.amount} /></td>
                                        <td>
                                            <StatusBadge status={payment.status} />
                                        </td>
                                        <td className="payment-method">
                                            {formatInvoiceId(payment.invoiceId || payment.unpaidInvoiceId || payment.paymentReference)}
                                        </td>
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
                                    <ChevronLeft size={16} />
                                    <span className="desktop-only" style={{ marginLeft: '4px' }}>{t('payments.pagination.previous')}</span>
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
                                    <span className="desktop-only" style={{ marginRight: '4px' }}>{t('payments.pagination.next')}</span>
                                    <ChevronRight size={16} />
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
