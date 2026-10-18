import React from 'react';

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
    fullValue
}) => {
    const activeColor = valueColor || color;

    return (
        <div className={`stat-card-ios ${className}`} title={fullValue || undefined}>
            <div className={`stat-content-ios ${Icon ? 'has-icon' : 'no-icon'}`}>
                <div className="stat-text-wrap">
                    <h3 className={uppercaseTitle ? 'uppercase-title-ios' : 'text-xs text-slate-500 font-semibold'}>
                        {title}
                    </h3>
                    <div className="stat-value-container-ios">
                        <span className="stat-value-ios" style={activeColor ? { color: activeColor } : {}}>
                            {value}
                        </span>
                        {change && (
                            <span className={`stat-change-inline ${changeType === 'negative' ? 'negative' : 'positive'}`}>
                                {change}
                            </span>
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
