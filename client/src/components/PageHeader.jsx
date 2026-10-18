import React, { useState } from 'react';
import MobileHeaderAction from './MobileHeaderAction';
import Breadcrumbs from './Breadcrumbs';
import { RefreshCw, Filter } from 'lucide-react';

/**
 * DesktopPageHeader Component
 * 
 * Standardized header component exclusively for desktop viewports.
 * Handles breadcrumbs, title, subtitle, leading controls (like date selects),
 * refresh button with text and spinner, and desktop action buttons.
 */
export const DesktopPageHeader = ({
    title,
    breadcrumbs,
    subtitle,
    leadingActions,
    actions,
    onRefresh,
    loading = false,
    refreshText = 'Actualizar',
    className = ''
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
        <div className={`page-header ${className}`.trim()}>
            <div className="page-header-left">
                <Breadcrumbs items={breadcrumbs} fallbackTitle={title} />
                {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
            </div>

            <div className="header-actions-desktop">
                {leadingActions}
                {onRefresh && (
                    <button type="button" className="btn-secondary" onClick={handleRefresh} disabled={isSpinning}>
                        <RefreshCw size={16} className={isSpinning ? 'spin' : ''} /> {refreshText}
                    </button>
                )}
                {actions}
            </div>
        </div>
    );
};

/**
 * MobilePageHeader Component
 * 
 * Standardized header component exclusively for mobile viewports.
 * Portals mobile actions (leading actions, filter toggle, refresh, extra actions)
 * directly into the top navbar (#mobile-header-actions), and renders any secondary
 * sticky bar or controls passed as children.
 */
export const MobilePageHeader = ({
    onFilterToggle,
    showFilters,
    onRefresh,
    loading = false,
    leadingActions,
    actions,
    children
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
        <>
            {(onRefresh || onFilterToggle || leadingActions || actions) && (
                <MobileHeaderAction>
                    {leadingActions}
                    {onFilterToggle && (
                        <button
                            type="button"
                            className={`btn-mobile-header-action ${showFilters ? 'active' : ''}`}
                            onClick={onFilterToggle}
                            title="Filtros"
                        >
                            <Filter size={20} />
                        </button>
                    )}
                    {onRefresh && (
                        <button
                            type="button"
                            onClick={handleRefresh}
                            className="btn-mobile-header-action"
                            disabled={isSpinning}
                            title="Actualizar"
                        >
                            <RefreshCw size={20} className={isSpinning ? 'spin' : ''} />
                        </button>
                    )}
                    {actions}
                </MobileHeaderAction>
            )}
            {children}
        </>
    );
};

/**
 * Unified PageHeader Component (with .Desktop and .Mobile subcomponents)
 * 
 * Provides backwards compatibility for legacy monolithic calls,
 * while exposing PageHeader.Desktop and PageHeader.Mobile for clean separation.
 */
const PageHeader = ({
    title,
    breadcrumbs,
    subtitle,
    onRefresh,
    onFilterToggle,
    showFilters,
    loading = false,
    refreshText = 'Actualizar',
    desktopLeadingActions,
    desktopActions,
    mobileLeadingActions,
    mobileActions,
    commonActions,
    children
}) => {
    return (
        <>
            <DesktopPageHeader
                title={title}
                breadcrumbs={breadcrumbs}
                subtitle={subtitle}
                leadingActions={desktopLeadingActions}
                actions={<>{desktopActions}{commonActions}</>}
                onRefresh={onRefresh}
                loading={loading}
                refreshText={refreshText}
            />
            <MobilePageHeader
                onFilterToggle={onFilterToggle}
                showFilters={showFilters}
                onRefresh={onRefresh}
                loading={loading}
                leadingActions={mobileLeadingActions}
                actions={<>{mobileActions}{commonActions}</>}
            >
                {children}
            </MobilePageHeader>
        </>
    );
};

PageHeader.Desktop = DesktopPageHeader;
PageHeader.Mobile = MobilePageHeader;

export default PageHeader;
