import React, { useState, useEffect } from 'react';
import { X, Check, Calendar, AlertCircle } from 'lucide-react';
import useAdminScrollLock from '../../hooks/useAdminScrollLock';
import { createInvoice } from '../../services/api';
import { showToast } from '../../utils/toast';
import '../../pages/Invoices.css';

const CreateDayInvoiceModal = ({
    isOpen,
    onClose,
    deviceName = '',
    date = '',
    driverName = '',
    onSuccess
}) => {
    useAdminScrollLock(isOpen);
    const [inputDevice, setInputDevice] = useState(deviceName || '');
    const [inputDate, setInputDate] = useState(date || new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (deviceName) setInputDevice(deviceName);
        if (date) setInputDate(date);
        setError('');
    }, [deviceName, date, isOpen]);

    if (!isOpen) return null;

    const activeDevice = (deviceName || inputDevice || '').trim().toUpperCase();
    const activeDate = date || inputDate;

    const handleConfirm = async (e) => {
        if (e) e.preventDefault();
        if (!activeDevice || !activeDate) {
            setError('Debes especificar la moto y la fecha.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await createInvoice({
                deviceIdName: activeDevice,
                date: activeDate
            });

            showToast('success', 'Factura Creada', `Factura para ${activeDevice} (${activeDate}) creada con éxito.`);
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Error al crear factura:', err);
            const msg = err.response?.data?.error || err.message || 'Error al crear la factura.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1250 }}>
            <div className="modal-card modal-surface--invoice" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div
                    className="modal-header"
                    style={{ background: 'linear-gradient(135deg, #009da0, #007073)' }}
                >
                    <div className="modal-header-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar size={18} className="text-white" />
                        <span style={{ fontWeight: 600, color: '#fff' }}>
                            Crear Factura Diaria
                        </span>
                    </div>
                    <button className="modal-close" onClick={onClose} type="button">
                        <X size={18} />
                    </button>
                </div>

                {/* Info Card (si ya viene moto y fecha) */}
                {deviceName && date ? (
                    <div className="modal-invoice-info">
                        <div className="modal-info-row">
                            <span className="modal-info-label">Dispositivo</span>
                            <span className="modal-info-value" style={{ fontWeight: 700 }}>{deviceName}</span>
                        </div>
                        {driverName && (
                            <div className="modal-info-row">
                                <span className="modal-info-label">Conductor</span>
                                <span className="modal-info-value">{driverName}</span>
                            </div>
                        )}
                        <div className="modal-info-row">
                            <span className="modal-info-label">Fecha a facturar</span>
                            <span className="modal-info-value" style={{ fontWeight: 600 }}>{date}</span>
                        </div>
                        <div className="modal-info-row">
                            <span className="modal-info-label">Tarifa</span>
                            <span className="modal-info-value modal-info-amount" style={{ fontSize: '0.9rem' }}>
                                Automática del contrato
                            </span>
                        </div>
                    </div>
                ) : null}

                <form className="modal-form" onSubmit={handleConfirm} style={{ padding: '1rem 1.25rem' }}>
                    {/* Campos editables si no vienen predefinidos */}
                    {(!deviceName || !date) && (
                        <>
                            {!deviceName && (
                                <div className="modal-field">
                                    <label>Moto / Placa *</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: PMS06I"
                                        value={inputDevice}
                                        onChange={(e) => setInputDevice(e.target.value.toUpperCase())}
                                        required
                                        style={{ textTransform: 'uppercase', fontWeight: 600 }}
                                    />
                                </div>
                            )}
                            {!date && (
                                <div className="modal-field">
                                    <label>Fecha de la factura *</label>
                                    <input
                                        type="date"
                                        value={inputDate}
                                        onChange={(e) => setInputDate(e.target.value)}
                                        required
                                    />
                                </div>
                            )}
                        </>
                    )}

                    <div
                        style={{
                            background: '#f0fdfa',
                            border: '1px solid #99f6e4',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            fontSize: '0.82rem',
                            color: '#0f766e',
                            lineHeight: 1.45,
                            marginBottom: '1rem'
                        }}
                    >
                        ✓ La tarifa y los datos del contrato se asignan automáticamente en el servidor igual que a medianoche.
                    </div>

                    {error && (
                        <div className="modal-error" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="modal-actions" style={{ marginTop: '0.5rem' }}>
                        <button
                            type="button"
                            className="btn-cancel"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="btn-confirm"
                            disabled={loading || !activeDevice || !activeDate}
                        >
                            {loading ? (
                                <><span className="btn-spinner" /> Creando...</>
                            ) : (
                                <><Check size={16} /> Crear factura</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateDayInvoiceModal;
