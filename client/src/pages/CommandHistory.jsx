import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    Terminal,
    RefreshCw,
    Bolt,
    PowerOff,
    ShieldAlert,
    User,
    Router,
    Plus,
    LoaderCircle,
    Clock,
    AlertCircle,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import useIsMobile from '../hooks/useIsMobile';
import SearchAndFilterBar from '../components/SearchAndFilterBar';
import MonthYearSelector from '../components/MonthYearSelector';
import SendCommandModal from '../components/modals/SendCommandModal';
import { getCommandHistory, getCommandStats } from '../services/api';
import './CommandHistory.css';
import './Invoices.css'; // Reutilizar estilos de mobile-select y FAB

const CommandHistory = () => {
    const isMobile = useIsMobile();
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);

    const [commands, setCommands] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
    const [stats, setStats] = useState({
        total: 0,
        trendPercent: '+0%',
        successRate: '100%',
        latencySeconds: '3.4s',
        queuedCount: 0,
        counts: { all: 0, stop: 0, resume: 0, preventive: 0, failed: 0 }
    });

    const [loading, setLoading] = useState(false);
    const [statsLoading, setStatsLoading] = useState(false);
    const [isSendCommandOpen, setIsSendCommandOpen] = useState(false);
    const [fabPortalElement, setFabPortalElement] = useState(null);

    useEffect(() => {
        setFabPortalElement(document.body);
    }, []);

    const fetchStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const res = await getCommandStats({
                month: selectedMonth,
                year: selectedYear
            });
            if (res?.stats) {
                setStats(res.stats);
            }
        } catch (err) {
            console.error('Error fetching command stats:', err);
        } finally {
            setStatsLoading(false);
        }
    }, [selectedMonth, selectedYear]);

    const fetchHistory = useCallback(async (pageToLoad = 1) => {
        setLoading(true);
        try {
            const res = await getCommandHistory({
                month: selectedMonth,
                year: selectedYear,
                type: filter,
                search: searchQuery,
                page: pageToLoad,
                limit: 20
            });
            if (res?.commands) {
                setCommands(res.commands);
                setPagination(res.pagination);
            }
        } catch (err) {
            console.error('Error fetching command history:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, selectedYear, filter, searchQuery]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    useEffect(() => {
        fetchHistory(currentPage);
    }, [fetchHistory, currentPage]);

    const handleFilterChange = (val) => {
        setFilter(val);
        setCurrentPage(1);
    };

    const handleSearchChange = (val) => {
        setSearchQuery(val);
        setCurrentPage(1);
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    };

    const renderActionPill = (cmd) => {
        const type = cmd.commandType;
        if (type === 'RESUME') {
            return (
                <div className="command-action-pill resume">
                    <Bolt size={14} />
                    <span>ENCENDIDO</span>
                </div>
            );
        }
        if (type === 'PREVENTIVE') {
            return (
                <div className="command-action-pill preventive">
                    <ShieldAlert size={14} />
                    <span>PREVENTIVO</span>
                </div>
            );
        }
        return (
            <div className="command-action-pill stop">
                <PowerOff size={14} />
                <span>APAGADO</span>
            </div>
        );
    };

    const renderStatusTag = (cmd) => {
        const status = cmd.status;
        const latency = cmd.latencyMs ? ` (${(cmd.latencyMs / 1000).toFixed(1)}s)` : '';

        if (status === 'EXECUTED') {
            return (
                <span className="command-status-tag executed">
                    {cmd.latencyMs > 0 ? `Ejecutado${latency}` : 'Confirmado GPS'}
                </span>
            );
        }
        if (status === 'QUEUED') {
            return <span className="command-status-tag queued">En cola GPRS</span>;
        }
        return <span className="command-status-tag failed">Error / Timeout</span>;
    };

    const renderDateSelectors = () => (
        <MonthYearSelector
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onChangeMonth={m => {
                setSelectedMonth(m);
                setCurrentPage(1);
            }}
            onChangeYear={y => {
                setSelectedYear(y);
                setCurrentPage(1);
            }}
            variant="desktop"
        />
    );

    const desktopHeader = (
        <PageHeader.Desktop
            title="Historial Comandos"
            onRefresh={() => {
                fetchStats();
                fetchHistory(currentPage);
            }}
            loading={loading || statsLoading}
            refreshText="Actualizar"
            leadingActions={renderDateSelectors()}
            actions={
                <button
                    className="btn-primary"
                    type="button"
                    onClick={() => setIsSendCommandOpen(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                    <Plus size={16} /> Nuevo Comando
                </button>
            }
        />
    );

    const mobileHeader = (
        <PageHeader.Mobile
            onRefresh={() => {
                fetchStats();
                fetchHistory(currentPage);
            }}
            loading={loading || statsLoading}
            onFilterToggle={() => setShowFilters(!showFilters)}
            showFilters={showFilters}
            leadingActions={
                pagination.totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f3f4f6', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginRight: '4px' }}>
                        <button
                            type="button"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage <= 1}
                            style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: currentPage <= 1 ? '#9ca3af' : '#1f2937' }}
                            aria-label="Página anterior"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span>{currentPage}/{pagination.totalPages}</span>
                        <button
                            type="button"
                            onClick={() => setCurrentPage(p => p + 1)}
                            disabled={currentPage >= pagination.totalPages}
                            style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: currentPage >= pagination.totalPages ? '#9ca3af' : '#1f2937' }}
                            aria-label="Página siguiente"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                )
            }
        />
    );

    const renderHeader = isMobile ? mobileHeader : desktopHeader;

    const filterOptions = [
        { value: 'ALL', label: 'Todos', badge: stats.counts?.all || 0 },
        { value: 'STOP', label: 'Apagados', badge: stats.counts?.stop || 0, badgeType: 'red' },
        { value: 'RESUME', label: 'Encendidos', badge: stats.counts?.resume || 0, badgeType: 'blue' },
        { value: 'PREVENTIVE', label: 'Preventivos', badge: stats.counts?.preventive || 0 },
        { value: 'FAILED', label: 'Fallidos', badge: stats.counts?.failed || 0, badgeType: 'red' }
    ];

    return (
        <div className="commands-page payments-page">
            {renderHeader}

            {/* Mobile Collapsible Filter Section (Mobile only) */}
            <div className={`collapsible-content w-full md:hidden ${showFilters ? 'expanded' : ''}`} id="filterSection">
                <div className="pt-2 pb-1">
                    <SearchAndFilterBar
                        searchQuery={searchQuery}
                        setSearchQuery={handleSearchChange}
                        searchPlaceholder="Buscar moto (ej. QBD25I) o comando..."
                        filter={filter}
                        setFilter={handleFilterChange}
                        filterOptions={filterOptions}
                        filterRowClass="summary-filter-row-ios"
                    />

                    {/* Action Items for Mobile */}
                    <div className="invoices-mobile-actions">
                        <MonthYearSelector
                            selectedMonth={selectedMonth}
                            selectedYear={selectedYear}
                            onChangeMonth={m => {
                                setSelectedMonth(m);
                                setCurrentPage(1);
                            }}
                            onChangeYear={y => {
                                setSelectedYear(y);
                                setCurrentPage(1);
                            }}
                            variant="mobile"
                        />
                        <button
                            className="filter-action-btn filter-action-btn-icon"
                            onClick={() => {
                                fetchStats();
                                fetchHistory(currentPage);
                            }}
                            title="Actualizar"
                        >
                            <RefreshCw size={15} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Desktop Filters (Always visible on desktop) */}
            <div className="hidden md:block" style={{ marginBottom: '1rem' }}>
                <SearchAndFilterBar
                    searchQuery={searchQuery}
                    setSearchQuery={handleSearchChange}
                    searchPlaceholder="Buscar moto (ej. QBD25I) o comando..."
                    filter={filter}
                    setFilter={handleFilterChange}
                    filterOptions={filterOptions}
                    filterRowClass="summary-filter-row-ios"
                />
            </div>

            {/* Telemetry Metric Cards */}
            <div className="telemetry-metrics-grid">
                <div className="telemetry-metric-card">
                    <span className="metric-card-label">Total Cmds</span>
                    <div className="metric-card-value-row">
                        <span className="metric-card-value">{stats.total}</span>
                        <span className="metric-card-badge">{stats.trendPercent}</span>
                    </div>
                    <span className="metric-card-sub">Mes activo</span>
                </div>

                <div className="telemetry-metric-card">
                    <span className="metric-card-label">Éxito GPS</span>
                    <div className="metric-card-value-row">
                        <span className="metric-card-value">{stats.successRate}</span>
                    </div>
                    <span className="metric-card-sub">Latencia ~{stats.latencySeconds}</span>
                </div>

                <div className="telemetry-metric-card">
                    <span className="metric-card-label">En Cola</span>
                    <div className="metric-card-value-row">
                        <span className="metric-card-value">{stats.queuedCount}</span>
                        {stats.queuedCount > 0 && <span className="metric-card-badge error">●</span>}
                    </div>
                    <span className="metric-card-sub">Modem GPRS</span>
                </div>
            </div>

            {/* Command History Cards List */}
            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '8px', color: '#64748b' }}>
                    <LoaderCircle size={22} className="animate-spin" />
                    <span>Cargando historial de telemetría...</span>
                </div>
            ) : commands.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                    <Terminal size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                    <p style={{ fontWeight: 600, margin: 0 }}>No se encontraron comandos</p>
                    <span style={{ fontSize: '0.85rem' }}>No hay registros de comandos de telemetría para los filtros seleccionados.</span>
                </div>
            ) : (
                <div className="commands-list">
                    {commands.map((cmd) => {
                        const type = (cmd.commandType || 'STOP').toLowerCase();
                        return (
                            <div key={cmd._id || cmd.sentAt} className="command-card">
                                {/* Side Indicator Bar */}

                                <div className="command-card-top">
                                    <div className="command-device-group">
                                        <span className="command-device-badge">{cmd.deviceIdName}</span>
                                        {renderActionPill(cmd)}
                                    </div>
                                    {renderStatusTag(cmd)}
                                </div>

                                <div className="command-card-bottom">
                                    <div className="command-sender-info">
                                        <User size={13} color="#94a3b8" />
                                        <span>
                                            {cmd.source === 'MANUAL' ? (
                                                <><strong>{cmd.senderName}</strong></>
                                            ) : (
                                                <><strong>{cmd.senderName}</strong> {cmd.reason && `• ${cmd.reason}`}</>
                                            )}
                                        </span>
                                    </div>
                                    <span className="command-time">{formatTime(cmd.sentAt)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* IoT Gateway Banner */}
            <div className="iot-gateway-banner">
                <div className="iot-gateway-content">
                    <div className="iot-gateway-icon-box">
                        <Router size={18} />
                    </div>
                    <div className="iot-gateway-texts">
                        <span className="iot-gateway-title">IoT Gateway AZVI Activo</span>
                        <span className="iot-gateway-sub">GPRS (93%) • Fallback SMS (7%)</span>
                    </div>
                </div>
                <div className="iot-pulse-dot" />
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '1rem' }}>
                    <button
                        type="button"
                        className="modal-button modal-button-cancel"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                    >
                        Anterior
                    </button>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                        Página {currentPage} de {pagination.totalPages}
                    </span>
                    <button
                        type="button"
                        className="modal-button modal-button-cancel"
                        disabled={currentPage >= pagination.totalPages}
                        onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                        style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                    >
                        Siguiente
                    </button>
                </div>
            )}

            {/* Floating Action Button (FAB) for Mobile / Desktop */}
            {fabPortalElement && !isSendCommandOpen && createPortal(
                <button
                    type="button"
                    className="contracts-add-fab primary-blue"
                    onClick={() => setIsSendCommandOpen(true)}
                    aria-label="Nuevo Comando"
                    title="Emitir nuevo comando de telemetría"
                >
                    <Plus size={28} />
                </button>,
                fabPortalElement
            )}

            {/* Modal para emitir nuevo comando */}
            <SendCommandModal
                isOpen={isSendCommandOpen}
                onClose={() => setIsSendCommandOpen(false)}
                onSuccess={() => {
                    fetchStats();
                    fetchHistory(1);
                }}
            />
        </div>
    );
};

export default CommandHistory;

