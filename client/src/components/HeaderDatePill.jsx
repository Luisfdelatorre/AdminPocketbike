import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

const SHORT_MONTH_NAMES = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

const FULL_MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * HeaderDatePill Component
 * 
 * Reusable compact iOS-style period pill for mobile headers.
 * Displays calendar icon, current month & year text, and a native hidden select
 * overlay that activates the device picker.
 * 
 * @param {number|string} selectedMonth - Selected month (1-12, or '' for all)
 * @param {number} selectedYear - Selected year (defaults to current year)
 * @param {function} onSelect - Callback when month changes: (month: number|string) => void
 * @param {function} onChangeMonth - Alias for onSelect
 * @param {'short'|'full'} format - Display format for visible pill ('short' e.g. 'Nov 2026' or 'full')
 * @param {boolean} includeAllMonths - Whether to include an option for all months
 * @param {string} allMonthsLabel - Custom label for all months option
 * @param {boolean} disabled - Whether the selector is disabled
 * @param {string} className - Optional container className
 */
const HeaderDatePill = ({
    selectedMonth,
    selectedYear = new Date().getFullYear(),
    onSelect,
    onChangeMonth,
    format = 'short',
    includeAllMonths = false,
    allMonthsLabel,
    disabled = false,
    className = ''
}) => {
    const handleMonthChange = onChangeMonth || onSelect;
    const isAllMonths = includeAllMonths && (selectedMonth === '' || selectedMonth === null || selectedMonth === undefined);
    const monthIndex = Number(selectedMonth) - 1;
    const monthList = format === 'short' ? SHORT_MONTH_NAMES : FULL_MONTH_NAMES;
    const currentMonthText = isAllMonths
        ? (allMonthsLabel || 'Todo el año')
        : (monthList[monthIndex] || 'Seleccionar mes');

    return (
        <div className={`mobile-header-date-pill-wrapper ${className}`.trim()}>
            <button
                type="button"
                className="mobile-header-date-pill"
                disabled={disabled}
                tabIndex={-1}
                aria-hidden="true"
            >
                <Calendar size={13} className="text-cyan-600" />
                <span>{currentMonthText} {selectedYear}</span>
                <ChevronDown size={11} className="text-slate-400" />
            </button>
            <select
                value={selectedMonth ?? ''}
                onChange={(e) => {
                    const val = e.target.value;
                    handleMonthChange?.(val === '' ? '' : Number(val));
                }}
                disabled={disabled}
                className="mobile-header-date-select-hidden"
                aria-label="Seleccionar mes"
            >
                {includeAllMonths && (
                    <option value="">{allMonthsLabel || `Todo el año ${selectedYear}`}</option>
                )}
                {FULL_MONTH_NAMES.map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                        {m} {selectedYear}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default HeaderDatePill;

