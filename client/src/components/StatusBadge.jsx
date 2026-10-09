import React from 'react';
import {
    CheckCircle2,
    Clock,
    XCircle,
    AlertTriangle,
    AlertCircle,
    Ban,
    Wrench,
    Hammer,
    Building2,
    HeartPulse,
    Smartphone,
    Banknote,
    ArrowLeftRight,
    Gift,
    CreditCard,
    Loader2
} from 'lucide-react';
import { useStatusConfig } from '../context/StatusConfigContext';
import './StatusBadge.css';

const ICON_MAP = {
    APPROVED: CheckCircle2,
    COMPLETED: CheckCircle2,
    PAID: CheckCircle2,
    FREE: Gift,
    PENDING: Clock,
    VERIFYING: Clock,
    PROCESSING: Loader2,
    DEBT: AlertTriangle,
    DECLINED: XCircle,
    FAILED: XCircle,
    ERROR: AlertCircle,
    VOIDED: Ban,
    NEQUI: Smartphone,
    EFECTIVO: Banknote,
    TRANSFERENCIA: ArrowLeftRight,
    ACCIDENT_TRANSIT: AlertTriangle,
    REPAIR: Wrench,
    MAINTENANCE: Wrench,
    WORKSHOP: Hammer,
    INCAPACITY: HeartPulse,
    INCAPACIDAD: HeartPulse,
    OFFICE: Building2,
    OFICINA: Building2,
    ADJUSTMENT: Building2,
};

/**
 * StatusBadge Unificado para Facturas y Pagos
 * Reutiliza automáticamente la configuración y estilos de Settings (StatusConfigContext).
 */
const StatusBadge = ({
    status,
    type,
    adjustmentType,
    label: customLabel,
    clickable = false,
    onClick,
    compact = false,
    showIcon = true,
    className = '',
    style: customStyle = {}
}) => {
    const { getStatusDetails } = useStatusConfig();

    // Determinar la clave principal a evaluar
    // Prioridad: adjustmentType > si type es FREE > status > type
    let keyToLookup = status;
    if (adjustmentType) {
        keyToLookup = adjustmentType;
    } else if (String(type).toUpperCase() === 'FREE') {
        keyToLookup = 'FREE';
    } else if (!keyToLookup && type) {
        keyToLookup = type;
    }

    const upperKey = keyToLookup ? String(keyToLookup).toUpperCase() : 'UNKNOWN';
    const details = getStatusDetails(upperKey, customLabel);

    const IconComponent = showIcon ? (ICON_MAP[upperKey] || CreditCard) : null;
    const displayText = customLabel || details?.badgeLabel || details?.label || upperKey;

    const baseColor = details?.color || '#4B5563';
    const baseBg = details?.bg || 'rgba(107, 114, 128, 0.1)';

    const badgeStyle = {
        color: baseColor,
        backgroundColor: baseBg,
        borderColor: `${baseColor}30`,
        ...customStyle
    };

    return (
        <span
            className={`unified-status-badge ${compact ? 'unified-status-badge--compact' : ''} ${clickable ? 'clickable' : ''} ${className}`}
            style={badgeStyle}
            onClick={clickable ? onClick : undefined}
            title={details?.description || displayText}
        >
            {IconComponent && (
                <span className="badge-icon">
                    <IconComponent size={compact ? 11 : 13} />
                </span>
            )}
            <span className="badge-text">{displayText}</span>
        </span>
    );
};

export default React.memo(StatusBadge);
