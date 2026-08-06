import React from 'react';
import MobileHeaderAction from './MobileHeaderAction';
import { RefreshCw, ListFilter } from 'lucide-react';

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
    loading, 
    refreshText = 'Actualizar',
    desktopActions, 
    mobileActions, 
    commonActions 
}) => {
    return (
        <div className="page-header">
            <div className="desktop-only">
                {title && (typeof title === 'string' ? <h1>{title}</h1> : title)}
            </div>
            
            <div className="header-actions-desktop desktop-only">
                {onRefresh && (
                    <button className="btn-secondary" onClick={onRefresh} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spin' : ''} /> {refreshText}
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
                            <ListFilter size={20} />
                        </button>
                    )}
                    {onRefresh && (
                        <button onClick={onRefresh} className="btn-mobile-header-action" disabled={loading}>
                            <RefreshCw size={20} className={loading ? 'spin' : ''} />
                        </button>
                    )}
                    {mobileActions}
                </MobileHeaderAction>
            )}
        </div>
    );
};

export default PageHeader;
