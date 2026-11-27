import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Search, DollarSign, Calendar, CreditCard, Check, X, Clock,
    ChevronLeft, ChevronRight, Download, TrendingUp, TrendingDown,
    RefreshCw, CheckCircle2, AlertCircle, Gift, FileText, SlidersHorizontal, ChevronDown
} from 'lucide-react';
import './Payments.css';
import PageHeader from '../components/PageHeader';
import Amount from '../components/Amount';
import DateDisplay from '../components/DateDisplay';
import StatusBadge from '../components/StatusBadge';
import MonthYearSelector from '../components/MonthYearSelector';
import { getAllPayments, exportPaymentsCSV } from '../services/api';
import SearchAndFilterBar from '../components/SearchAndFilterBar';
import StatCard from '../components/StatCard';
import MobileMetricsCard from '../components/MobileMetricsCard';
import useIsMobile from '../hooks/useIsMobile';
import useAssistantScreenBridge from '../hooks/useAssistantScreenBridge';
import { usePaymentsFirstPageQuery, PAYMENTS_PAGE_SIZE } from '../hooks/useScreenQueries';

const PaymentMobileRow = ({ payment }) => {
    const status = (payment.status || '').toUpperCase();
    const type = (payment.type || '').toUpperCase();
    const isFree = payment.amount === 0 && (type === 'FREE' || payment.isFree || status === 'FREE');
    const isAdjustment = payment.amount === 0 && (payment.adjustmentType || type === 'ADJUSTMENT' || status === 'ADJUSTMENT' || isFree);
    const isApproved = !isAdjustment && (status === 'APPROVED' || status === 'COMPLETED');
    const isPending = !isAdjustment && (status === 'PENDING' || status === 'VERIFYING');
    const isDeclined = !isAdjustment && (status === 'DECLINED' || status === 'ERROR' || status === 'FAILED');

    const deviceName = payment.deviceId || 'N/A';
    const amount = payment.amount || 0;

    // Date & time of payment
    const paymentRawDate = payment.createdAt;
    let paymentTimeStr = '';
    if (paymentRawDate) {
        const pDate = new Date(paymentRawDate);
        if (!isNaN(pDate.getTime())) {
            let hours = pDate.getHours();
            const minutes = String(pDate.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'pm' : 'am';
            hours = hours % 12 || 12;
            const day = pDate.getDate();
            const month = pDate.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
            paymentTimeStr = `${day} ${month}, ${hours}:${minutes} ${ampm}`;
        }
    }

    // Format reference cut date (e.g. 30 nov)
    const formatReferenceDate = (ref) => {
        if (!ref) return '';
        const parts = String(ref).split('-');
        if (parts.length >= 4) {
            const day = parseInt(parts[3], 10);
            const monthNum = parseInt(parts[2], 10);
            const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
            const month = (monthNum >= 1 && monthNum <= 12) ? monthNames[monthNum - 1] : parts[2];
            if (!isNaN(day)) return `${day} ${month}`;
        }
        return '';
    };

    const referenceDate = formatReferenceDate(payment.invoiceId || payment.unpaidInvoiceId || payment.paymentReference);

    return (
        <div className="payment-mobile-row-wrapper select-none">
            <article className="payment-mobile-row-card">
                <div className={`payment-avatar-circle ${isApproved ? 'avatar-approved' : isPending ? 'avatar-pending' : isAdjustment ? 'avatar-adjustment' : 'avatar-declined'}`}>
                    {isApproved ? (
                        <CheckCircle2 size={18} strokeWidth={2.3} />
                    ) : isPending ? (
                        <Clock size={18} strokeWidth={2.3} />
                    ) : isAdjustment ? (
                        <Gift size={18} strokeWidth={2} />
                    ) : (
                        <AlertCircle size={18} strokeWidth={2.3} />
                    )}
                </div>

                <div className="payment-mobile-inset-content">
                    <div className="payment-mobile-info-left">
                        <div className="payment-mobile-title-row">
                            <span className="payment-mobile-id">{deviceName}</span>
                            {referenceDate && (
                                <span className="payment-mobile-cut-date">{referenceDate}</span>
                            )}
                        </div>
                        <p className="payment-mobile-subtitle">
                            {paymentTimeStr || (payment.invoiceId || 'Pago registrado')}
                        </p>
                    </div>

                    <div className="payment-mobile-info-right">
                        <span className="payment-mobile-amount">
                            ${amount.toLocaleString()}
                        </span>
                        <span className={`payment-mobile-badge ${isApproved ? 'badge-approved' : isPending ? 'badge-pending' : isAdjustment ? 'badge-adjustment' : 'badge-declined'}`}>
                            {isApproved ? (
                                <>
                                    <CheckCircle2 size={11} strokeWidth={2.5} /> APROBADO
                                </>
                            ) : isPending ? (
                                <>
                                    <Clock size={11} strokeWidth={2.5} /> PENDIENTE
                                </>
                            ) : isAdjustment ? (
                                <>
                                    <CheckCircle2 size={11} strokeWidth={2.5} /> {payment.adjustmentType || (isFree ? 'GRATIS' : 'AJUSTE')}
                                </>
                            ) : (
                                <>
                                    <AlertCircle size={11} strokeWidth={2.5} /> RECHAZADO
                                </>
                            )}
                        </span>
                    </div>
                </div>
            </article>
        </div>
    );
};

const Payments = () => {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    // Page 1 is cached per month/year: coming back to the tab paints it instantly.
    // Later pages (infinite scroll / pagination) stay local to the screen.
    const firstPage = usePaymentsFirstPageQuery({ month: selectedMonth, year: selectedYear });
    const [payments, setPayments] = useState(() => firstPage.data?.payments ?? []);
    const [pageLoading, setPageLoading] = useState(false);
    const loading = firstPage.isPending || pageLoading;
    const [loadingMore, setLoadingMore] = useState(false);
    const [filter, setFilter] = useState('all'); // all, completed, pending, failed
    const [datePreset, setDatePreset] = useState('all'); // all, today, yesterday, last_7_days
    const [sortBy, setSortBy] = useState('date'); // date, amount, device
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [pagination, setPagination] = useState(() => ({
        page: 1,
        limit: PAYMENTS_PAGE_SIZE,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
        ...(firstPage.data?.pagination || {}),
    }));

    // State and refs
    const [showFilters, setShowFilters] = useState(false);
    const observerTarget = useRef(null);
    const userScrolledRef = useRef(false);
    const [pullProgress, setPullProgress] = useState(0);
    const pullDistanceRef = useRef(0);
    const touchStartYRef = useRef(0);
    const isPullingRef = useRef(false);
    const paginationRef = useRef(pagination);
    const loadingMoreRef = useRef(loadingMore);
    const loadingRef = useRef(loading);

    useEffect(() => { paginationRef.current = pagination; }, [pagination]);
    useEffect(() => { loadingMoreRef.current = loadingMore; }, [loadingMore]);
    useEffect(() => { loadingRef.current = loading; }, [loading]);

    useEffect(() => {
        const content = document.querySelector('.admin-content');
        const handleScroll = () => {
            if ((content?.scrollTop || window.scrollY) > 10) {
                userScrolledRef.current = true;
            }
        };
        content?.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            content?.removeEventListener('scroll', handleScroll);
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    // iOS/Mobile elastic pull-up gesture: when list doesn't fill the screen, dragging up triggers loading previous day
    useEffect(() => {
        if (!isMobile) return;
        const content = document.querySelector('.admin-content') || window;

        const onTouchStart = (e) => {
            if (!e.touches || e.touches.length === 0) return;
            touchStartYRef.current = e.touches[0].clientY;
            pullDistanceRef.current = 0;
            isPullingRef.current = false;
        };

        const onTouchMove = (e) => {
            if (!e.touches || e.touches.length === 0) return;
            const currentY = e.touches[0].clientY;
            const deltaY = touchStartYRef.current - currentY; // positive = dragging finger upwards (pulling up at bottom)

            const adminContent = document.querySelector('.admin-content');
            const isAtBottom = adminContent
                ? (adminContent.scrollTop + adminContent.clientHeight >= adminContent.scrollHeight - 30)
                : (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 30);

            if (deltaY > 0 && isAtBottom) {
                isPullingRef.current = true;
                pullDistanceRef.current = deltaY;
                const progress = Math.min(1, Math.max(0, deltaY / 55));
                setPullProgress(progress);
            } else if (isPullingRef.current && deltaY <= 0) {
                isPullingRef.current = false;
                pullDistanceRef.current = 0;
                setPullProgress(0);
            }
        };

        const onTouchEnd = () => {
            const pulledDistance = pullDistanceRef.current;
            setPullProgress(0);
            pullDistanceRef.current = 0;
            isPullingRef.current = false;

            if (pulledDistance > 40) {
                const currentPagination = paginationRef.current;
                if (!loadingRef.current && !loadingMoreRef.current && currentPagination.page < currentPagination.totalPages) {
                    loadPayments(currentPagination.page + 1, true);
                }
            }
        };

        content.addEventListener('touchstart', onTouchStart, { passive: true });
        content.addEventListener('touchmove', onTouchMove, { passive: true });
        content.addEventListener('touchend', onTouchEnd, { passive: true });

        return () => {
            content.removeEventListener('touchstart', onTouchStart);
            content.removeEventListener('touchmove', onTouchMove);
            content.removeEventListener('touchend', onTouchEnd);
        };
    }, [isMobile]);

    // Sync page 1 from the cache. A new month/year replaces the list; a background
    // refresh of the same period only refreshes the head and keeps scrolled pages.
    const seededRef = useRef({ data: firstPage.data, period: `${selectedMonth}-${selectedYear}` });
    useEffect(() => {
        const data = firstPage.data;
        if (!data || firstPage.isPlaceholderData) return;
        const period = `${selectedMonth}-${selectedYear}`;
        const previous = seededRef.current;
        if (previous.data === data && previous.period === period) return;
        seededRef.current = { data, period };

        const keepScrolledPages = previous.period === period && paginationRef.current.page > 1;
        if (keepScrolledPages) {
            setPayments(prev => {
                const headIds = new Set(data.payments.map(p => String(p._id || p.paymentId)));
                return [...data.payments, ...prev.filter(p => !headIds.has(String(p._id || p.paymentId)))];
            });
            setPagination(prev => ({ ...prev, ...data.pagination, page: prev.page }));
            return;
        }
        userScrolledRef.current = false;
        setPayments(data.payments);
        setPagination(prev => ({ ...prev, ...data.pagination, page: 1 }));
    }, [firstPage.data, firstPage.isPlaceholderData, selectedMonth, selectedYear]);

    useEffect(() => {
        if (firstPage.error) console.error('Error loading payments:', firstPage.error);
    }, [firstPage.error]);

    const loadPayments = async (page = 1, append = false) => {
        if (page === 1 && !append) {
            userScrolledRef.current = false;
            const result = await firstPage.refetch();
            // Same data object (nothing changed) still has to bring the list back to page 1
            if (result.data && paginationRef.current.page > 1) {
                setPayments(result.data.payments);
                setPagination(prev => ({ ...prev, ...result.data.pagination, page: 1 }));
            }
            return;
        }
        // While the previous month is still on screen (placeholder), don't append the new month's pages to it
        if (append && firstPage.isPlaceholderData) return;
        if (append) {
            setLoadingMore(true);
        } else {
            userScrolledRef.current = false;
            setPageLoading(true);
        }
        try {
            const queryParams = {
                page,
                limit: PAYMENTS_PAGE_SIZE
            };
            if (selectedMonth) queryParams.month = selectedMonth;
            if (selectedYear) queryParams.year = selectedYear;

            const result = await getAllPayments(queryParams);

            if (result.success) {
                if (append) {
                    setPayments(prev => {
                        const existingIds = new Set(prev.map(p => String(p._id || p.paymentId)));
                        const incomingUnique = (result.payments || []).filter(p => !existingIds.has(String(p._id || p.paymentId)));
                        return [...prev, ...incomingUnique];
                    });
                } else {
                    setPayments(result.payments || []);
                }
                setPagination(prev => ({
                    ...prev,
                    ...result.pagination,
                    page: Number(result.pagination?.page || page)
                }));
            } else {
                console.error('Failed to load payments:', result.error);
            }
        } catch (error) {
            console.error('Error loading payments:', error);
        } finally {
            setPageLoading(false);
            setLoadingMore(false);
        }
    };

    // Infinite scroll observer for mobile (matches Invoices pattern)
    useEffect(() => {
        if (!isMobile) return;
        if (loading || loadingMore) return;
        if (pagination.page >= pagination.totalPages) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && userScrolledRef.current && !loadingMore && pagination.page < pagination.totalPages) {
                    const nextPage = pagination.page + 1;
                    loadPayments(nextPage, true);
                }
            },
            { threshold: 0.1, rootMargin: '120px' }
        );

        const currentTarget = observerTarget.current;
        if (currentTarget) {
            observer.observe(currentTarget);
        }

        return () => {
            if (currentTarget) observer.unobserve(currentTarget);
        };
    }, [isMobile, loading, loadingMore, pagination.page, pagination.totalPages]);

    const downloadCSV = async () => {
        const month = selectedMonth || (today.getMonth() + 1);
        const year = selectedYear || today.getFullYear();
        try {
            await exportPaymentsCSV(month, year);
        } catch (error) {
            console.error('Error downloading CSV via API, falling back to direct link:', error);
            window.open(`/api/payments/export?month=${month}&year=${year}`, '_blank');
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    const formatInvoiceId = (invoiceId) => {
        if (!invoiceId) return 'N/A';
        const parts = invoiceId.split('-');
        if (parts.length >= 4) {
            const deviceName = parts[0];
            const year = parts[1];
            const month = parts[2];
            const day = parts[3];

            const dateObj = new Date(`${year}-${month}-${day}T12:00:00`);
            const monthName = dateObj.toLocaleDateString('es-ES', { month: 'short' });

            return `${deviceName}-${monthName}-${parseInt(day)}`;
        }
        return invoiceId;
    };

    const handleClearSearch = () => {
        setSearchInput('');
        setSearchQuery('');
        setDatePreset('all');
    };

    // Client-side filtering and sorting
    const sortedPayments = [...payments]
        .filter(p => {
            if (filter !== 'all') {
                const status = (p.status || '').toUpperCase();
                const type = (p.type || '').toUpperCase();
                const isFreeOrAdj = p.amount === 0 || type === 'FREE' || p.isFree || status === 'FREE' || p.adjustmentType || type === 'ADJUSTMENT' || status === 'ADJUSTMENT';
                const isApproved = !isFreeOrAdj && (status === 'APPROVED' || status === 'COMPLETED');
                const isPending = !isFreeOrAdj && (status === 'PENDING' || status === 'VERIFYING');
                const isFailed = !isFreeOrAdj && (status === 'DECLINED' || status === 'ERROR' || status === 'FAILED' || status === 'REJECTED');

                if (filter === 'completed' && !isApproved) return false;
                if (filter === 'pending' && !isPending) return false;
                if (filter === 'failed' && !isFailed) return false;
                if (filter === 'free' && !isFreeOrAdj) return false;
            }
            if (datePreset !== 'all' && p.createdAt) {
                const pDate = new Date(p.createdAt);
                if (!isNaN(pDate.getTime())) {
                    const now = new Date();
                    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const startOfYesterday = new Date(startOfToday);
                    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
                    const startOfLast7Days = new Date(startOfToday);
                    startOfLast7Days.setDate(startOfLast7Days.getDate() - 7);

                    if (datePreset === 'today' && pDate < startOfToday) return false;
                    if (datePreset === 'yesterday' && (pDate < startOfYesterday || pDate >= startOfToday)) return false;
                    if (datePreset === 'last_7_days' && pDate < startOfLast7Days) return false;
                }
            }
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

    const filteredTotalAmount = sortedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const assistantCardsData = useMemo(() => {
        if (!sortedPayments.length) return null;
        const fmtCop = (n) =>
            new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency: 'COP',
                maximumFractionDigits: 0,
            }).format(Number(n) || 0);
        const statusEs = (raw) => {
            const st = String(raw || '').toUpperCase();
            if (st === 'APPROVED' || st === 'COMPLETED') return 'Aprobado';
            if (st === 'PENDING' || st === 'VERIFYING') return 'Pendiente';
            if (st === 'DECLINED' || st === 'FAILED' || st === 'REJECTED') return 'Rechazado';
            if (st === 'ERROR') return 'Error';
            if (st === 'FREE' || st === 'ADJUSTMENT') return 'Ajuste / Gratis';
            return raw || '';
        };
        return {
            kind: 'list',
            items: sortedPayments.slice(0, 5).map((p) => {
                const method = p.paymentMethod || p.type || '';
                const dateLabel = p.createdAt
                    ? new Date(p.createdAt).toLocaleDateString('es-CO', {
                          day: '2-digit',
                          month: 'short',
                      })
                    : '';
                const subParts = [statusEs(p.status), method, dateLabel].filter(Boolean);
                return {
                    title: p.deviceId || p.deviceIdName || 'Pago',
                    subtitle: subParts.join(' · '),
                    value: fmtCop(p.amount || 0),
                };
            }),
        };
    }, [sortedPayments]);

    useAssistantScreenBridge('payments', {
        loading,
        activeFilters: {
            status: filter,
            datePreset,
            searchQuery,
            month: selectedMonth,
            year: selectedYear,
            sortBy,
        },
        metrics: {
            filteredCount: sortedPayments.length,
            filteredTotal: filteredTotalAmount,
            loadedCount: payments.length,
            globalTotalCount: Number(pagination.total || payments.length),
            isPaginated: Number(pagination.totalPages || 1) > 1,
        },
        cardsData: assistantCardsData,
        singleMatchItem:
            Boolean(searchQuery || filter !== 'all' || datePreset !== 'all') &&
            sortedPayments.length === 1
                ? sortedPayments[0]?.deviceId || null
                : null,
        applyFilter: (params = {}) => {
            if (params.status) setFilter(params.status);
            if (params.datePreset) setDatePreset(params.datePreset);
            if (params.sortBy) setSortBy(params.sortBy);
            if (params.month) setSelectedMonth(Number(params.month));
            if (params.year) setSelectedYear(Number(params.year));
            return true;
        },
        search: (q) => {
            setSearchInput(q);
            setSearchQuery(q);
            return true;
        },
        clearFilters: () => {
            setFilter('all');
            setDatePreset('all');
            setSearchInput('');
            setSearchQuery('');
            return true;
        },
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
        const type = (p.type || '').toUpperCase();
        const isFreeOrAdj = p.amount === 0 || type === 'FREE' || p.isFree || status === 'FREE' || p.adjustmentType || type === 'ADJUSTMENT' || status === 'ADJUSTMENT';
        return !isFreeOrAdj && (status === 'APPROVED' || status === 'COMPLETED');
    }).length;

    const pendingCount = payments.filter(p => {
        const status = (p.status || '').toUpperCase();
        return status === 'PENDING' || status === 'VERIFYING';
    }).length;

    const failedCount = payments.filter(p => {
        const status = (p.status || '').toUpperCase();
        return status === 'DECLINED' || status === 'ERROR' || status === 'FAILED' || status === 'REJECTED';
    }).length;

    const freeCount = payments.filter(p => {
        const status = (p.status || '').toUpperCase();
        const type = (p.type || '').toUpperCase();
        return p.amount === 0 || type === 'FREE' || p.isFree || status === 'FREE' || p.adjustmentType || type === 'ADJUSTMENT' || status === 'ADJUSTMENT';
    }).length;

    const handlePageChange = (newPage) => {
        loadPayments(Number(newPage), false);
    };

    const handleFilterChange = (newFilter) => {
        setFilter(newFilter);
    };

    const totalPagePayments = payments.length;
    const completedPercentage = totalPagePayments > 0 ? Math.round((completedCount / totalPagePayments) * 100) : 0;
    const pendingPercentage = totalPagePayments > 0 ? Math.round((pendingCount / totalPagePayments) * 100) : 0;

    const filterOptions = [
        { value: 'all', label: t('payments.filters.all') },
        { value: 'completed', label: t('payments.filters.completed') },
        { value: 'pending', label: t('payments.filters.pending') },
        { value: 'failed', label: t('payments.filters.failed') },
        { value: 'free', label: 'Gratis' }
    ];

    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const currentMonthLabel = selectedMonth ? `${monthNames[selectedMonth - 1]} ${selectedYear}` : `Todo ${selectedYear}`;

    const desktopHeader = (
        <PageHeader.Desktop
            title={t('payments.title')}
            subtitle={t('payments.subtitle')}
            onRefresh={() => loadPayments(1, false)}
            loading={loading || firstPage.isFetching}
            refreshText={t('payments.refresh')}
            leadingActions={
                <MonthYearSelector
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    onChangeMonth={m => setSelectedMonth(m)}
                    onChangeYear={y => setSelectedYear(y)}
                    variant="desktop"
                />
            }
            actions={
                <button type="button" className="btn-secondary" onClick={downloadCSV}>
                    <Download size={16} style={{ marginRight: 4 }} /> CSV
                </button>
            }
        />
    );

    const mobileHeader = (
        <PageHeader.Mobile
            onRefresh={() => loadPayments(1, false)}
            loading={loading || firstPage.isFetching}
            onFilterToggle={() => setShowFilters(!showFilters)}
            showFilters={showFilters}
            datePicker={{
                selectedMonth,
                selectedYear,
                includeAllMonths: true,
                onSelect: (m) => setSelectedMonth(m)
            }}
        />
    );

    const renderHeader = isMobile ? mobileHeader : desktopHeader;

    return (
        <div className="payments-page">
            {renderHeader}

            <div className="payments-mobile-top-section">
                {/* Mobile Consolidated Metrics Card vs Desktop StatCards */}
                {isMobile ? !showFilters && (
                    <MobileMetricsCard
                        loading={firstPage.isPending}
                        segments={[
                            { width: completedPercentage, variant: 'completed' },
                            { width: pendingPercentage, variant: 'pending' }
                        ]}
                        columns={[
                            {
                                label: 'Cobrado',
                                dot: 'completed',
                                value: `${completedPercentage}%`,
                                subcount: completedCount
                            },
                            {
                                label: 'Pendiente',
                                dot: 'pending',
                                value: `${pendingPercentage}%`,
                                subcount: pendingCount,
                                valueClass: 'val-pending'
                            },
                            {
                                label: 'Ingresos',
                                icon: <DollarSign size={12} className="text-cyan-600" />,
                                value: `$${totalAmount.toLocaleString()}`
                            }
                        ]}
                    />
                ) : (
                    /* Summary Stats — Minimalist iOS style (Desktop) */
                    <div className="devices-stats-ios payments-stats-grid">
                        <StatCard
                            loading={firstPage.isPending}
                            title={t('payments.stats.revenue', 'INGRESOS')}
                            value={<Amount value={totalAmount} />}
                            valueColor="#00C292"
                        />
                        <StatCard
                            loading={firstPage.isPending}
                            title={t('payments.stats.completed', 'PAGADOS')}
                            value={completedCount}
                            valueColor="#0070eb"
                        />
                        <StatCard
                            loading={firstPage.isPending}
                            title={t('payments.stats.pending', 'PENDIENTES')}
                            value={pendingCount}
                            valueColor="#FB9678"
                        />
                        <StatCard
                            loading={firstPage.isPending}
                            title={t('payments.stats.total', 'TOTAL')}
                            value={pagination.total}
                            valueColor="#1a1c1c"
                        />
                    </div>
                )}

                {/* Mobile Collapsible Filter & Search Section */}
                {isMobile && showFilters && (
                    <div className="payments-mobile-filter-section">
                        <div className="payments-mobile-search-bar">
                            <Search size={16} className="search-icon" />
                            <input
                                type="search"
                                value={searchInput}
                                onChange={(e) => {
                                    setSearchInput(e.target.value);
                                    setSearchQuery(e.target.value);
                                }}
                                placeholder="Buscar por placa, dispositivo o referencia..."
                                className="payments-mobile-search-input"
                            />
                            {searchInput && (
                                <button
                                    type="button"
                                    onClick={handleClearSearch}
                                    className="clear-search"
                                    title="Limpiar búsqueda"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        <div className="payments-filter-pills-row no-scrollbar">
                            <button
                                type="button"
                                onClick={() => handleFilterChange('all')}
                                className={`payment-filter-pill ${filter === 'all' ? 'active' : ''}`}
                            >
                                <span>Todos</span>
                                <span className="pill-count">{pagination.total || 0}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleFilterChange('completed')}
                                className={`payment-filter-pill ${filter === 'completed' ? 'active' : ''}`}
                            >
                                <span>Aprobados</span>
                                <span className="pill-count">{completedCount}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleFilterChange('pending')}
                                className={`payment-filter-pill ${filter === 'pending' ? 'active' : ''}`}
                            >
                                <span>Pendientes</span>
                                <span className="pill-count">{pendingCount}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleFilterChange('failed')}
                                className={`payment-filter-pill ${filter === 'failed' ? 'active' : ''}`}
                            >
                                <span>Rechazados</span>
                                <span className="pill-count">{failedCount}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleFilterChange('free')}
                                className={`payment-filter-pill ${filter === 'free' ? 'active' : ''}`}
                            >
                                <span>Gratis</span>
                                <span className="pill-count">{freeCount}</span>
                            </button>
                        </div>
                    </div>
                )}
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

            {/* Payments List / Table */}
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
            ) : isMobile ? (
                /* Mobile iOS List */
                <div className="payments-mobile-list-container">
                    <div className="payments-mobile-list-title">
                        Pagos Recientes
                    </div>
                    <div className="payments-mobile-cards-group">
                        {sortedPayments.map((payment, index) => {
                            const mobileKey = payment._id || `${payment.paymentId || 'pay'}-${index}`;
                            return (
                                <PaymentMobileRow
                                    key={mobileKey}
                                    payment={payment}
                                />
                            );
                        })}
                    </div>

                    {/* Infinite Scroll Sentinel for Mobile (loads next day per scroll attempt) */}
                    <div ref={observerTarget} className="payments-infinite-scroll-loader">
                        {loadingMore ? (
                            <div className="payments-infinite-loading-text">
                                <RefreshCw size={16} className="spin" />
                                <span>Cargando día anterior...</span>
                            </div>
                        ) : pagination.page >= pagination.totalPages ? (
                            <p className="payments-infinite-subtext">
                                Mostrando todos los pagos ({sortedPayments.length} transacciones en {pagination.totalPages} días)
                            </p>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    if (!loadingMore && pagination.page < pagination.totalPages) {
                                        loadPayments(pagination.page + 1, true);
                                    }
                                }}
                                className={`payments-load-day-button ${pullProgress >= 0.8 ? 'ready' : ''}`}
                                style={{
                                    transform: pullProgress > 0 ? `translateY(-${pullProgress * 10}px)` : 'none',
                                    borderColor: pullProgress >= 0.8 ? '#0891B2' : undefined,
                                    backgroundColor: pullProgress >= 0.8 ? '#F0FDFA' : undefined
                                }}
                            >
                                <span>{pullProgress >= 0.8 ? 'Suelta para cargar día anterior' : 'Cargar día anterior'}</span>
                                <ChevronDown
                                    size={14}
                                    style={{
                                        transform: pullProgress >= 0.8 ? 'rotate(180deg)' : 'none',
                                        transition: 'transform 0.2s ease'
                                    }}
                                />
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                /* Desktop Table View */
                <div className="payments-table-container">
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
                                const paymentKey = payment._id || `${payment.paymentId || 'pay'}-${index}`;
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

                    {/* Pagination Controls (Desktop) */}
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
                </div>
            )}
        </div>
    );
};

export default Payments;
