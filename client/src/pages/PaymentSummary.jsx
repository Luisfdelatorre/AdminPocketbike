import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

import { getPaymentSummary } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './PaymentSummary.css';
import MotorIcon from '../components/MotorIcon';

// Helper to format currency
// Helper to format currency
const formatCurrency = (amount) => {
    if (!amount) return '-';
    if (amount >= 1000) {
        return `$${(amount / 1000).toFixed(0)}k`;
    }
    return `$${amount}`;
};

const PaymentSummary = () => {
    // Token is handled by api interceptor
    const { } = useAuth(); // Removed token from destructuring
    const [loading, setLoading] = useState(false);
    const [summaryData, setSummaryData] = useState([]);
    const tableContainerRef = useRef(null);

    // Default to current month/year
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1-12
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());

    // Generate days 1..31 based on month
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

    // Find maximum day with data
    const maxDay = summaryData.length > 0
        ? Math.max(...summaryData.map(item => {
            const days = Object.keys(item.days).map(Number);
            return days.length > 0 ? Math.max(...days) : 0;
        }))
        : daysInMonth; // Fallback to full month if no data or initial load

    // Use maxDay for the grid, but ensure it doesn't exceed daysInMonth (sanity check)
    const displayDays = Math.min(Math.max(maxDay, 1), daysInMonth);
    const daysArray = Array.from({ length: displayDays }, (_, i) => i + 1);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Using the new endpoint
            const response = await getPaymentSummary({
                month: selectedMonth,
                year: selectedYear
            });

            if (response.success && Array.isArray(response.data)) {
                setSummaryData(response.data);
            }
        } catch (error) {
            console.error("Error fetching summary:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedMonth, selectedYear]);

    // Auto-scroll to the end (current day) after data loads
    useEffect(() => {
        if (!loading && summaryData.length > 0 && tableContainerRef.current) {
            // Scroll to the right end of the table
            tableContainerRef.current.scrollLeft = tableContainerRef.current.scrollWidth;
        }
    }, [loading, summaryData]);

    return (
        <div className="payment-summary-container">
            <div className="summary-header">
                <h1>Estatus de Pagos</h1>

                <div className="controls">
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="select-control"
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                                {new Date(0, i).toLocaleString('es-ES', { month: 'long' })}
                            </option>
                        ))}
                    </select>

                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="select-control"
                    >
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                        <option value={2027}>2027</option>
                    </select>

                    <button
                        className={`select-control refresh-btn ${loading ? 'spinning' : ''}`}
                        onClick={fetchData}
                        disabled={loading}
                        title="Actualizar datos"
                    >
                        <RefreshCw size={20} />
                    </button>
                </div>
            </div>

            <div className="matrix-container" ref={tableContainerRef}>
                <table className="summary-table">
                    <thead>
                        <tr>
                            <th>DISPOSITIVO</th>
                            <th>Deuda</th>
                            {daysArray.map(day => (
                                <th key={day}>{String(day).padStart(2, '0')}</th>
                            ))}
                            <th key={"day" + 1}>--</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={daysInMonth + 1}>Cargando...</td></tr>
                        ) :


                            summaryData.map((item) => (
                                <tr key={item.device.deviceId}>
                                    <td>
                                        <div className="device-cell">
                                            <span className="device-name">{item.device.name}</span>
                                            <span className="driver-name">{item.device.driverName || 'Sin Conductor'}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="device-cell">
                                            {item.device.unpaidTotal > 0 ? (
                                                <span className="debt-badge">
                                                    {formatCurrency(item.device.unpaidTotal)}
                                                </span>
                                            ) : (
                                                <span className="no-debt">✓</span>
                                            )}
                                        </div>
                                    </td>
                                    {daysArray.map(day => {
                                        const dayData = item.days[day];
                                        let cellClass = 'status-cell empty';
                                        let content = '--';
                                        content = formatCurrency(dayData?.totalPaid);
                                        if (dayData) {
                                            console.log(dayData);

                                            if (dayData.dayType === 'LOAN') {
                                                cellClass = 'status-cell loand';
                                                content = '--';
                                            } else if (dayData.dayType === 'PAID') {
                                                cellClass = 'status-cell approved';
                                                content = dayData?.totalPaid > 0 ? formatCurrency(dayData?.totalPaid) : '✓';
                                            } else if (dayData.dayType === 'FREE') {
                                                cellClass = 'status-cell free';
                                                content = dayData?.totalPaid > 0 ? formatCurrency(dayData?.totalPaid) : '✓';
                                            } else {
                                                cellClass = 'status-cell pending';
                                            }

                                            if (dayData.cutOff) {
                                                content = (
                                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <span>{content}</span>
                                                        <div style={{ position: 'absolute', top: '-8px', right: '-18px' }}>
                                                            <MotorIcon color="#ef4444" size={14} />
                                                        </div>
                                                    </div>
                                                );
                                            }
                                        }

                                        return (
                                            <td key={day}>
                                                <div className={cellClass}>
                                                    {content}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))


                        }
                    </tbody>
                </table>
            </div>

            <div className="legend">
                <div className="legend-item">
                    <div className="indicator" style={{ background: '#22c55e' }}></div>
                    <span>Pagado</span>
                </div>
                <div className="legend-item">
                    <div className="indicator" style={{ background: '#ef4444' }}></div>
                    <span>Corte / Apagado</span>
                </div>
                <div className="legend-item">
                    <div className="indicator" style={{ background: '#f59e0b' }}></div>
                    <span>Pase Provisional</span>
                </div>
                <div className="legend-item">
                    <div className="indicator" style={{ background: '#fca5a5' }}></div>
                    <span>Pendiente / Alerta</span>
                </div>
                <div className="legend-item">
                    <div className="indicator" style={{ background: '#f1f5f9' }}></div>
                    <span>Sin registro</span>
                </div>
            </div>
        </div>
    );
};

export default PaymentSummary;
