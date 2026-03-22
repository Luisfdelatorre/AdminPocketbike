import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    FileText, Calendar, DollarSign, Check, X, Search, Filter,
    HandCoins, Wrench, AlertTriangle, Hammer, PlusCircle, Download, RefreshCw, Building2
} from 'lucide-react';
import './Invoices.css';
import { getAllInvoices, getInvoiceStats, exportInvoicesCSV, registerManualAdjustment } from '../services/api';

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
        },
        MAINTENANCE: {
            label: 'Mantenimiento',
            color: '#7460EE',
            bg: '#F5F3FF',
            description: 'Mantenimiento programado — día sin cobro al cliente.',
            autoAmount: 0,         // free day
            autoReference: 'MANTENIMIENTO - Día ajustado automáticamente',
        },
        WORKSHOP: {
            label: 'Taller',
            color: '#0891B2',
            bg: '#ECFEFF',
            description: 'Dispositivo en taller — día sin cobro al cliente.',
            autoAmount: 0,         // free day
            autoReference: 'TALLER - Día ajustado automáticamente',
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
        // For REPAIR/MAINTENANCE amount=0 is valid; for plain manual it must be > 0
        if (!isAdjustment && (!manualPayForm.amount || Number(manualPayForm.amount) <= 0)) {
            setManualPayError('El monto debe ser mayor a 0.');
            return;
        }
        setManualPayLoading(true);
        setManualPayError('');
        try {
            if (manualPayForm.adjustmentType) {
                // Adjustment payment (REPAIR / DAMAGE / MAINTENANCE / WORKSHOP)
                await registerManualAdjustment({
                    invoiceId: manualPayModal.invoice._id,
                    adjustmentType: manualPayForm.adjustmentType,
                    amount: Number(manualPayForm.amount),
                    adjustmentReference: manualPayForm.reference,
                    note: manualPayForm.note,
                });
            } else {
                // TODO: plain cash/manual payment endpoint
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
    }, [currentPage]);

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

    const loadInvoices = async (page = 1) => {
        setLoading(true);
        try {
            const result = await getAllInvoices({ page, limit: PAGE_SIZE });

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

    const formatCurrency = (amount) => {
        return `$${(amount).toLocaleString()} COP`;
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return dateString ? date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }) : '--';
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
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(Number(e.target.value))}
                        className="select-control"
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                                {new Date(0, i).toLocaleString('es-ES', { month: 'long' })}
                            </option>
                        ))}
                    </select>
                    <select
                        value={selectedYear}
                        onChange={e => setSelectedYear(Number(e.target.value))}
                        className="select-control"
                    >
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                        <option value={2027}>2027</option>
                    </select>
                    <button
                        className="select-control refresh-btn"
                        onClick={handleExport}
                        disabled={downloading}
                        title="Descargar facturas CSV"
                        style={{ background: '#00C292', color: '#fff', border: 'none' }}
                    >
                        {downloading
                            ? <RefreshCw size={18} className="spinning" />
                            : <Download size={18} />}
                    </button>
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
                            <div>Amount</div>
                            <div>Dia Pago</div>
                            <div>{t('common.status')}</div>
                        </div>
                        {filteredInvoices.map((invoice) => (
                            <div key={invoice.invoiceId} className="table-row">
                                <div className="invoice-id">{invoice.invoiceId}</div>
                                <div className="device-id">{invoice.deviceIdName}</div>
                                <div className="invoice-amount">
                                    {formatCurrency(invoice.paidAmount)}
                                </div>
                                <div className="invoice-date">
                                    <Calendar size={14} />
                                    {formatDate(invoice.transaction?.finalized_at)}
                                </div>
                                <div className="invoice-status">
                                    {/* Status badge */}
                                    <span
                                        className="status-badge"
                                        style={{
                                            background: `${getStatusColor(invoice.dayType)}20`,
                                            color: getStatusColor(invoice.dayType)
                                        }}
                                    >
                                        {invoice.dayType === 'PENDING' && (
                                            <HandCoins size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                        )}
                                        {invoice.dayType}
                                    </span>

                                    {/* Adjustment icon (repair / damage / maintenance) */}
                                    {invoice.adjustmentType && (
                                        <span
                                            className="adjustment-badge"
                                            data-tooltip={
                                                `${invoice.adjustmentType}${invoice.adjustmentComment ? ': ' + invoice.adjustmentComment : ''}`
                                            }
                                            style={{
                                                color:
                                                    invoice.adjustmentType === 'REPAIR' ? '#FB9678'
                                                        : invoice.adjustmentType === 'DAMAGE' ? '#EF4444'
                                                            : '#7460EE'
                                            }}
                                        >

                                        </span>
                                    )}

                                    {/* Manual payment button — only for unpaid / PENDING / DEBT */}
                                    {(invoice.dayType === 'PENDING' || invoice.dayType === 'DEBT') && (
                                        <button
                                            className="manual-pay-btn"
                                            title="Registrar pago manual"
                                            onClick={() => openManualPayModal(invoice)}
                                        >

                                            {!invoice.adjustmentType && <PlusCircle size={18} />}
                                            {invoice.adjustmentType === 'REPAIR' && <Wrench size={13} />}
                                            {invoice.adjustmentType === 'DAMAGE' && <AlertTriangle size={13} />}
                                            {invoice.adjustmentType === 'MAINTENANCE' && <Hammer size={13} />}
                                            {invoice.adjustmentType === 'WORKSHOP' && <Building2 size={13} />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="results-info">
                        Showing {filteredInvoices.length} of {totalInvoices} invoices
                    </div>

                    {totalPages > 1 && (
                        <div className="pagination-controls">
                            <button
                                className="page-btn"
                                onClick={() => setCurrentPage(p => p - 1)}
                                disabled={currentPage <= 1}
                            >
                                ← Anterior
                            </button>
                            <span className="page-info">
                                Página {currentPage} de {totalPages}
                            </span>
                            <button
                                className="page-btn"
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
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        {/* Modal header — icon changes by adjustment type */}
                        <div className="modal-header" style={
                            manualPayForm.adjustmentType
                                ? { background: `linear-gradient(135deg, ${ADJUSTMENT_CONFIG[manualPayForm.adjustmentType].color}, ${ADJUSTMENT_CONFIG[manualPayForm.adjustmentType].color}cc)` }
                                : {}
                        }>
                            <div className="modal-header-left">
                                {!manualPayForm.adjustmentType && <HandCoins size={20} />}
                                {manualPayForm.adjustmentType === 'REPAIR' && <Wrench size={20} />}
                                {manualPayForm.adjustmentType === 'DAMAGE' && <AlertTriangle size={20} />}
                                {manualPayForm.adjustmentType === 'MAINTENANCE' && <Hammer size={20} />}
                                {manualPayForm.adjustmentType === 'WORKSHOP' && <Building2 size={20} />}
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

                        {/* Invoice info */}
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

                        {/* Form */}
                        <form className="modal-form" onSubmit={handleManualPaySubmit}>

                            {/* Adjustment type banner -- shown when a reason is selected */}
                            {manualPayForm.adjustmentType && (() => {
                                const cfg = ADJUSTMENT_CONFIG[manualPayForm.adjustmentType];
                                return (
                                    <div className="adjustment-info-banner" style={{ background: cfg.bg, borderColor: cfg.color + '50', color: cfg.color }}>
                                        {manualPayForm.adjustmentType === 'REPAIR' && <Wrench size={14} />}
                                        {manualPayForm.adjustmentType === 'DAMAGE' && <AlertTriangle size={14} />}
                                        {manualPayForm.adjustmentType === 'MAINTENANCE' && <Hammer size={14} />}
                                        {manualPayForm.adjustmentType === 'WORKSHOP' && <Building2 size={14} />}
                                        <span>{cfg.description}</span>
                                    </div>
                                );
                            })()}

                            {/* Tipo de ajuste -- dropdown */}
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
                                    {Object.entries(ADJUSTMENT_CONFIG).map(([key, cfg]) => (
                                        <option key={key} value={key} style={{ color: cfg.color, background: cfg.bg, fontWeight: 600 }}>{cfg.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Monto pagado */}
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
