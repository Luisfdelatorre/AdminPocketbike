import React, { useEffect, useRef } from 'react';
import { Power, RefreshCw } from 'lucide-react';

const formatCurrency = (amount) => {
  if (!amount) return '-';
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}k`;
  }
  return `$${amount}`;
};

const PillContainer = ({ daysArray, currentDay, item, isFutureSummaryDay, renderDayCell }) => {
  const containerRef = useRef(null);
  const visibleDays = daysArray.filter((day) => Boolean(item.days[day]) || !isFutureSummaryDay(day));

  // Auto‑scroll to the last pill after render
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [daysArray, item]);

  return (
    <div className="pill-container" ref={containerRef}>
      {visibleDays.map((day) => {
        const dayData = item.days[day];
        const { cellClass, content } = renderDayCell(dayData);
        return (
          <div
            key={day}
            className={`bike-summary-day${day === currentDay ? ' border p-1 rounded bg-indigo-50/50 border-gray-300' : ''}`}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flexShrink: 0 }}
          >
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>{String(day).padStart(2, '0')}</span>
            <div className={cellClass} style={{ width: '36px', height: '28px', fontSize: '9px' }}>{content}</div>
          </div>
        );
      })}
    </div>
  );
};

const BikePaymentSummary = ({ summaryData, daysArray, currentDay, isFutureSummaryDay, loading, user, handleEngineToggle, pendingCommands, getDeviceStatus, renderDayCell }) => {
  if (loading) {
    return <div style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>Cargando...</div>;
  }

  return (
    <section className="bike-summary-list">
      {summaryData.map((item) => {
        const hasDebt = (item.device.unpaidTotal || 0) > 0;
        return (
          <div
            key={item.device.deviceId}
            className="bike-summary bike-summary-card"
          >
            {/* Card header: device name + debt badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem', color: '#111827', letterSpacing: '0.05em' }}>
                  {item.device.name} - {item.device.driverName || 'Sin Conductor'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {/* Motor toggle */}
                {(() => {
                  const status = getDeviceStatus ? getDeviceStatus(item.device.deviceId || item.device.name) : null;
                  if (!status) return null;

                  if (user?.role === 'viewer') {
                    return (
                      <div
                        className={`engine-toggle-slider ${status.cutOff === 1 ? 'deactivated' : 'active'}`}
                        style={{ opacity: 0.5, cursor: 'not-allowed', transform: 'scale(0.75)', transformOrigin: 'center', display: 'inline-flex' }}
                      >
                        <div className="slider-knob"><Power size={10} /></div>
                      </div>
                    );
                  }

                  const isPending = pendingCommands ? !!pendingCommands[status.id] : false;
                  return (
                    <button
                      onClick={() => handleEngineToggle && handleEngineToggle(item.device)}
                      disabled={isPending}
                      className={`engine-toggle-slider ${status.cutOff === 1 ? 'deactivated' : 'active'} ${isPending ? 'pending' : ''}`}
                      title={status.cutOff === 1 ? 'Activar Moto' : 'Desactivar Moto'}
                      style={{ transform: 'scale(0.75)', transformOrigin: 'center' }}
                    >
                      <div className="slider-knob">
                        {isPending ? (
                          <RefreshCw size={10} className="spin" />
                        ) : (
                          <Power size={10} />
                        )}
                      </div>
                    </button>
                  );
                })()}

                {hasDebt ? (
                  <span className="debt-badge">{formatCurrency(item.device.unpaidTotal)}</span>
                ) : (
                  <span className="no-debt">✓</span>
                )}
              </div>
            </div>

            {/* Daily status pills — horizontal scroll */}
            <PillContainer
              daysArray={daysArray}
              currentDay={currentDay}
              item={item}
              isFutureSummaryDay={isFutureSummaryDay}
              renderDayCell={renderDayCell}
            />
          </div>
        );
      })}
    </section>
  );
};

export default BikePaymentSummary;
