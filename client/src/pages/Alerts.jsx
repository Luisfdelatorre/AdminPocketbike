import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    ShieldAlert,
    Zap,
    AlertTriangle,
    KeyRound,
    MapPin,
    WifiOff,
    CheckCircle2,
    Clock,
    ExternalLink,
    LoaderCircle,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Eye,
    Radio
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import useIsMobile from '../hooks/useIsMobile';
import SearchAndFilterBar from '../components/SearchAndFilterBar';
import MonthYearSelector from '../components/MonthYearSelector';
import { useSSE } from '../context/SSEContext';
import { getAlertsHistory, getAlertsStats, updateAlertStatus } from '../services/api';
import './Alerts.css';
import './Invoices.css'; // Reutilizar estilos de mobile-select y actions

const ALERT_TYPE_META = {
    POWER_CUT: {
        label: 'Corte Batería',
        icon: Zap,
        className: 'power-cut',
        color: '#dc2626'
    },
    UNAUTHORIZED_MOVEMENT: {
        label: 'Movimiento No Aut.',
        icon: AlertTriangle,
        className: 'movement',
        color: '#ea580c'
    },
    UNAUTHORIZED_IGNITION: {
        label: 'Ignición en Corte',
        icon: KeyRound,
        className: 'ignition',
        color: '#d97706'
    },
    GEOFENCE_EXIT: {
        label: 'Salida Geocerca',
        icon: MapPin,
        className: 'geofence',
        color: '#7c3aed'
    },
    EXTENDED_OFFLINE: {
        label: 'Offline Prolongado',
        icon: WifiOff,
        className: 'offline',
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

            // Increment stats in real time
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
        if (diffMins < 1) return 'Hace un momento';
        if (diffMins < 60) return `Hace ${diffMins} min`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `Hace ${diffHours} h`;
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    // Filter Options
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f3f4f6', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginRight: '4px' }}>
                        <button
                            type="button"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage <= 1}
                            style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: currentPage <= 1 ? '#9ca3af' : '#1f2937' }}
                            aria-label="Página anterior"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span>{currentPage}/{pagination.totalPages}</span>
                        <button
                            type="button"
                            onClick={() => setCurrentPage((p) => p + 1)}
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

    return (
        <div className="alerts-page payments-page">
            {isMobile ? mobileHeader : desktopHeader}

            {/* Mobile Collapsible Filter Section */}
            <div className={`collapsible-content w-full md:hidden ${showFilters ? 'expanded' : ''}`} id="filterSection">
                <div className="pt-2 pb-1">
                    <SearchAndFilterBar
                        searchQuery={searchQuery}
                        setSearchQuery={handleSearchChange}
                        searchPlaceholder="Buscar por placa (ej. DQY62I)..."
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
            <div className="hidden md:block" style={{ marginBottom: '0.5rem' }}>
                <SearchAndFilterBar
                    searchQuery={searchQuery}
                    setSearchQuery={handleSearchChange}
                    searchPlaceholder="Buscar por placa (ej. DQY62I) o título..."
                    filter={filter}
                    setFilter={handleFilterChange}
                    filterOptions={filterOptions}
                    filterRowClass="summary-filter-row-ios"
                />
            </div>

            {/* Telemetry Metric Cards */}
            <div className="alerts-metrics-grid">
                <div className="alert-metric-card critical">
                    <span className="metric-card-label">Críticas</span>
                    <div className="metric-card-value-row">
                        <span className="metric-card-value" style={{ color: '#dc2626' }}>{stats.critical}</span>
                        {stats.critical > 0 && <span className="metric-card-badge error">Prioridad</span>}
                    </div>
                    <span className="metric-card-sub">Corte / Movimiento</span>
                </div>

                <div className="alert-metric-card active-card">
                    <span className="metric-card-label">Activas</span>
                    <div className="metric-card-value-row">
                        <span className="metric-card-value" style={{ color: '#d97706' }}>{stats.active}</span>
                    </div>
                    <span className="metric-card-sub">Pendientes de gestión</span>
                </div>

                <div className="alert-metric-card resolved-card">
                    <span className="metric-card-label">Resueltas</span>
                    <div className="metric-card-value-row">
                        <span className="metric-card-value" style={{ color: '#059669' }}>{stats.resolved}</span>
                    </div>
                    <span className="metric-card-sub">Atendidas por equipo</span>
                </div>

                <div className="alert-metric-card total-card">
                    <span className="metric-card-label">Total Mes</span>
                    <div className="metric-card-value-row">
                        <span className="metric-card-value">{stats.total}</span>
                    </div>
                    <span className="metric-card-sub">Incidentes detectados</span>
                </div>
            </div>

            {/* Live Gateway Indicator */}
            <div className="alerts-live-banner">
                <div className="alerts-live-left">
                    <div className="alerts-live-icon">
                        <Radio size={18} />
                    </div>
                    <div>
                        <h4 className="alerts-live-title">Stream Telemétrico Conectado (SSE)</h4>
                        <p className="alerts-live-sub">Escuchando eventos de Traccar WebSocket y telemetría de corte en tiempo real</p>
                    </div>
                </div>
                <div className="iot-pulse-dot" title="Stream activo" />
            </div>

            {/* Alerts List */}
            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '8px', color: '#64748b' }}>
                    <LoaderCircle size={22} className="animate-spin" />
                    <span>Cargando registro de alertas...</span>
                </div>
            ) : alerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                    <ShieldAlert size={34} style={{ margin: '0 auto 8px', color: '#10b981', opacity: 0.8 }} />
                    <p style={{ fontWeight: 600, margin: 0, color: '#1e293b' }}>Sin alertas registradas</p>
                    <span style={{ fontSize: '0.85rem' }}>No se han detectado anomalías telemétricas para los filtros seleccionados. Flota segura.</span>
                </div>
            ) : (
                <div className="alerts-list">
                    {alerts.map((alert) => {
                        const meta = ALERT_TYPE_META[alert.alertType] || {
                            label: alert.alertType,
                            icon: AlertTriangle,
                            className: 'power-cut',
                            color: '#dc2626'
                        };
                        const IconComponent = meta.icon;
                        const isCritical = alert.severity === 'CRITICAL';
                        const isResolved = alert.status === 'RESOLVED';
                        const isAcknowledged = alert.status === 'ACKNOWLEDGED';

                        return (
                            <div
                                key={alert._id || alert.timestamp}
                                className={`alert-card severity-${alert.severity?.toLowerCase()} status-${alert.status?.toLowerCase()}`}
                            >
                                <div className="alert-card-top">
                                    <div className="alert-device-group">
                                        <span className="alert-device-badge">{alert.deviceIdName}</span>
                                        <span className={`alert-type-pill ${meta.className}`}>
                                            <IconComponent size={13} />
                                            {meta.label}
                                        </span>
                                        {alert.occurrenceCount > 1 && (
                                            <span className="alert-occurrence-badge" title="Eventos continuos agrupados">
                                                x{alert.occurrenceCount}
                                            </span>
                                        )}
                                        {alert.companyName && (
                                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                                • {alert.companyName}
                                            </span>
                                        )}
                                    </div>

                                    {/* Status Pill */}
                                    {isResolved ? (
                                        <span className="alert-status-tag resolved">
                                            <CheckCircle2 size={12} />
                                            Resuelta
                                        </span>
                                    ) : isAcknowledged ? (
                                        <span className="alert-status-tag acknowledged">
                                            <Eye size={12} />
                                            En Gestión
                                        </span>
                                    ) : (
                                        <span className="alert-status-tag active">
                                            <span className="pulse-dot" />
                                            Activa
                                        </span>
                                    )}
                                </div>

                                <div className="alert-card-body">
                                    <h4 className="alert-title">{alert.title}</h4>
                                    {alert.message && <p className="alert-message">{alert.message}</p>}

                                    {/* Telemetry Chips */}
                                    <div className="alert-chips-row">
                                        {alert.metadata?.cutOff !== null && alert.metadata?.cutOff !== undefined && (
                                            <span className={`alert-chip ${alert.metadata.cutOff ? 'highlight-red' : 'highlight-green'}`}>
                                                Motor: {alert.metadata.cutOff ? 'BLOQUEADO' : 'NORMAL'}
                                            </span>
                                        )}
                                        {alert.metadata?.ignition !== null && alert.metadata?.ignition !== undefined && (
                                            <span className={`alert-chip ${alert.metadata.ignition ? 'highlight-red' : ''}`}>
                                                Switch: {alert.metadata.ignition ? 'ENCENDIDO' : 'APAGADO'}
                                            </span>
                                        )}
                                        {alert.metadata?.motion !== null && alert.metadata?.motion !== undefined && (
                                            <span className="alert-chip">
                                                Movimiento: {alert.metadata.motion ? 'SÍ' : 'NO'}
                                            </span>
                                        )}
                                        {alert.location?.speed > 0 && (
                                            <span className="alert-chip highlight-red">
                                                Velocidad: {Math.round(alert.location.speed)} km/h
                                            </span>
                                        )}
                                        {alert.metadata?.batteryLevel !== null && alert.metadata?.batteryLevel !== undefined && (
                                            <span className="alert-chip">
                                                Batería: {alert.metadata.batteryLevel}%
                                            </span>
                                        )}
                                        {alert.metadata?.hoursOffline && (
                                            <span className="alert-chip highlight-red">
                                                Offline: ~{alert.metadata.hoursOffline}h
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="alert-card-bottom">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <Clock size={12} color="#94a3b8" />
                                            {formatTimeAgo(alert.timestamp)}
                                        </span>

                                        {isResolved && alert.resolvedBy?.name && (
                                            <span className="alert-resolved-info">
                                                <CheckCircle2 size={12} />
                                                Resuelta por <strong>{alert.resolvedBy.name}</strong>
                                                {alert.resolutionNotes && ` ("${alert.resolutionNotes}")`}
                                            </span>
                                        )}
                                    </div>

                                    <div className="alert-actions-group">
                                        {/* Google Maps Shortcut */}
                                        {alert.location?.latitude && alert.location?.longitude && (
                                            <a
                                                href={`https://www.google.com/maps?q=${alert.location.latitude},${alert.location.longitude}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="alert-action-btn btn-map"
                                                title="Ver ubicación satelital en Google Maps"
                                            >
                                                <ExternalLink size={12} />
                                                Ver Mapa
                                            </a>
                                        )}

                                        {/* Acknowledge Button */}
                                        {!isResolved && !isAcknowledged && (
                                            <button
                                                type="button"
                                                className="alert-action-btn btn-acknowledge"
                                                disabled={actionLoadingId === alert._id}
                                                onClick={() => handleAcknowledge(alert)}
                                                title="Marcar como atendida / en seguimiento"
                                            >
                                                {actionLoadingId === alert._id ? (
                                                    <LoaderCircle size={12} className="animate-spin" />
                                                ) : (
                                                    <Eye size={12} />
                                                )}
                                                Atender
                                            </button>
                                        )}

                                        {/* Resolve Button */}
                                        {!isResolved && (
                                            <button
                                                type="button"
                                                className="alert-action-btn btn-resolve"
                                                disabled={actionLoadingId === alert._id}
                                                onClick={() => handleOpenResolveModal(alert)}
                                                title="Cerrar y marcar como resuelta"
                                            >
                                                <CheckCircle2 size={12} />
                                                Resolver
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

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
                                className="modal-button modal-button-primary"
                                style={{ background: '#059669', borderColor: '#059669' }}
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
