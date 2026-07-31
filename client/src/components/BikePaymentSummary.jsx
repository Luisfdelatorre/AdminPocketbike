import React, { useEffect, useRef } from 'react';
import { Power, RefreshCw } from 'lucide-react';
import { formatOfflineTimeShort } from '../utils/helpers';

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

  // Auto‑scroll to the last pill ONLY on mount or when month (daysArray) changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [daysArray]);

  return (
    <div className="pill-container" ref={containerRef}>
      {visibleDays.map((day) => {
        const dayData = item.days[day];
        const { cellClass, content } = renderDayCell(dayData);
        return (
          <div
            key={day}
            className={`bike-summary-day${day === currentDay ? ' border p-1 rounded bg-indigo-50/50 border-gray-300' : ''}`}
          >
            <span className="day-number">{String(day).padStart(2, '0')}</span>
            <div className={`${cellClass} day-cell-badge`}>{content}</div>
            {dayData && <span className="day-distance">{dayData.distance > 0 ? `${Math.round(dayData.distance)}km` : '0km'}</span>}
          </div>
        );
      })}
    </div>
  );
};

const BikePaymentSummary = ({ summaryData, daysArray, currentDay, isFutureSummaryDay, loading, user, handleEngineToggle, pendingCommands, queuedCommands, getDeviceStatus, renderDayCell }) => {
  if (loading) {
    return <div className="summary-loading">Cargando...</div>;
  }

  return (
    <section className="bike-summary-list">
      {summaryData.map((item, idx) => {
        const cardKey = item.device._id || item.device.id || item.device.deviceId || item.device.name || idx;
        const hasDebt = (item.device.unpaidTotal || 0) > 0;
        return (
          <div
            key={cardKey}
            className="bike-summary bike-summary-card"
          >
            {/* Card header: device name + debt badge */}
            <div className="bike-summary-card-header">
              <div className="device-cell inline-header">
                <span className="device-name">{item.device.name}</span>
                <span className="header-separator">•</span>
                <span className="driver-name">{item.device.driverName || 'Sin Conductor'}</span>
              </div>
              <div className="header-actions">
                {/* Motor toggle */}
                {formatOfflineTimeShort(item.device.lastUpdate) && (
                  <span
                    className="header-offline-badge"
                    title={`Inactivo desde: ${item.device.lastUpdate ? new Date(item.device.lastUpdate).toLocaleString('es-CO') : 'Desconocido'}`}
                  >
                    {formatOfflineTimeShort(item.device.lastUpdate)}
                  </span>
                )}
                {(() => {
                  const dev = item.device;
                  const isOff = Boolean(dev.cutOff);
                  const devKey = dev.deviceId || dev.id || dev.name;

                  if (user?.role === 'viewer') {
                    return (
                      <div
                        className={`engine-toggle-slider scaled ${isOff ? 'deactivated' : 'active'}`}
                        style={{ opacity: 0.5, cursor: 'not-allowed' }}
                      >
                        <div className="slider-knob"><Power size={10} /></div>
                      </div>
                    );
                  }

                  const isPending = pendingCommands ? Boolean(
                    pendingCommands[dev.deviceId] || pendingCommands[dev.id] || pendingCommands[dev.name] || pendingCommands[devKey]
                  ) : false;
                  const isQueued = Boolean(
                    dev.queued ||
                    (queuedCommands && (
                      queuedCommands[dev.deviceId] ||
                      queuedCommands[dev.id] ||
                      queuedCommands[dev.name] ||
                      (dev.name && queuedCommands[dev.name.toUpperCase()]) ||
                      queuedCommands[dev.gpsId] ||
                      queuedCommands[dev._id] ||
                      queuedCommands[devKey]
                    ))
                  );
                  return (
                    <button
                      onClick={() => handleEngineToggle && handleEngineToggle(dev)}
                      disabled={isPending}
                      className={`engine-toggle-slider scaled ${isOff ? 'deactivated' : 'active'} ${isPending ? 'pending' : ''} ${isQueued ? 'queued' : ''}`}
                      title={isQueued ? 'Comando en cola (esperando señal GPS)' : (isOff ? 'Activar Moto' : 'Desactivar Moto')}
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
