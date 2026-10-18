import React from 'react';
import { Search, X } from 'lucide-react';

const SearchAndFilterBar = ({
    searchQuery,
    setSearchQuery,
    searchPlaceholder = 'Buscar...',
    filter,
    setFilter,
    filterOptions = [], // [{ value: 'all', label: 'Todos' }]
    filterRowClass = '',
    className = '',
    children,
    extraActions = null
}) => {
    return (
        <div className={`search-filter-wrapper-ios ${className}`}>
            <div className="search-ios">
                <Search size={15} className="search-ios-icon" />
                <input
                    type="text"
                    className="search-ios-input"
                    placeholder={searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button
                        type="button"
                        className="search-ios-clear"
                        onClick={() => setSearchQuery('')}
                        aria-label="Limpiar búsqueda"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {filterOptions && filterOptions.length > 0 && (
                <div className={`filter-row-ios ${filterRowClass}`.trim()}>
                    <div className="filter-pills-ios">
                        {filterOptions.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                data-filter={opt.value}
                                className={`filter-pill-ios ${filter === opt.value ? 'active' : ''}`}
                                onClick={() => setFilter(opt.value)}
                            >
                                <span className="filter-pill-label">{opt.label}</span>
                                {opt.badge !== undefined && opt.badge !== null && (
                                    <span
                                        className={`filter-pill-badge ${opt.badgeType ? `badge-${opt.badgeType}` : ''}`}
                                        style={opt.badgeColor ? { backgroundColor: opt.badgeColor } : undefined}
                                    >
                                        {opt.badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {(extraActions || children) && (
                <div className="search-filter-extra-actions">
                    {extraActions || children}
                </div>
            )}
        </div>
    );
};

export default SearchAndFilterBar;
