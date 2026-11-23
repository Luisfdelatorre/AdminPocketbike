import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    ShieldAlert,
    Zap,
    AlertTriangle,
    KeyRound,
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
    Play,
    Map,
    Check,
    Phone,
    PhoneCall,
    Power,
    Navigation,
    User,
    CheckCircle2,
    Calendar,
    Satellite,
    ExternalLink,
    Lock,
    Search,
    X,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import useIsMobile from '../hooks/useIsMobile';
import useAssistantScreenBridge from '../hooks/useAssistantScreenBridge';
import SearchAndFilterBar from '../components/SearchAndFilterBar';
import MonthYearSelector from '../components/MonthYearSelector';
import StatCard from '../components/StatCard';
import MobileMetricsCard from '../components/MobileMetricsCard';
import MotorIcon from '../components/MotorIcon';
import { useAuth } from '../context/AuthContext';
import { useSSE } from '../context/SSEContext';
import {
    getAlertsHistory,
    getAlertsStats,
    updateAlertStatus,
    getActiveContract,
    sendCommand
} from '../services/api';
import './Alerts.css';
import './Invoices.css';

const ALERT_TYPE_META = {
    UNAUTHORIZED_DRIVING: {
        label: 'Sabotaje: Conducción en Corte',
        shortLabel: 'Sabotaje',
        icon: ShieldAlert,
        themeClass: 'critical',
        color: '#dc2626'
    },
    POWER_CUT: {
        label: 'Energia',
        shortLabel: 'Energia',
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
        icon: Navigation,
        themeClass: 'warning',
        color: '#0284c7'
    },
    EXTENDED_OFFLINE: {
        label: 'Offline Prolongado',
        shortLabel: 'Offline',
        icon: Radio,
        themeClass: 'info',
        color: '#64748b'
    }
};

