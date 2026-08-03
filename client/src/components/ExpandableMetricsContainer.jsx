import React from 'react';

const ExpandableMetricsContainer = ({ isExpanded, children, className = '' }) => {
    return (
        <div className={`expandable-metrics-container ${isExpanded ? 'expanded' : 'collapsed'} ${className}`.trim()}>
            {children}
        </div>
    );
};

export default ExpandableMetricsContainer;
