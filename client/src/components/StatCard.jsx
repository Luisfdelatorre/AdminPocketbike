import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const StatCard = ({
    title,
    value,
    change,
    changeType,
    icon: Icon,
    iconBg,
    color,
    valueColor,
    uppercaseTitle = true,
    className = '',
    fullValue,
    loading = false
}) => {
    const activeColor = valueColor || color;

    const renderChange = () => {
        if (change === undefined || change === null || change === '') return null;

        if (typeof change === 'number') {
            if (change === 0) return null;
            const isPositive = change > 0;
            const formatted = Number.isInteger(Math.abs(change)) ? Math.abs(change) : Math.abs(change).toFixed(1);
            return (
                <span className={`stat-change-inline ${isPositive ? 'positive' : 'negative'}`}>
                    {isPositive ? <TrendingUp size={11} className="inline mr-0.5" /> : <TrendingDown size={11} className="inline mr-0.5" />}
                    {formatted}%
                </span>
            );
        }

        const isNegative = changeType === 'negative' || (typeof change === 'string' && change.trim().startsWith('-'));
        return (
            <span className={`stat-change-inline ${isNegative ? 'negative' : 'positive'}`}>
                {change}
            </span>
        );
    };

    return (
        <div className={`stat-card-ios ${className}`} title={fullValue || undefined}>
            <div className={`stat-content-ios ${Icon ? 'has-icon' : 'no-icon'}`}>
                <div className="stat-text-wrap">
                    <h3 className={uppercaseTitle ? 'uppercase-title-ios' : 'text-xs text-slate-500 font-semibold'}>
                        {title}
                    </h3>
                    <div className="stat-value-container-ios" aria-busy={loading || undefined}>
                        {loading ? (
                            <span className="stat-value-ios">
                                <span className="skeleton skeleton-wide" aria-hidden="true" />
                            </span>
                        ) : (
                            <>
                                <span className="stat-value-ios" style={activeColor ? { color: activeColor } : {}}>
                                    {value}
                                </span>
                                {renderChange()}
                            </>
                        )}
                    </div>
                </div>
                {Icon && (
                    <div
                        className="stat-icon-ios"
                        style={{
                            background: iconBg || (color ? `${color}20` : '#3b82f6'),
                            color: color || '#ffffff'
                        }}
                    >
                        <Icon size={16} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatCard;
