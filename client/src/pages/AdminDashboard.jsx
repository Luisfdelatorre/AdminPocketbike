import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
    DollarSign, FileText, CreditCard, Users,
    TrendingUp, TrendingDown, Download, ListFilter, BarChart2
} from 'lucide-react';
// Recharts import removed due to crash issues
import {
    AreaChart, Area, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { getDashboardStats } from '../services/api';
import './AdminDashboard.css';

const AdminDashboard = () => {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [stats, setStats] = useState({
        totalRevenue: 0,
        activeDevices: 0,
        pendingPayments: 0,
        totalDevices: 0,
        totalInvoiced: 0,
        collectionGap: 0,
        collectionRate: 100
    });
    const [revenueData, setRevenueData] = useState([]);
    const [deviceData, setDeviceData] = useState([]);
    const [recentPayments, setRecentPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(''); // '' = all year
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [showFilters, setShowFilters] = useState(false);
    const [portalElement, setPortalElement] = useState(null);

    useEffect(() => {
        fetchDashboardData();
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        setPortalElement(document.getElementById('mobile-header-actions'));
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const params = { year: selectedYear };
            if (selectedMonth) params.month = selectedMonth;
            const result = await getDashboardStats(params);

            if (result.success) {
                setStats(result.data.stats);
                setRevenueData(result.data.revenueData);
                setDeviceData(result.data.deviceData);
                setRecentPayments(result.data.recentPayments);
            } else {
                console.error('Failed to fetch dashboard data:', result.error);
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
        csvRows.push(['Facturado (ano)', stats.totalInvoiced || 0]);
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

    return (
        <div className="dashboard-content ios-dashboard">
            {portalElement && createPortal(
                <button
                    type="button"
                    className={`p-2 rounded-full transition-colors flex items-center justify-center ${showFilters ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                    onClick={() => setShowFilters(!showFilters)}
                    id="filterToggle"
                >
                    <ListFilter size={20} />
                </button>,
                portalElement
            )}
            {/* Expandable Metrics Section */}
            <div className={`expandable-metrics-container ${showFilters ? 'expanded' : 'collapsed'}`}>

                {/* Header Controls Bar */}
                <div className="dashboard-controls-row">
                    <div className="select-wrapper-month">
                        <select
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="select-control-ios"
                        >
                            <option value="">Todo el año</option>
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>
                                    {new Date(0, i).toLocaleString('es-ES', { month: 'long' })}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="select-wrapper-year">
                        <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(Number(e.target.value))}
                            className="select-control-ios"
                        >
                            <option value={2025}>2025</option>
                            <option value={2026}>2026</option>
                            <option value={2027}>2027</option>
                        </select>
                    </div>
                    <button
                        type="button"
                        className="btn-icon-ios btn-ios-grey"
                        onClick={handleDownloadReport}
                        title={t('dashboard.downloadReport')}
                    >
                        <Download size={20} />
                    </button>
                </div>


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
                    title="Facturado (año)"
                    value={formatCompact(stats.totalInvoiced || 0)}
                />
                <StatCard
                    title="Cartera Pendiente"
                    value={formatCompact(stats.collectionGap || 0)}
                    change={stats.collectionRate ? -(100 - stats.collectionRate) : 0}
                />
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
                                    <span className={`status-badge-ios ${(payment.status || 'unknown').toLowerCase()}`}>
                                        {payment.status || 'Unknown'}
                                    </span>
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