const Alerts = () => {
    const isMobile = useIsMobile();
    const { user } = useAuth();
    const { subscribe } = useSSE();

    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);
    const [streamMode, setStreamMode] = useState('active'); // 'active' | 'paused' | 'reconnecting'
    const [expandedGroups, setExpandedGroups] = useState({});

    const toggleGroupExpanded = (groupKey) => {
        setExpandedGroups((prev) => ({
            ...prev,
            [groupKey]: !prev[groupKey]
        }));
    };

    const handleCycleStreamMode = async () => {
        if (streamMode === 'active') {
            setStreamMode('paused');
        } else if (streamMode === 'paused') {
            setStreamMode('reconnecting');
            try {
                await Promise.all([
                    fetchStats(),
                    fetchHistory(currentPage)
                ]);
            } finally {
                setTimeout(() => {
                    setStreamMode('active');
                }, 600);
            }
        } else {
            setStreamMode('active');
        }
    };

    const [alerts, setAlerts] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        acknowledged: 0,
        resolved: 0,
        critical: 0,
        warning: 0,
        counts: { unauthorizedDriving: 0, powerCut: 0, movement: 0, ignition: 0, geofence: 0, offline: 0 }
    });

    const [loading, setLoading] = useState(false);
    const [statsLoading, setStatsLoading] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState(null);

    // Inspector selection
    const [selectedAlertId, setSelectedAlertId] = useState(null);
    const [contractInfo, setContractInfo] = useState(null);
    const [contractLoading, setContractLoading] = useState(false);
    const [iotCommandLoading, setIotCommandLoading] = useState(false);
    const [iotCommandSuccess, setIotCommandSuccess] = useState(null);
    const [dispatchNotes, setDispatchNotes] = useState('');

    // Resolve Modal
    const [resolvingAlert, setResolvingAlert] = useState(null);
    const [resolutionNotes, setResolutionNotes] = useState('');

    useAssistantScreenBridge('alerts', {
        loading: loading || statsLoading,
        activeFilters: {
            status: statusFilter,
            alertType: filter,
            searchQuery,
            month: selectedMonth,
            year: selectedYear,
        },
        metrics: {
            filteredCount: Number(pagination.total || alerts.length),
            totalCount: Number(stats.total || 0),
            activeCount: Number(stats.active || 0),
            criticalCount: Number(stats.critical || 0),
        },
        selectedItem: selectedAlertId,
        applyFilter: (params = {}) => {
            if (params.alertType) {
                setFilter(params.alertType);
                setCurrentPage(1);
            }
            if (params.status) {
                setStatusFilter(params.status);
                setCurrentPage(1);
            }
            if (params.month) setSelectedMonth(Number(params.month));
            if (params.year) setSelectedYear(Number(params.year));
            return true;
        },
        search: (q) => {
            setSearchQuery(q);
            setCurrentPage(1);
            return true;
        },
        clearFilters: () => {
            setFilter('ALL');
            setStatusFilter('ALL');
            setSearchQuery('');
            setCurrentPage(1);
            return true;
        },
        openDetail: ({ identifier } = {}) => {
            const key = (identifier || '').trim().toLowerCase();
            const found = key
                ? alerts.find(
                      (a) =>
                          String(a._id) === identifier ||
                          (a.deviceIdName || '').toLowerCase() === key
                  )
                : alerts[0];
            if (found) {
                setSelectedAlertId(found._id);
                return true;
            }
            return false;
        },
    });

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
                limit: 20,
                grouped: true
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

    // Set default selected alert (also supports selecting collapsed sub-events)
    useEffect(() => {
        if (alerts.length > 0) {
            const stillExists = alerts.some(
                (a) => a._id === selectedAlertId || (a.collapsedAlerts || []).some((sub) => sub._id === selectedAlertId)
            );
            if (!stillExists) {
                setSelectedAlertId(alerts[0]._id);
            }
        } else {
            setSelectedAlertId(null);
        }
    }, [alerts, selectedAlertId]);

    // Currently selected alert object (checks top-level and collapsed sub-alerts)
    const selectedAlert = useMemo(() => {
        for (const a of alerts) {
            if (a._id === selectedAlertId) return a;
            if (a.collapsedAlerts?.length) {
                const sub = a.collapsedAlerts.find((item) => item._id === selectedAlertId);
                if (sub) return sub;
            }
        }
        return alerts[0] || null;
    }, [alerts, selectedAlertId]);

    // Fetch active contract for the selected alert's plate
    useEffect(() => {
        if (!selectedAlert?.deviceIdName) {
            setContractInfo(null);
            return;
        }
        let isCancelled = false;
        setContractLoading(true);
        getActiveContract(selectedAlert.deviceIdName)
            .then((res) => {
                if (!isCancelled) {
                    setContractInfo(res?.data || res || null);
                }
            })
            .catch(() => {
                if (!isCancelled) {
                    setContractInfo(null);
                }
            })
            .finally(() => {
                if (!isCancelled) {
                    setContractLoading(false);
                }
            });
        return () => {
            isCancelled = true;
        };
    }, [selectedAlert?.deviceIdName]);

    // Real-time SSE listener
    useEffect(() => {
        if (streamMode === 'paused') return;

        const unsubscribeNew = subscribe('new_alert', (event) => {
            if (streamMode === 'paused') return;
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
            if (streamMode === 'paused') return;
            const updatedAlert = event.parsedData;
            if (!updatedAlert) return;

            setAlerts((prev) =>
                prev.map((a) => (a._id === updatedAlert._id ? { ...a, ...updatedAlert } : a))
            );
            if (!updatedAlert._isLiveSummaryUpdate) {
                fetchStats();
            }
        });

        return () => {
            unsubscribeNew();
            unsubscribeUpdated();
        };
    }, [subscribe, fetchStats, streamMode]);

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

    // Execute IoT Engine Command
    const handleExecuteIoTCommand = async (commandType) => {
        if (!selectedAlert?.deviceIdName) return;
        const isCut = commandType === 'engineStop';
        const confirmMsg = isCut
            ? `¿Confirmas enviar CORTE INMEDIATO DE MOTOR al vehículo ${selectedAlert.deviceIdName}?`
            : `¿Confirmas REANUDAR MOTOR al vehículo ${selectedAlert.deviceIdName}?`;

        if (!window.confirm(confirmMsg)) return;

        setIotCommandLoading(true);
        setIotCommandSuccess(null);
        try {
            await sendCommand({
                deviceIdName: selectedAlert.deviceIdName,
                command: commandType,
                reason: `Comando inmediato desde Centro de Alertas (${selectedAlert.alertType})`
            });
            setIotCommandSuccess(isCut ? 'Corte enviado con éxito' : 'Reanudación enviada con éxito');
            setTimeout(() => setIotCommandSuccess(null), 4000);
        } catch (err) {
            alert(`Error al enviar comando: ${err.message || 'Error de comunicación'}`);
        } finally {
            setIotCommandLoading(false);
        }
    };

    // Save Dispatch Note
    const handleSaveDispatchNote = async () => {
        if (!selectedAlert || !dispatchNotes.trim()) return;
        setActionLoadingId(selectedAlert._id);
        try {
            await updateAlertStatus(selectedAlert._id, {
                status: selectedAlert.status === 'RESOLVED' ? 'RESOLVED' : 'ACKNOWLEDGED',
                notes: dispatchNotes
            });
            setAlerts((prev) =>
                prev.map((a) =>
                    a._id === selectedAlert._id
                        ? { ...a, resolutionNotes: dispatchNotes, status: a.status === 'ACTIVE' ? 'ACKNOWLEDGED' : a.status }
                        : a
                )
            );
            setDispatchNotes('');
            alert('Nota de despacho registrada en auditoría.');
            fetchStats();
        } catch (err) {
            alert(`Error al guardar nota: ${err.message}`);
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
        const diffMs = Math.max(0, now - d);
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Hace 1 min';
        if (diffMins <= 30) return `Hace ${diffMins} min`;

        const isToday = d.toDateString() === now.toDateString();
        const timeStr = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });

        if (isToday) {
            return timeStr;
        }

        return `${d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} ${timeStr}`;
    };

    const filterOptions = [
        { value: 'ALL', label: 'Todas', badge: stats.total || 0 },
        { value: 'UNAUTHORIZED_DRIVING', label: 'Sabotaje', badge: stats.counts?.unauthorizedDriving || 0, badgeType: 'debt' },
        { value: 'POWER_CUT', label: 'Batería', badge: stats.counts?.powerCut || 0, badgeType: 'debt' },
        { value: 'STATUS_ACTIVE', label: 'Pendientes', badge: stats.active || 0, badgeType: 'cutoff' },
        { value: 'STATUS_RESOLVED', label: 'Resueltas', badge: stats.resolved || 0, badgeType: 'ok' },

        { value: 'UNAUTHORIZED_MOVEMENT', label: 'Movimie.', badge: stats.counts?.movement || 0, badgeType: 'debt' },
        { value: 'UNAUTHORIZED_IGNITION', label: 'Ignición', badge: stats.counts?.ignition || 0, badgeType: 'debt' },
        { value: 'GEOFENCE_EXIT', label: 'Geocerca', badge: stats.counts?.geofence || 0, badgeType: 'weekly' },
        { value: 'EXTENDED_OFFLINE', label: 'Offline', badge: stats.counts?.offline || 0 }
    ];

    const activeFilterValue = statusFilter === 'ACTIVE'
        ? 'STATUS_ACTIVE'
        : statusFilter === 'RESOLVED'
            ? 'STATUS_RESOLVED'
            : filter;

    const handleUnifiedFilterChange = (val) => {
        if (val === 'STATUS_ACTIVE') {
            setFilter('ALL');
            setStatusFilter('ACTIVE');
        } else if (val === 'STATUS_RESOLVED') {
            setFilter('ALL');
            setStatusFilter('RESOLVED');
        } else {
            setStatusFilter('ALL');
            setFilter(val);
        }
        setCurrentPage(1);
    };

    const totalAlertsCount = stats.total || 0;
    const resolvedPercentage = totalAlertsCount > 0 ? Math.round(((stats.resolved || 0) / totalAlertsCount) * 100) : 0;
    const activePercentage = totalAlertsCount > 0 ? Math.round(((stats.active || 0) / totalAlertsCount) * 100) : 0;

    const renderSSECyclicButton = (isCompact = false) => {
        const isAct = streamMode === 'active';
        const isPau = streamMode === 'paused';
        const isRec = streamMode === 'reconnecting';

        const titleTooltip = isAct
            ? 'Stream Activo en vivo (Clic para pausar)'
            : isPau
                ? 'Stream Pausado (Clic para reconectar)'
                : 'Reconectando y sincronizando telemetría...';

        return (
            <button
                type="button"
                className={`sse-cyclic-btn ${streamMode} ${isCompact ? 'compact' : ''}`}
                onClick={handleCycleStreamMode}
                title={titleTooltip}
                aria-label={titleTooltip}
            >
                <div className={`sse-banner-icon-wrap ${streamMode}`}>
                    {isRec ? (
                        <RefreshCw size={15} className="animate-spin" />
                    ) : isPau ? (
                        <Pause size={15} />
                    ) : (
                        <Radio size={15} />
                    )}
                    <span className="sse-ping-badge">
                        <span className={`sse-ping-dot ${streamMode}`} />
                    </span>
                </div>
            </button>
        );
    };

    const desktopHeader = (
        <PageHeader.Desktop
            title="Alertas & Incidentes"
            breadcrumbs={[
                { label: 'Operaciones' },
                { label: 'Alertas & Incidentes' }
            ]}
            onRefresh={() => {
                fetchStats();
                fetchHistory(currentPage);
            }}
            loading={loading || statsLoading}
            refreshText="Actualizar"
            leadingActions={
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
                    variant="desktop"
                />
            }
            actions={renderSSECyclicButton()}
        />
    );

    const mobileHeader = (
        <PageHeader.Mobile
            loading={loading || statsLoading}
            onFilterToggle={() => setShowFilters(!showFilters)}
            showFilters={showFilters}
            datePicker={{
                selectedMonth,
                selectedYear,
                includeAllMonths: false,
                onSelect: (m) => {
                    setSelectedMonth(m);
                    setCurrentPage(1);
                }
            }}
            actions={renderSSECyclicButton(true)}
        />
    );

    const renderHeader = isMobile ? mobileHeader : desktopHeader;

    const selectedCutOff = selectedAlert?.metadata?.cutOff;

    return (
        <div className="alerts-page payments-page">
            {renderHeader}

            {/* Mobile Consolidated Metrics Card vs Desktop StatCards */}
            {isMobile ? !showFilters && (
                <MobileMetricsCard
                    segments={[
                        { width: resolvedPercentage, variant: 'completed' },
                        { width: activePercentage, variant: 'pending' }
                    ]}
                    columns={[
                        {
                            label: 'Críticas',
                            dot: 'pending',
                            value: stats.critical || 0,
                            subcount: `${stats.active || 0} act.`,
                            valueClass: 'val-pending'
                        },
                        {
                            label: 'Resueltas',
                            dot: 'completed',
                            value: `${resolvedPercentage}%`,
                            subcount: stats.resolved || 0
                        },
                        {
                            label: 'Total Mes',
                            icon: <Activity size={12} className="text-cyan-600" />,
                            value: totalAlertsCount
                        }
                    ]}
                />
            ) : (
                /* Summary Stats — Minimalist iOS style (Desktop) */
                <div className="devices-stats-ios payments-stats-grid">
                    <StatCard
                        title="CRÍTICAS"
                        value={stats.critical || 0}
                        valueColor="#E46A76"
                    />
                    <StatCard
                        title="ACTIVAS"
                        value={stats.active || 0}
                        valueColor="#FB9678"
                    />
                    <StatCard
                        title="RESUELTAS"
                        value={stats.resolved || 0}
                        valueColor="#00C292"
                    />
                    <StatCard
                        title="TOTAL MES"
                        value={totalAlertsCount}
                        valueColor="#1a1c1c"
                    />
                </div>
            )}

            {/* Mobile Collapsible Filter & Search Section */}
            {isMobile && showFilters && (
                <div className="mobile-filter-section">
                    <div className="mobile-search-bar">
                        <Search size={16} className="search-icon" />
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            placeholder="Buscar por placa (ej. FPZ45I)..."
                            className="mobile-search-input"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => handleSearchChange('')}
                                className="clear-search"
                                title="Limpiar búsqueda"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <div className="filter-pills-row no-scrollbar">
                        {filterOptions.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleUnifiedFilterChange(opt.value)}
                                className={`filter-pill ${activeFilterValue === opt.value ? 'active' : ''}`}
                            >
                                <span>{opt.label}</span>
                                {opt.badge !== undefined && (
                                    <span className="pill-count">{opt.badge}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Desktop Filters (Desktop only) */}
            {!isMobile && (
                <div className="payment-controls hidden md:flex items-center justify-between gap-4">
                    <SearchAndFilterBar
                        searchQuery={searchQuery}
                        setSearchQuery={handleSearchChange}
                        searchPlaceholder="Filtrar placa (ej: FPZ45I), ID o chofer..."
                        filter={activeFilterValue}
                        setFilter={handleUnifiedFilterChange}
                        filterOptions={filterOptions}
                    />
                </div>
            )}

            {/* ── BEGIN: 2-Column Split Workspace (Feed + Desktop Inspector) ── */}
            <div className="alerts-workspace-split">
                {/* Left Column: Incidents Cards List */}
                <div className="alerts-feed-column">
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
                                const isSelected = selectedAlert?._id === alert._id;
                                const groupKey = `${alert.deviceIdName}_${alert.alertType}`;
                                const collapsedCount = alert.groupedCount > 1 ? alert.groupedCount : 0;
                                const collapsedAlerts = alert.collapsedAlerts || [];
                                const isExpanded = Boolean(expandedGroups[groupKey]);

                                return (
                                    <article
                                        key={alert._id || alert.timestamp}
                                        className={`incident-card ${isResolved ? 'status-resolved' : ''} ${isSelected ? 'is-selected' : ''}`}
                                        onClick={() => setSelectedAlertId(alert._id)}
                                    >
                                        {/* Card Header */}
                                        <div className="incident-header">
                                            <div className="incident-header-left">
                                                <div className="incident-badges-row">
                                                    <span className="incident-plate-badge">{alert.deviceIdName}</span>
                                                    <span className={`incident-type-tag ${meta.themeClass}`}>
                                                        <IconComponent size={12} className={meta.themeClass === 'critical' ? 'animate-pulse' : ''} />
                                                        <span>{meta.shortLabel}</span>
                                                    </span>
                                                    {(alert.alertType === 'UNAUTHORIZED_DRIVING' || alert.metadata?.bypassSuspected) && (
                                                        <span className="incident-sabotage-badge">
                                                            Puenteado
                                                        </span>
                                                    )}
                                                    {collapsedCount > 1 ? (
                                                        <button
                                                            type="button"
                                                            className={`incident-collapse-pill ${isExpanded ? 'expanded' : ''}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleGroupExpanded(groupKey);
                                                            }}
                                                            title={isExpanded ? 'Ocultar eventos anteriores' : `Ver ${collapsedCount - 1} eventos anteriores de ${alert.deviceIdName}`}
                                                        >
                                                            <span>x{collapsedCount}</span>
                                                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                        </button>
                                                    ) : alert.occurrenceCount > 1 && (
                                                        <span className="incident-events-badge">
                                                            x{alert.occurrenceCount}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="incident-header-right">
                                                <div className="incident-time" title={alert.timestamp ? new Date(alert.timestamp).toLocaleString('es-CO') : ''}>
                                                    <Clock size={12} />
                                                    <span>{formatTimeAgo(alert.timestamp)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 4-Column Telemetry Grid */}
                                        <div className="incident-telemetry-grid">
                                            {/* 1. Motor */}
                                            <div className={`telemetry-cell ${cutOff ? 'highlight-rose' : ''}`}>
                                                <div className="telemetry-cell-top">
                                                    <MotorIcon size={14} color={cutOff ? '#e11d48' : '#059669'} />
                                                </div>
                                                <span className={`telemetry-cell-value ${cutOff ? 'text-rose' : 'text-emerald'}`}>
                                                    {cutOff === true ? 'Corte' : cutOff === false ? 'Normal' : '--'}
                                                </span>
                                            </div>

                                            {/* 2. Switch */}
                                            <div className={`telemetry-cell ${ignition && cutOff ? 'highlight-rose' : ''}`}>
                                                <div className="telemetry-cell-top">
                                                    <KeyRound size={13} color={ignition ? (cutOff ? '#e11d48' : '#d97706') : '#94a3b8'} />
                                                </div>
                                                <span className={`telemetry-cell-value font-mono ${ignition && cutOff ? 'text-rose' : ignition ? 'text-amber' : ''}`}>
                                                    {ignition === true ? (cutOff ? 'ON' : 'ON') : ignition === false ? 'OFF' : '--'}
                                                </span>
                                            </div>

                                            {/* 3. Velocidad */}
                                            <div className={`telemetry-cell ${speed > 0 ? 'highlight-rose' : ''}`}>
                                                <div className="telemetry-cell-top">
                                                    <Gauge size={13} color={speed > 0 ? '#e11d48' : '#94a3b8'} />
                                                </div>
                                                <span className={`telemetry-cell-value font-mono ${speed > 0 ? 'text-rose' : ''}`}>
                                                    {Math.round(speed)} km/h
                                                </span>
                                            </div>

                                            {/* 4. Batería */}
                                            <div className={`telemetry-cell ${isPowerCut || (batteryLevel !== null && batteryLevel <= 25) ? 'highlight-rose' : ''}`}>
                                                <div className="telemetry-cell-top">
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

                                        {/* Card Footer: Action Bar */}
                                        <div className="incident-footer">
                                            <div className="incident-status-left">
                                                <span className={`status-ping-dot ${!isResolved ? 'animate' : ''}`} style={{ background: isResolved ? '#059669' : isAcknowledged ? '#d97706' : '#e11d48' }} />
                                            </div>

                                            <div className="incident-actions-right" onClick={(e) => e.stopPropagation()}>
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

                                        {/* Expanded History of Collapsed Alerts for this Bike & Event */}
                                        {isExpanded && collapsedAlerts.length > 0 && (
                                            <div className="collapsed-alerts-drawer" onClick={(e) => e.stopPropagation()}>
                                                <div className="collapsed-alerts-header">
                                                    <span>Eventos anteriores ({collapsedCount - 1})</span>
                                                    {collapsedCount - 1 > collapsedAlerts.length && (
                                                        <span className="collapsed-alerts-more">
                                                            Mostrando últimos {collapsedAlerts.length}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="collapsed-alerts-list">
                                                    {collapsedAlerts.map((sub) => {
                                                        const subResolved = sub.status === 'RESOLVED';
                                                        const subAck = sub.status === 'ACKNOWLEDGED';
                                                        const subSelected = selectedAlert?._id === sub._id;
                                                        const subSpeed = Math.round(sub.location?.speed ?? 0);
                                                        const subBat = sub.metadata?.batteryLevel;

                                                        return (
                                                            <div
                                                                key={sub._id || sub.timestamp}
                                                                className={`collapsed-alert-row ${subSelected ? 'is-selected' : ''}`}
                                                                onClick={() => setSelectedAlertId(sub._id)}
                                                            >
                                                                <div className="collapsed-alert-left">
                                                                    <span
                                                                        className="collapsed-status-dot"
                                                                        style={{ background: subResolved ? '#059669' : subAck ? '#d97706' : '#e11d48' }}
                                                                    />
                                                                    <span className="collapsed-alert-time" title={sub.timestamp ? new Date(sub.timestamp).toLocaleString('es-CO') : ''}>
                                                                        {formatTimeAgo(sub.timestamp)}
                                                                    </span>
                                                                </div>
                                                                <div className="collapsed-alert-metrics">
                                                                    <span>{subSpeed} km/h</span>
                                                                    <span>{subBat !== null && subBat !== undefined ? `${subBat}%` : '--'}</span>
                                                                    <span className={`collapsed-status-label ${subResolved ? 'resolved' : subAck ? 'ack' : 'active'}`}>
                                                                        {subResolved ? 'Resuelta' : subAck ? 'Atendida' : 'Activa'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </article>
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
                </div>

                {/* Right Column: Geo-Telemetric Map & Fast Dispatch Inspector (Desktop xl) */}
                <div className="alerts-inspector-column">
                    {selectedAlert ? (
                        <>
                            {/* Card 1: GPS Live Tracking */}
                            <div className="inspector-map-card">
                                <div className="inspector-card-header">
                                    <div className="flex items-center gap-2">
                                        <Navigation size={16} className="text-teal" />
                                        <span className="inspector-card-title">Rastreo GPS en Vivo</span>
                                    </div>
                                    <span className="incident-plate-badge">{selectedAlert.deviceIdName}</span>
                                </div>

                                <div className="inspector-map-canvas">
                                    {selectedAlert.location?.latitude && selectedAlert.location?.longitude ? (
                                        <>
                                            <iframe
                                                title="GPS Live Map"
                                                className="inspector-map-iframe"
                                                src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedAlert.location.longitude - 0.006}%2C${selectedAlert.location.latitude - 0.006}%2C${selectedAlert.location.longitude + 0.006}%2C${selectedAlert.location.latitude + 0.006}&layer=mapnik&marker=${selectedAlert.location.latitude}%2C${selectedAlert.location.longitude}`}
                                            />
                                            {/* GPS HUD Overlay */}
                                            <div className="inspector-map-hud-top">
                                                <div className="inspector-hud-chip">
                                                    <span className="hud-live-dot" />
                                                    <span className="font-semibold">{selectedAlert.location.address || 'GPS Activo'}</span>
                                                </div>
                                                <div className="inspector-hud-chip font-mono">
                                                    {Math.round(selectedAlert.location.speed || 0)} km/h
                                                </div>
                                            </div>
                                            {/* Floating Map Tools */}
                                            <div className="inspector-map-tools">
                                                <a
                                                    href={`https://www.google.com/maps?q=${selectedAlert.location.latitude},${selectedAlert.location.longitude}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inspector-map-btn"
                                                    title="Abrir en Google Maps"
                                                >
                                                    <ExternalLink size={14} />
                                                </a>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="inspector-map-empty">
                                            <Satellite size={32} className="animate-pulse text-slate-400" />
                                            <p>Sin coordenadas en este paquete</p>
                                            <span>Esperando reporte GPS del vehículo</span>
                                        </div>
                                    )}
                                </div>

                                <div className="inspector-coords-strip">
                                    <span className="font-mono text-xs text-slate-500">
                                        {selectedAlert.location?.latitude && selectedAlert.location?.longitude
                                            ? `Lat: ${selectedAlert.location.latitude.toFixed(4)}° | Lng: ${selectedAlert.location.longitude.toFixed(4)}°`
                                            : 'Lat: -- | Lng: --'}
                                    </span>
                                    <span className="inspector-sat-badge">
                                        <Satellite size={12} />
                                        <span>GPS OK</span>
                                    </span>
                                </div>
                            </div>

                            {/* Card 2: Quick Dispatch Card & Fast IoT Actuation */}
                            <div className="inspector-dispatch-card">
                                {/* Driver & Contract Info */}
                                <div className="inspector-driver-header">
                                    <div className="inspector-driver-avatar">
                                        <User size={22} className="text-slate-600" />
                                    </div>
                                    <div className="inspector-driver-info">
                                        <h4 className="inspector-driver-name">
                                            {contractLoading
                                                ? 'Cargando datos...'
                                                : contractInfo?.customerName || `Conductor ${selectedAlert.deviceIdName}`}
                                        </h4>
                                        <span className="inspector-driver-doc">
                                            {contractInfo?.customerDocument ? `CC ${contractInfo.customerDocument}` : `Placa ${selectedAlert.deviceIdName}`} • {contractInfo?.status === 'ACTIVE' ? 'Conductor Activo' : 'Flota'}
                                        </span>
                                        {contractInfo?.customerPhone && (
                                            <a href={`tel:${contractInfo.customerPhone}`} className="inspector-driver-phone">
                                                <Phone size={12} />
                                                <span>{contractInfo.customerPhone}</span>
                                            </a>
                                        )}
                                    </div>
                                    <span className="inspector-contract-tag">
                                        {contractInfo?.contractId ? `Contrato #${contractInfo.contractId}` : 'Sin contrato'}
                                    </span>
                                </div>

                                {/* Sabotage Alert Callout if relay bypass suspected */}
                                {(selectedAlert.alertType === 'UNAUTHORIZED_DRIVING' || selectedAlert.metadata?.bypassSuspected) && (
                                    <div className="inspector-sabotage-card">
                                        <div className="inspector-sabotage-header">
                                            <ShieldAlert size={16} className="text-rose-600 animate-pulse" />
                                            <span className="inspector-sabotage-title">
                                                🚨 Sabotaje Confirmado de Relé de Corte
                                            </span>
                                        </div>
                                        <p className="inspector-sabotage-desc">
                                            La motocicleta registra velocidad activa ({Math.round(selectedAlert.location?.speed || selectedAlert.metadata?.speed || 0)} km/h) con switch ON mientras la orden del sistema está en CORTE. El relé de inmovilización ha sido puenteado o desconectado y el cliente sigue trabajando.
                                        </p>
                                    </div>
                                )}

                                {/* Fast IoT Actuation */}
                                <div className="inspector-iot-section">
                                    <span className="inspector-section-label">Comandos Inmediatos IoT</span>
                                    <div className="inspector-iot-buttons">
                                        {selectedCutOff ? (
                                            <button
                                                type="button"
                                                className="btn-iot-actuation resume"
                                                disabled={iotCommandLoading}
                                                onClick={() => handleExecuteIoTCommand('engineResume')}
                                            >
                                                {iotCommandLoading ? <LoaderCircle size={15} className="animate-spin" /> : <Power size={15} />}
                                                <span>Reanudar Motor (Relé 1)</span>
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                className="btn-iot-actuation stop"
                                                disabled={iotCommandLoading}
                                                onClick={() => handleExecuteIoTCommand('engineStop')}
                                            >
                                                {iotCommandLoading ? <LoaderCircle size={15} className="animate-spin" /> : <Power size={15} />}
                                                <span>Corte Inmediato de Motor (Relé 1)</span>
                                            </button>
                                        )}

                                        <div className="inspector-iot-grid-secondary">
                                            {contractInfo?.customerPhone && (
                                                <a
                                                    href={`tel:${contractInfo.customerPhone}`}
                                                    className="btn-iot-secondary"
                                                >
                                                    <PhoneCall size={14} />
                                                    <span>Llamar Chofer</span>
                                                </a>
                                            )}
                                            {selectedAlert.location?.latitude && selectedAlert.location?.longitude && (
                                                <a
                                                    href={`https://www.google.com/maps?q=${selectedAlert.location.latitude},${selectedAlert.location.longitude}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn-iot-secondary"
                                                >
                                                    <Map size={14} />
                                                    <span>Ver Mapa</span>
                                                </a>
                                            )}
                                        </div>

                                        {iotCommandSuccess && (
                                            <div className="iot-command-success">
                                                <CheckCircle2 size={14} />
                                                <span>{iotCommandSuccess}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Quick Dispatch Notes */}
                                <div className="inspector-notes-section">
                                    <label className="inspector-section-label flex justify-between">
                                        <span>Bitácora de Despacho Rápido</span>
                                        <span className="text-slate-400 font-normal">Auditoría central</span>
                                    </label>
                                    <textarea
                                        className="inspector-notes-textarea"
                                        placeholder="Ingresar verificación de siniestro, llamada a conductor o reporte a cuadrilla..."
                                        rows={2}
                                        value={dispatchNotes}
                                        onChange={(e) => setDispatchNotes(e.target.value)}
                                    />
                                    <div className="flex justify-between items-center pt-1">
                                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                            <Lock size={11} /> Quedará registrado en auditoría
                                        </span>
                                        <button
                                            type="button"
                                            className="btn-save-note"
                                            disabled={actionLoadingId === selectedAlert._id || !dispatchNotes.trim()}
                                            onClick={handleSaveDispatchNote}
                                        >
                                            {actionLoadingId === selectedAlert._id ? <LoaderCircle size={13} className="animate-spin" /> : 'Guardar Nota'}
                                        </button>
                                    </div>
                                </div>

                                {/* Mini Timeline */}
                                <div className="inspector-timeline-section">
                                    <span className="inspector-section-label">Historial del Incidente</span>
                                    <div className="inspector-timeline">
                                        <div className="timeline-item">
                                            <div className="timeline-dot red" />
                                            <div className="timeline-content">
                                                <span className="timeline-title">{selectedAlert.title || 'Alerta telemétrica disparada'}</span>
                                                <span className="timeline-sub font-mono">{formatTimeAgo(selectedAlert.timestamp)} • Coordenada válida</span>
                                            </div>
                                        </div>
                                        {selectedAlert.occurrenceCount > 1 && (
                                            <div className="timeline-item">
                                                <div className="timeline-dot amber" />
                                                <div className="timeline-content">
                                                    <span className="timeline-title">Eventos telemétricos repetidos ({selectedAlert.occurrenceCount}x)</span>
                                                    <span className="timeline-sub font-mono">Deduplicado en cooldown</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="timeline-item">
                                            <div className="timeline-dot teal" />
                                            <div className="timeline-content">
                                                <span className="timeline-title">
                                                    {selectedAlert.status === 'RESOLVED' ? 'Incidente resuelto' : selectedAlert.status === 'ACKNOWLEDGED' ? 'En despacho activo' : 'Pendiente de despacho'}
                                                </span>
                                                <span className="timeline-sub font-mono">
                                                    {selectedAlert.status === 'RESOLVED' && selectedAlert.resolvedAt ? formatTimeAgo(selectedAlert.resolvedAt) : 'Supervisión en tiempo real'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="inspector-empty-placeholder">
                            <Navigation size={32} className="text-slate-300 mb-2" />
                            <p className="font-semibold text-slate-700">Ningún incidente seleccionado</p>
                            <span className="text-xs text-slate-400">Selecciona una alerta de la lista para ver su telemetría y mapa en vivo</span>
                        </div>
                    )}
                </div>
            </div>
            {/* ── END: 2-Column Split Workspace ────────────────────────── */}

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
