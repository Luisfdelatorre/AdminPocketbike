import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check, AlertTriangle } from 'lucide-react';
import useAdminScrollLock from '../../hooks/useAdminScrollLock';
import { useStatusConfig } from '../../context/StatusConfigContext';
import { registerManualAdjustment } from '../../services/api';
import { showToast } from '../../utils/toast';
import './InvoiceAdjustmentModal.css';

const DEFAULT_ADJUSTMENT_CONFIG = {
    FREE: {
        label: 'Día Gratis ($0)',
        badgeLabel: 'GRATIS',
        color: '#16A34A',
        bg: '#F0FDF4',
        description: 'Día libre de cobro al cliente.',
        autoAmount: 0,
        autoReference: 'GRATIS - Día ajustado manualmente',
        isRealPayment: false,
        isFree: true,
    },
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
        autoReference: 'INCAPACIDAD MÉDICA - Día sin cobro al cliente',
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

const InvoiceAdjustmentModal = ({ isOpen, onClose, invoice, onSuccess }) => {
    const { t } = useTranslation();
    useAdminScrollLock(isOpen);

    const { statusConfig } = useStatusConfig();
    const ADJUSTMENT_CONFIG = { ...DEFAULT_ADJUSTMENT_CONFIG, ...(statusConfig || {}) };

    const [manualPayForm, setManualPayForm] = useState({
        amount: '',
        reference: '',
        note: '',
        paymentDate: new Date().toISOString().split('T')[0],
        adjustmentType: null,
    });
    const [manualPayLoading, setManualPayLoading] = useState(false);
    const [manualPayError, setManualPayError] = useState('');

    const formatCurrency = (amount, isMobile = false) => {
        if (amount === undefined || amount === null) return isMobile ? '$0' : '$0 COP';
        const num = Number(amount) || 0;
        return isMobile ? `$${num.toLocaleString('es-CO')}` : `$${num.toLocaleString('es-CO')} COP`;
    };

    const buildAutoReference = (cfg, inv) => {
        if (!cfg) return '';
        const badge = cfg.badgeLabel || '';
        const deviceName = inv?.deviceName || inv?.deviceIdName || inv?.plate || '';
        const rawDate = inv?.date || inv?.invoiceDate || inv?.dueDate;
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

    useEffect(() => {
        if (!isOpen || !invoice) return;

        const isAllowedOption = (k, c) => !c?.hidden && (c?.category !== 'STATUS' || k === 'FREE');
        const availableKeys = Object.keys(ADJUSTMENT_CONFIG).filter(k => isAllowedOption(k, ADJUSTMENT_CONFIG[k]));
        const reason = (invoice.adjustmentType && ADJUSTMENT_CONFIG[invoice.adjustmentType])
            ? invoice.adjustmentType
            : (invoice.dayType === 'FREE' ? 'FREE' : (availableKeys[0] || 'FREE'));
        const cfg = ADJUSTMENT_CONFIG[reason] || null;
        const autoAmount = cfg?.autoAmount !== undefined && cfg?.autoAmount !== null ? cfg.autoAmount : invoice.amount;

        setManualPayForm({
            amount: autoAmount,
            reference: invoice.adjustmentReference || buildAutoReference(cfg, invoice),
            note: invoice.adjustmentComment || invoice.note || '',
            paymentDate: new Date().toISOString().split('T')[0],
            adjustmentType: reason,
        });
        setManualPayError('');
    }, [isOpen, invoice, ADJUSTMENT_CONFIG]);

    if (!isOpen || !invoice) return null;

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
                invoiceId: invoice.invoiceId || invoice._id,
                adjustmentType: manualPayForm.adjustmentType || 'FREE',
                amount: Number(manualPayForm.amount),
                adjustmentReference: manualPayForm.reference || 'Ajuste manual registrado por Admin',
                note: manualPayForm.note,
            });
            showToast('success', 'Ajuste Registrado', `Factura ${invoice.invoiceId || invoice._id} actualizada con éxito.`);
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            setManualPayError(err.response?.data?.error || err.message || 'Error al registrar el pago.');
        } finally {
            setManualPayLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1250 }}>
            <div className="modal-card modal-surface--invoice" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header" style={
                    manualPayForm.adjustmentType && ADJUSTMENT_CONFIG[manualPayForm.adjustmentType]?.color
                        ? { background: `linear-gradient(135deg, ${ADJUSTMENT_CONFIG[manualPayForm.adjustmentType].color}, ${ADJUSTMENT_CONFIG[manualPayForm.adjustmentType].color}cc)` }
                        : {}
                }>
                    <div className="modal-header-left">
                        <span>
                            {manualPayForm.adjustmentType
                                ? ADJUSTMENT_CONFIG[manualPayForm.adjustmentType]?.label || manualPayForm.adjustmentType
                                : 'Pago Manual'}
                        </span>
                    </div>
                    <button className="modal-close" onClick={onClose} type="button">
                        <X size={18} />
                    </button>
                </div>

                <div className="modal-invoice-info">
                    <div className="modal-info-row">
                        <span className="modal-info-label">Factura</span>
                        <span className="modal-info-value">{invoice.invoiceId || invoice._id}</span>
                    </div>
                    <div className="modal-info-row">
                        <span className="modal-info-label">Dispositivo</span>
                        <span className="modal-info-value">{invoice.deviceIdName}</span>
                    </div>
                    <div className="modal-info-row">
                        <span className="modal-info-label">Monto total</span>
                        <span className="modal-info-value modal-info-amount">
                            {formatCurrency(invoice.amount)}
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
                                .filter(([key, cfg]) => !cfg?.hidden && (cfg?.category !== 'STATUS' || key === 'FREE'))
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
                        <button type="button" className="btn-cancel" onClick={onClose}>
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
        </div>
    );
};

export default InvoiceAdjustmentModal;
