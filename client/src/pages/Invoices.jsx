import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
    FileText, Calendar, DollarSign, Check, X, Search, Filter,
    HandCoins, Wrench, AlertTriangle, Hammer, PlusCircle, Plus, Download, RefreshCw, Building2,
    ChevronLeft, ChevronRight, TrendingUp, TrendingDown
} from 'lucide-react';
import './Payments.css';
import './Invoices.css';
import PageHeader from '../components/PageHeader';
import useIsMobile from '../hooks/useIsMobile';
import { getAllInvoices, getInvoiceStats, exportInvoicesCSV, registerManualAdjustment, getAdjustmentTypes, getPaymentStatuses } from '../services/api';
import useFilterVisibilityOnScroll from '../hooks/useFilterVisibilityOnScroll';
import SearchAndFilterBar from '../components/SearchAndFilterBar';
import StatCard from '../components/StatCard';
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

    const DEFAULT_ADJUSTMENT_CONFIG = {
        NEQUI: {
            label: 'Pago Real - Nequi',
            color: '#E11D48',
            bg: '#FFF1F2',
            description: 'Pago real recibido vía Nequi.',
            autoAmount: null,
            autoReference: 'Pago Nequi recibido por Admin',
            isRealPayment: true,
        },
        EFECTIVO: {
            label: 'Pago Real - Efectivo',
            color: '#16A34A',
            bg: '#F0FDF4',
            description: 'Pago real recibido en efectivo.',
            autoAmount: null,
            autoReference: 'Pago en Efectivo recibido por Admin',
            isRealPayment: true,
        },
        TRANSFERENCIA: {
            label: 'Pago Real - Transferencia Bancaria',
            color: '#2563EB',
            bg: '#EFF6FF',
            description: 'Pago real recibido por transferencia bancaria.',
            autoAmount: null,
            autoReference: 'Transferencia Bancaria recibida por Admin',
            isRealPayment: true,
        },
        ACCIDENT_TRANSIT: {
            label: 'Ajuste - Retenida en tránsito por accidente ($0)',
            badgeLabel: 'RETENIDA',
            color: '#FB9678',
            bg: '#FFF4EF',
            description: 'Vehículo retenido en tránsito por accidente — día sin cobro al cliente.',
            autoAmount: 0,
            autoReference: 'RETENIDA EN TRÁNSITO POR ACCIDENTE - Día ajustado automáticamente',
        },
        REPAIR: {
            label: 'Ajuste - Retenida en tránsito por accidente ($0)',
            badgeLabel: 'RETENIDA',
            color: '#FB9678',
            bg: '#FFF4EF',
            description: 'Vehículo retenido en tránsito por accidente — día sin cobro al cliente.',
            autoAmount: 0,
            autoReference: 'RETENIDA EN TRÁNSITO POR ACCIDENTE - Día ajustado automáticamente',
            hidden: true,
        },
        INCAPACITY: {
            label: 'Ajuste - Incapacidad ($0)',
            color: '#3b82f6',
            bg: '#EFF6FF',
            description: 'Incapacidad médica del cliente — día sin cobro al cliente.',
            autoAmount: 0,
            autoReference: 'INCAPACIDAD - Día ajustado automáticamente',
        },
        MAINTENANCE: {
            label: 'Ajuste - Mantenimiento ($0)',
            color: '#7460EE',
            bg: '#F5F3FF',
            description: 'Mantenimiento programado — día sin cobro al cliente.',
            autoAmount: 0,
            autoReference: 'MANTENIMIENTO - Día ajustado automáticamente',
        },
        OFFICE: {
            label: 'Ajuste - Oficina ($0)',
            color: '#0891B2',
            bg: '#ECFEFF',
            description: 'Ajuste realizado en oficina — día sin cobro al cliente.',
            autoAmount: 0,
            autoReference: 'OFICINA - Día ajustado automáticamente',
        },
        WORKSHOP: {
            label: 'Ajuste - Taller ($0)',
            color: '#A3A3A3',
            bg: '#F5F5F5',
            description: 'Dispositivo en taller — día sin cobro al cliente.',
            autoAmount: 0,
            autoReference: 'TALLER - Día ajustado automáticamente',
        },
    };

    const [ADJUSTMENT_CONFIG, setAdjustmentConfig] = useState(DEFAULT_ADJUSTMENT_CONFIG);

    useEffect(() => {
        Promise.all([getAdjustmentTypes(), getPaymentStatuses()])
            .then(([adjRes, payRes]) => {
                const combined = {
                    ...DEFAULT_ADJUSTMENT_CONFIG,
                    ...(payRes?.data || {}),
                    ...(adjRes?.data || {})
                };
                setAdjustmentConfig(combined);
            })
            .catch(err => console.warn('No se pudo cargar la configuración de tipos de ajuste:', err));
    }, []);
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

    const renderDateSelectors = () => (
        <div className="date-selectors-group">
            <select
                value={selectedMonth}
                onChange={e => {
                    setSelectedMonth(Number(e.target.value));
                    setCurrentPage(1);
                }}
                className="date-select-standard"
                aria-label="Seleccionar mes"
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
                className="date-select-standard"
                aria-label="Seleccionar año"
            >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
            </select>
        </div>
    );

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
            onRefresh={() => loadInvoices(currentPage)}
            loading={loading}
            onFilterToggle={() => setShowFilters(!showFilters)}
            showFilters={showFilters}
            leadingActions={
                totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f3f4f6', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginRight: '4px' }}>
                        <button
                            type="button"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage <= 1}
                            style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: currentPage <= 1 ? '#9ca3af' : '#1f2937' }}
                            aria-label="Página anterior"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span>{currentPage}/{totalPages}</span>
                        <button
                            type="button"
                            onClick={() => setCurrentPage(p => p + 1)}
                            disabled={currentPage >= totalPages}
                            style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: currentPage >= totalPages ? '#9ca3af' : '#1f2937' }}
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

            {/* Mobile Collapsible Filter Section (Mobile only) */}
            <div className={`collapsible-content w-full md:hidden ${showFilters ? 'expanded' : ''}`} id="filterSection">
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
            <InvoiceAdjustmentModal
                isOpen={manualPayModal.open}
                invoice={manualPayModal.invoice}
                onClose={closeManualPayModal}
                onSuccess={() => {
                    loadInvoices(currentPage);
                    loadStats();
                }}
            />

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
            <CreateDayInvoiceModal
                isOpen={addInvoicesModalOpen}
                onClose={() => setAddInvoicesModalOpen(false)}
                onSuccess={() => {
                    loadInvoices(1);
                    loadStats();
                }}
            />
        </div >
    );
};

export default Invoices;
