import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
    DollarSign, FileText, CreditCard, Users,
    TrendingUp, TrendingDown, Download, ListFilter, BarChart2,
    Zap, BatteryCharging, AlertTriangle
} from 'lucide-react';
import { getDashboardStats, getAllDevices } from '../services/api';
import PageHeader from '../components/PageHeader';
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

    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // Mes en curso por defecto
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [showFilters, setShowFilters] = useState(false);

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
                    setStats(dashResult.data.stats);
                    setRevenueData(dashResult.data.revenueData || []);
                    setDeviceData(dashResult.data.deviceData || []);
                    setRecentPayments(dashResult.data.recentPayments || []);
                }
                if (devResult.success && devResult.devices) {
                    setElectricalSummary(calculateFleetElectricalSummary(devResult.devices));
                }
            })
            .catch(error => {
                if (isMounted) console.error('Error fetching dashboard data:', error);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
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
                setStats(dashResult.data.stats);
                setRevenueData(dashResult.data.revenueData || []);
                setDeviceData(dashResult.data.deviceData || []);
                setRecentPayments(dashResult.data.recentPayments || []);
            }
            if (devResult.success && devResult.devices) {
                setElectricalSummary(calculateFleetElectricalSummary(devResult.devices));
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const StatCard = ({ title, value, change, uppercaseTitle, valueColor, className }) => {
        const formatChange = (val) => {
            const num = Math.abs(val);
            return Number.isInteger(num) ? num : num.toFixed(1);
        };

        return (
            <div className={`stat-card-ios ${className || ''}`}>
                <div className="stat-content-ios">
                    <h3 className={uppercaseTitle ? 'uppercase-title-ios' : ''}>{title}</h3>
                    <div className="stat-value-container-ios">
                        <span className="stat-value-ios" style={valueColor ? { color: valueColor } : {}}>{value}</span>
                        {change !== undefined && change !== 0 && (
                            <span className={`stat-change-inline-ios ${change > 0 ? 'positive' : 'negative'}`}>
                                {change > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                                {formatChange(change)}%
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="dashboard-content ios-dashboard">
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>{t('dashboard.loading')}</p>
                </div>
            </div>
        );
    }

    const formatCompact = (value) => {
        if (!value) return '$0';
        if (value >= 1000000) {
            return `$${Math.round(value / 1000000)}M`;
        }
        if (value >= 1000) {
            return `$${Math.round(value / 1000)}k`;
        }
        return `$${value}`;
    };

    const handleDownloadReport = () => {
        const period = selectedMonth ? `${selectedMonth}-${selectedYear}` : `${selectedYear}`;
        const csvRows = [];

        // 1. Stats Section
        csvRows.push(['RESUMEN DEL PERIODO', period]);
        csvRows.push(['']);
        csvRows.push(['Metrica', 'Valor (COP/Cantidad)']);
        csvRows.push(['Ingresos Totales', stats.totalRevenue || 0]);
        csvRows.push(['Dispositivos Activos', stats.activeDevices || 0]);
        csvRows.push(['Pagos Pendientes', stats.pendingPayments || 0]);
        csvRows.push([selectedMonth ? 'Facturado (mes)' : 'Facturado (ano)', stats.totalInvoiced || 0]);
        csvRows.push(['Cartera Pendiente', stats.collectionGap || 0]);
        csvRows.push(['']);

        // 2. Recent Payments Section
        csvRows.push(['PAGOS RECIENTES']);
        csvRows.push(['']);
        csvRows.push(['Dispositivo', 'Monto (COP)', 'Estado', 'Fecha']);

        if (recentPayments && recentPayments.length > 0) {
            recentPayments.forEach(p => {
                csvRows.push([p.device, p.amount, p.status, p.date]);
            });
        } else {
            csvRows.push(['No hay pagos recientes en este periodo']);
        }

        // Create CSV content (adding BOM for UTF-8 Excel compatibility)
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
            + csvRows.map(e => e.join(",")).join("\n");

        // Trigger download
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `reporte_pocketbike_${period}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderDateSelectors = (isMobileView = false) => (
        <div className={`date-selectors-group${isMobileView ? ' mobile-date-selectors' : ''}`}>
            <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="date-select-standard"
                aria-label="Seleccionar mes"
            >
                <option value="">Todo el año</option>
                {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                        {new Date(0, i).toLocaleString('es-ES', { month: 'long' })}
                    </option>
                ))}
            </select>

            <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="date-select-standard"
                aria-label="Seleccionar año"
            >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
            </select>
        </div>
    );

    const desktopHeader = (
        <PageHeader.Desktop
            title={t('dashboard.title', 'Dashboard')}
            onRefresh={fetchDashboardData}
            loading={loading}
            refreshText="Actualizar"
            leadingActions={renderDateSelectors(false)}
            actions={
                <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleDownloadReport}
                    title={t('dashboard.downloadReport')}
                >
                    <Download size={16} /> Exportar CSV
                </button>
            }
        />
    );

    const mobileHeader = (
        <>
            <PageHeader.Mobile
                onRefresh={fetchDashboardData}
                loading={loading}
                onFilterToggle={() => setShowFilters(prev => !prev)}
                showFilters={showFilters}
                actions={
                    <button
                        type="button"
                        className="btn-mobile-header-action"
                        onClick={handleDownloadReport}
                        title={t('dashboard.downloadReport')}
                    >
                        <Download size={18} />
                    </button>
                }
            />
            {/* Header Controls Bar (Mobile / Collapsible) */}
            <div className="dashboard-controls-row md:hidden">
                {renderDateSelectors(true)}
            </div>
        </>
    );

    const renderHeader = isMobile ? mobileHeader : desktopHeader;

    return (
        <div className="dashboard-content ios-dashboard">
            {renderHeader}

            {/* Expandable Metrics Section */}
            <div className={`expandable-metrics-container ${!isMobile || showFilters ? 'expanded' : 'collapsed'}`}>
                {/* Middle 3 Compact Stat Cards */}
                <div className="stats-grid-mid-3">
                    <StatCard
                        title="INGRESOS"
                        value={formatCompact(stats.totalRevenue)}
                        uppercaseTitle
                    />
                    <StatCard
                        title="DEVICES"
                        value={(stats.activeDevices || 0).toLocaleString()}
                        uppercaseTitle
                    />
                    <StatCard
                        title="PENDIENTES"
                        value={stats.pendingPayments || 0}
                        uppercaseTitle
                        valueColor="#FF9500"
                    />
                </div>
            </div>
            {/* Top 2 Primary Stat Cards */}
            <div className="stats-grid-top-2">
                <StatCard
                    title={selectedMonth ? "Facturado (mes)" : "Facturado (año)"}
                    value={formatCompact(stats.totalInvoiced || 0)}
                />
                <StatCard
                    title="Cartera Pendiente"
                    value={formatCompact(stats.collectionGap || 0)}
                    change={stats.collectionRate ? -(100 - stats.collectionRate) : 0}
                />
            </div>

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


            {/* iOS Pagos Recientes Card */}
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
                                <span className="amount-cell text-right">${payment.amount.toLocaleString()}</span>
                                <div className="status-cell text-center flex justify-center">
                                    <StatusBadge status={payment.status} />
                                </div>
                                <span className="date-cell text-right">{payment.date}</span>
                            </div>
                        ))
                    ) : (
                        <div className="no-data-cell text-center">
                            {t('dashboard.recentPayments.noPayments')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;


