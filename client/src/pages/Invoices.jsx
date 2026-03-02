import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    FileText, Calendar, DollarSign, Check, X, Search, Filter,
    HandCoins, Wrench, AlertTriangle, Hammer, PlusCircle
} from 'lucide-react';
import './Invoices.css';
import { getAllInvoices, getInvoiceStats } from '../services/api';

const Invoices = () => {
    const { t } = useTranslation();
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, paid, unpaid, pending
    const [searchQuery, setSearchQuery] = useState('');

    // ── Manual Payment Modal ──────────────────────────────
    const [manualPayModal, setManualPayModal] = useState({ open: false, invoice: null });
    const [manualPayForm, setManualPayForm] = useState({
        amount: '',
        reference: '',
        note: '',
        paymentDate: new Date().toISOString().split('T')[0],
        adjustmentReason: null, // REPAIR | DAMAGE | MAINTENANCE | null
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
    };

    const openManualPayModal = (invoice) => {
        const reason = invoice.adjustmentReason || null;
        const cfg = reason ? ADJUSTMENT_CONFIG[reason] : null;
        const autoAmount = cfg
            ? (cfg.autoAmount !== null ? cfg.autoAmount : invoice.amount)
            : invoice.amount;

        setManualPayForm({
            amount: autoAmount,
            reference: cfg ? cfg.autoReference : '',
            note: invoice.adjustmentComment || '',
            paymentDate: new Date().toISOString().split('T')[0],
            adjustmentReason: reason,
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
        const isAdjustment = !!manualPayForm.adjustmentReason;
        // For REPAIR/MAINTENANCE amount=0 is valid; for plain manual it must be > 0
        if (!isAdjustment && (!manualPayForm.amount || Number(manualPayForm.amount) <= 0)) {
            setManualPayError('El monto debe ser mayor a 0.');
            return;
        }
        setManualPayLoading(true);
        setManualPayError('');
        try {
            // TODO: wire to real API endpoint
            // await registerManualPayment({
            //   invoiceId: manualPayModal.invoice.invoiceId,
            //   adjustmentReason: manualPayForm.adjustmentReason,
            //   ...manualPayForm,
            // });
            console.log('Manual payment submitted', {
                invoiceId: manualPayModal.invoice.invoiceId,
                ...manualPayForm,
            });
            await loadInvoices();
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
        loadInvoices();
        loadStats();
    }, []);

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

    const loadInvoices = async () => {
        setLoading(true);
        try {
            const result = await getAllInvoices({ page: 1, limit: 50 });

            if (result.success) {
                setInvoices(result.invoices || []);
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
                                    {invoice.adjustmentReason && (
                                        <span
                                            className="adjustment-badge"
                                            data-tooltip={
                                                `${invoice.adjustmentReason}${invoice.adjustmentComment ? ': ' + invoice.adjustmentComment : ''}`
                                            }
                                            style={{
                                                color:
                                                    invoice.adjustmentReason === 'REPAIR' ? '#FB9678'
                                                        : invoice.adjustmentReason === 'DAMAGE' ? '#EF4444'
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

                                            {!invoice.adjustmentReason && <PlusCircle size={18} />}
                                            {invoice.adjustmentReason === 'REPAIR' && <Wrench size={13} />}
                                            {invoice.adjustmentReason === 'DAMAGE' && <AlertTriangle size={13} />}
                                            {invoice.adjustmentReason === 'MAINTENANCE' && <Hammer size={13} />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="results-info">
                        Showing {filteredInvoices.length} of {invoices.length} invoices
                    </div>
                </>
            )}

            {/* ── Manual Payment Modal ─────────────────────────── */}
            {manualPayModal.open && manualPayModal.invoice && (
                <div className="modal-overlay" onClick={closeManualPayModal}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        {/* Modal header — icon changes by adjustment type */}
                        <div className="modal-header" style={
                            manualPayForm.adjustmentReason
                                ? { background: `linear-gradient(135deg, ${ADJUSTMENT_CONFIG[manualPayForm.adjustmentReason].color}, ${ADJUSTMENT_CONFIG[manualPayForm.adjustmentReason].color}cc)` }
                                : {}
                        }>
                            <div className="modal-header-left">
                                {!manualPayForm.adjustmentReason && <HandCoins size={20} />}
                                {manualPayForm.adjustmentReason === 'REPAIR' && <Wrench size={20} />}
                                {manualPayForm.adjustmentReason === 'DAMAGE' && <AlertTriangle size={20} />}
                                {manualPayForm.adjustmentReason === 'MAINTENANCE' && <Hammer size={20} />}
                                <span>
                                    {manualPayForm.adjustmentReason
                                        ? ADJUSTMENT_CONFIG[manualPayForm.adjustmentReason].label
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

                            {/* Adjustment type banner */}
                            {manualPayForm.adjustmentReason && (() => {
                                const cfg = ADJUSTMENT_CONFIG[manualPayForm.adjustmentReason];
                                return (
                                    <div className="adjustment-info-banner" style={{ background: cfg.bg, borderColor: cfg.color + '50', color: cfg.color }}>
                                        {manualPayForm.adjustmentReason === 'REPAIR' && <Wrench size={14} />}
                                        {manualPayForm.adjustmentReason === 'DAMAGE' && <AlertTriangle size={14} />}
                                        {manualPayForm.adjustmentReason === 'MAINTENANCE' && <Hammer size={14} />}
                                        <span>{cfg.description}</span>
                                    </div>
                                );
                            })()}

                            <div className="modal-field">
                                <label>Monto pagado {!manualPayForm.adjustmentReason && <span className="required">*</span>}</label>
                                <div className="modal-amount-input">
                                    <span className="currency-symbol">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        placeholder="0"
                                        value={manualPayForm.amount}
                                        onChange={(e) => setManualPayForm(f => ({ ...f, amount: e.target.value }))}
                                        readOnly={!!manualPayForm.adjustmentReason}
                                        style={manualPayForm.adjustmentReason ? { background: '#F9FAFB', cursor: 'default', fontWeight: 700 } : {}}
                                        required={!manualPayForm.adjustmentReason}
                                    />
                                </div>
                                {manualPayForm.adjustmentReason && (
                                    <span className="field-hint">
                                        {Number(manualPayForm.amount) === 0
                                            ? '✓ Día sin cobro (ajuste automático)'
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
                                    placeholder="Ej: Pago en efectivo, depósito bancario…"
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
                                        <><span className="btn-spinner" /> Registrando…</>
                                    ) : (
                                        <><Check size={15} /> Confirmar pago</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Invoices;
