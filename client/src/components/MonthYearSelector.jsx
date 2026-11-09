import React from 'react';

/**
 * MonthYearSelector Component
 * Reusable period selector for month and year dropdowns across the application.
 * 
 * @param {number|string} selectedMonth - Selected month (1-12, or '' for all)
 * @param {number|string} selectedYear - Selected year (e.g. 2026)
 * @param {function} onChangeMonth - Callback when month changes: (month: number|string) => void
 * @param {function} onChangeYear - Callback when year changes: (year: number) => void
 * @param {'desktop'|'mobile'} variant - Styling variant ('desktop' uses date-select-standard, 'mobile' uses sort-select)
 * @param {number[]} years - Available years (defaults to [2024, 2025, 2026, 2027])
 * @param {boolean} includeAllMonths - Whether to show an "All year" / "Todos" option
 * @param {string} allMonthsLabel - Label for all months option (defaults to 'Todo el año')
 * @param {boolean} disabled - Whether the selects are disabled
 * @param {string} className - Optional container className
 */
const MonthYearSelector = ({
    selectedMonth,
    selectedYear,
    onChangeMonth,
    onChangeYear,
    variant = 'desktop',
    years = [2024, 2025, 2026, 2027],
    includeAllMonths = false,
    allMonthsLabel = 'Todo el año',
    disabled = false,
    className = ''
}) => {
    const isMobile = variant === 'mobile';
    const monthSelectClass = isMobile ? 'sort-select mobile-select-month' : 'date-select-standard';
    const yearSelectClass = isMobile ? 'sort-select mobile-select-year' : 'date-select-standard';

    return (
        <div
            className={`month-year-selector ${className}`.trim()}
            style={isMobile ? { display: 'contents' } : { display: 'flex', gap: '8px', alignItems: 'center' }}
        >
            <select
                value={selectedMonth ?? ''}
                onChange={(e) => {
                    const val = e.target.value;
                    onChangeMonth?.(val === '' ? '' : Number(val));
                }}
                className={monthSelectClass}
                disabled={disabled}
                aria-label="Seleccionar mes"
            >
                {includeAllMonths && (
                    <option value="">{allMonthsLabel}</option>
                )}
                {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                        {new Date(0, i).toLocaleString('es-ES', { month: 'long' }).replace(/^\w/, (c) => c.toUpperCase())}
                    </option>
                ))}
            </select>

            <select
                value={selectedYear ?? new Date().getFullYear()}
                onChange={(e) => onChangeYear?.(Number(e.target.value))}
                className={yearSelectClass}
                disabled={disabled}
                aria-label="Seleccionar año"
            >
                {years.map((y) => (
                    <option key={y} value={y}>
                        {y}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default MonthYearSelector;

