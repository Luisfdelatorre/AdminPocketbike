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
    Search
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import useIsMobile from '../hooks/useIsMobile';
import SearchAndFilterBar from '../components/SearchAndFilterBar';
import MonthYearSelector from '../components/MonthYearSelector';
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

    const handlePauseStream = () => setStreamMode('paused');
    const handleActivateStream = () => setStreamMode('active');
    const handleReconnectStream = async () => {
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
        counts: { powerCut: 0, movement: 0, ignition: 0, geofence: 0, offline: 0 }
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

    // Set default selected alert
    useEffect(() => {
        if (alerts.length > 0) {
            const stillExists = alerts.some((a) => a._id === selectedAlertId);
            if (!stillExists) {
                setSelectedAlertId(alerts[0]._id);
            }
        } else {
            setSelectedAlertId(null);
        }
    }, [alerts, selectedAlertId]);

    // Currently selected alert object
    const selectedAlert = useMemo(() => {
        return alerts.find((a) => a._id === selectedAlertId) || alerts[0] || null;
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
                prev.map((a) => (a._id === updatedAlert._id ? updatedAlert : a))
            );
            fetchStats();
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
        { value: 'POWER_CUT', label: 'Batería', badge: stats.counts?.powerCut || 0, badgeType: 'red' },
        { value: 'UNAUTHORIZED_MOVEMENT', label: 'Movimie.', badge: stats.counts?.movement || 0, badgeType: 'red' },
        { value: 'UNAUTHORIZED_IGNITION', label: 'Ignición', badge: stats.counts?.ignition || 0, badgeType: 'red' },
        { value: 'GEOFENCE_EXIT', label: 'Geocerca', badge: stats.counts?.geofence || 0, badgeType: 'blue' },
        { value: 'EXTENDED_OFFLINE', label: 'Offline', badge: stats.counts?.offline || 0 }
    ];

    const desktopHeader = (
        <div className="alerts-desktop-header">
            <div className="alerts-desktop-header-left">
                <nav className="alerts-breadcrumb">
                    <span className="breadcrumb-item">
                        <Navigation size={13} />
                        <span>Inicio</span>
                    </span>
                    <span className="breadcrumb-sep">/</span>
                    <span className="breadcrumb-active">Alertas &amp; Incidentes</span>
                </nav>
                <div className="alerts-title-row">
                    <h1 className="alerts-main-title">Centro de Alertas y Telemetría en Vivo</h1>
                    {stats.critical > 0 && (
                        <span className="badge-critical-count">
                            <span className="badge-critical-dot" />
                            {stats.critical} Críticas
                        </span>
                    )}
                </div>
                <p className="alerts-subtitle">
                    Supervisión telemétrica continua, detección de fugas mecánicas y control de inmovilización remota • <span className="font-semibold text-slate-800">{user?.companyName || 'MOTOS AZVI SAS'}</span>
                </p>
            </div>
            <div className="alerts-desktop-header-right">
                <div className="alerts-date-pill">
                    <Calendar size={14} />
                    <span>{new Date().toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                </div>
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
        </div>
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

    const selectedCutOff = selectedAlert?.metadata?.cutOff;

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

            {/* ── BEGIN: SSE Compact Triple-Toggle Control (Desktop & Mobile) ── */}
            <div className="alerts-sse-compact-bar">
                <div className="sse-banner-left">
                    <div className={`sse-banner-icon-wrap ${streamMode}`}>
                        <Radio size={18} className={streamMode === 'reconnecting' ? 'animate-spin' : ''} />
                        <span className="sse-ping-badge">
                            <span className={`sse-ping-dot ${streamMode}`} />
                        </span>
                    </div>
                    <div className="sse-banner-text">
                        <div className="sse-banner-title-row">
                            <span className="sse-banner-title">
                                {streamMode === 'active' ? 'Stream Activo' : streamMode === 'paused' ? 'Stream Pausado' : 'Reconectando...'}
                            </span>
                            <span className="sse-banner-ws-badge">Traccar WS</span>
                        </div>
                    </div>
                </div>

                <div className="sse-triple-toggle">
                    <button
                        type="button"
                        className={`sse-toggle-btn ${streamMode === 'paused' ? 'active-paused' : ''}`}
                        onClick={handlePauseStream}
                        title="Pausar stream"
                    >
                        <Pause size={12} />
                        <span>Pausa</span>
                    </button>

                    <button
                        type="button"
                        className={`sse-toggle-btn ${streamMode === 'active' ? 'active-live' : ''}`}
                        onClick={handleActivateStream}
                        title="Stream en vivo activo"
                    >
                        <Play size={12} />
                        <span>Activo</span>
                    </button>

                    <button
                        type="button"
                        className={`sse-toggle-btn ${streamMode === 'reconnecting' ? 'active-reconnect' : ''}`}
                        onClick={handleReconnectStream}
                        title="Forzar reconexión y sincronización de datos"
                    >
                        <RefreshCw size={12} className={streamMode === 'reconnecting' ? 'animate-spin' : ''} />
                        <span>Reconectar</span>
                    </button>
                </div>
            </div>
            {/* ── END: SSE Compact Triple-Toggle Control ────────────────── */}

            {/* ── BEGIN: KPI Dashboard ─────────────────────────────────── */}
            <section aria-label="Resumen telemétrico" className="alerts-metrics-grid">
                {/* Críticas */}
                <div className="alert-metric-card border-rose-accent">
                    <div className="alert-metric-header">
                        <span className="metric-card-label">Críticas</span>
                        <div className="metric-card-pill rose">
                            <Zap size={12} />
                            <span>Prioridad</span>
                        </div>
                    </div>
                    <div className="metric-card-value-row">
                        <span className="metric-card-value rose">{stats.critical}</span>
                        <span className="metric-card-sub">corte / fuga</span>
                    </div>
                </div>

                {/* Activas */}
                <div className="alert-metric-card border-amber-accent">
                    <div className="alert-metric-header">
                        <span className="metric-card-label">Activas</span>
                        <div className="metric-card-pill amber">
                            <Clock size={12} />
                            <span>Pendientes</span>
                        </div>
                    </div>
                    <div className="metric-card-value-row">
                        <span className="metric-card-value amber">{stats.active}</span>
                        <span className="metric-card-sub">sin despachar</span>
                    </div>
                </div>

                {/* Resueltas */}
                <div className="alert-metric-card border-emerald-accent">
                    <div className="alert-metric-header">
                        <span className="metric-card-label">Resueltas</span>
                        <div className="metric-card-pill slate">
                            <Check size={12} color="#059669" />
                            <span>Cerradas</span>
                        </div>
                    </div>
                    <div className="metric-card-value-row">
                        <span className="metric-card-value slate">{stats.resolved}</span>
                        <span className="metric-card-sub">por equipo</span>
                    </div>
                </div>

                {/* Total Mes */}
                <div className="alert-metric-card border-teal-accent">
                    <div className="alert-metric-header">
                        <span className="metric-card-label">Total Mes</span>
                        <div className="metric-card-pill slate">
                            <Activity size={12} color="#64748b" />
                            <span>Globales</span>
                        </div>
                    </div>
                    <div className="metric-card-value-row">
                        <span className="metric-card-value slate">{stats.total}</span>
                        <span className="metric-card-sub">incidentes</span>
                    </div>
                </div>
            </section>
            {/* ── END: KPI Dashboard ───────────────────────────────────── */}

            {/* ── BEGIN: Quick Status Pills Toolbar ────────────────────── */}
            <div className="alerts-toolbar">
                <div className="alerts-search-wrap">
                    <Search size={15} className="alerts-search-icon" />
                    <input
                        type="text"
                        className="alerts-search-input"
                        placeholder="Filtrar placa (ej: FPZ45I), ID o chofer..."
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                    />
                </div>

                <div className="alerts-pills-row">
                    <button
                        type="button"
                        className={`alerts-filter-pill ${statusFilter === 'ALL' && filter === 'ALL' ? 'active' : ''}`}
                        onClick={() => {
                            setStatusFilter('ALL');
                            setFilter('ALL');
                            setCurrentPage(1);
                        }}
                    >
                        <span>Todos</span>
                        <span className="pill-counter">{stats.total || 0}</span>
                    </button>

                    <button
                        type="button"
                        className={`alerts-filter-pill critical ${filter === 'UNAUTHORIZED_MOVEMENT' || filter === 'POWER_CUT' ? 'active' : ''}`}
                        onClick={() => {
                            setFilter(filter === 'UNAUTHORIZED_MOVEMENT' ? 'ALL' : 'UNAUTHORIZED_MOVEMENT');
                            setCurrentPage(1);
                        }}
                    >
                        <span className="pill-dot red" />
                        <span>Críticas</span>
                        <span className="pill-counter">{stats.critical || 0}</span>
                    </button>

                    <button
                        type="button"
                        className={`alerts-filter-pill pending ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
                        onClick={() => {
                            setStatusFilter(statusFilter === 'ACTIVE' ? 'ALL' : 'ACTIVE');
                            setCurrentPage(1);
                        }}
                    >
                        <span className="pill-dot amber" />
                        <span>Pendientes</span>
                        <span className="pill-counter">{stats.active || 0}</span>
                    </button>

                    <button
                        type="button"
                        className={`alerts-filter-pill resolved ${statusFilter === 'RESOLVED' ? 'active' : ''}`}
                        onClick={() => {
                            setStatusFilter(statusFilter === 'RESOLVED' ? 'ALL' : 'RESOLVED');
                            setCurrentPage(1);
                        }}
                    >
                        <span className="pill-dot green" />
                        <span>Resueltas</span>
                        <span className="pill-counter">{stats.resolved || 0}</span>
                    </button>
                </div>
            </div>
            {/* ── END: Quick Status Pills Toolbar ──────────────────────── */}

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
                                                    {alert.occurrenceCount > 1 && (
                                                        <span className="incident-events-badge">
                                                            x{alert.occurrenceCount} eventos
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
