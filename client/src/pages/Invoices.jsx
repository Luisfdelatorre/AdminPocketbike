import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
    FileText, Calendar, DollarSign, Check, X, Search, Filter,
    HandCoins, Wrench, AlertTriangle, Hammer, PlusCircle, Plus, Download, RefreshCw, Building2,
    ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Clock, Gift, Pencil, CreditCard, ChevronDown, SlidersHorizontal, CheckCircle2
} from 'lucide-react';
import './Payments.css';
import './Invoices.css';
import PageHeader from '../components/PageHeader';
import useIsMobile from '../hooks/useIsMobile';
import { useStatusConfig } from '../context/StatusConfigContext';
import { getAllInvoices, getInvoiceStats, exportInvoicesCSV, registerManualAdjustment } from '../services/api';
import SearchAndFilterBar from '../components/SearchAndFilterBar';
import MonthYearSelector from '../components/MonthYearSelector';
import StatCard from '../components/StatCard';
import MobileMetricsCard from '../components/MobileMetricsCard';
import StatusBadge from '../components/StatusBadge';
import CreateDayInvoiceModal from '../components/modals/CreateDayInvoiceModal';
import InvoiceAdjustmentModal from '../components/modals/InvoiceAdjustmentModal';

const ADJUSTMENT_ICONS = {
    REPAIR: Wrench,
    MAINTENANCE: Hammer,
    ACCIDENT_TRANSIT: AlertTriangle,
    DAMAGE: AlertTriangle,
    INCAPACITY: AlertTriangle,
    INCAPACIDAD: AlertTriangle,
    WORKSHOP: Building2,
    OFFICE: Building2,
    OFICINA: Building2,
};

