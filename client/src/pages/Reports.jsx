import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { getDailyReconciliationReport, toggleReconciliation } from '../services/api';
import { Calendar, Download, RefreshCw, FileText, ListFilter, Check, X } from 'lucide-react';
import './Reports.css';

const Reports = () => {
    const { t } = useTranslation();
    const today = new Date();
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [year, setYear] = useState(today.getFullYear());
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [portalElement, setPortalElement] = useState(null);
    const [reconciledDates, setReconciledDates] = useState({});
    const [activePromptDate, setActivePromptDate] = useState(null);
    const [tempTxId, setTempTxId] = useState('');

    const toggleReconciled = async (date, nextState, transactionId) => {
        const currentlyReconciled = reconciledDates[date]?.reconciled || reconciledDates[date] === true;
        // Optimistic UI update
        setReconciledDates(prev => ({
            ...prev,
            [date]: { reconciled: nextState, transactionId }
        }));

        try {
            await toggleReconciliation(date, nextState, transactionId);
        } catch (error) {
            console.error('Failed to toggle reconciliation:', error);
            // Revert state on error
            setReconciledDates(prev => ({
                ...prev,
                [date]: {
                    reconciled: currentlyReconciled,
                    transactionId: prev[date]?.transactionId || ''
                }
            }));
            alert('Error updating reconciliation status');
        }
    };

    const handleToggleClick = (date) => {
        const currentlyReconciled = reconciledDates[date]?.reconciled || reconciledDates[date] === true;
        if (currentlyReconciled) {
            toggleReconciled(date, false, '');
        } else {
            setTempTxId('');
            setActivePromptDate(date);
        }
    };

    const handlePromptSubmit = (date) => {
        toggleReconciled(date, true, tempTxId.trim());
        setActivePromptDate(null);
    };

    useEffect(() => {
        setPortalElement(document.getElementById('mobile-header-actions'));
    }, []);

    useEffect(() => {
        loadReport();
    }, [month, year]);

    const loadReport = async () => {
        setLoading(true);
        try {
            const res = await getDailyReconciliationReport(month, year);
            if (res.success) {
                setReportData(res.data);
                if (res.reconciledDates) {
                    setReconciledDates(res.reconciledDates);
                }
            } else {
                console.error('Failed to load report:', res.error);
                alert('Error loading report');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value || 0);
    };

    const formatPercentage = (value) => {
        return (value || 0).toFixed(5);
    };

    const formatCompact = (value) => {
        if (value === undefined || value === null) return '$0';
        if (value >= 1000000) {
            const val = value / 1000000;
            return `$${val % 1 === 0 ? val : val.toFixed(1)}M`;
        }
        if (value >= 1000) {
            const val = value / 1000;
            return `$${val % 1 === 0 ? val : val.toFixed(0)}k`;
        }
        return `$${value}`;
    };

    const totalPayments = reportData.reduce((acc, row) => acc + (row.payments || 0), 0);
    const totalCommission = reportData.reduce((acc, row) => acc + (row.commission || 0), 0);
    const totalBancolombia = reportData.reduce((acc, row) => acc + (row.bancolombia || 0), 0);

    const activeRow = reportData.find(row => row.date === activePromptDate);
    const activeAmount = activeRow ? activeRow.bancolombia : 0;
    const activeFormattedDate = activePromptDate ? activePromptDate.split('-').reverse().join('/') : '';

    return (
        <div className="reports-page">
            {portalElement && createPortal(
                <button
                    type="button"
                    className={`p-2 rounded-full transition-colors flex items-center justify-center ${showFilters ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                    onClick={() => setShowFilters(!showFilters)}
                    id="filterToggle"
                    style={{ border: 'none', background: 'none', padding: '8px' }}
                >
                    <ListFilter size={20} />
                </button>,
                portalElement
            )}

            <div className="reports-header">
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '24px', color: '#1e293b', margin: 0 }}>
                        <FileText size={28} color="#2563eb" />
                        Reconciliation Report
                    </h1>
                </div>

                {/* Desktop controls */}
                <div className="reports-header-actions desktop-only-flex">
                    <select
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', color: '#1e293b' }}
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                            <option key={`m-${m}`} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
                        ))}
                    </select>

                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', color: '#1e293b' }}
                    >
                        {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
                            <option key={`y-${y}`} value={y}>{y}</option>
                        ))}
                    </select>

                    <button onClick={loadReport} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', color: '#1e293b', cursor: 'pointer' }}>
                        <RefreshCw size={16} /> <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Mobile collapsible controls */}
            <div className={`collapsible-content max-w-[380px] mx-auto md:hidden ${showFilters ? 'expanded' : ''}`} id="filterSection" style={{ marginBottom: '.5rem' }}>
                <div className="reports-header-actions">
                    <select
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', color: '#1e293b', width: '100%' }}
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                            <option key={`m-${m}`} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
                        ))}
                    </select>

                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', color: '#1e293b', width: '100%' }}
                    >
                        {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
                            <option key={`y-${y}`} value={y}>{y}</option>
                        ))}
                    </select>

                    <button onClick={loadReport} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', color: '#1e293b', cursor: 'pointer' }}>
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

             {/* Summary Cards */}
            <div className="reports-summary-cards">
                <div className="report-card payments">
                    <h3 className="report-card-title">{t('reports.totalPayments')}</h3>
                    <div className="report-card-value">
                        <span className="desktop-only">{formatCurrency(totalPayments)}</span>
                        <span className="mobile-only">{formatCompact(totalPayments)}</span>
                    </div>
                </div>
                <div className="report-card commission">
                    <h3 className="report-card-title">{t('reports.commission')}</h3>
                    <div className="report-card-value">
                        <span className="desktop-only">{formatCurrency(totalCommission)}</span>
                        <span className="mobile-only">{formatCompact(totalCommission)}</span>
                    </div>
                </div>
                <div className="report-card bancolombia">
                    <h3 className="report-card-title">{t('reports.bancolombia')}</h3>
                    <div className="report-card-value">
                        <span className="desktop-only">{formatCurrency(totalBancolombia)}</span>
                        <span className="mobile-only">{formatCompact(totalBancolombia)}</span>
                    </div>
                </div>
            </div>

            {/* Excel-like Data Table */}
            <div className="reports-table-container">
                {loading ? (
                    <div className="reports-loading">Loading report data...</div>
                ) : (
                    <table className="reports-table">
                        <thead className="reports-thead">
                            <tr>
                                <th className="reports-th text-left">Fecha</th>
                                {/*<th className="reports-th text-center">Day</th>*/}
                                <th className="reports-th">Payments</th>
                                <th className="reports-th">Bancolombia</th>
                                <th className="reports-th col-commission">Commission</th>
                                <th className="reports-th">Transactions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.map((row, index) => {
                                const isReconciled = reconciledDates[row.date]?.reconciled || reconciledDates[row.date] === true;
                                const transactionId = reconciledDates[row.date]?.transactionId || '';
                                return (
                                    <tr key={row.date} className={`reports-tr ${index % 2 === 0 ? 'even' : 'odd'}`}>
                                        <td className="reports-td col-date">
                                            {row.date.split('-').reverse().join('/')}
                                        </td>
                                        {/*<td className="reports-td text-center">
                                                {row.day}
                                            </td>*/}
                                        <td className="reports-td col-payments">
                                            {formatCurrency(row.payments)}
                                        </td>
                                        <td className="reports-td col-bancolombia">
                                            <div className="bancolombia-cell-content">
                                                <div className="bancolombia-amount-wrapper">
                                                    <span>{formatCurrency(row.bancolombia)}</span>
                                                    {transactionId && (
                                                        <div className="bancolombia-tx-id">
                                                            {transactionId}
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleToggleClick(row.date)}
                                                    className="bancolombia-reconcile-btn"
                                                    title={isReconciled ? "Reconciliado" : "Marcar como reconciliado"}
                                                >
                                                    <Check
                                                        size={16}
                                                        color={isReconciled ? '#10b981' : '#cbd5e1'}
                                                        strokeWidth={isReconciled ? 3 : 2}
                                                    />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="reports-td col-commission">
                                            {row.commission === 0 ? '-' : formatCurrency(row.commission)}
                                        </td>
                                        <td className="reports-td col-transactions">
                                            {row.transactions}
                                        </td>
                                    </tr>
                                );
                            })}
                            {reportData.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="reports-loading">No data available for this month.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {activePromptDate && createPortal(
                <div className="reconcile-backdrop" onClick={() => setActivePromptDate(null)}>
                    <div className="reconcile-popover" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setActivePromptDate(null)}
                            className="reconcile-popover-close"
                            title="Cancelar"
                        >
                            <X size={16} />
                        </button>
                        <div className="reconcile-popover-header">
                            <span className="reconcile-popover-title">
                                ID Transacción <span className="reconcile-popover-meta">{activeFormattedDate} • {formatCurrency(activeAmount)}</span>
                            </span>
                        </div>
                        <input
                            type="text"
                            placeholder="Digite el ID..."
                            value={tempTxId}
                            onChange={(e) => setTempTxId(e.target.value)}
                            className="reconcile-popover-input"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handlePromptSubmit(activePromptDate);
                                if (e.key === 'Escape') setActivePromptDate(null);
                            }}
                        />
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Reports;
