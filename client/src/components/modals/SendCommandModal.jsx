import React, { useState, useEffect } from 'react';
import { X, Check, Terminal, Bolt, PowerOff, ShieldAlert, LoaderCircle } from 'lucide-react';
import useAdminScrollLock from '../../hooks/useAdminScrollLock';
import { sendCommand, getAllDevices } from '../../services/api';
import { showToast } from '../../utils/toast';
import '../../pages/Invoices.css';

const SendCommandModal = ({
    isOpen,
    onClose,
    defaultDevice = '',
    onSuccess
}) => {
    useAdminScrollLock(isOpen);
    const [deviceIdName, setDeviceIdName] = useState(defaultDevice || '');
    const [commandAction, setCommandAction] = useState('engineResume'); // 'engineResume' | 'engineStop' | 'preventiveLock'
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [devicesList, setDevicesList] = useState([]);

    useEffect(() => {
        if (defaultDevice) setDeviceIdName(defaultDevice);
        setError('');
    }, [defaultDevice, isOpen]);

    useEffect(() => {
        if (isOpen) {
            getAllDevices()
                .then(res => {
                    const list = res?.data || res || [];
                    if (Array.isArray(list)) {
                        setDevicesList(list.map(d => d.name || d.deviceName).filter(Boolean).sort());
                    }
                })
                .catch(() => {});
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        const targetMoto = (deviceIdName || '').trim().toUpperCase();
        if (!targetMoto) {
            setError('Debes especificar la moto o placa.');
            return;
        }

        setLoading(true);
        setError('');

        const rawCmd = commandAction === 'preventiveLock' ? 'engineStop' : commandAction;
        const defaultReason = commandAction === 'engineResume'
            ? 'Habilitar encendido manual'
            : (commandAction === 'preventiveLock' ? 'Bloqueo preventivo por seguridad' : 'Corte de motor manual');

        try {
            await sendCommand({
                deviceIdName: targetMoto,
                command: rawCmd,
                reason: reason.trim() || defaultReason
            });

            showToast('success', 'Comando Enviado', `Comando enviado a ${targetMoto} con éxito.`);
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Error al enviar comando:', err);
            const msg = err.response?.data?.error || err.message || 'Error al emitir el comando al GPS.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1250 }}>
            <div className="modal-card modal-surface--invoice" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
                {/* Header */}
                <div
                    className="modal-header"
                    style={{ background: 'linear-gradient(135deg, #006194, #004b73)' }}
                >
                    <div className="modal-header-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Terminal size={18} className="text-white" />
                        <span style={{ fontWeight: 600, color: '#fff' }}>
                            Emitir Comando de Telemetría
                        </span>
                    </div>
                    <button className="modal-close" onClick={onClose} type="button">
                        <X size={18} />
                    </button>
                </div>

                <form className="modal-form" onSubmit={handleSubmit} style={{ padding: '1.25rem' }}>
                    {/* Moto Selector / Input */}
                    <div className="modal-field">
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                            Moto / Placa *
                        </label>
                        <input
                            type="text"
                            list="devices-datalist"
                            placeholder="Ej: QBD25I"
                            value={deviceIdName}
                            onChange={(e) => setDeviceIdName(e.target.value.toUpperCase())}
                            required
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                fontSize: '0.95rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                color: '#0f172a'
                            }}
                        />
                        <datalist id="devices-datalist">
                            {devicesList.map(dev => (
                                <option key={dev} value={dev} />
                            ))}
                        </datalist>
                    </div>

                    {/* Action Selector Pills */}
                    <div className="modal-field" style={{ marginTop: '12px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px', display: 'block' }}>
                            Acción a Ejecutar *
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={() => setCommandAction('engineResume')}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '10px 6px',
                                    borderRadius: '8px',
                                    border: commandAction === 'engineResume' ? '2px solid #006194' : '1px solid #e2e8f0',
                                    background: commandAction === 'engineResume' ? '#e0f2fe' : '#ffffff',
                                    cursor: 'pointer',
                                    gap: '4px',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <Bolt size={18} color="#006194" />
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#006194' }}>ENCENDIDO</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setCommandAction('engineStop')}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '10px 6px',
                                    borderRadius: '8px',
                                    border: commandAction === 'engineStop' ? '2px solid #ba1a1a' : '1px solid #e2e8f0',
                                    background: commandAction === 'engineStop' ? '#ffdad6' : '#ffffff',
                                    cursor: 'pointer',
                                    gap: '4px',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <PowerOff size={18} color="#ba1a1a" />
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ba1a1a' }}>APAGADO</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setCommandAction('preventiveLock')}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '10px 6px',
                                    borderRadius: '8px',
                                    border: commandAction === 'preventiveLock' ? '2px solid #ea580c' : '1px solid #e2e8f0',
                                    background: commandAction === 'preventiveLock' ? '#ffedd5' : '#ffffff',
                                    cursor: 'pointer',
                                    gap: '4px',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <ShieldAlert size={18} color="#ea580c" />
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ea580c' }}>PREVENTIVO</span>
                            </button>
                        </div>
                    </div>

                    {/* Reason input */}
                    <div className="modal-field" style={{ marginTop: '12px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                            Motivo / Observación
                        </label>
                        <input
                            type="text"
                            placeholder="Ej: Verificación de taller, petición de cliente..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '9px 12px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                fontSize: '0.9rem',
                                color: '#1e293b'
                            }}
                        />
                    </div>

                    {error && (
                        <div style={{
                            marginTop: '12px',
                            padding: '8px 12px',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '8px',
                            color: '#dc2626',
                            fontSize: '0.85rem'
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            className="modal-button modal-button-cancel"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="modal-button modal-button-confirm"
                            disabled={loading || !deviceIdName}
                            style={{
                                background: commandAction === 'engineStop' ? '#ba1a1a' : (commandAction === 'preventiveLock' ? '#ea580c' : '#006194'),
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            {loading ? (
                                <>
                                    <LoaderCircle size={16} className="animate-spin" />
                                    <span>Enviando...</span>
                                </>
                            ) : (
                                <>
                                    <Check size={16} />
                                    <span>Confirmar Envío</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SendCommandModal;

