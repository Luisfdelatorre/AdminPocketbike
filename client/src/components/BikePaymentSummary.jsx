import React, { useState, useEffect, useRef } from 'react';
import { Power, RefreshCw } from 'lucide-react';
import { formatOfflineTimeShort, formatCurrency } from '../utils/helpers';
import DayCell from './DayCell';

const PillContainer = ({ daysArray, currentDay, item, isFutureSummaryDay }) => {
  const containerRef = useRef(null);
  const visibleDays = daysArray.filter((day) => Boolean(item.days[day]) || !isFutureSummaryDay(day));

  // Auto‑scroll to the last pill ONLY on mount or when month (daysArray) changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, []);

  return (
    <div className="bike-summary-pills-row no-scrollbar" ref={containerRef}>
      {visibleDays.map((day) => {
        const dayData = item.days[day];
        return (
          <div key={day} className="bike-summary-day-item">
            <span className={`bike-day-label ${day === currentDay ? 'is-today' : ''}`}>
              {String(day).padStart(2, '0')}
            </span>
            <DayCell dayData={dayData} isMobile={true} />
          </div>
        );
      })}
    </div>
  );
};

const EngineToggleButton = ({ item, handleEngineToggle, user }) => {
  const dev = item.device;
  const isOff = Boolean(dev.cutOff);
  const isQueued = Boolean(dev.queued);
  const [isLocallyPending, setIsLocallyPending] = useState(false);

  useEffect(() => {
    if (isQueued) {
      setIsLocallyPending(false);
    }
  }, [isQueued, isOff]);

  const handleClick = async (e) => {
    e.stopPropagation();
    if (user?.role === 'viewer' || isLocallyPending || isQueued) return;

    setIsLocallyPending(true);
    try {
      if (handleEngineToggle) {
        await handleEngineToggle(dev);
      }
    } catch (err) {
      setIsLocallyPending(false);
    }
  };

  const isDisabled = isLocallyPending || isQueued;

  if (user?.role === 'viewer') {
    return (
      <div
        className={`engine-toggle-slider ${isOff ? 'deactivated' : 'active'}`}
        style={{ opacity: 0.5, cursor: 'not-allowed', transformOrigin: 'center', display: 'inline-flex' }}
      >
        <div className="slider-knob"><Power size={10} /></div>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`engine-toggle-slider ${isOff ? 'deactivated' : 'active'} ${isLocallyPending ? 'pending' : ''} ${isQueued ? 'queued' : ''}`}
      title={isQueued ? 'Comando en cola (esperando señal GPS)' : (isOff ? 'Activar Moto' : 'Desactivar Moto')}
      style={{ transform: 'scale(0.75)', transformOrigin: 'center' }}
    >
      <div className="slider-knob">
        {isLocallyPending ? (
          <RefreshCw size={10} className="spin" />
        ) : (
          <Power size={10} />
        )}
      </div>
    </button>
  );
};

const BikePaymentSummary = ({ summaryData, daysArray, currentDay, isFutureSummaryDay, loading, user, handleEngineToggle, getDeviceStatus }) => {
  if (loading) {
    return <div className="loading-state">Cargando...</div>;
  }

  return (
    <div className="bike-summary-container">
      {summaryData.map((item) => {
        const hasDebt = (item.device.unpaidTotal || 0) > 0;
        return (
          <div key={item.device.id || item.device.name} className="bike-summary-card">
            <div className="bike-summary-content">
              {/* Header Info */}
              <div className="bike-summary-header">
                <div className="bike-summary-info">
                  <h3 className="bike-summary-title">{item.device.name}</h3>
                  <span className="bike-summary-driver">{item.device.customerName || item.device.driverName || 'Sin Conductor'}</span>
                </div>
                <div className="bike-summary-actions">
                  {formatOfflineTimeShort(item.device.lastUpdate) && (
                    <span
                      className="bike-summary-offline"
                      title={`Inactivo desde: ${item.device.lastUpdate ? new Date(item.device.lastUpdate).toLocaleString('es-CO') : 'Desconocido'}`}
                    >
                      {formatOfflineTimeShort(item.device.lastUpdate)}
                    </span>
                  )}
                  {/* Motor toggle */}
                  <EngineToggleButton item={item} handleEngineToggle={handleEngineToggle} user={user} />

                  {hasDebt ? (
                    <span className="summary-badge debt">
                      {formatCurrency(item.device.unpaidTotal)}
                    </span>
                  ) : (
                    <span className="summary-badge paid">
                      Al día
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Daily status pills — horizontal scroll */}
            <PillContainer
              daysArray={daysArray}
              currentDay={currentDay}
              item={item}
              isFutureSummaryDay={isFutureSummaryDay}
            />
          </div>
        );
      })}
    </div>
  );
};

export default BikePaymentSummary;

