import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAdjustmentTypes, getPaymentStatuses } from '../services/api';

// Fallback tokens por defecto (milisegundo 0, sin FOUC)
export const DEFAULT_STATUS_CONFIG = {
    // Estados de Pago (Payment.status)
    APPROVED: {
        label: 'Aprobado',
        badgeLabel: 'APROBADO',
        color: '#059669',
        bg: '#ECFDF5',
        description: 'Transacción aprobada con éxito.',
        category: 'PAYMENT_STATUS',
    },
    COMPLETED: {
        label: 'Completado',
        badgeLabel: 'APROBADO',
        color: '#059669',
        bg: '#ECFDF5',
        description: 'Transacción completada.',
        category: 'PAYMENT_STATUS',
    },
    PENDING: {
        label: 'Día Pendiente',
        badgeLabel: 'PENDIENTE',
        color: '#eab308',
        bg: 'rgba(234,179,8,0.05)',
        description: 'Factura pendiente por cobro.',
        category: 'STATUS',
    },

    // Estados Contables de Factura (Invoice.dayType)
    PAID: {
        label: 'Día Pagado',
        badgeLabel: 'PAGADO',
        color: '#0ea5e9',
        bg: 'rgba(14,165,233,0.08)',
        description: 'Factura pagada.',
        category: 'STATUS',
    },
    FREE: {
        label: 'Día Gratis ($0)',
        badgeLabel: 'GRATIS',
        color: '#22c55e',
        bg: 'rgba(34,197,94,0.05)',
        description: 'Día libre de cobro.',
        category: 'STATUS',
    },
    DEBT: {
        label: 'Día en Deuda',
        badgeLabel: 'DEUDA',
        color: '#ef4444',
        bg: 'rgba(239,68,68,0.03)',
        description: 'Día no pagado en mora / deuda.',
        category: 'STATUS',
    },


    // Tipos de Pago y Ajustes Manuales (Payment.type / Invoice.adjustmentType)
    NEQUI: {
        label: 'Pago Real - Nequi',
        badgeLabel: 'NEQUI',
        color: '#E11D48',
        bg: '#FFF1F2',
        description: 'Pago recibido vía Nequi.',
        category: 'ADJUSTMENT',
    },
    EFECTIVO: {
        label: 'Pago Real - Efectivo',
        badgeLabel: 'EFECTIVO',
        color: '#16A34A',
        bg: '#F0FDF4',
        description: 'Pago recibido en efectivo.',
        category: 'ADJUSTMENT',
    },
    TRANSFERENCIA: {
        label: 'Pago Real - Transferencia Bancaria',
        badgeLabel: 'TRANSFERENCIA',
        color: '#2563EB',
        bg: '#EFF6FF',
        description: 'Pago recibido por transferencia bancaria.',
        category: 'ADJUSTMENT',
    },
    ACCIDENT_TRANSIT: {
        label: 'Ajuste - Tránsito por Accidente',
        badgeLabel: 'TRANSITO',
        color: '#F97316',
        bg: '#FFF7ED',
        description: 'Retenida en tránsito por accidente.',
        category: 'ADJUSTMENT',
    },
    REPAIR: {
        label: 'Ajuste - Reparación',
        badgeLabel: 'RETENIDA',
        color: '#F97316',
        bg: '#FFF7ED',
        description: 'Vehículo en reparación o retenido.',
        category: 'ADJUSTMENT',
    },
    MAINTENANCE: {
        label: 'Ajuste - Mantenimiento',
        badgeLabel: 'MANTENIMIENTO',
        color: '#7C3AED',
        bg: '#F5F3FF',
        description: 'Mantenimiento preventivo o correctivo.',
        category: 'ADJUSTMENT',
    },
    WORKSHOP: {
        label: 'Ajuste - Taller',
        badgeLabel: 'TALLER',
        color: '#4B5563',
        bg: '#F3F4F6',
        description: 'Vehículo en taller.',
        category: 'ADJUSTMENT',
    },
    INCAPACITY: {
        label: 'Ajuste - Incapacidad',
        badgeLabel: 'INCAPACIDAD',
        color: '#0284C7',
        bg: '#F0F9FF',
        description: 'Incapacidad médica certificada.',
        category: 'ADJUSTMENT',
    },
    INCAPACIDAD: {
        label: 'Ajuste - Incapacidad',
        badgeLabel: 'INCAPACIDAD',
        color: '#0284C7',
        bg: '#F0F9FF',
        description: 'Incapacidad médica certificada.',
        category: 'ADJUSTMENT',
    },
    OFFICE: {
        label: 'Ajuste - Oficina',
        badgeLabel: 'OFICINA',
        color: '#0891B2',
        bg: '#ECFEFF',
        description: 'Ajuste realizado en oficina.',
        category: 'ADJUSTMENT',
    },
    OFICINA: {
        label: 'Ajuste - Oficina',
        badgeLabel: 'OFICINA',
        color: '#0891B2',
        bg: '#ECFEFF',
        description: 'Ajuste realizado en oficina.',
        category: 'ADJUSTMENT',
    },
    ADJUSTMENT: {
        label: 'Ajuste - Oficina',
        badgeLabel: 'OFICINA',
        color: '#0891B2',
        bg: '#ECFEFF',
        description: 'Ajuste realizado en oficina.',
        category: 'ADJUSTMENT',
    },
    INITIAL_FEE: {
        label: 'Cuota Inicial',
        badgeLabel: 'CUOTA INICIAL',
        color: '#0d9488',
        bg: 'rgba(13,148,136,0.06)',
        description: 'Cuota inicial del contrato.',
        category: 'STATUS',
    }
};

