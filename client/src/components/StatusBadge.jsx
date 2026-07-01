import React from 'react';
import { Check, X, Clock, CreditCard } from 'lucide-react';

/**
 * Renders a status badge with appropriate color and icon.
 * Props:
 *   - status: string (e.g., 'APPROVED', 'PENDING', 'DECLINED', etc.)
 */
const StatusBadge = ({ status }) => {
  const upper = (status || 'unknown').toUpperCase();
  const getColor = () => {
    switch (upper) {
      case 'APPROVED':
      case 'COMPLETED':
        return '#4a3fecff';
      case 'FREE':
        return '#22C55E'; // green
      case 'DECLINED':
      case 'FAILED':
      case 'ERROR':
        return '#EF4444'; // red
      case 'PENDING':
      case 'VERIFYING':
        return '#FACC15'; // yellow
      default:
        return '#6B7280'; // gray
    }
  };

  const getIcon = () => {
    switch (upper) {
      case 'APPROVED':
      case 'COMPLETED':
      case 'FREE':
        return <Check />;
      case 'DECLINED':
      case 'FAILED':
      case 'ERROR':
        return <X />;
      case 'PENDING':
      case 'VERIFYING':
        return <Clock />;
      default:
        return <CreditCard />;
    }
  };

  const bgColor = getColor();
  const style = {
    background: `${bgColor}20`,
    color: bgColor,
    padding: '2px 6px',

    fontWeight: 500,
    fontSize: '0.85rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px'
  };

  return (
    <span className="status-badge" style={style}>
      {upper}
    </span>
  );
};

export default StatusBadge;
