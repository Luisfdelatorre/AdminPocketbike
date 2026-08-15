import React from 'react';

const StatCard = ({ title, value, valueColor }) => {
    return (
        <div className="stat-card-ios">
            <div className="stat-content-ios">
                <h3 className="uppercase-title-ios">{title}</h3>
                <div className="stat-value-container-ios">
                    <span className="stat-value-ios" style={valueColor ? { color: valueColor } : {}}>
                        {value}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default StatCard;