const InvoiceMobileRow = ({ invoice, isPayable, openManualPayModal }) => {
    const [swiped, setSwiped] = useState(false);
    const touchStartX = useRef(0);
    const touchEndX = useRef(0);

    const isPaid = invoice.dayType === 'PAID' || (invoice.paidAmount > 0 && invoice.dayType !== 'PENDING');
    const isFree = invoice.dayType === 'FREE' || invoice.isFree || Boolean(invoice.adjustmentType);
    const isPending = !isPaid && !isFree;

    const mainId = invoice.deviceIdName || invoice.deviceId || invoice.invoiceId || 'N/A';
    const amount = isPaid ? (invoice.paidAmount || invoice.amount || 0) : (invoice.amount || 0);

    // Fecha de la factura (fecha a la que corresponde la factura)
    const formatInvoiceDate = (dateVal, invoiceId, invoiceIdSub) => {
        if (dateVal) {
            const d = new Date(dateVal);
            if (!isNaN(d.getTime())) {
                const day = d.getUTCDate();
                const month = d.toLocaleDateString('es-ES', { month: 'short', timeZone: 'UTC' }).replace('.', '');
                return `${day} ${month}`;
            }
        }
        if (invoiceId) {
            const parts = String(invoiceId).split('-');
            if (parts.length >= 4) {
                const day = parseInt(parts[3], 10);
                const monthNum = parseInt(parts[2], 10);
                const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
                const month = (monthNum >= 1 && monthNum <= 12) ? monthNames[monthNum - 1] : parts[2];
                if (!isNaN(day)) return `${day} ${month}`;
            }
        }
        if (invoiceIdSub) return invoiceIdSub;
        return '--';
    };

    const invoiceDateStr = formatInvoiceDate(invoice.date, invoice.invoiceId, invoice.invoiceIdSub);

    // Fecha y hora del pago o transacción
    const paymentRawDate = invoice.paymentDate || invoice.transaction?.finalized_at || invoice.createdAt;
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

    const handleTouchStart = (e) => {
        touchStartX.current = e.targetTouches[0].clientX;
    };

    const handleTouchMove = (e) => {
        touchEndX.current = e.targetTouches[0].clientX;
    };

    const handleTouchEnd = () => {
        if (!isPending) return;
        const diff = touchStartX.current - touchEndX.current;
        if (diff > 45) {
            setSwiped(true);
        } else if (diff < -45) {
            setSwiped(false);
        }
    };

    return (
        <div className="invoice-mobile-row-wrapper select-none">
            {isPending && (
                <div className="invoice-mobile-actions-behind">
                    <button
                        type="button"
                        aria-label={`Editar factura ${mainId}`}
                        onClick={() => {
                            setSwiped(false);
                            openManualPayModal(invoice);
                        }}
                        className="invoice-swipe-btn invoice-swipe-edit"
                    >
                        <Pencil size={18} />
                        <span>Editar</span>
                    </button>
                    <button
                        type="button"
                        aria-label={`Pagar factura ${mainId}`}
                        onClick={() => {
                            setSwiped(false);
                            openManualPayModal(invoice);
                        }}
                        className="invoice-swipe-btn invoice-swipe-pay"
                    >
                        <CreditCard size={18} />
                        <span>Pagar</span>
                    </button>
                </div>
            )}

            <article
                className={`invoice-mobile-row-card ${swiped ? 'is-swiped' : ''}`}
                style={{ transform: swiped ? 'translateX(-144px)' : 'translateX(0px)' }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={() => {
                    if (swiped) {
                        setSwiped(false);
                    } else if (isPayable) {
                        openManualPayModal(invoice);
                    }
                }}
            >
                <div className={`invoice-avatar-circle ${isPaid ? 'avatar-paid' : isFree ? 'avatar-free' : 'avatar-pending'}`}>
                    {isPaid ? (
                        <CheckCircle2 size={18} strokeWidth={2.3} />
                    ) : isFree ? (
                        <Gift size={18} strokeWidth={2} />
                    ) : (
                        <Clock size={18} strokeWidth={2.3} />
                    )}
                </div>

                <div className="invoice-mobile-inset-content">
                    <div className="invoice-mobile-info-left">
                        <div className="invoice-mobile-title-row">
                            <span className="invoice-mobile-id">{mainId}</span>
                            <span className="invoice-mobile-cut-date">{invoiceDateStr}</span>
                        </div>
                        <p className="invoice-mobile-subtitle">
                            {isPaid ? (paymentTimeStr || 'Pagado') : isFree ? 'Ajuste / Gratuito' : 'Pendiente de pago'}
                        </p>
                    </div>

                    <div className="invoice-mobile-info-right">
                        <span className="invoice-mobile-amount">
                            ${amount.toLocaleString()}
                        </span>
                        <span className={`invoice-mobile-badge ${isPaid ? 'badge-paid' : isFree ? 'badge-free' : 'badge-pending'}`}>
                            {isPaid ? (
                                <>
                                    <CheckCircle2 size={11} strokeWidth={2.5} /> PAGADO
                                </>
                            ) : isFree ? (
                                <>
                                    <CheckCircle2 size={11} strokeWidth={2.5} /> GRATIS
                                </>
                            ) : (
                                <>
                                    <Clock size={11} strokeWidth={2.5} /> PENDIENTE
                                </>
                            )}
                        </span>
                    </div>
                </div>
            </article>
        </div>
    );
};

const Invoices = () => {
    const { t } = useTranslation();
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearchSubmit = (e) => {
        if (e) e.preventDefault();
        setSearchQuery(searchInput.trim());
        setCurrentPage(1);
    };

    const handleClearSearch = () => {
        setSearchInput('');
        setSearchQuery('');
        setCurrentPage(1);
    };
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalInvoices, setTotalInvoices] = useState(0);
    const isMobile = useIsMobile();
    const PAGE_SIZE = 100;

    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [downloading, setDownloading] = useState(false);

    const [showFilters, setShowFilters] = useState(false);

    const handleExport = async () => {
        setDownloading(true);
        try {
            await exportInvoicesCSV(selectedMonth, selectedYear);
        } catch (err) {
            console.error('CSV export error:', err);
            alert('Error al exportar: ' + err.message);
        } finally {
            setDownloading(false);
        }
    };

    // ── Add Invoices to Device Modal ──────────────────────
    const [addInvoicesModalOpen, setAddInvoicesModalOpen] = useState(false);
    const [fabPortalElement, setFabPortalElement] = useState(null);

    useEffect(() => {
        setFabPortalElement(document.body);
    }, []);

    // ── Manual Payment Modal ──────────────────────────────
    const [manualPayModal, setManualPayModal] = useState({ open: false, invoice: null });

    const openManualPayModal = (invoice) => {
        setManualPayModal({ open: true, invoice });
    };

    const closeManualPayModal = () => {
        setManualPayModal({ open: false, invoice: null });
    };

    const { statusConfig: ADJUSTMENT_CONFIG = {} } = useStatusConfig();
    // ─────────────────────────────────────────────────────

    const [stats, setStats] = useState({
        total: 0,
        paid: 0,
        unpaid: 0,
        totalAmount: 0
    });

    const [loadingMore, setLoadingMore] = useState(false);
    const observerTarget = useRef(null);

    useEffect(() => {
        setCurrentPage(1);
        loadInvoices(1, false);
    }, [selectedMonth, selectedYear, searchQuery, filter]);

    const loadStats = async () => {
        try {
            const result = await getInvoiceStats({ month: selectedMonth, year: selectedYear });
            if (result.success && result.stats) {
                setStats(result.stats);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const loadInvoices = async (page = 1, append = false) => {
        if (append) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }
        try {
            const params = {};
            if (page > 1) params.page = page;
            if (searchQuery) {
                params.search = searchQuery.trim();
                params.limit = isMobile ? 30 : 500;
            } else {
                if (selectedMonth) params.month = selectedMonth;
                if (selectedYear) params.year = selectedYear;
                if (isMobile) params.limit = 30;
            }
            if (filter && filter !== 'all') params.status = filter;

            const result = await getAllInvoices(params);
            if (result.success) {
                if (append) {
                    setInvoices(prev => [...prev, ...(result.invoices || [])]);
                } else {
                    setInvoices(result.invoices || []);
                }
                if (result.stats) {
                    setStats(result.stats);
                }
                setTotalPages(result.pagination?.totalPages || 1);
                setTotalInvoices(result.pagination?.total || 0);
            } else {
                console.error('Error loading invoices:', result.error);
            }
        } catch (error) {
            console.error('Error loading invoices:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // Infinite scroll observer for mobile
    useEffect(() => {
        if (!isMobile) return;
        if (loading || loadingMore) return;
        if (currentPage >= totalPages) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !loadingMore && currentPage < totalPages) {
                    const nextPage = currentPage + 1;
                    setCurrentPage(nextPage);
                    loadInvoices(nextPage, true);
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
    }, [isMobile, loading, loadingMore, currentPage, totalPages]);

    const formatCurrency = (amount, isMobile = false) => {
        if (amount === undefined || amount === null) return isMobile ? '$0' : '$0 COP';
        return isMobile ? `$${amount.toLocaleString()}` : `$${amount.toLocaleString()} COP`;
    };

    const formatCompact = (value) => {
        if (!value) return '$0';
        if (value >= 1000000) {
            return `$${Math.round(value / 1000000)}M`;
        }
        if (value >= 1000) {
            return `$${Math.round(value / 1000)}k`;
        }
        return `$${value}`;
    };

    const formatDate = (dateString, isMobile = false) => {
        if (!dateString) return '--';
        const date = new Date(dateString);
        if (isMobile) {
            const day = date.getDate();
            const month = date.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');

            let hours = date.getHours();
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'pm' : 'am';
            hours = hours % 12;
            hours = hours ? hours : 12;

            return (
                <div className="date-cell">
                    <div>{day} {month}</div>
                    <div className="date-sub">{hours}:{minutes}{ampm}</div>
                </div>
            );
        }
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const filteredInvoices = invoices.filter(invoice => {
        if (filter !== 'all') {
            const activeFilter = String(filter).trim().toUpperCase();
            if (invoice.dayType?.toUpperCase() !== activeFilter && invoice.adjustmentType?.toUpperCase() !== activeFilter) {
                return false;
            }
        }
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                invoice.invoiceId?.toLowerCase().includes(query) ||
                invoice.deviceIdName?.toLowerCase().includes(query) ||
                invoice.deviceId?.toLowerCase().includes(query) ||
                invoice.contractId?.toLowerCase().includes(query) ||
                invoice.paymentReference?.toLowerCase().includes(query) ||
                invoice.adjustmentReference?.toLowerCase().includes(query) ||
                invoice.transactionId?.toLowerCase().includes(query) ||
                invoice.transaction?.id?.toLowerCase().includes(query) ||
                invoice.transaction?.reference?.toLowerCase().includes(query)
            );
        }
        return true;
    });

    const totalCount = stats.total || 0;
    const paidPercentage = totalCount > 0 ? Math.round((stats.paid / totalCount) * 100) : 0;
    const unpaidPercentage = totalCount > 0 ? Math.round((stats.unpaid / totalCount) * 100) : 0;

    const handleFilterChange = (newFilter) => {
        setFilter(newFilter);
        setCurrentPage(1);
    };

    const renderDateSelectors = () => (
        <MonthYearSelector
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onChangeMonth={m => {
                setSelectedMonth(m);
                setCurrentPage(1);
            }}
            onChangeYear={y => {
                setSelectedYear(y);
                setCurrentPage(1);
            }}
            variant="desktop"
        />
    );

    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const currentMonthLabel = selectedMonth ? `${monthNames[selectedMonth - 1]} ${selectedYear}` : `Todo ${selectedYear}`;

    const desktopHeader = (
        <PageHeader.Desktop
            title={t('invoices.title')}
            onRefresh={() => loadInvoices(currentPage)}
            loading={loading}
            refreshText={t('payments.refresh')}
            leadingActions={renderDateSelectors()}
            actions={
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        className="btn-primary"
                        type="button"
                        onClick={() => setAddInvoicesModalOpen(true)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                        <PlusCircle size={16} /> Adicionar Facturas
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={handleExport}
                        disabled={downloading}
                    >
                        {downloading ? <RefreshCw size={16} className="spin" /> : <Download size={16} />} CSV
                    </button>
                </div>
            }
        />
    );

    const mobileHeader = (
        <PageHeader.Mobile
            onRefresh={() => {
                setCurrentPage(1);
                loadInvoices(1, false);
            }}
            loading={loading}
            onFilterToggle={() => setShowFilters(prev => !prev)}
            showFilters={showFilters}
            datePicker={{
                selectedMonth,
                selectedYear,
                includeAllMonths: true,
                onSelect: (m) => {
                    setSelectedMonth(m);
                    setCurrentPage(1);
                }
            }}
        />
    );

    const renderHeader = isMobile ? mobileHeader : desktopHeader;

    return (
        <div className="payments-page">
            {renderHeader}
            {/* Metrics Section: Consolidated iOS Card on Mobile, 4 StatCards on Desktop */}
            {isMobile ? !showFilters && (
                <MobileMetricsCard
                    segments={[
                        { width: paidPercentage, variant: 'completed' },
                        { width: unpaidPercentage, variant: 'pending' }
                    ]}
                    columns={[
                        {
                            label: 'Cobrado',
                            dot: 'completed',
                            value: `${paidPercentage}%`,
                            subcount: stats.paid?.toLocaleString() || 0
                        },
                        {
                            label: 'En mora',
                            dot: 'pending',
                            value: `${unpaidPercentage}%`,
                            subcount: stats.unpaid?.toLocaleString() || 0,
                            valueClass: 'val-pending'
                        },
                        {
                            label: 'Emitidas',
                            icon: <FileText size={12} className="text-cyan-600" />,
                            value: stats.total?.toLocaleString() || 0
                        }
                    ]}
                />
            ) : (
                <div className="payment-stats">
                    <StatCard
                        title={t('invoices.stats.total')}
                        value={formatCurrency(stats.totalAmount)}
                        iconBg="var(--brand-teal)"
                    />
                    <StatCard
                        title={t('invoices.stats.paid')}
                        value={stats.paid}
                        change={paidPercentage > 0 ? `${paidPercentage}%` : null}
                        changeType="positive"
                        iconBg="#00C292"
                    />
                    <StatCard
                        title={t('invoices.stats.unpaid')}
                        value={stats.unpaid}
                        change={unpaidPercentage > 0 ? `${unpaidPercentage}%` : null}
                        changeType="negative"
                        iconBg="#EF4444"
                    />
                    <StatCard
                        title={t('invoices.stats.invoices')}
                        value={stats.total}
                        iconBg="#7460EE"
                    />
                </div>
            )}
            {/* Mobile Collapsible Filter & Search Section */}
            {isMobile && showFilters && (
                <div className="invoices-mobile-filter-section">
                    <div className="invoices-mobile-search-bar">
                        <Search size={16} className="search-icon" />
                        <input
                            type="search"
                            value={searchInput}
                            onChange={(e) => {
                                setSearchInput(e.target.value);
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Buscar ID factura, cliente o contrato..."
                            className="invoices-mobile-search-input"
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

                    <div className="invoices-filter-pills-row no-scrollbar">
                        <button
                            type="button"
                            onClick={() => handleFilterChange('all')}
                            className={`invoice-filter-pill ${filter === 'all' ? 'active' : ''}`}
                        >
                            <span>Todas</span>
                            <span className="pill-count">{stats.total?.toLocaleString() || 0}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleFilterChange('PAID')}
                            className={`invoice-filter-pill ${filter === 'PAID' ? 'active' : ''}`}
                        >
                            <span>Pagadas</span>
                            <span className="pill-count">{stats.paid?.toLocaleString() || 0}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleFilterChange('PENDING')}
                            className={`invoice-filter-pill ${filter === 'PENDING' ? 'active' : ''}`}
                        >
                            <span>Pendientes</span>
                            <span className="pill-count">{stats.unpaid?.toLocaleString() || 0}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleFilterChange('FREE')}
                            className={`invoice-filter-pill ${filter === 'FREE' ? 'active' : ''}`}
                        >
                            <span>Gratis</span>
                            <span className="pill-count">{stats.free?.toLocaleString() || 0}</span>
                        </button>
                    </div>
                </div>
            )}



            {/* Desktop Filters (Desktop only) */}
            <div className="payment-controls hidden md:flex">
                <button
                    className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('all')}
                >
                    <Filter size={16} /> Todos
                </button>
                <button
                    className={`filter-btn ${filter === 'PAID' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('PAID')}
                >
                    {ADJUSTMENT_CONFIG.PAID?.badgeLabel || 'Pagadas'}
                </button>
                <button
                    className={`filter-btn ${filter === 'PENDING' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('PENDING')}
                >
                    {ADJUSTMENT_CONFIG.PENDING?.badgeLabel || 'Pendientes'}
                </button>
                <button
                    className={`filter-btn ${filter === 'DEBT' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('DEBT')}
                >
                    {ADJUSTMENT_CONFIG.DEBT?.badgeLabel || 'Deudas'}
                </button>
                <form onSubmit={handleSearchSubmit} className="search-box invoices-search-form">
                    <button
                        type="submit"
                        className="invoices-search-submit-btn"
                        title="Buscar (Enter o clic)"
                    >
                        <Search className="search-icon" size={18} />
                    </button>
                    <input
                        type="text"
                        className="invoices-search-input"
                        placeholder="Buscar por ID, dispositivo..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSearchSubmit(e);
                        }}
                    />
                    {(searchInput || searchQuery) && (
                        <button type="button" className="clear-search" onClick={handleClearSearch}>
                            <X size={16} />
                        </button>
                    )}
                </form>
            </div>

            {/* Invoices List */}
            {loading && invoices.length === 0 ? (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>{t('common.loading')}</p>
                </div>
            ) : filteredInvoices.length === 0 ? (
                <div className="empty-state">
                    <FileText size={48} />
                    <h3>No se encontraron facturas</h3>
                    <p>{searchQuery ? `No hay resultados para "${searchQuery}"` : 'No hay registros de facturas en este periodo.'}</p>
                </div>
            ) : isMobile ? (
                /* Mobile Transaction List with Infinite Scroll */
                <div className="invoices-mobile-list-container">
                    <div className="invoices-mobile-list-title">
                        Facturas Recientes
                    </div>
                    <div className="invoices-mobile-cards-group">
                        {filteredInvoices.map((invoice) => (
                            <InvoiceMobileRow
                                key={invoice.invoiceId || invoice._id}
                                invoice={invoice}
                                isPayable={invoice.isPayable}
                                openManualPayModal={openManualPayModal}
                            />
                        ))}
                    </div>

                    {/* Infinite Scroll Sentinel & Status */}
                    <div ref={observerTarget} className="invoice-infinite-scroll-loader">
                        {loadingMore ? (
                            <div className="invoice-infinite-loading-text">
                                <RefreshCw size={16} className="spin" />
                                <span>Cargando más facturas...</span>
                            </div>
                        ) : currentPage >= totalPages ? (
                            <p className="invoice-infinite-subtext">
                                Mostrando {filteredInvoices.length} de {totalInvoices} facturas registradas
                            </p>
                        ) : (
                            <p className="invoice-infinite-subtext">Desliza para cargar más...</p>
                        )}
                    </div>
                </div>
            ) : (
                /* Desktop Table View */
                <>
                    <div className="devices-table-card-ios">
                        <div className="invoices-table-header-ios">
                            <span>ID Factura</span>
                            <span className="desktop-col">{t('login.deviceId')}</span>
                            <span>Monto</span>
                            <span>Fecha Pago</span>
                            <span>{t('common.status')}</span>
                        </div>
                        <div className="devices-table-rows-ios">
                            {filteredInvoices.map((invoice) => {
                                const { isPayable, isPaidOrFree, statusClass, label, invoiceIdSub, deviceIdName } = invoice;
                                const BadgeIcon = invoice.adjustmentType ? ADJUSTMENT_ICONS[invoice.adjustmentType] : null;
                                const mainId = deviceIdName || invoice.invoiceId || 'N/A';
                                const paymentId = invoice.transactionId || invoice.transaction?.id || null;

                                return (
                                    <div key={invoice.invoiceId} className="invoices-row-ios">
                                        <div className="device-name-col">
                                            <div className="invoice-id-cell">
                                                {invoiceIdSub ? (
                                                    <>
                                                        <div className="invoice-id-main">{mainId}</div>
                                                        <div className="invoice-id-sub">{invoiceIdSub}</div>
                                                    </>
                                                ) : (
                                                    <div className="invoice-id-main">{mainId}</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="desktop-col device-name-text">
                                            {deviceIdName}
                                        </div>
                                        <div className={`amount-col ${isPaidOrFree ? 'amount-paid' : 'amount-debt'}`}>
                                            <span className="desktop-only">{formatCurrency(invoice.paidAmount, false)}</span>
                                            <span className="mobile-only">{formatCurrency(invoice.paidAmount, true)}</span>
                                        </div>
                                        <div className="date-col flex-col !items-start">
                                            <span className="desktop-only">{formatDate(invoice.paymentDate || invoice.transaction?.finalized_at || invoice.createdAt, false)}</span>
                                            <span className="mobile-only">{formatDate(invoice.paymentDate || invoice.transaction?.finalized_at || invoice.createdAt, true)}</span>
                                            {paymentId && (
                                                <div className="invoice-payment-id desktop-only" title={`ID de pago: ${paymentId}`}>
                                                    {paymentId}
                                                </div>
                                            )}
                                        </div>
                                        <div className="status-col">
                                            <StatusBadge
                                                status={invoice.dayType}
                                                adjustmentType={invoice.adjustmentType}
                                                label={label}
                                                clickable={isPayable}
                                                onClick={isPayable ? () => openManualPayModal(invoice) : undefined}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="results-info">
                        Mostrando {filteredInvoices.length} de {totalInvoices} facturas
                    </div>

                    {totalPages > 1 && (
                        <div className="pagination">
                            <button
                                className="pagination-circle-btn"
                                onClick={() => {
                                    const prev = Math.max(1, currentPage - 1);
                                    setCurrentPage(prev);
                                    loadInvoices(prev, false);
                                }}
                                disabled={currentPage <= 1}
                                aria-label="Página anterior"
                                title="Página anterior"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <div className="pagination-circle-page">
                                <span className="pagination-circle-page-current">{currentPage}</span>
                                <span className="pagination-circle-page-divider">/</span>
                                <span className="pagination-circle-page-total">{totalPages}</span>
                            </div>
                            <button
                                className="pagination-circle-btn"
                                onClick={() => {
                                    const next = Math.min(totalPages, currentPage + 1);
                                    setCurrentPage(next);
                                    loadInvoices(next, false);
                                }}
                                disabled={currentPage >= totalPages}
                                aria-label="Página siguiente"
                                title="Página siguiente"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* ── Manual Payment Modal ─────────────────────────── */}
            {manualPayModal.open && (
                <InvoiceAdjustmentModal
                    isOpen={manualPayModal.open}
                    invoice={manualPayModal.invoice}
                    onClose={closeManualPayModal}
                    onSuccess={() => {
                        loadInvoices(currentPage);
                    }}
                />
            )}

            {/* Floating Action Button (FAB) for Mobile */}
            {fabPortalElement && !addInvoicesModalOpen && !manualPayModal.open && createPortal(
                <button
                    type="button"
                    className="contracts-add-fab primary-blue"
                    onClick={() => setAddInvoicesModalOpen(true)}
                    aria-label="Adicionar Facturas"
                    title="Adicionar Facturas a Moto"
                >
                    <Plus size={30} />
                </button>,
                fabPortalElement
            )}

            {/* Modal para Crear Factura Diaria */}
            {addInvoicesModalOpen && (
                <CreateDayInvoiceModal
                    isOpen={addInvoicesModalOpen}
                    onClose={() => setAddInvoicesModalOpen(false)}
                    onSuccess={() => {
                        loadInvoices(1);
                    }}
                />
            )}
        </div >
    );
};

export default Invoices;
