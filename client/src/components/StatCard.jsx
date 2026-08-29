import React from 'react';

const StatCard = ({ title, value, change, changeType, icon: Icon, iconBg, valueColor, uppercaseTitle = true, className = '' }) => {
    return (
        <div className={`stat-card-ios ${className}`}>
            <div className="stat-content-ios flex items-center justify-between w-full">
                <div>
                    <h3 className={uppercaseTitle ? "uppercase-title-ios" : "text-xs text-slate-500 font-semibold"}>{title}</h3>
                    <div className="stat-value-container-ios flex items-center gap-2 mt-1">
                        <span className="stat-value-ios" style={valueColor ? { color: valueColor } : {}}>
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
                    <div className="stat-icon-ios p-2.5 rounded-2xl flex items-center justify-center text-white shadow-sm" style={{ background: iconBg || '#3b82f6' }}>
                        <Icon size={18} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatCard;
