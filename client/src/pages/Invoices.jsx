import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
    FileText, Calendar, DollarSign, Check, X, Search, Filter,
    HandCoins, Wrench, AlertTriangle, Hammer, PlusCircle, Download, RefreshCw, Building2,
    ChevronLeft, ChevronRight, ListFilter, TrendingUp, TrendingDown
} from 'lucide-react';
import './Payments.css';
import './Invoices.css';
import { getAllInvoices, getInvoiceStats, exportInvoicesCSV, registerManualAdjustment, getAdjustmentTypes, getPaymentStatuses } from '../services/api';
import useFilterVisibilityOnScroll from '../hooks/useFilterVisibilityOnScroll';
import SearchAndFilterBar from '../components/SearchAndFilterBar';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';

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
    const PAGE_SIZE = 100;

    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [downloading, setDownloading] = useState(false);

    const [showFilters, setShowFilters] = useState(false);
    const [portalElement, setPortalElement] = useState(null);

    useEffect(() => {
        setPortalElement(document.getElementById('mobile-header-actions'));
    }, []);

    useFilterVisibilityOnScroll(setShowFilters);

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

    // ── Manual Payment Modal ──────────────────────────────
    const [manualPayModal, setManualPayModal] = useState({ open: false, invoice: null });
    const [manualPayForm, setManualPayForm] = useState({
        amount: '',
        reference: '',
        note: '',
        paymentDate: new Date().toISOString().split('T')[0],
        adjustmentType: null, // REPAIR | DAMAGE | MAINTENANCE | null
    });
    const [manualPayLoading, setManualPayLoading] = useState(false);
    const [manualPayError, setManualPayError] = useState('');

    const [ADJUSTMENT_CONFIG, setAdjustmentConfig] = useState({});

    useEffect(() => {
        Promise.all([getAdjustmentTypes(), getPaymentStatuses()])
            .then(([adjRes, payRes]) => {
                const combined = {
                    ...(payRes?.data || {}),
                    ...(adjRes?.data || {})
                };
                setAdjustmentConfig(combined);
            })
            .catch(err => console.warn('No se pudo cargar la configuración de tipos de ajuste:', err));
    }, []);

    const buildAutoReference = (cfg, invoice) => {
        if (!cfg) return '';
        const badge = cfg.badgeLabel || '';
        const deviceName = invoice?.deviceName || invoice?.deviceIdName || invoice?.plate || invoice?.device?.name || '';
        const rawDate = invoice?.date || invoice?.invoiceDate || invoice?.dueDate;
        const dateStr = rawDate ? new Date(rawDate).toISOString().split('T')[0] : '';

        if (cfg.autoReference) {
            let ref = cfg.autoReference;
            if (ref.includes('{deviceName}') || ref.includes('{date}') || ref.includes('{type}')) {
                return ref
                    .replace(/{type}/g, badge)
                    .replace(/{deviceName}/g, deviceName)
                    .replace(/{date}/g, dateStr);
            }
        }

        const parts = [badge, deviceName, dateStr ? `(${dateStr})` : ''].filter(Boolean);
        return parts.join(' - ');
    };

    const openManualPayModal = (invoice) => {
        const reason = invoice.adjustmentType || 'ADJUSTMENT';
        const cfg = ADJUSTMENT_CONFIG[reason] || null;
        const autoAmount = cfg?.autoAmount ?? invoice.amount;

        setManualPayForm({
            amount: autoAmount,
            reference: buildAutoReference(cfg, invoice),
            note: invoice.adjustmentComment || '',
            paymentDate: new Date().toISOString().split('T')[0],
            adjustmentType: reason,
        });
        setManualPayError('');
        setManualPayModal({ open: true, invoice });
    };

    const closeManualPayModal = () => {
        setManualPayModal({ open: false, invoice: null });
        setManualPayError('');
    };

    const handleManualPaySubmit = async (e) => {
        e.preventDefault();
        const isAdjustment = !!manualPayForm.adjustmentType;
        if (!isAdjustment && (!manualPayForm.amount || Number(manualPayForm.amount) <= 0)) {
            setManualPayError('El monto debe ser mayor a 0.');
            return;
        }
        setManualPayLoading(true);
        setManualPayError('');
        try {
            await registerManualAdjustment({
                invoiceId: manualPayModal.invoice.invoiceId || manualPayModal.invoice._id,
                adjustmentType: manualPayForm.adjustmentType || 'NEQUI',
                amount: Number(manualPayForm.amount),
                adjustmentReference: manualPayForm.reference || 'Pago manual Nequi / Registro directo por Admin',
                note: manualPayForm.note,
            });
            await loadInvoices(currentPage);
            closeManualPayModal();
        } catch (err) {
            setManualPayError(err.message || 'Error al registrar el pago.');
        } finally {
            setManualPayLoading(false);
        }
    };
    // ─────────────────────────────────────────────────────

    const [stats, setStats] = useState({
        total: 0,
        paid: 0,
        unpaid: 0,
        totalAmount: 0
    });

    useEffect(() => {
        loadStats();
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        loadInvoices(currentPage);
    }, [currentPage, selectedMonth, selectedYear, searchQuery, filter]);

    const loadStats = async () => {
        try {
            const result = await getInvoiceStats({ month: selectedMonth, year: selectedYear });
            if (result.success) {
                setStats(result.stats);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const loadInvoices = async (page = 1) => {
        setLoading(true);
        try {
            const params = {};
            if (page > 1) params.page = page;
            if (searchQuery) {
                params.search = searchQuery.trim();
                params.limit = 500;
            } else {
                if (selectedMonth) params.month = selectedMonth;
                if (selectedYear) params.year = selectedYear;
            }
            if (filter && filter !== 'all') params.status = filter;

            const result = await getAllInvoices(params);
            if (result.success) {
                setInvoices(result.invoices || []);
                setTotalPages(result.pagination?.totalPages || 1);
                setTotalInvoices(result.pagination?.total || 0);
            } else {
                console.error('Error loading invoices:', result.error);
            }
        } catch (error) {
            console.error('Error loading invoices:', error);
        } finally {
            setLoading(false);
        }
    };

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

    return (
        <div className="payments-page">
            {portalElement && createPortal(
                <div className="invoices-portal-actions">
                    {totalPages > 1 && (
                        <div className="portal-pagination-pill">
                            <button
                                type="button"
                                onClick={() => setCurrentPage(p => p - 1)}
                                disabled={currentPage <= 1}
                                className="portal-pagination-arrow"
                                aria-label="Página anterior"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <span>{currentPage}/{totalPages}</span>
                            <button
                                type="button"
                                onClick={() => setCurrentPage(p => p + 1)}
                                disabled={currentPage >= totalPages}
                                className="portal-pagination-arrow"
                                aria-label="Página siguiente"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    )}
                    <button
                        type="button"
                        className={`portal-filter-toggle ${showFilters ? 'active' : ''}`}
                        onClick={() => setShowFilters(!showFilters)}
                        id="filterToggle"
                        aria-label="Filtros"
                    >
                        <ListFilter size={20} />
                    </button>
                </div>,
                portalElement
            )}

            <div className="page-header hidden md:flex">
                <div>
                    <h1>{t('invoices.title')}</h1>
                </div>
                <div className="invoices-header-actions">
                    <select
                        value={selectedMonth}
                        onChange={e => {
                            setSelectedMonth(Number(e.target.value));
                            setCurrentPage(1);
                        }}
                        className="select-control header-date-select"
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                                {new Date(0, i).toLocaleString('es-ES', { month: 'long' }).replace(/^\w/, (c) => c.toUpperCase())}
                            </option>
                        ))}
                    </select>
                    <select
                        value={selectedYear}
                        onChange={e => {
                            setSelectedYear(Number(e.target.value));
                            setCurrentPage(1);
                        }}
                        className="select-control header-date-select"
                    >
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                        <option value={2027}>2027</option>
                    </select>
                    <button
                        className="btn-secondary"
                        onClick={() => loadInvoices(currentPage)}
                    >
                        <RefreshCw size={16} /> {t('payments.refresh')}
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={handleExport}
                        disabled={downloading}
                    >
                        {downloading ? <RefreshCw size={16} className="spinning" /> : <Download size={16} />} CSV
                    </button>
                </div>
            </div>

            {/* Mobile Collapsible Filter Section (Mobile only) */}
            <div className={`collapsible-content max-w-[380px] mx-auto md:hidden ${showFilters ? 'expanded' : ''}`} id="filterSection">
                <div className="pt-2 pb-1">
                    <SearchAndFilterBar
                        searchQuery={searchInput}
                        setSearchQuery={(val) => {
                            setSearchInput(val);
                            setSearchQuery(val);
                            setCurrentPage(1);
                        }}
                        searchPlaceholder={t('invoices.searchPlaceholder')}
                        filter={filter}
                        setFilter={(val) => handleFilterChange(val)}
                        filterOptions={[
                            { value: 'all', label: t('payments.filters.all') || 'Todas' },
                            { value: 'PAID', label: ADJUSTMENT_CONFIG.PAID?.badgeLabel || 'Pagadas' },
                            { value: 'PENDING', label: ADJUSTMENT_CONFIG.PENDING?.badgeLabel || 'Pendientes' },
                            { value: 'DEBT', label: ADJUSTMENT_CONFIG.DEBT?.badgeLabel || 'Deudas' }
                        ]}
                        filterRowClass="summary-filter-row-ios"
                    />

                    {/* Action Items for Mobile */}
                    <div className="invoices-mobile-actions">
                        <select
                            value={selectedMonth}
                            onChange={e => {
                                setSelectedMonth(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="sort-select mobile-select-month"
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>
                                    {new Date(0, i).toLocaleString('es-ES', { month: 'long' }).replace(/^\w/, (c) => c.toUpperCase())}
                                </option>
                            ))}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={e => {
                                setSelectedYear(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="sort-select mobile-select-year"
                        >
                            <option value={2025}>2025</option>
                            <option value={2026}>2026</option>
                            <option value={2027}>2027</option>
                        </select>
                        <button className="filter-action-btn filter-action-btn-icon" onClick={() => loadInvoices(currentPage)} title="Actualizar">
                            <RefreshCw size={18} />
                        </button>
                        <button className="filter-action-btn filter-action-btn-icon" onClick={handleExport} title="Descargar CSV">
                            <Download size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="payment-stats">
                <StatCard
                    title={t('invoices.stats.total')}
                    value={
                        <>
                            <span className="desktop-only">{formatCurrency(stats.totalAmount)}</span>
                            <span className="mobile-only">{formatCompact(stats.totalAmount)}</span>
                        </>
                    }

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
            {loading ? (
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
            ) : (
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
                                                <div className="invoice-payment-id" title={`ID de pago: ${paymentId}`}>
                                                    ID Pago: {paymentId}
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
                                onClick={() => setCurrentPage(p => p - 1)}
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
                                onClick={() => setCurrentPage(p => p + 1)}
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
            {manualPayModal.open && manualPayModal.invoice && (
                <div className="modal-overlay" onClick={closeManualPayModal}>
                    <div className="modal-card modal-surface--invoice" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header" style={
                            manualPayForm.adjustmentType
                                ? { background: `linear-gradient(135deg, ${ADJUSTMENT_CONFIG[manualPayForm.adjustmentType].color}, ${ADJUSTMENT_CONFIG[manualPayForm.adjustmentType].color}cc)` }
                                : {}
                        }>
                            <div className="modal-header-left">
                                {(() => {
                                    const ModalIcon = manualPayForm.adjustmentType
                                        ? (ADJUSTMENT_ICONS[manualPayForm.adjustmentType] || HandCoins)
                                        : HandCoins;
                                    return <ModalIcon size={20} />;
                                })()}
                                <span>
                                    {manualPayForm.adjustmentType
                                        ? ADJUSTMENT_CONFIG[manualPayForm.adjustmentType]?.label || manualPayForm.adjustmentType
                                        : 'Pago Manual'}
                                </span>
                            </div>
                            <button className="modal-close" onClick={closeManualPayModal}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="modal-invoice-info">
                            <div className="modal-info-row">
                                <span className="modal-info-label">Factura</span>
                                <span className="modal-info-value">{manualPayModal.invoice.invoiceId}</span>
                            </div>
                            <div className="modal-info-row">
                                <span className="modal-info-label">Dispositivo</span>
                                <span className="modal-info-value">{manualPayModal.invoice.deviceIdName}</span>
                            </div>
                            <div className="modal-info-row">
                                <span className="modal-info-label">Monto total</span>
                                <span className="modal-info-value modal-info-amount">
                                    {formatCurrency(manualPayModal.invoice.amount)}
                                </span>
                            </div>
                        </div>

                        <form className="modal-form" onSubmit={handleManualPaySubmit}>
                            {manualPayForm.adjustmentType && (() => {
                                const cfg = ADJUSTMENT_CONFIG[manualPayForm.adjustmentType];
                                if (!cfg) return null;
                                return (
                                    <div className="adjustment-info-banner" style={{ background: cfg.bg, borderColor: (cfg.color || '#3b82f6') + '50', color: cfg.color || '#3b82f6' }}>
                                        <AlertTriangle size={14} />
                                        <span>{cfg.description}</span>
                                    </div>
                                );
                            })()}

                            <div className="modal-field">
                                <label>Tipo de ajuste</label>
                                <select
                                    value={manualPayForm.adjustmentType || ''}
                                    onChange={(e) => {
                                        const reason = e.target.value || null;
                                        const cfg = reason ? ADJUSTMENT_CONFIG[reason] : null;
                                        const invoice = manualPayModal.invoice;
                                        setManualPayForm(f => ({
                                            ...f,
                                            adjustmentType: reason,
                                            amount: cfg?.autoAmount ?? invoice.amount,
                                            reference: buildAutoReference(cfg, invoice),
                                        }));
                                    }}
                                    style={{ width: '100%', color: '#1a1a2e', background: '#fff', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
                                >
                                    {Object.entries(ADJUSTMENT_CONFIG)
                                        .filter(([key, cfg]) => !cfg.hidden && cfg.category !== 'STATUS')
                                        .map(([key, cfg]) => (
                                            <option key={key} value={key} style={{ color: cfg.color, background: cfg.bg, fontWeight: 600 }}>{cfg.label}</option>
                                        ))
                                    }
                                </select>
                            </div>

                            <div className="modal-field">
                                <label>Monto pagado {!manualPayForm.adjustmentType && <span className="required">*</span>}</label>
                                <div className="modal-amount-input">
                                    <span className="currency-symbol">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        placeholder="0"
                                        value={manualPayForm.amount}
                                        onChange={(e) => setManualPayForm(f => ({ ...f, amount: e.target.value }))}
                                        readOnly={!!manualPayForm.adjustmentType && !ADJUSTMENT_CONFIG[manualPayForm.adjustmentType]?.isRealPayment && ADJUSTMENT_CONFIG[manualPayForm.adjustmentType]?.autoAmount !== null}
                                        style={manualPayForm.adjustmentType && !ADJUSTMENT_CONFIG[manualPayForm.adjustmentType]?.isRealPayment && ADJUSTMENT_CONFIG[manualPayForm.adjustmentType]?.autoAmount !== null ? { background: '#F9FAFB', cursor: 'default', fontWeight: 700 } : {}}
                                        required={!manualPayForm.adjustmentType}
                                    />
                                </div>
                                {manualPayForm.adjustmentType && (
                                    <span className="field-hint">
                                        {Number(manualPayForm.amount) === 0
                                            ? '✓ Dia sin cobro (ajuste automatico)'
                                            : `✓ Cobro completo: ${formatCurrency(manualPayForm.amount)}`}
                                    </span>
                                )}
                            </div>

                            <div className="modal-field">
                                <label>Fecha de pago <span className="required">*</span></label>
                                <input
                                    type="date"
                                    value={manualPayForm.paymentDate}
                                    onChange={(e) => setManualPayForm(f => ({ ...f, paymentDate: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="modal-field">
                                <label>Referencia / comprobante</label>
                                <input
                                    type="text"
                                    placeholder="Nro. transferencia, recibo, etc."
                                    value={manualPayForm.reference}
                                    onChange={(e) => setManualPayForm(f => ({ ...f, reference: e.target.value }))}
                                />
                            </div>

                            <div className="modal-field">
                                <label>Nota</label>
                                <textarea
                                    rows={2}
                                    placeholder="Ej: Pago en efectivo, deposito bancario..."
                                    value={manualPayForm.note}
                                    onChange={(e) => setManualPayForm(f => ({ ...f, note: e.target.value }))}
                                />
                            </div>

                            {manualPayError && (
                                <div className="modal-error">{manualPayError}</div>
                            )}

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={closeManualPayModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-confirm" disabled={manualPayLoading}>
                                    {manualPayLoading ? (
                                        <><span className="btn-spinner" /> Registrando...</>
                                    ) : (
                                        <><Check size={15} /> Confirmar pago</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div >
            )}
        </div >
    );
};

export default Invoices;