const StatusConfigContext = createContext({
    statusConfig: DEFAULT_STATUS_CONFIG,
    loading: false,
    refreshStatusConfig: async () => { },
    updateLocalStatus: () => { },
    getStatusDetails: () => ({})
});

export const StatusConfigProvider = ({ children }) => {
    const [statusConfig, setStatusConfig] = useState(DEFAULT_STATUS_CONFIG);
    const [loading, setLoading] = useState(false);

    const loadStatuses = useCallback(async () => {
        try {
            setLoading(true);
            const [adjRes, payRes] = await Promise.all([
                getAdjustmentTypes().catch(() => null),
                getPaymentStatuses().catch(() => null)
            ]);

            const merged = { ...DEFAULT_STATUS_CONFIG };

            if (payRes?.data && typeof payRes.data === 'object') {
                Object.entries(payRes.data).forEach(([key, val]) => {
                    merged[key] = { ...(merged[key] || {}), ...val, category: 'STATUS' };
                });
            }

            if (adjRes?.data && typeof adjRes.data === 'object') {
                Object.entries(adjRes.data).forEach(([key, val]) => {
                    merged[key] = { ...(merged[key] || {}), ...val, category: 'ADJUSTMENT' };
                });
            }

            setStatusConfig(merged);
        } catch (error) {
            console.warn('[StatusConfigContext] Fallback a tokens locales:', error?.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStatuses();
    }, [loadStatuses]);

    // Permite actualizar en memoria al editar en Settings sin esperar otro fetch
    const updateLocalStatus = useCallback((key, updatedItem) => {
        setStatusConfig(prev => ({
            ...prev,
            [key]: { ...(prev[key] || {}), ...updatedItem }
        }));
    }, []);

    // Helper O(1) de resolución de estilo
    const getStatusDetails = useCallback((key, fallbackLabel) => {
        if (!key) return null;
        const upper = String(key).toUpperCase();
        const cfg = statusConfig[upper] || DEFAULT_STATUS_CONFIG[upper] || null;

        if (cfg) {
            return {
                label: cfg.label || fallbackLabel || upper,
                badgeLabel: cfg.badgeLabel || cfg.label || fallbackLabel || upper,
                color: cfg.color || '#4B5563',
                bg: cfg.bg || 'rgba(107, 114, 128, 0.1)',
                description: cfg.description || ''
            };
        }

        return {
            label: fallbackLabel || upper,
            badgeLabel: fallbackLabel || upper,
            color: '#6B7280',
            bg: '#F3F4F6',
            description: ''
        };
    }, [statusConfig]);

    return (
        <StatusConfigContext.Provider
            value={{
                statusConfig,
                loading,
                refreshStatusConfig: loadStatuses,
                updateLocalStatus,
                getStatusDetails
            }}
        >
            {children}
        </StatusConfigContext.Provider>
    );
};

export const useStatusConfig = () => useContext(StatusConfigContext);
export default StatusConfigContext;
