import React, { useEffect, useRef } from 'react';
import { Power, RefreshCw } from 'lucide-react';

const formatCurrency = (amount) => {
  if (!amount) return '-';
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}k`;
  }
  return `$${amount}`;
};

const PillContainer = ({ daysArray, item, renderDayCell }) => {
  const containerRef = useRef(null);

  // Auto‑scroll to the last pill after render
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [daysArray, item]);

  return (
    <div className="pill-container" ref={containerRef} style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
      {daysArray.map((day) => {
        const { cellClass, content } = renderDayCell(item.days[day]);
        return (
          <div key={day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>{String(day).padStart(2, '0')}</span>
            <div className={cellClass} style={{ width: '36px', height: '28px', fontSize: '9px' }}>{content}</div>
          </div>
        );
      })}
    </div>
  );
};

const MobilePaymentSummary = ({ summaryData, daysArray, loading, user, handleEngineToggle, pendingCommands, getDeviceStatus, renderDayCell }) => {
  if (loading) {
    return <div style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>Cargando...</div>;
  }

  return (
    <section style={{ padding: '4px 4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {summaryData.map((item) => {
        const hasDebt = (item.device.unpaidTotal || 0) > 0;
        return (
          <div
            key={item.device.deviceId}
            style={{
              background: '#fff',
              border: '1px solid rgba(0,0,0,0.06)',
              borderRadius: '12px',
              padding: '6px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
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
            <PillContainer daysArray={daysArray} item={item} renderDayCell={renderDayCell} />
          </div>
        );
      })}
    </section>
  );
};

export default MobilePaymentSummary;
