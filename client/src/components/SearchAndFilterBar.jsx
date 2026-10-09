import React from 'react';
import { Search, X } from 'lucide-react';

const SearchAndFilterBar = ({
    searchQuery,
    setSearchQuery,
    searchPlaceholder = 'Buscar...',
    filter,
    setFilter,
    filterOptions = [], // [{ value: 'all', label: 'Todos' }]
    filterRowClass = 'devices-filter-row-ios'
}) => {
    return (
        <>
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
                    <button type="button" className="search-ios-clear" onClick={() => setSearchQuery('')}>
                        <X size={14} />
                    </button>
                )}
            </div>

            {filterOptions && filterOptions.length > 0 && (
                <div className={filterRowClass}>
                    <div className="filter-pills-ios">
                        {filterOptions.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                data-filter={opt.value}
                                className={`filter-pill-ios ${filter === opt.value ? 'active' : ''}`}
                                onClick={() => setFilter(opt.value)}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};

export default SearchAndFilterBar;
