import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
    DollarSign, FileText, CreditCard, Users,
    TrendingUp, TrendingDown, Download, ListFilter
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

    const StatCard = ({ title, value, change, icon: Icon, color, className }) => {
        const formatChange = (val) => {
            const num = Math.abs(val);
            return Number.isInteger(num) ? num : num.toFixed(1);
        };

        return (
            <div className={`stat-card ${className || ''}`}>
                <div className="stat-icon" style={{ background: color }}>
                    <Icon size={18} />
                </div>
                <div className="stat-content">
                    <h3>{title}</h3>
                    <div className="stat-value-container">
                        <span className="stat-value">{value}</span>
                        {change !== undefined && change !== 0 && (
                            <span className={`stat-change-inline ${change > 0 ? 'positive' : 'negative'}`}>
                                {change > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
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
            <div className="dashboard-content">
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
        <div className="dashboard-content">
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

            <div className="dashboard-header">
                <div>
                    <h1>{t('dashboard.title')}</h1>
                </div>
                {/* Desktop controls */}
                <div className="dashboard-controls hidden md:flex">
                    <select
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        className="select-control"
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
                        className="select-control"
                    >
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                        <option value={2027}>2027</option>
                    </select>
                    <button className="btn-download" onClick={handleDownloadReport} title={t('dashboard.downloadReport')}>
                        <Download size={18} className="download-icon" /> Descargar Reporte
                    </button>
                </div>
            </div>

            {/* Mobile collapsible controls & stats */}
            <div className={`collapsible-content max-w-[380px] mx-auto md:hidden ${showFilters ? 'expanded' : ''}`} id="filterSection" >
                <div className=" dashboard-controls">
                    <select
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        className="select-control"
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
                        className="select-control"
                    >
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                        <option value={2027}>2027</option>
                    </select>
                    <button className="btn-download" onClick={handleDownloadReport} title={t('dashboard.downloadReport')}>
                        <Download size={18} className="download-icon" />
                        <span className="download-text-desktop">📊 {t('dashboard.downloadReport')}</span>
                    </button>
                </div>

                {/* Mobile Collapsible Stats Cards inside the collapsible wrapper */}
                <div className="stats-grid-mobile-collapsible" style={{ marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                    <StatCard
                        title={t('dashboard.stats.totalRevenue')}
                        value={formatCompact(stats.totalRevenue)}
                        change={stats.changes?.totalRevenue || 0}
                        icon={DollarSign}
                        color="var(--brand-teal)"
                    />
                    <StatCard
                        title={t('dashboard.stats.activeDevices', 'Active Devices')}
                        value={stats.activeDevices || 0}
                        change={stats.changes?.activeDevices || 0}
                        icon={Users}
                        color="#FB9678"
                    />
                    <StatCard
                        title={t('dashboard.stats.pendingPayments')}
                        value={stats.pendingPayments}
                        change={stats.changes?.pendingPayments || 0}
                        icon={CreditCard}
                        color="#00C292"
                    />
                </div>
            </div>

            {/* Mobile Permanent Stats Cards (always visible on mobile, hidden on desktop) */}
            <div className="stats-grid-mobile-permanent md:hidden">
                <StatCard
                    title="Facturado (año)"
                    value={formatCompact(stats.totalInvoiced || 0)}
                    change={0}
                    icon={FileText}
                    color="#7460EE"
                />
                <StatCard
                    title="Cartera Pendiente"
                    value={formatCompact(stats.collectionGap || 0)}
                    change={stats.collectionRate ? -(100 - stats.collectionRate) : 0}
                    icon={TrendingDown}
                    color="#EF4444"
                />
            </div>

            {/* Desktop Stats Cards (always visible on desktop, hidden on mobile) */}
            <div className="stats-grid hidden md:grid">
                <StatCard
                    title={t('dashboard.stats.totalRevenue')}
                    value={`$${(stats.totalRevenue || 0).toLocaleString()}`}
                    change={stats.changes?.totalRevenue || 0}
                    icon={DollarSign}
                    color="var(--brand-teal)"
                />
                <StatCard
                    title={t('dashboard.stats.activeDevices', 'Active Devices')}
                    value={stats.activeDevices || 0}
                    change={stats.changes?.activeDevices || 0}
                    icon={Users}
                    color="#FB9678"
                />
                <StatCard
                    title={t('dashboard.stats.pendingPayments')}
                    value={stats.pendingPayments}
                    change={stats.changes?.pendingPayments || 0}
                    icon={CreditCard}
                    color="#00C292"
                />
                <StatCard
                    title="Facturado (año)"
                    value={`$${(stats.totalInvoiced || 0).toLocaleString()}`}
                    change={0}
                    icon={FileText}
                    color="#7460EE"
                />
                <StatCard
                    title="Cartera Pendiente"
                    value={`$${(stats.collectionGap || 0).toLocaleString()}`}
                    change={stats.collectionRate ? -(100 - stats.collectionRate) : 0}
                    icon={TrendingDown}
                    color="#EF4444"
                />
            </div>
            {/*
          
            <div className="charts-grid">
                
                <div className="chart-card revenue-chart">
                    <div className="chart-header">
                        <h3>{t('dashboard.charts.revenue')}</h3>
                        <select className="chart-filter">
                            <option>{t('dashboard.charts.last6Months')}</option>
                            <option>{t('dashboard.charts.lastYear')}</option>
                        </select>
                    </div>
                    {
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={revenueData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--brand-teal)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--brand-teal)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                <XAxis dataKey="month" stroke="#666" />
                                <YAxis stroke="#666" />
                                <Tooltip />
                                <Area type="monotone" dataKey="revenue" stroke="var(--brand-teal)"
                                    fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    }
                </div>

               
                <div className="chart-card">
                    <h3>{t('dashboard.charts.deviceStatus')}</h3>
                    {
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={deviceData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    dataKey="value"
                                    label
                                >
                                    {deviceData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    }
                </div>
            </div>

    */}
            <div className="table-card">
                <div className="table-header">
                    <h3>{t('dashboard.recentPayments.title')}</h3>
                    <a href="#/payments" className="view-all">{t('dashboard.recentPayments.viewAll')} →</a>
                </div>
                <table className="payments-table">
                    <thead>
                        <tr>
                            <th>{t('dashboard.recentPayments.table.device')}</th>
                            <th>{t('dashboard.recentPayments.table.amount')}</th>
                            <th>{t('dashboard.recentPayments.table.status')}</th>
                            <th>{t('dashboard.recentPayments.table.date')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recentPayments.length > 0 ? (
                            recentPayments.map(payment => (
                                <tr key={payment.id}>
                                    <td><strong>{payment.device}</strong></td>
                                    <td>${payment.amount.toLocaleString()}</td>
                                    <td>
                                        <span className={`status-badge ${(payment.status || 'unknown').toLowerCase()}`}>
                                            {payment.status || 'Unknown'}
                                        </span>
                                    </td>
                                    <td>{payment.date}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#9CA3AF' }}>
                                    {t('dashboard.recentPayments.noPayments')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminDashboard;
