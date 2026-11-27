import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Download, TrendingUp, TrendingDown, DollarSign, Zap, BatteryCharging, AlertTriangle } from 'lucide-react';
import { getReportTemplate } from '../services/api';
import { useDashboardQuery } from '../hooks/useScreenQueries';
import { exportToCSV } from '../utils/helpers';
import { buildReportRows } from '../utils/reportGenerator';
import { showToast } from '../utils/toast';
import PageHeader from '../components/PageHeader';
import MonthYearSelector from '../components/MonthYearSelector';
import StatCard from '../components/StatCard';
import useIsMobile from '../hooks/useIsMobile';
import useAssistantScreenBridge from '../hooks/useAssistantScreenBridge';
import StatusBadge from '../components/StatusBadge';
import './AdminDashboard.css';

const EMPTY_LIST = [];
const DEFAULT_STATS = {
    totalRevenue: 0,
    activeDevices: 0,
    pendingPayments: 0,
    totalDevices: 0,
    totalInvoiced: 0,
    collectionGap: 0,
    collectionRate: 100
};
const DEFAULT_ELECTRICAL_SUMMARY = {
    total: 0,
    healthy: 0,
    weak: 0,
    damaged: 0,
    powerCut: 0,
    overvoltage: 0,
    noCharge: 0,
    weakCharge: 0,
    healthPercentage: 100
};

const AdminDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const [downloadingReport, setDownloadingReport] = useState(false);

    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // Mes en curso por defecto
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());

    // Cached across tab switches: only the very first visit shows "Cargando datos…";
    // later visits paint the cached data and refresh in the background.
    const dashboardQuery = useDashboardQuery({ month: selectedMonth, year: selectedYear });
    const stats = { ...DEFAULT_STATS, ...(dashboardQuery.data?.stats || {}) };
    const electricalSummary = dashboardQuery.data?.electricalSummary || DEFAULT_ELECTRICAL_SUMMARY;
    const recentPayments = dashboardQuery.data?.recentPayments ?? EMPTY_LIST;
    const initialLoading = dashboardQuery.isPending;
    const loading = dashboardQuery.isFetching;

    useEffect(() => {
        if (dashboardQuery.error) console.error('Error fetching dashboard data:', dashboardQuery.error);
    }, [dashboardQuery.error]);

    const fetchDashboardData = () => dashboardQuery.refetch();

    const formatCurrency = (value) => {
        if (!value) return '$0';
        return `$${Number(value).toLocaleString('es-CO')}`;
    };

    const formatCompact = (value) => {
        if (!value) return '$0';
        if (value >= 1000000) {
            const millions = value / 1000000;
            const formatted = Number.isInteger(millions) ? millions : millions.toFixed(2).replace(/\.?0+$/, '');
            return `$${formatted}M`;
        }
        if (value >= 1000) {
            const thousands = value / 1000;
            const formatted = Number.isInteger(thousands) ? thousands : thousands.toFixed(1).replace(/\.?0+$/, '');
            return `$${formatted}k`;
        }
        return `$${Number(value).toLocaleString('es-CO')}`;
    };

    const collectionPercentage = Math.min(100, Math.max(0, Math.round(stats.collectionRate || 0)));
    const pendingPercentage = Math.max(0, 100 - collectionPercentage);

    useAssistantScreenBridge('dashboard', {
        loading,
        activeFilters: { month: selectedMonth, year: selectedYear },
        metrics: {
            totalRevenue: Number(stats.totalRevenue || 0),
            totalInvoiced: Number(stats.totalInvoiced || 0),
            collectionRate: Number(stats.collectionRate || 0),
            activeDevices: Number(stats.activeDevices || 0),
            totalDevices: Number(stats.totalDevices || 0),
        },
        applyFilter: (params = {}) => {
            if (params.month) setSelectedMonth(Number(params.month));
            if (params.year) setSelectedYear(Number(params.year));
            return true;
        },
    });

    const handleDownloadReport = async () => {
        if (downloadingReport) return;
        setDownloadingReport(true);
        const period = selectedMonth
            ? `${String(selectedMonth).padStart(2, '0')}-${selectedYear}`
            : `${selectedYear}`;
        try {
            const res = await getReportTemplate('dashboard-summary');
            if (!res?.success || !res.data) throw new Error(res?.error || 'Template unavailable');
            const rows = buildReportRows(res.data, { period, stats, recentPayments });
            exportToCSV(`reporte_dashboard_${period}.csv`, rows);
        } catch (error) {
            console.error('Error generating dashboard report:', error);
            showToast('error', t('dashboard.report.errorTitle', 'Reporte'), t('dashboard.report.error', 'No se pudo generar el reporte'));
        } finally {
            setDownloadingReport(false);
        }
    };

    const downloadLabel = t('dashboard.report.download', 'Descargar reporte');

    const desktopHeader = (
        <PageHeader.Desktop
            title={t('dashboard.title', 'Dashboard')}
            onRefresh={fetchDashboardData}
            loading={loading}
            refreshText="Actualizar"
            actions={
                <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleDownloadReport}
                    disabled={downloadingReport || initialLoading}
                    title={downloadLabel}
                >
                    <Download size={16} /> {t('dashboard.report.short', 'Reporte')}
                </button>
            }
            leadingActions={
                <MonthYearSelector
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    onChangeMonth={setSelectedMonth}
                    onChangeYear={setSelectedYear}
                    includeAllMonths={true}
                    variant="desktop"
                />
            }

        />
    );

    const mobileHeader = (
        <PageHeader.Mobile
            onRefresh={fetchDashboardData}
            loading={loading}
            datePicker={{
                selectedMonth,
                selectedYear,
                includeAllMonths: true,
                onSelect: (m) => setSelectedMonth(m)
            }}
            actions={
                <button
                    type="button"
                    className="btn-mobile-header-action"
                    onClick={handleDownloadReport}
                    disabled={downloadingReport || initialLoading}
                    title={downloadLabel}
                    aria-label={downloadLabel}
                >
                    <Download size={20} />
                </button>
            }
        />
    );

    const renderHeader = isMobile ? mobileHeader : desktopHeader;

    return (
        <div className="dashboard-content ios-dashboard">
            {renderHeader}

            {initialLoading ? (
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>{t('dashboard.loading', 'Cargando datos...')}</p>
                </div>
            ) : (
                <>
                    {/* Opción A: Mobile Consolidated Metrics Card vs Desktop Balanced StatCards */}
                    {isMobile ? (
                        <div className="mobile-metrics-card">
                            <div className="mobile-metrics-top-row">
                                <span className="mobile-metrics-primary-title">
                                    {selectedMonth ? 'Recaudo del Mes' : 'Recaudo del Año'}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                    <span className="mobile-metrics-primary-val">
                                        {formatCurrency(stats.totalRevenue)}
                                    </span>
                                    <span className="stat-change-inline positive" style={{ fontSize: '10px' }}>
                                        {collectionPercentage}% Cobrado
                                    </span>
                                </div>
                            </div>

                            <div className="metrics-progress-bar">
                                <div
                                    className="progress-fill fill-completed"
                                    style={{ width: `${collectionPercentage}%` }}
                                />
                                <div
                                    className="progress-fill fill-pending"
                                    style={{ width: `${pendingPercentage}%` }}
                                />
                            </div>

                            <div className="metrics-columns">
                                <div className="metrics-col">
                                    <div className="metrics-header-row">
                                        <span className="metrics-dot dot-completed" />
                                        <span className="metrics-label">Cobrado</span>
                                    </div>
                                    <p className="metrics-val">
                                        {formatCompact(stats.totalRevenue)}
                                        <span className="metrics-subcount"> ({collectionPercentage}%)</span>
                                    </p>
                                </div>

                                <div className="metrics-col bordered-col">
                                    <div className="metrics-header-row">
                                        <span className="metrics-dot dot-pending" />
                                        <span className="metrics-label">Pendiente</span>
                                    </div>
                                    <p className="metrics-val val-pending">
                                        {formatCompact(stats.collectionGap || 0)}
                                        <span className="metrics-subcount"> ({pendingPercentage}%)</span>
                                    </p>
                                </div>

                                <div className="metrics-col">
                                    <div className="metrics-header-row">
                                        <span className="metrics-dot dot-cyan" />
                                        <span className="metrics-label">Flota</span>
                                    </div>
                                    <p className="metrics-val">
                                        {stats.activeDevices || 0} Motos
                                        {stats.pendingPayments > 0 && (
                                            <span className="metrics-subcount" style={{ color: '#E11D48' }}> ({stats.pendingPayments} mora)</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Desktop: 4 Balanced StatCards */
                        <div className="dashboard-stats-grid-desktop">
                            <StatCard
                                title={selectedMonth ? "Facturado (mes)" : "Facturado (año)"}
                                value={formatCompact(stats.totalInvoiced || 0)}
                                fullValue={formatCurrency(stats.totalInvoiced || 0)}
                                uppercaseTitle
                            />
                            <StatCard
                                title="Total Ingresos Cobrados"
                                value={formatCompact(stats.totalRevenue || 0)}
                                fullValue={formatCurrency(stats.totalRevenue || 0)}
                                valueColor="#059669"
                                uppercaseTitle
                            />
                            <StatCard
                                title="Cartera Pendiente"
                                value={formatCompact(stats.collectionGap || 0)}
                                fullValue={formatCurrency(stats.collectionGap || 0)}
                                change={stats.collectionRate ? -(100 - stats.collectionRate) : 0}
                                uppercaseTitle
                            />
                            <StatCard
                                title="Dispositivos / Motos"
                                value={`${stats.activeDevices || 0} Activos`}
                                change={stats.pendingPayments > 0 ? `${stats.pendingPayments} en mora` : null}
                                changeType="negative"
                                uppercaseTitle
                            />
                        </div>
                    )}

                    {/* iOS Pagos Recientes Card */}
                    {/* Tarjeta KPI Ejecutiva: Salud Eléctrica de la Flota */}
                    <div 
                        className="fleet-electrical-card"
                        onClick={() => navigate('/devices')}
                        title="Ver lista de dispositivos en flota"
                    >
                        <div className="fleet-electrical-header">
                            <div className="fleet-electrical-title-wrap">
                                <div className="fleet-electrical-icon-badge">
                                    <BatteryCharging size={18} />
                                </div>
                                <div>
                                    <h3 className="fleet-electrical-title">Salud Eléctrica de la Flota</h3>
                                    <span className="fleet-electrical-subtitle">
                                        {electricalSummary.total > 0
                                            ? `${electricalSummary.healthy} de ${electricalSummary.total} motos con sistema eléctrico óptimo`
                                            : 'Monitoreo de baterías y alternadores en tiempo real'}
                                    </span>
                                </div>
                            </div>
                            <div className="fleet-electrical-score-wrap">
                                <span className="fleet-electrical-score">{electricalSummary.healthPercentage}%</span>
                                <span className="fleet-electrical-score-label">Salud General</span>
                            </div>
                        </div>

                        <div className="fleet-electrical-badges-row">
                            <button 
                                type="button"
                                className="fleet-pill-filter pill-healthy"
                                onClick={(e) => { e.stopPropagation(); navigate('/devices?filter=all'); }}
                                title="Ver todas las motos operando normal"
                            >
                                <span className="pill-dot"></span>
                                <strong>{electricalSummary.healthy}</strong> Sanas
                            </button>

                            {(electricalSummary.damaged > 0 || electricalSummary.weak > 0) && (
                                <button 
                                    type="button"
                                    className="fleet-pill-filter pill-warning"
                                    onClick={(e) => { e.stopPropagation(); navigate('/devices?filter=battery_issue'); }}
                                    title="Filtrar motos con batería baja o dañada"
                                >
                                    <span className="pill-dot"></span>
                                    <strong>{electricalSummary.damaged + electricalSummary.weak}</strong> Batería Baja/Falla
                                </button>
                            )}

                            {(electricalSummary.overvoltage > 0 || electricalSummary.noCharge > 0) && (
                                <button 
                                    type="button"
                                    className="fleet-pill-filter pill-danger"
                                    onClick={(e) => { e.stopPropagation(); navigate('/devices?filter=alt_issue'); }}
                                    title="Filtrar motos con falla en alternador o regulador"
                                >
                                    <Zap size={12} className="inline mr-1" />
                                    <strong>{electricalSummary.overvoltage + electricalSummary.noCharge}</strong> Alternador/Carga
                                </button>
                            )}

                            <span className="fleet-electrical-cta">
                                Ver dispositivos →
                            </span>
                        </div>
                    </div>
                    <div className="table-card-ios">
                        <div className="table-header-ios">
                            <h2>{t('dashboard.recentPayments.title', 'Pagos Recientes')}</h2>
                            <a href="#/payments" className="view-all-ios">
                                <span>{t('dashboard.recentPayments.viewAll', 'Ver Todos')}</span>
                                <span style={{ fontSize: '16px', lineHeight: 1 }}>→</span>
                            </a>
                        </div>

                        {/* Table Header Band */}
                        <div className="table-header-band-ios">
                            <span className="text-left">{t('dashboard.recentPayments.table.device', 'Dispositivo')}</span>
                            <span className="text-right">{t('dashboard.recentPayments.table.amount', 'Monto')}</span>
                            <span className="text-center">{t('dashboard.recentPayments.table.status', 'Estado')}</span>
                            <span className="text-right">{t('dashboard.recentPayments.table.date', 'Fecha')}</span>
                        </div>

                        {/* List of Transactions */}
                        <div className="table-rows-container">
                            {recentPayments.length > 0 ? (
                                recentPayments.map((payment, index) => (
                                    <div key={payment.id || index} className="table-row-ios">
                                        <span className="device-cell text-left">{payment.device}</span>
                                        <span className="amount-cell text-right">${payment.amount?.toLocaleString()}</span>
                                        <div className="status-cell text-center flex justify-center">
                                            <StatusBadge status={payment.status} />
                                        </div>
                                        <span className="date-cell text-right">{payment.date}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="no-data-cell text-center">
                                    {t('dashboard.recentPayments.noPayments', 'No hay pagos recientes')}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AdminDashboard;
