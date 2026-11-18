import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Download, TrendingUp, TrendingDown, DollarSign, Zap, BatteryCharging, AlertTriangle } from 'lucide-react';
import { getDashboardStats, getAllDevices } from '../services/api';
import PageHeader from '../components/PageHeader';
import MonthYearSelector from '../components/MonthYearSelector';
import StatCard from '../components/StatCard';
import useIsMobile from '../hooks/useIsMobile';
import StatusBadge from '../components/StatusBadge';
import { calculateFleetElectricalSummary } from '../utils/batteryHealthHelper';
import './AdminDashboard.css';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const [stats, setStats] = useState({
        totalRevenue: 0,
        activeDevices: 0,
        pendingPayments: 0,
        totalDevices: 0,
        totalInvoiced: 0,
        collectionGap: 0,
        collectionRate: 100
    });
    const [electricalSummary, setElectricalSummary] = useState({
        total: 0,
        healthy: 0,
        weak: 0,
        damaged: 0,
        powerCut: 0,
        overvoltage: 0,
        noCharge: 0,
        weakCharge: 0,
        healthPercentage: 100
    });
    const [revenueData, setRevenueData] = useState([]);
    const [deviceData, setDeviceData] = useState([]);
    const [recentPayments, setRecentPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [initialLoading, setInitialLoading] = useState(true);

    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // Mes en curso por defecto
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        const params = { year: selectedYear };
        if (selectedMonth) params.month = selectedMonth;

        Promise.all([
            getDashboardStats(params),
            getAllDevices().catch(() => ({ success: false, devices: [] }))
        ])
            .then(([dashResult, devResult]) => {
                if (!isMounted) return;
                if (dashResult.success) {
                    setStats(dashResult.data.stats || {});
                    setRevenueData(dashResult.data.revenueData || []);
                    setDeviceData(dashResult.data.deviceData || []);
                    setRecentPayments(dashResult.data.recentPayments || []);
                } else {
                    console.error('Failed to fetch dashboard data:', dashResult.error);
                }
                if (devResult.success && devResult.devices) {
                    setElectricalSummary(calculateFleetElectricalSummary(devResult.devices));
                }
            })
            .catch(error => {
                if (isMounted) console.error('Error fetching dashboard data:', error);
            })
            .finally(() => {
                if (isMounted) {
                    setLoading(false);
                    setInitialLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [selectedMonth, selectedYear]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const params = { year: selectedYear };
            if (selectedMonth) params.month = selectedMonth;
            const [dashResult, devResult] = await Promise.all([
                getDashboardStats(params),
                getAllDevices().catch(() => ({ success: false, devices: [] }))
            ]);

            if (dashResult.success) {
                setStats(dashResult.data.stats || {});
                setRevenueData(dashResult.data.revenueData || []);
                setDeviceData(dashResult.data.deviceData || []);
                setRecentPayments(dashResult.data.recentPayments || []);
            } else {
                console.error('Failed to fetch dashboard data:', dashResult.error);
            }
            if (devResult.success && devResult.devices) {
                setElectricalSummary(calculateFleetElectricalSummary(devResult.devices));
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
            setInitialLoading(false);
        }
    };

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

    const desktopHeader = (
        <PageHeader.Desktop
            title={t('dashboard.title', 'Dashboard')}
            onRefresh={fetchDashboardData}
            loading={loading}
            refreshText="Actualizar"
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
