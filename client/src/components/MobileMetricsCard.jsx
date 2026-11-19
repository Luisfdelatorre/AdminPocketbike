import React from 'react';

/**
 * MobileMetricsCard Component
 *
 * Reusable consolidated iOS-style mobile metrics card with a segmented
 * progress bar and compact metric columns. Relies on centralized styles
 * in `client/src/index.css` (`.mobile-metrics-card`).
 *
 * @param {Object} props
 * @param {Array<{ width: number, variant: string }>} [props.segments] - Progress bar segments (e.g. 'completed', 'pending', 'blue')
 * @param {Array<{ label: string, value: React.ReactNode, subcount?: string|number, dot?: string, icon?: React.ReactNode, valueClass?: string }>} props.columns - Metric columns (typically 3)
 * @param {string} [props.className] - Optional additional class name
 */
const MobileMetricsCard = ({ segments = [], columns = [], className = '' }) => {
    return (
        <div className={`mobile-metrics-card ${className}`.trim()}>
            {segments.length > 0 && (
                <div className="metrics-progress-bar">
                    {segments.map((seg, idx) => (
                        <div
                            key={seg.key || seg.variant || idx}
                            className={`progress-fill fill-${seg.variant}`}
                            style={{ width: `${seg.width}%` }}
                        />
                    ))}
                </div>
            )}

            <div className="metrics-columns">
                {columns.map((col, idx) => {
                    const isMiddle = columns.length === 3 && idx === 1;
                    return (
                        <div
                            key={col.key || col.label || idx}
                            className={`metrics-col${isMiddle ? ' bordered-col' : ''}`}
                        >
                            <div className="metrics-header-row">
                                {col.dot && <span className={`metrics-dot dot-${col.dot}`} />}
                                {col.icon}
                                <span className="metrics-label">{col.label}</span>
                            </div>
                            <p className={`metrics-val${col.valueClass ? ` ${col.valueClass}` : ''}`}>
                                {col.value}
                                {col.subcount !== undefined && col.subcount !== null && (
                                    <> <span className="metrics-subcount">({col.subcount})</span></>
                                )}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MobileMetricsCard;
