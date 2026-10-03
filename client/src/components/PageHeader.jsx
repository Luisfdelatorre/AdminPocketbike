import React, { useState } from 'react';
import MobileHeaderAction from './MobileHeaderAction';
import { RefreshCw, Filter } from 'lucide-react';

/**
 * PageHeader Component
 * 
 * Reusable header for all pages. It standardizes the desktop title,
 * desktop-specific actions, and mobile-specific actions.
 * 
 * @param {string|ReactNode} title - The title of the page (displayed in desktop view)
 * @param {Function} onRefresh - If provided, renders a refresh button (desktop and mobile)
 * @param {Function} onFilterToggle - If provided, renders a filter toggle button (mobile only by default, or you can manage desktop filters separately)
 * @param {boolean} showFilters - Indicates if filters are active (used to style the filter button)
 * @param {boolean} loading - Indicates if data is loading (spins the refresh icon)
 * @param {string} refreshText - Text to display next to the refresh icon on desktop (default: 'Actualizar')
 * @param {ReactNode} desktopActions - Elements (e.g., buttons) to show only on desktop next to the title
 * @param {ReactNode} mobileActions - Additional elements to render inside the MobileHeaderAction portal
 * @param {ReactNode} commonActions - Optional elements to show regardless of viewport
 */
const PageHeader = ({ 
    title, 
    onRefresh, 
    onFilterToggle, 
    showFilters, 
    loading = false, 
    refreshText = 'Actualizar',
    desktopActions, 
    mobileActions, 
    commonActions 
}) => {
    const [isClickSpinning, setIsClickSpinning] = useState(false);

    const handleRefresh = (e) => {
        setIsClickSpinning(true);
        setTimeout(() => setIsClickSpinning(false), 800);
        if (onRefresh) {
            onRefresh(e);
        }
    };

    const isSpinning = Boolean(loading || isClickSpinning);

    return (
        <div className="page-header">
            <div className="desktop-only">
                {title && (typeof title === 'string' ? <h1>{title}</h1> : title)}
            </div>
            
            <div className="header-actions-desktop desktop-only">
                {onRefresh && (
                    <button className="btn-secondary" onClick={handleRefresh} disabled={isSpinning}>
                        <RefreshCw size={16} className={isSpinning ? 'spin' : ''} /> {refreshText}
                    </button>
                )}
                {desktopActions}
                {commonActions}
            </div>

            {(onRefresh || onFilterToggle || mobileActions) && (
                <MobileHeaderAction>
                    {onFilterToggle && (
                        <button
                            type="button"
                            className={`btn-mobile-header-action ${showFilters ? 'active text-blue-600' : ''}`}
                            onClick={onFilterToggle}
                            title="Filtros"
                        >
                            <Filter size={20} />
                        </button>
                    )}
                    {onRefresh && (
                        <button onClick={handleRefresh} className="btn-mobile-header-action" disabled={isSpinning}>
                            <RefreshCw size={20} className={isSpinning ? 'spin' : ''} />
                        </button>
                    )}
                    {mobileActions}
                </MobileHeaderAction>
            )}
        </div>
    );
};

export default PageHeader;
