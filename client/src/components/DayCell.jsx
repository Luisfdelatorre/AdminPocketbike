import React from 'react';
import MotorIcon from './MotorIcon';

const formatCurrency = (amount) => {
    if (!amount) return '-';
    if (amount >= 1000) {
        return `$${(amount / 1000).toFixed(0)}k`;
    }
    return `$${amount}`;
};

const DayCell = ({ dayData, isMobile }) => {
    let cellClass = 'status-cell empty';
    let contentStr = '--';
    let paymentTime = null;

    if (dayData) {
        const rawDate = dayData.latestPaymentAt || dayData.paidAt || (dayData.paid && dayData.updatedAt ? dayData.updatedAt : null);
        if (rawDate) {
            const dateObj = new Date(rawDate);
            if (!isNaN(dateObj.getTime())) {
                const hours = String(dateObj.getHours()).padStart(2, '0');
                const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                paymentTime = `${hours}:${minutes}`;
            }
        }

        if (dayData.dayType === 'LOAN') {
            cellClass = 'status-cell loand';
            contentStr = '--';
        } else if (dayData.dayType === 'PAID') {
            cellClass = 'status-cell approved';
            contentStr = dayData?.totalPaid > 0 ? formatCurrency(dayData?.totalPaid) : '✓';
        } else if (dayData.dayType === 'FREE') {
            cellClass = 'status-cell free';
            contentStr = dayData?.totalPaid > 0 ? formatCurrency(dayData?.totalPaid) : '✓';
        } else if (dayData.dayType === 'ADJUSTMENT') {
            cellClass = 'status-cell adjusted';
            contentStr = '🔧';
        } else {
            cellClass = 'status-cell pending';
            contentStr = dayData?.totalPaid > 0 ? formatCurrency(dayData?.totalPaid) : '-';
        }
    }

    let content = (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.1 }}>
            <span style={{ fontSize: '10.5px' }}>{contentStr}</span>
            {paymentTime && (
                <span className="payment-time-sub">
                    {paymentTime}
                </span>
            )}
        </div>
    );

    if (dayData?.cutOff) {
        content = (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {content}
                <div style={{ position: 'absolute', top: '-8px', right: '-18px' }}>
                    <MotorIcon color="#ef4444" size={14} />
                </div>
            </div>
        );
    }

    if (dayData?.note) {
        content = (
            <div className="has-note-indicator" title={dayData.note}>
                {content}
            </div>
        );
    }

    if (isMobile) {
        return (
            <div className={cellClass} style={{ width: '36px', minHeight: '34px', fontSize: '9px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', padding: '2px 0' }}>
                {content}
                {dayData && (
                    <span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', lineHeight: 1 }}>
                        {dayData.distance > 0 ? `${Math.round(dayData.distance)}km` : '0km'}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <div className={cellClass}>
                {content}
            </div>
            {dayData && (
                <span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                    {dayData.distance > 0 ? `${Math.round(dayData.distance)}km` : '0km'}
                </span>
            )}
        </div>
    );
};

export default DayCell;
