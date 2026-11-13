import React, { useState, useEffect, useCallback } from 'react';
import {
    ShieldAlert,
    Zap,
    AlertTriangle,
    KeyRound,
    MapPin,
    WifiOff,
    CheckCircle2,
    Clock,
    LoaderCircle,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Eye,
    Radio,
    BatteryFull,
    BatteryMedium,
    BatteryLow,
    ZapOff,
    Gauge,
    Activity,
    Pause,
    Map,
    Check
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import useIsMobile from '../hooks/useIsMobile';
import SearchAndFilterBar from '../components/SearchAndFilterBar';
import MonthYearSelector from '../components/MonthYearSelector';
import MotorIcon from '../components/MotorIcon';
import { useSSE } from '../context/SSEContext';
import { getAlertsHistory, getAlertsStats, updateAlertStatus } from '../services/api';
import './Alerts.css';
import './Invoices.css';

const ALERT_TYPE_META = {
    POWER_CUT: {
        label: 'Corte Batería',
        shortLabel: 'Corte',
        icon: Zap,
        themeClass: 'critical',
        color: '#e11d48'
    },
    UNAUTHORIZED_MOVEMENT: {
        label: 'Movimiento No Autorizado',
        shortLabel: 'Mov',
        icon: AlertTriangle,
        themeClass: 'critical',
        color: '#e11d48'
    },
    UNAUTHORIZED_IGNITION: {
        label: 'Ignición en Corte',
        shortLabel: 'Ignición',
        icon: KeyRound,
        themeClass: 'critical',
        color: '#e11d48'
    },
    GEOFENCE_EXIT: {
        label: 'Salida de Geocerca',
        shortLabel: 'Geocerca',
        icon: MapPin,
        themeClass: 'warning',
        color: '#d97706'
    },
    EXTENDED_OFFLINE: {
        label: 'Offline Prolongado',
        shortLabel: 'Offline',
        icon: WifiOff,
        themeClass: 'neutral',
        color: '#64748b'
    }
};

const Alerts = () => {
    const isMobile = useIsMobile();
    const { subscribe } = useSSE();
    const today = new Date();

    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);

    const [alerts, setAlerts] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        acknowledged: 0,
        resolved: 0,
        critical: 0,
        warning: 0,
        counts: { powerCut: 0, movement: 0, ignition: 0, geofence: 0, offline: 0 }
    });

    const [loading, setLoading] = useState(false);
    const [statsLoading, setStatsLoading] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState(null);

    // Resolve Modal
    const [resolvingAlert, setResolvingAlert] = useState(null);
    const [resolutionNotes, setResolutionNotes] = useState('');

    const fetchStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const res = await getAlertsStats({
                month: selectedMonth,
                year: selectedYear
            });
            if (res?.data?.stats) {
                setStats(res.data.stats);
            } else if (res?.stats) {
                setStats(res.stats);
            }
        } catch (err) {
            console.error('Error fetching alerts stats:', err);
        } finally {
            setStatsLoading(false);
        }
    }, [selectedMonth, selectedYear]);

    const fetchHistory = useCallback(async (pageToLoad = 1) => {
        setLoading(true);
        try {
            const res = await getAlertsHistory({
                month: selectedMonth,
                year: selectedYear,
                type: filter,
                status: statusFilter,
                search: searchQuery,
                page: pageToLoad,
                limit: 20
            });
            const data = res?.data || res;
            if (data?.alerts) {
                setAlerts(data.alerts);
                setPagination(data.pagination || { page: 1, total: data.alerts.length, totalPages: 1 });
            }
        } catch (err) {
            console.error('Error fetching alerts history:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, selectedYear, filter, statusFilter, searchQuery]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    useEffect(() => {
        fetchHistory(currentPage);
    }, [fetchHistory, currentPage]);

    // Real-time SSE listener
    useEffect(() => {
        const unsubscribeNew = subscribe('new_alert', (event) => {
            const incomingAlert = event.parsedData;
            if (!incomingAlert) return;

            setAlerts((prev) => {
                const exists = prev.some((a) => a._id === incomingAlert._id);
                if (exists) {
                    return prev.map((a) => (a._id === incomingAlert._id ? incomingAlert : a));
                }
                return [incomingAlert, ...prev];
            });

            setStats((prev) => ({
                ...prev,
                total: prev.total + 1,
                active: prev.active + 1,
                critical: incomingAlert.severity === 'CRITICAL' ? prev.critical + 1 : prev.critical,
                warning: incomingAlert.severity === 'WARNING' ? prev.warning + 1 : prev.warning
            }));
        });

        const unsubscribeUpdated = subscribe('alert_updated', (event) => {
            const updatedAlert = event.parsedData;
            if (!updatedAlert) return;

            setAlerts((prev) =>
                prev.map((a) => (a._id === updatedAlert._id ? updatedAlert : a))
            );
            fetchStats();
        });

        return () => {
            unsubscribeNew();
            unsubscribeUpdated();
        };
    }, [subscribe, fetchStats]);

    const handleAcknowledge = async (alert) => {
        setActionLoadingId(alert._id);
        try {
            await updateAlertStatus(alert._id, { status: 'ACKNOWLEDGED' });
            setAlerts((prev) =>
                prev.map((a) =>
                    a._id === alert._id ? { ...a, status: 'ACKNOWLEDGED', acknowledgedAt: new Date() } : a
                )
            );
            fetchStats();
        } catch (err) {
            console.error('Error acknowledging alert:', err);
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleOpenResolveModal = (alert) => {
        setResolvingAlert(alert);
        setResolutionNotes('');
    };

    const handleConfirmResolve = async () => {
        if (!resolvingAlert) return;
        setActionLoadingId(resolvingAlert._id);
        try {
            await updateAlertStatus(resolvingAlert._id, {
                status: 'RESOLVED',
                notes: resolutionNotes
            });
            setAlerts((prev) =>
                prev.map((a) =>
                    a._id === resolvingAlert._id
                        ? {
                              ...a,
                              status: 'RESOLVED',
                              resolvedAt: new Date(),
                              resolutionNotes
                          }
                        : a
                )
            );
            setResolvingAlert(null);
            fetchStats();
        } catch (err) {
            console.error('Error resolving alert:', err);
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleSearchChange = (val) => {
        setSearchQuery(val);
        setCurrentPage(1);
    };

    const handleFilterChange = (val) => {
        setFilter(val);
        setCurrentPage(1);
    };

    const formatTimeAgo = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Hace 1 min';
        if (diffMins < 60) return `Hace ${diffMins} min`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `Hace ${diffHours} h`;
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    };

    const filterOptions = [
        { value: 'ALL', label: 'Todas', badge: stats.total || 0 },
        { value: 'POWER_CUT', label: '⚡ Corte Batería', badge: stats.counts?.powerCut || 0, badgeType: 'red' },
        { value: 'UNAUTHORIZED_MOVEMENT', label: '🚨 Remolque / Mov.', badge: stats.counts?.movement || 0, badgeType: 'red' },
        { value: 'UNAUTHORIZED_IGNITION', label: '🔑 Ignición Switch', badge: stats.counts?.ignition || 0, badgeType: 'red' },
        { value: 'GEOFENCE_EXIT', label: '📍 Salida Geocerca', badge: stats.counts?.geofence || 0, badgeType: 'blue' },
        { value: 'EXTENDED_OFFLINE', label: '📡 Offline', badge: stats.counts?.offline || 0 }
    ];

    const desktopHeader = (
        <PageHeader.Desktop
            title="Centro de Alertas Telemétricas"
            subtitle="Monitoreo de seguridad en tiempo real y detección de anomalías GPS"
            actions={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MonthYearSelector
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        onChangeMonth={(m) => {
                            setSelectedMonth(m);
                            setCurrentPage(1);
                        }}
                        onChangeYear={(y) => {
                            setSelectedYear(y);
                            setCurrentPage(1);
                        }}
                    />
                    <button
                        className="filter-action-btn filter-action-btn-icon"
                        onClick={() => {
                            fetchStats();
                            fetchHistory(currentPage);
                        }}
                        title="Actualizar datos"
                    >
                        <RefreshCw size={16} className={loading || statsLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginRight: '4px' }}>
                        <button
                            type="button"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage <= 1}
                            style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: currentPage <= 1 ? '#94a3b8' : '#1e293b' }}
                            aria-label="Página anterior"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span className="font-mono">{currentPage}/{pagination.totalPages}</span>
                        <button
                            type="button"
                            onClick={() => setCurrentPage((p) => p + 1)}
                            disabled={currentPage >= pagination.totalPages}
                            style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: currentPage >= pagination.totalPages ? '#94a3b8' : '#1e293b' }}
                            aria-label="Página siguiente"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                )
            }
        />
    );

    return (
        <div className="alerts-page payments-page">
            {isMobile ? mobileHeader : desktopHeader}

            {/* Mobile Collapsible Filter Section */}
            <div className={`collapsible-content w-full md:hidden ${showFilters ? 'expanded' : ''}`} id="filterSection">
                <div className="pt-2 pb-1">
                    <SearchAndFilterBar
                        searchQuery={searchQuery}
                        setSearchQuery={handleSearchChange}
                        searchPlaceholder="Buscar por placa (ej. FPZ45I)..."
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
                            onChangeMonth={(m) => {
                                setSelectedMonth(m);
                                setCurrentPage(1);
                            }}
                            onChangeYear={(y) => {
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

            {/* Desktop Filters */}
            <div className="hidden md:block" style={{ marginBottom: '0.25rem' }}>
                <SearchAndFilterBar
                    searchQuery={searchQuery}
                    setSearchQuery={handleSearchChange}
                    searchPlaceholder="Buscar por placa (ej. FPZ45I) o motivo..."
                    filter={filter}
                    setFilter={handleFilterChange}
                    filterOptions={filterOptions}
                    filterRowClass="summary-filter-row-ios"
                />
            </div>

            {/* ── BEGIN: KPI Dashboard ─────────────────────────────────── */}
            <section aria-label="Resumen telemétrico" className="alerts-metrics-grid">
                {/* Críticas */}
                <div className="alert-metric-card">
                    <div className="alert-metric-header">
                        <span className="metric-card-label">Críticas</span>
                        <div className="metric-card-icon-wrap rose" title="Alerta crítica: Corte / Movimiento">
                            <AlertTriangle size={16} className="animate-pulse" />
                        </div>
                    </div>
                    <div className="metric-card-value-row">
                        <span className="metric-card-value rose">{stats.critical}</span>
                        <span className="metric-card-sub">corte / fuga</span>
                    </div>
                    <div className="metric-card-pill rose">
                        <Zap size={12} />
                        <span>Prioridad máx.</span>
                    </div>
                </div>

                {/* Activas */}
                <div className="alert-metric-card">
                    <div className="alert-metric-header">
                        <span className="metric-card-label">Activas</span>
                        <div className="metric-card-icon-wrap amber" title="Pendientes de gestión">
                            <Clock size={16} />
                        </div>
                    </div>
                    <div className="metric-card-value-row">
                        <span className="metric-card-value amber">{stats.active}</span>
                        <span className="metric-card-sub">pendientes</span>
                    </div>
                    <div className="metric-card-pill amber">
                        <Clock size={12} />
                        <span>Sin despachar</span>
                    </div>
                </div>

                {/* Resueltas */}
                <div className="alert-metric-card">
                    <div className="alert-metric-header">
                        <span className="metric-card-label">Resueltas</span>
                        <div className="metric-card-icon-wrap emerald" title="Atendidas por equipo">
                            <CheckCircle2 size={16} />
                        </div>
                    </div>
                    <div className="metric-card-value-row">
                        <span className="metric-card-value slate">{stats.resolved}</span>
                        <span className="metric-card-sub">cerradas</span>
                    </div>
                    <div className="metric-card-pill slate">
                        <Check size={12} color="#059669" />
                        <span>Por equipo</span>
                    </div>
                </div>

                {/* Total Mes */}
                <div className="alert-metric-card">
                    <div className="alert-metric-header">
                        <span className="metric-card-label">Total Mes</span>
                        <div className="metric-card-icon-wrap slate" title="Total incidentes detectados">
                            <Activity size={16} />
                        </div>
                    </div>
                    <div className="metric-card-value-row">
                        <span className="metric-card-value slate">{stats.total}</span>
                        <span className="metric-card-sub">globales</span>
                    </div>
                    <div className="metric-card-pill slate">
                        <Activity size={12} color="#64748b" />
                        <span>Incidentes</span>
                    </div>
                </div>
            </section>
            {/* ── END: KPI Dashboard ───────────────────────────────────── */}

            {/* ── BEGIN: Stream Status Banner ─────────────────────────── */}
            <section aria-label="Estado de conexión en tiempo real" className="alerts-live-banner">
                <div className="alerts-live-icon-box">
                    <Radio size={20} />
                    <span className="alerts-live-dot" />
                </div>
                <div className="alerts-live-texts">
                    <h2 className="alerts-live-title">Stream Telemétrico Conectado (SSE)</h2>
                    <p className="alerts-live-sub">
                        Escuchando eventos de Traccar WebSocket y telemetría de corte en tiempo real.
                    </p>
                </div>
            </section>
            {/* ── END: Stream Status Banner ───────────────────────────── */}

            {/* ── BEGIN: Incidents Cards List ─────────────────────────── */}
            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '8px', color: '#64748b' }}>
                    <LoaderCircle size={22} className="animate-spin" />
                    <span>Cargando incidentes de telemetría...</span>
                </div>
            ) : alerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                    <ShieldAlert size={36} style={{ margin: '0 auto 8px', color: '#10b981', opacity: 0.8 }} />
                    <p style={{ fontWeight: 600, margin: 0, color: '#0f172a' }}>Sin alertas registradas</p>
                    <span style={{ fontSize: '0.82rem' }}>No se han detectado anomalías telemétricas para los filtros seleccionados. Flota segura.</span>
                </div>
            ) : (
                <div className="alerts-list">
                    {alerts.map((alert) => {
                        const meta = ALERT_TYPE_META[alert.alertType] || {
                            label: alert.alertType,
                            shortLabel: 'Alerta',
                            icon: AlertTriangle,
                            themeClass: 'critical',
                            color: '#e11d48'
                        };
                        const IconComponent = meta.icon;
                        const isResolved = alert.status === 'RESOLVED';
                        const isAcknowledged = alert.status === 'ACKNOWLEDGED';
                        const cutOff = alert.metadata?.cutOff;
                        const ignition = alert.metadata?.ignition;
                        const speed = alert.location?.speed ?? 0;
                        const batteryLevel = alert.metadata?.batteryLevel;
                        const isPowerCut = alert.alertType === 'POWER_CUT' || alert.metadata?.powerCut;

                        return (
                            <article
                                key={alert._id || alert.timestamp}
                                className={`incident-card ${isResolved ? 'status-resolved' : ''}`}
                            >
                                {/* Card Header */}
                                <div className="incident-header">
                                    <div className="incident-header-left">
                                        <div className="incident-badges-row">
                                            <span className="incident-plate-badge">{alert.deviceIdName}</span>
                                            <span className={`incident-type-tag ${meta.themeClass}`}>
                                                <IconComponent size={12} className={meta.themeClass === 'critical' ? 'animate-pulse' : ''} />
                                                <span>{meta.label}</span>
                                            </span>
                                            {alert.occurrenceCount > 1 && (
                                                <span className="incident-events-badge">
                                                    x{alert.occurrenceCount} eventos
                                                </span>
                                            )}
                                        </div>
                                        {alert.companyName && (
                                            <div className="incident-company-info">
                                                <span className="incident-company-dot" />
                                                <span className="incident-company-name">{alert.companyName}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="incident-header-right">
                                        <div className="incident-time">
                                            <Clock size={12} />
                                            <span>{formatTimeAgo(alert.timestamp)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Structured 4-Column Telemetry Grid ── */}
                                <div className="incident-telemetry-grid">
                                    {/* 1. Motor */}
                                    <div className={`telemetry-cell ${cutOff ? 'highlight-rose' : ''}`}>
                                        <div className="telemetry-cell-top">
                                            <span className="telemetry-cell-label">Motor</span>
                                            <MotorIcon size={14} color={cutOff ? '#e11d48' : '#059669'} />
                                        </div>
                                        <span className={`telemetry-cell-value ${cutOff ? 'text-rose' : 'text-emerald'}`}>
                                            {cutOff === true ? 'Corte Activo' : cutOff === false ? 'Normal' : '--'}
                                        </span>
                                    </div>

                                    {/* 2. Switch */}
                                    <div className={`telemetry-cell ${ignition && cutOff ? 'highlight-rose' : ''}`}>
                                        <div className="telemetry-cell-top">
                                            <span className="telemetry-cell-label">Switch</span>
                                            <KeyRound size={13} color={ignition ? (cutOff ? '#e11d48' : '#d97706') : '#94a3b8'} />
                                        </div>
                                        <span className={`telemetry-cell-value font-mono ${ignition && cutOff ? 'text-rose' : ignition ? 'text-amber' : ''}`}>
                                            {ignition === true ? (cutOff ? 'ON (Fuga)' : 'ON') : ignition === false ? 'OFF' : '--'}
                                        </span>
                                    </div>

                                    {/* 3. Velocidad */}
                                    <div className={`telemetry-cell ${speed > 0 ? 'highlight-rose' : ''}`}>
                                        <div className="telemetry-cell-top">
                                            <span className="telemetry-cell-label">Velocidad</span>
                                            <Gauge size={13} color={speed > 0 ? '#e11d48' : '#94a3b8'} />
                                        </div>
                                        <span className={`telemetry-cell-value font-mono ${speed > 0 ? 'text-rose' : ''}`}>
                                            {Math.round(speed)} km/h
                                        </span>
                                    </div>

                                    {/* 4. Batería */}
                                    <div className={`telemetry-cell ${isPowerCut || (batteryLevel !== null && batteryLevel <= 25) ? 'highlight-rose' : ''}`}>
                                        <div className="telemetry-cell-top">
                                            <span className="telemetry-cell-label">Batería</span>
                                            {isPowerCut ? (
                                                <ZapOff size={13} color="#e11d48" className="animate-pulse" />
                                            ) : batteryLevel > 70 ? (
                                                <BatteryFull size={14} color="#059669" />
                                            ) : batteryLevel > 25 ? (
                                                <BatteryMedium size={14} color="#d97706" />
                                            ) : (
                                                <BatteryLow size={14} color="#e11d48" className="animate-pulse" />
                                            )}
                                        </div>
                                        <span className={`telemetry-cell-value font-mono ${isPowerCut || (batteryLevel !== null && batteryLevel <= 25) ? 'text-rose' : ''}`}>
                                            {isPowerCut ? 'Corte' : batteryLevel !== null && batteryLevel !== undefined ? `${batteryLevel}%` : '--'}
                                        </span>
                                    </div>
                                </div>

                                {/* Card Footer: Unified Action Bar */}
                                <div className="incident-footer">
                                    <div className="incident-status-left">
                                        <span className={`status-ping-dot ${!isResolved ? 'animate' : ''}`} style={{ background: isResolved ? '#059669' : isAcknowledged ? '#d97706' : '#e11d48' }} />
                                        <span>
                                            {isResolved ? (
                                                <>Resuelta {alert.resolvedBy?.name && `por ${alert.resolvedBy.name}`}</>
                                            ) : isAcknowledged ? (
                                                <>En seguimiento</>
                                            ) : (
                                                <>Pendiente despacho</>
                                            )}
                                        </span>
                                    </div>

                                    <div className="incident-actions-right">
                                        {/* Ver Mapa */}
                                        {alert.location?.latitude && alert.location?.longitude && (
                                            <a
                                                href={`https://www.google.com/maps?q=${alert.location.latitude},${alert.location.longitude}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn-incident-secondary"
                                                title="Ver ubicación en Google Maps"
                                            >
                                                <Map size={13} color="#64748b" />
                                                <span>Ver Mapa</span>
                                            </a>
                                        )}

                                        {/* Atender */}
                                        {!isResolved && !isAcknowledged && (
                                            <button
                                                type="button"
                                                className="btn-incident-secondary"
                                                disabled={actionLoadingId === alert._id}
                                                onClick={() => handleAcknowledge(alert)}
                                                title="Marcar como atendida / en despacho"
                                            >
                                                {actionLoadingId === alert._id ? (
                                                    <LoaderCircle size={13} className="animate-spin" />
                                                ) : (
                                                    <Eye size={13} color="#64748b" />
                                                )}
                                                <span>Atender</span>
                                            </button>
                                        )}

                                        {/* Resolver */}
                                        {!isResolved && (
                                            <button
                                                type="button"
                                                className="btn-incident-primary"
                                                disabled={actionLoadingId === alert._id}
                                                onClick={() => handleOpenResolveModal(alert)}
                                                title="Cerrar y marcar como resuelta"
                                            >
                                                <CheckCircle2 size={13} />
                                                <span>Resolver</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
            {/* ── END: Incidents Cards List ───────────────────────────── */}

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '1rem' }}>
                    <button
                        type="button"
                        className="modal-button modal-button-cancel"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                        onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                        style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                    >
                        Siguiente
                    </button>
                </div>
            )}

            {/* Modal de Resolución */}
            {resolvingAlert && (
                <div className="alert-modal-overlay" onClick={() => setResolvingAlert(null)}>
                    <div className="alert-modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3 className="alert-modal-title">
                            Resolver Alerta • {resolvingAlert.deviceIdName}
                        </h3>
                        <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                            {resolvingAlert.title}
                        </p>
                        <div>
                            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                                Notas de Resolución / Observaciones (opcional)
                            </label>
                            <textarea
                                className="alert-modal-textarea"
                                placeholder="Ej: Se comunicó con el cliente, vehículo verificado sin novedad..."
                                value={resolutionNotes}
                                onChange={(e) => setResolutionNotes(e.target.value)}
                            />
                        </div>
                        <div className="alert-modal-actions">
                            <button
                                type="button"
                                className="modal-button modal-button-cancel"
                                onClick={() => setResolvingAlert(null)}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="btn-incident-primary"
                                style={{ padding: '0.55rem 1rem' }}
                                disabled={actionLoadingId === resolvingAlert._id}
                                onClick={handleConfirmResolve}
                            >
                                {actionLoadingId === resolvingAlert._id ? (
                                    <LoaderCircle size={14} className="animate-spin" />
                                ) : (
                                    <CheckCircle2 size={14} />
                                )}
                                Confirmar Resolución
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Alerts;
