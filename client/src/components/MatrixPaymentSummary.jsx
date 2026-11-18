import React from 'react';
import DayCell from './DayCell';

const formatCurrency = (amount) => {
    if (!amount) return '-';
    if (amount >= 1000) {
        return `$${(amount / 1000).toFixed(0)}k`;
    }
    return `$${amount}`;
};

const MatrixPaymentSummary = ({
    loading,
    daysInMonth,
    filteredSummaryData,
    daysArray,
    isFutureSummaryDay,
    renderEngineButton,
    onDayClick
}) => {
    // Vertical sum of totalPaid per day across visible devices
    const dailyTotals = daysArray.reduce((acc, day) => {
        acc[day] = filteredSummaryData.reduce((sum, item) => sum + (item.days[day]?.totalPaid || 0), 0);
        return acc;
    }, {});

    return (
        <div className="matrix-shell">
            <div className="matrix-container">
                <table className="summary-table">
                    <thead>
                        <tr>
                            <th>DISPOSITIVO</th>
                            <th>Deuda</th>
                            {daysArray.map(day => (
                                <th key={day}>{String(day).padStart(2, '0')}</th>
                            ))}
                            <th style={{ textAlign: 'center', minWidth: '60px' }}>Motor</th>
                        </tr>
                        <tr className="daily-totals-row">
                            <th className="totals-label">Total día</th>
                            <th></th>
                            {daysArray.map(day => (
                                <th key={day} className="daily-total-cell">
                                    {dailyTotals[day] > 0 ? formatCurrency(dailyTotals[day]) : '--'}
                                </th>
                            ))}
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={daysInMonth + 3}>Cargando...</td></tr>
                        ) : (
                            filteredSummaryData.map((item) => (
                                <tr key={item.device.deviceId} className="bike-summary">
                                    <td>
                                        <div className="device-cell">
                                            <span className="device-name">{item.device.name}</span>
                                            <span className="driver-name">{item.device.customerName || item.device.driverName || 'Sin Conductor'}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="device-cell">
                                            {item.device.unpaidTotal > 0 ? (
                                                <span className="debt-badge">{formatCurrency(item.device.unpaidTotal)}</span>
                                            ) : (
                                                <span className="no-debt">✓</span>
                                            )}
                                        </div>
                                    </td>
                                    {daysArray.map(day => {
                                        const dayData = item.days[day];
                                        const isEmptyFutureDay = !dayData && isFutureSummaryDay(day);
                                        const hasInvoice = Boolean(dayData?.invoiceId || dayData);
                                        return (
                                            <td
                                                key={day}
                                                className={`bike-summary-day${isEmptyFutureDay ? ' empty-day' : ''}`}
                                                onClick={() => onDayClick && onDayClick(item, day, dayData)}
                                                style={{ cursor: 'pointer' }}
                                                title={hasInvoice ? `Día ${day}: Clic para ajustar factura / pago` : `Día ${day}: Clic para adicionar factura`}
                                            >
                                                <DayCell dayData={dayData} isMobile={false} />
                                            </td>
                                        );
                                    })}
                                    <td style={{ textAlign: 'center' }}>
                                        {renderEngineButton(item)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MatrixPaymentSummary;
