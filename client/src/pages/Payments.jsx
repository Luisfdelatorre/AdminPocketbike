import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, DollarSign, Calendar, CreditCard, Check, X, Clock, ChevronLeft, ChevronRight, Download, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import './Payments.css';
import PageHeader from '../components/PageHeader';
import Amount from '../components/Amount';
import DateDisplay from '../components/DateDisplay';
import StatusBadge from '../components/StatusBadge';
import { getAllPayments, exportPaymentsCSV } from '../services/api';
import useFilterVisibilityOnScroll from '../hooks/useFilterVisibilityOnScroll';
import SearchAndFilterBar from '../components/SearchAndFilterBar';
import StatCard from '../components/StatCard';
import useIsMobile from '../hooks/useIsMobile';

const Payments = () => {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
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

    useFilterVisibilityOnScroll(setShowFilters);

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
                    page: Number(result.pagination?.page || 1)
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

    const downloadCSV = async () => {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        try {
            await exportPaymentsCSV(month, year);
        } catch (error) {
            console.error('Error downloading CSV via API, falling back to direct link:', error);
            window.open(`/api/payments/export?month=${month}&year=${year}`, '_blank');
        }
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
            const deviceMatch = p.deviceId && p.deviceId.toString().toLowerCase().includes(query);
            const invoiceMatch = (p.invoiceId || p.unpaidInvoiceId || p.paymentReference || '').toString().toLowerCase().includes(query);
            return deviceMatch || invoiceMatch;
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'date':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                case 'amount':
                    return (b.amount || 0) - (a.amount || 0);
                case 'device':
                    return String(a.deviceId || '').localeCompare(String(b.deviceId || ''));
                default:
                    return 0;
            }
        });

    const totalAmount = payments.reduce((sum, p) => {
        const status = (p.status || '').toUpperCase();
        if (status === 'APPROVED' || status === 'COMPLETED') {
            return sum + (p.amount || 0);
        }
        return sum;
    }, 0);

    const completedCount = payments.filter(p => {
        const status = (p.status || '').toUpperCase();
        return status === 'APPROVED' || status === 'COMPLETED';
    }).length;

    const pendingCount = payments.filter(p => {
        const status = (p.status || '').toUpperCase();
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

    const filterOptions = [
        { value: 'all', label: t('payments.filters.all') },
        { value: 'completed', label: t('payments.filters.completed') },
        { value: 'pending', label: t('payments.filters.pending') },
        { value: 'failed', label: t('payments.filters.failed') }
    ];

    const desktopHeader = (
        <PageHeader.Desktop
            title={t('payments.title')}
            subtitle={t('payments.subtitle')}
            onRefresh={loadPayments}
            loading={loading}
            refreshText={t('payments.refresh')}
            actions={
                <button type="button" className="btn-secondary" onClick={downloadCSV}>
                    <Download size={16} style={{ marginRight: 4 }} /> CSV
                </button>
            }
        />
    );

    const mobileHeader = (
        <PageHeader.Mobile
            onRefresh={loadPayments}
            loading={loading}
            onFilterToggle={() => setShowFilters(!showFilters)}
            showFilters={showFilters}
            leadingActions={
                pagination.totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f3f4f6', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginRight: '4px' }}>
                        <button
                            type="button"
                            onClick={() => handlePageChange(pagination.page - 1)}
                            disabled={!pagination.hasPrev}
                            style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: pagination.hasPrev ? '#1f2937' : '#9ca3af' }}
                            aria-label="Página anterior"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span>{pagination.page}/{pagination.totalPages}</span>
                        <button
                            type="button"
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={!pagination.hasNext}
                            style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: pagination.hasNext ? '#1f2937' : '#9ca3af' }}
                            aria-label="Página siguiente"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                )
            }
        />
    );

    const renderHeader = isMobile ? mobileHeader : desktopHeader;

    return (
        <div className="payments-page">
            {renderHeader}

            {/* Mobile Collapsible Filter Section */}
            <div className={`collapsible-content w-full md:hidden ${showFilters ? 'expanded' : ''}`} id="filterSection">
                <div className="pt-2 pb-1">
                    <SearchAndFilterBar
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        searchPlaceholder={t('invoices.searchPlaceholder')}
                        filter={filter}
                        setFilter={handleFilterChange}
                        filterOptions={filterOptions}
                    />

                    {/* Sort & Action Items */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '0.5rem' }}>
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

            {/* Summary Stats — Minimalist iOS style */}
            <div className="devices-stats-ios payments-stats-grid">
                <StatCard
                    title={t('payments.stats.revenue', 'INGRESOS')}
                    value={<Amount value={totalAmount} />}
                    valueColor="#00C292"
                />
                <StatCard
                    title={t('payments.stats.completed', 'PAGADOS')}
                    value={completedCount}
                    valueColor="#0070eb"
                />
                <StatCard
                    title={t('payments.stats.pending', 'PENDIENTES')}
                    value={pendingCount}
                    valueColor="#FB9678"
                />
                <StatCard
                    title={t('payments.stats.total', 'TOTAL')}
                    value={pagination.total}
                    valueColor="#1a1c1c"
                />
            </div>

            {/* Filters and Sort (Desktop only) */}
            <div className="payment-controls hidden md:flex items-center justify-between gap-4">
                <SearchAndFilterBar
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    searchPlaceholder={t('invoices.searchPlaceholder')}
                    filter={filter}
                    setFilter={handleFilterChange}
                    filterOptions={filterOptions}
                />
                <select
                    className="sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{ minWidth: '150px' }}
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
                                {sortedPayments.map((payment, index) => {
                                    const paymentKey = payment.paymentId || payment._id || `payment-${index}`;
                                    const displayId = String(payment.paymentId || payment._id || '');
                                    const shortId = displayId.includes('-') ? displayId.split('-').pop() : displayId.slice(-6);
                                    return (
                                        <tr key={paymentKey}>
                                            <td className="payment-id desktop-only" title="Click to copy full ID" onClick={() => copyToClipboard(displayId)} style={{ cursor: 'pointer' }}>
                                                <code>...{shortId || 'N/A'}</code>
                                            </td>
                                            <td className="desktop-only"><strong>{payment.deviceId || 'N/A'}</strong></td>
                                            <td className="date"><DateDisplay dateString={payment.createdAt} /></td>
                                            <td className="amount"><Amount value={payment.amount} /></td>
                                            <td>
                                                <StatusBadge 
                                                    status={payment.amount === 0 && (payment.adjustmentType || payment.type === 'ADJUSTMENT') ? (payment.adjustmentType || 'ADJUSTMENT') : payment.status} 
                                                    type={payment.type} 
                                                    adjustmentType={payment.adjustmentType} 
                                                />
                                            </td>
                                            <td className="payment-method">
                                                {formatInvoiceId(payment.invoiceId || payment.unpaidInvoiceId || payment.paymentReference)}
                                            </td>
                                        </tr>
                                    );
                                })}
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
