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
import { getAllInvoices, getInvoiceStats, exportInvoicesCSV, registerManualAdjustment } from '../services/api';
import useFilterVisibilityOnScroll from '../hooks/useFilterVisibilityOnScroll';

const Invoices = () => {
    const { t } = useTranslation();
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
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

    // Config per adjustment type
    const ADJUSTMENT_CONFIG = {
        REPAIR: {
            label: 'Reparación',
            color: '#FB9678',
            bg: '#FFF4EF',
            description: 'El dispositivo estaba en reparación — día sin cobro al cliente.',
            autoAmount: 0,         // free day
            autoReference: 'REPARACIÓN - Día ajustado automáticamente',
        },
        DAMAGE: {
            label: 'Daño',
            color: '#EF4444',
            bg: '#FEF2F2',
            description: 'Cobro completo por daño — el cliente es responsable.',
            autoAmount: null,      // full invoice amount
            autoReference: 'DAÑO - Cobro completo por responsabilidad del cliente',
            hidden: true,
        },
        INCAPACITY: {
            label: 'Incapacidad',
            color: '#EF4444',
            bg: '#FEF2F2',
            description: 'Incapacidad médica del cliente — día sin cobro al cliente.',
            autoAmount: 0,         // free day (pago 0)
            autoReference: 'INCAPACIDAD - Día ajustado automáticamente',
        },
        MAINTENANCE: {
            label: 'Mantenimiento',
            color: '#7460EE',
            bg: '#F5F3FF',
            description: 'Mantenimiento programado — día sin cobro al cliente.',
            autoAmount: 0,         // free day
            autoReference: 'MANTENIMIENTO - Día ajustado automáticamente',
        },
        OFFICE: {
            label: 'Oficina',
            color: '#0891B2',
            bg: '#ECFEFF',
            description: 'Ajuste realizado en oficina — día sin cobro al cliente.',
            autoAmount: 0,         // free day (pago 0)
            autoReference: 'OFICINA - Día ajustado automáticamente',
        },
        WORKSHOP: {
            label: 'Taller',
            color: '#A3A3A3',
            bg: '#F5F5F5',
            description: 'Dispositivo en taller — día sin cobro al cliente.',
            autoAmount: 0,         // free day
            autoReference: 'TALLER - Día ajustado automáticamente',
            hidden: true,
        },
    };

    const openManualPayModal = (invoice) => {
        const reason = invoice.adjustmentType || null;
        const cfg = reason ? ADJUSTMENT_CONFIG[reason] : null;
        const autoAmount = cfg
            ? (cfg.autoAmount !== null ? cfg.autoAmount : invoice.amount)
            : invoice.amount;

        setManualPayForm({
            amount: autoAmount,
            reference: cfg ? cfg.autoReference : '',
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
            if (manualPayForm.adjustmentType) {
                await registerManualAdjustment({
                    invoiceId: manualPayModal.invoice._id,
                    adjustmentType: manualPayForm.adjustmentType,
                    amount: Number(manualPayForm.amount),
                    adjustmentReference: manualPayForm.reference,
                    note: manualPayForm.note,
                });
            } else {
                console.log('Plain manual payment submitted', {
                    invoiceId: manualPayModal.invoice._id,
                    ...manualPayForm,
                });
            }
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
        loadInvoices(currentPage);
        loadStats();
    }, [currentPage, selectedMonth, selectedYear]);

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
            const result = await getAllInvoices({ page, limit: PAGE_SIZE, month: selectedMonth, year: selectedYear });
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
                <div style={{ lineHeight: '1.2' }}>
                    <div>{day} {month}</div>
                    <div style={{ fontSize: '0.65rem', color: '#6B7280' }}>{hours}:{minutes}{ampm}</div>
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
            return `${deviceName}-${monthName.replace('.', '')}-${parseInt(day)}`;
        }
        return invoiceId;
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

    const filteredInvoices = invoices.filter(invoice => {
        if (filter !== 'all') {
            const statusMap = {
                'completed': 'PAID',
                'pending': 'PENDING',
                'failed': 'DEBT'
            };
            const mappedStatus = statusMap[filter] || filter;
            if (invoice.dayType.toUpperCase() !== mappedStatus.toUpperCase()) {
                return false;
            }
        }
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f3f4f6', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, color: '#4b5563' }}>
                            <button
                                type="button"
                                onClick={() => setCurrentPage(p => p - 1)}
                                disabled={currentPage <= 1}
                                style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: currentPage > 1 ? '#1f2937' : '#9ca3af' }}
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <span>{currentPage}/{totalPages}</span>
                            <button
                                type="button"
                                onClick={() => setCurrentPage(p => p + 1)}
                                disabled={currentPage >= totalPages}
                                style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: currentPage < totalPages ? '#1f2937' : '#9ca3af' }}
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
                    <h1>📄 {t('invoices.title')}</h1>
                    <p>Historial y registro de cobros diarios por dispositivo</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                        value={selectedMonth}
                        onChange={e => {
                            setSelectedMonth(Number(e.target.value));
                            setCurrentPage(1);
                        }}
                        className="select-control"
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
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
                        className="select-control"
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
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
                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
                        <button
                            type="button"
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
                            Pagadas
                        </button>
                        <button
                            type="button"
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
                            Pendientes
                        </button>
                        <button
                            type="button"
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
                            Deudas
                        </button>
                    </div>

                    {/* Action Items for Mobile */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                        <select
                            value={selectedMonth}
                            onChange={e => {
                                setSelectedMonth(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="sort-select"
                            style={{ flexGrow: 1, padding: '8px 12px' }}
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
                            className="sort-select"
                            style={{ padding: '8px 12px' }}
                        >
                            <option value={2025}>2025</option>
                            <option value={2026}>2026</option>
                            <option value={2027}>2027</option>
                        </select>
                        <button className="filter-action-btn" onClick={() => loadInvoices(currentPage)} style={{ height: '38px', width: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Actualizar">
                            <RefreshCw size={18} />
                        </button>
                        <button className="filter-action-btn" onClick={handleExport} style={{ height: '38px', width: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Descargar CSV">
                            <Download size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="payment-stats">
                <div className="payment-stat-card">
                    <div className="stat-icon" style={{ background: 'var(--brand-teal)' }}>
                        <DollarSign size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Recaudación Total</div>
                        <div className="stat-value-container">
                            <span className="stat-number">
                                <span className="desktop-only">{formatCurrency(stats.totalAmount)}</span>
                                <span className="mobile-only">{formatCompact(stats.totalAmount)}</span>
                            </span>
                        </div>
                    </div>
                </div>
                <div className="payment-stat-card">
                    <div className="stat-icon" style={{ background: '#00C292' }}>
                        <Check size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Pagadas</div>
                        <div className="stat-value-container">
                            <span className="stat-number">{stats.paid}</span>
                            {paidPercentage > 0 && (
                                <span className="stat-change-inline positive">
                                    <TrendingUp size={14} />
                                    {paidPercentage}%
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="payment-stat-card">
                    <div className="stat-icon" style={{ background: '#EF4444' }}>
                        <X size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Deudas / Impagas</div>
                        <div className="stat-value-container">
                            <span className="stat-number">{stats.unpaid}</span>
                            {unpaidPercentage > 0 && (
                                <span className="stat-change-inline negative">
                                    <TrendingDown size={14} />
                                    {unpaidPercentage}%
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="payment-stat-card">
                    <div className="stat-icon" style={{ background: '#7460EE' }}>
                        <FileText size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Total Facturas</div>
                        <div className="stat-number">{stats.total}</div>
                    </div>
                </div>
            </div>

            {/* Desktop Filters (Desktop only) */}
            <div className="payment-controls hidden md:flex">
                <button
                    className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('all')}
                    style={{ border: filter === 'all' ? '1px solid var(--brand-teal)' : '1px solid #E5E7EB', background: filter === 'all' ? 'var(--brand-teal)' : 'white', color: filter === 'all' ? 'white' : '#6B7280' }}
                >
                    <Filter size={16} /> Todos
                </button>
                <button
                    className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('completed')}
                    style={{ border: filter === 'completed' ? '1px solid var(--brand-teal)' : '1px solid #E5E7EB', background: filter === 'completed' ? 'var(--brand-teal)' : 'white', color: filter === 'completed' ? 'white' : '#6B7280' }}
                >
                    Pagadas
                </button>
                <button
                    className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('pending')}
                    style={{ border: filter === 'pending' ? '1px solid var(--brand-teal)' : '1px solid #E5E7EB', background: filter === 'pending' ? 'var(--brand-teal)' : 'white', color: filter === 'pending' ? 'white' : '#6B7280' }}
                >
                    Pendientes
                </button>
                <button
                    className={`filter-btn ${filter === 'failed' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('failed')}
                    style={{ border: filter === 'failed' ? '1px solid var(--brand-teal)' : '1px solid #E5E7EB', background: filter === 'failed' ? 'var(--brand-teal)' : 'white', color: filter === 'failed' ? 'white' : '#6B7280' }}
                >
                    Deudas
                </button>
                <div className="search-box" style={{ marginLeft: 'auto', width: '300px' }}>
                    <Search className="search-icon" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por ID, dispositivo..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ paddingLeft: '2.5rem' }}
                    />
                    {searchQuery && (
                        <button className="clear-search" onClick={() => setSearchQuery('')}>
                            <X size={16} />
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
                    <h3>No se encontraron facturas</h3>
                    <p>{searchQuery ? `No hay resultados para "${searchQuery}"` : 'No hay registros de facturas en este periodo.'}</p>
                </div>
            ) : (
                <>
                    <div className="payments-table-container">
                        <table className="payments-table">
                            <thead>
                                <tr>
                                    <th>ID Factura</th>
                                    <th className="desktop-only">{t('login.deviceId')}</th>
                                    <th>Monto</th>
                                    <th>Fecha Pago</th>
                                    <th>{t('common.status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredInvoices.map((invoice) => (
                                     <tr key={invoice.invoiceId}>
                                        <td className="payment-id">
                                            <div style={{ lineHeight: '1.2' }}>
                                                {(() => {
                                                    const formatted = formatInvoiceId(invoice.invoiceId);
                                                    const dashIndex = formatted.indexOf('-');
                                                    if (dashIndex !== -1) {
                                                        return (
                                                            <>
                                                                <div>{formatted.slice(0, dashIndex)}</div>
                                                                <div style={{ fontSize: '0.65rem', color: '#6B7280' }}>{formatted.slice(dashIndex + 1)}</div>
                                                            </>
                                                        );
                                                    }
                                                    return formatted;
                                                })()}
                                            </div>
                                        </td>
                                        <td className="desktop-only">{invoice.deviceIdName}</td>
                                        <td className="amount" style={{ color: invoice.dayType === 'PAID' || invoice.dayType === 'FREE' ? '#00c292' : '#EF4444', fontWeight: 600 }}>
                                            <span className="desktop-only">{formatCurrency(invoice.paidAmount, false)}</span>
                                            <span className="mobile-only">{formatCurrency(invoice.paidAmount, true)}</span>
                                        </td>
                                        <td className="date">
                                            <span className="desktop-only">{formatDate(invoice.transaction?.finalized_at || invoice.createdAt, false)}</span>
                                            <span className="mobile-only">{formatDate(invoice.transaction?.finalized_at || invoice.createdAt, true)}</span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span
                                                    className="status-badge"
                                                    onClick={(invoice.dayType === 'PENDING' || invoice.dayType === 'DEBT') ? () => openManualPayModal(invoice) : undefined}
                                                    style={{
                                                        background: `${getStatusColor(invoice.dayType)}20`,
                                                        color: getStatusColor(invoice.dayType),
                                                        cursor: (invoice.dayType === 'PENDING' || invoice.dayType === 'DEBT') ? 'pointer' : 'default'
                                                    }}
                                                    title={(invoice.dayType === 'PENDING' || invoice.dayType === 'DEBT') ? "Registrar pago manual / ajuste" : undefined}
                                                >
                                                    {invoice.adjustmentType === 'REPAIR' && <Wrench size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
                                                    {(invoice.adjustmentType === 'DAMAGE' || invoice.adjustmentType === 'INCAPACITY' || invoice.adjustmentType === 'INCAPACIDAD') && <AlertTriangle size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
                                                    {invoice.adjustmentType === 'MAINTENANCE' && <Hammer size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
                                                    {(invoice.adjustmentType === 'WORKSHOP' || invoice.adjustmentType === 'OFFICE' || invoice.adjustmentType === 'OFICINA') && <Building2 size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
                                                    {(() => {
                                                        const adjType = invoice.adjustmentType === 'OFICINA' ? 'OFFICE' : (invoice.adjustmentType === 'INCAPACIDAD' ? 'INCAPACITY' : invoice.adjustmentType);
                                                        if (adjType && ADJUSTMENT_CONFIG[adjType]) {
                                                            return ADJUSTMENT_CONFIG[adjType].label.toUpperCase();
                                                        }
                                                        return invoice.dayType === 'PAID' ? 'PAGADO' : invoice.dayType === 'DEBT' ? 'DEUDA' : invoice.dayType === 'FREE' ? 'GRATIS' : invoice.dayType;
                                                    })()}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="results-info">
                        Mostrando {filteredInvoices.length} de {totalInvoices} facturas
                    </div>

                    {totalPages > 1 && (
                        <div className="pagination">
                            <button
                                className="pagination-btn"
                                onClick={() => setCurrentPage(p => p - 1)}
                                disabled={currentPage <= 1}
                            >
                                ← Anterior
                            </button>
                            <span className="pagination-info">
                                Página {currentPage} de {totalPages}
                            </span>
                            <button
                                className="pagination-btn"
                                onClick={() => setCurrentPage(p => p + 1)}
                                disabled={currentPage >= totalPages}
                            >
                                Siguiente →
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
                                {!manualPayForm.adjustmentType && <HandCoins size={20} />}
                                {manualPayForm.adjustmentType === 'REPAIR' && <Wrench size={20} />}
                                {(manualPayForm.adjustmentType === 'DAMAGE' || manualPayForm.adjustmentType === 'INCAPACITY' || manualPayForm.adjustmentType === 'INCAPACIDAD') && <AlertTriangle size={20} />}
                                {manualPayForm.adjustmentType === 'MAINTENANCE' && <Hammer size={20} />}
                                {(manualPayForm.adjustmentType === 'WORKSHOP' || manualPayForm.adjustmentType === 'OFFICE' || manualPayForm.adjustmentType === 'OFICINA') && <Building2 size={20} />}
                                <span>
                                    {manualPayForm.adjustmentType
                                        ? ADJUSTMENT_CONFIG[manualPayForm.adjustmentType].label
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
                                return (
                                    <div className="adjustment-info-banner" style={{ background: cfg.bg, borderColor: cfg.color + '50', color: cfg.color }}>
                                        {manualPayForm.adjustmentType === 'REPAIR' && <Wrench size={14} />}
                                        {(manualPayForm.adjustmentType === 'DAMAGE' || manualPayForm.adjustmentType === 'INCAPACITY' || manualPayForm.adjustmentType === 'INCAPACIDAD') && <AlertTriangle size={14} />}
                                        {manualPayForm.adjustmentType === 'MAINTENANCE' && <Hammer size={14} />}
                                        {(manualPayForm.adjustmentType === 'WORKSHOP' || manualPayForm.adjustmentType === 'OFFICE' || manualPayForm.adjustmentType === 'OFICINA') && <Building2 size={14} />}
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
                                            amount: cfg
                                                ? (cfg.autoAmount !== null ? cfg.autoAmount : invoice.amount)
                                                : invoice.amount,
                                            reference: cfg ? cfg.autoReference : '',
                                        }));
                                    }}
                                    style={{ width: '100%', color: '#1a1a2e', background: '#fff', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
                                >
                                    <option value="" style={{ color: '#1a1a2e', background: '#fff' }}>-- Pago normal --</option>
                                    {Object.entries(ADJUSTMENT_CONFIG).filter(([_, cfg]) => !cfg.hidden).map(([key, cfg]) => (
                                        <option key={key} value={key} style={{ color: cfg.color, background: cfg.bg, fontWeight: 600 }}>{cfg.label}</option>
                                    ))}
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
                                        readOnly={!!manualPayForm.adjustmentType}
                                        style={manualPayForm.adjustmentType ? { background: '#F9FAFB', cursor: 'default', fontWeight: 700 } : {}}
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
