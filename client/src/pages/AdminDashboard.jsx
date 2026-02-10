import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
    DollarSign, FileText, CreditCard, Users,
    TrendingUp, TrendingDown
} from 'lucide-react';
// Recharts import removed due to crash issues
// import {
//     AreaChart, Area, PieChart, Pie, Cell,
//     XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
// } from 'recharts';
import { getDashboardStats } from '../services/api';
import './AdminDashboard.css';

const AdminDashboard = () => {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [stats, setStats] = useState({
        totalRevenue: 0,
        activeContracts: 0,
        pendingPayments: 0,
        totalDevices: 0
    });
    const [revenueData, setRevenueData] = useState([]);
    const [deviceData, setDeviceData] = useState([]);
    const [recentPayments, setRecentPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const result = await getDashboardStats();

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

    const StatCard = ({ title, value, change, icon: Icon, color }) => (
        <div className="stat-card">
            <div className="stat-icon" style={{ background: color }}>
                <Icon size={24} />
            </div>
            <div className="stat-content">
                <h3>{title}</h3>
                <div className="stat-value">{value}</div>
                {change !== undefined && change !== 0 && (
                    <div className={`stat-change ${change > 0 ? 'positive' : 'negative'}`}>
                        {change > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        {Math.abs(change)}%
                    </div>
                )}
            </div>
        </div>
    );

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

    return (
        <div className="dashboard-content">
            <div className="dashboard-header">
                <div>
                    <h1>{t('dashboard.title')}</h1>
                    <p>{t('dashboard.welcome', { name: user?.name || 'Admin' })}</p>
                </div>
                <button className="btn-download">📊 {t('dashboard.downloadReport')}</button>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <StatCard
                    title={t('dashboard.stats.totalRevenue')}
                    value={`$${(stats.totalRevenue / 100).toLocaleString()}`}
                    change={12.5}
                    icon={DollarSign}
                    color="#03C9D7"
                />
                <StatCard
                    title={t('dashboard.stats.activeContracts')}
                    value={stats.activeContracts}
                    change={5.2}
                    icon={FileText}
                    color="#FB9678"
                />
                <StatCard
                    title={t('dashboard.stats.pendingPayments')}
                    value={stats.pendingPayments}
                    change={-2.1}
                    icon={CreditCard}
                    color="#00C292"
                />
                <StatCard
                    title={t('dashboard.stats.totalDevices')}
                    value={stats.totalDevices}
                    change={0}
                    icon={Users}
                    color="#7460EE"
                />
            </div>

            {/* Charts Section */}
            <div className="charts-grid">
                {/* Revenue Chart */}
                <div className="chart-card revenue-chart">
                    <div className="chart-header">
                        <h3>{t('dashboard.charts.revenue')}</h3>
                        <select className="chart-filter">
                            <option>{t('dashboard.charts.last6Months')}</option>
                            <option>{t('dashboard.charts.lastYear')}</option>
                        </select>
                    </div>
                    {/* 
            <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueData}>
                    <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#03C9D7" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#03C9D7" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="month" stroke="#666" />
                    <YAxis stroke="#666" />
                    <Tooltip />
                    <Area type="monotone" dataKey="revenue" stroke="#03C9D7"
                        fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
            </ResponsiveContainer>
            */}
                </div>

                {/* Device Status */}
                <div className="chart-card">
                    <h3>{t('dashboard.charts.deviceStatus')}</h3>
                    {/* 
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
            */}
                </div>
            </div>

            {/* Recent Payments Table */}
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
                                    <td>${(payment.amount / 100).toLocaleString()} COP</td>
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
