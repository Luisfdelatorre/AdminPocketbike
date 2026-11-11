import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { getDailyReconciliationReport, toggleReconciliation, getAllCompanies } from '../services/api';
import { Calendar, Download, RefreshCw, FileText, Check, X, Copy } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SearchAndFilterBar from '../components/SearchAndFilterBar';
import StatCard from '../components/StatCard';
import useIsMobile from '../hooks/useIsMobile';
import { useAuth } from '../context/AuthContext';
import './Reports.css';

const Reports = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const isMobile = useIsMobile();
    const today = new Date();
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [year, setYear] = useState(today.getFullYear());
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState('all');
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [reconciledDates, setReconciledDates] = useState({});
    const [activePromptDate, setActivePromptDate] = useState(null);
    const [tempTxId, setTempTxId] = useState('');
    const [selectedDates, setSelectedDates] = useState([]);
    const [copiedTotal, setCopiedTotal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all | payments | bancolombia | reconciled | pending | selected

    const isSystemAdmin = user?.isSuperAdmin || (user?.role === 'admin' && (user?.companyName === 'System' || !user?.companyId));

    useEffect(() => {
        if (isSystemAdmin) {
            getAllCompanies()
                .then(data => {
                    if (Array.isArray(data)) {
                        setCompanies(data);
                    }
                })
                .catch(err => console.error('Failed to load companies:', err));
        }
    }, [isSystemAdmin]);

    const toggleReconciled = async (date, nextState, transactionId) => {
        const currentlyReconciled = reconciledDates[date]?.reconciled || reconciledDates[date] === true;
        // Optimistic UI update
        setReconciledDates(prev => ({
            ...prev,
            [date]: { reconciled: nextState, transactionId }
        }));

        try {
            await toggleReconciliation(date, nextState, transactionId, selectedCompany);
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
        loadReport();
    }, [month, year, selectedCompany]);

    const loadReport = async () => {
        setLoading(true);
        try {
            const res = await getDailyReconciliationReport(month, year, selectedCompany);
            if (res.success) {
                setReportData(res.data);
                setSelectedDates([]);
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

    const withPaymentsCount = reportData.filter(row => (row.payments || 0) > 0).length;
    const bancolombiaCount = reportData.filter(row => (row.bancolombia || 0) > 0).length;
    const reconciledCount = reportData.filter(row => {
        return Boolean(reconciledDates[row.date]?.reconciled || reconciledDates[row.date] === true);
    }).length;
    const pendingCount = reportData.filter(row => {
        const isReconciled = Boolean(reconciledDates[row.date]?.reconciled || reconciledDates[row.date] === true);
        return !isReconciled && (row.payments || 0) > 0;
    }).length;

    // Selection logic for weekly Bancolombia transfer calculation
    const selectedRows = reportData.filter(row => selectedDates.includes(row.date));
    const selectedTotal = selectedRows.reduce((acc, row) => acc + (row.bancolombia || 0), 0);
    const selectableRows = reportData.filter(row => (row.bancolombia || 0) > 0);
    const allSelectableChecked = selectableRows.length > 0 && selectableRows.every(row => selectedDates.includes(row.date));
    const isIndeterminate = selectedDates.length > 0 && !allSelectableChecked;

    const handleToggleSelectDate = (date) => {
        setSelectedDates(prev =>
            prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
        );
    };

    const handleToggleSelectAll = () => {
        if (allSelectableChecked) {
            setSelectedDates([]);
        } else {
            setSelectedDates(selectableRows.map(row => row.date));
        }
    };

    const handleClearSelection = () => {
        setSelectedDates([]);
    };

    const copySelectedTotal = async () => {
        if (selectedTotal === undefined || selectedTotal === null) return;
        const textToCopy = selectedTotal.toString();
        let copied = false;
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(textToCopy);
                copied = true;
            } catch (err) {
                console.error('Clipboard API failed', err);
            }
        }
        if (!copied) {
            const textArea = document.createElement("textarea");
            textArea.value = textToCopy;
            textArea.style.position = 'fixed';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                copied = true;
            } catch (err) {
                console.error('Fallback copy failed', err);
            }
            document.body.removeChild(textArea);
        }
        if (copied) {
            setCopiedTotal(true);
            setTimeout(() => setCopiedTotal(false), 2200);
        }
    };

    // Filter Options for standard iOS Stat Pills in SearchAndFilterBar
    const filterOptions = [
        { value: 'all', label: 'Todos', badge: reportData.length, badgeType: 'all' },
        { value: 'payments', label: `Pagos: ${formatCompact(totalPayments)}`, badge: withPaymentsCount, badgeType: 'all' },
        { value: 'bancolombia', label: `Bancolombia: ${formatCompact(totalBancolombia)}`, badge: bancolombiaCount, badgeType: 'ok' },
        { value: 'reconciled', label: 'Conciliados', badge: reconciledCount, badgeType: 'ok' },
        { value: 'pending', label: 'Pendientes', badge: pendingCount, badgeType: 'debt' },
    ];

    if (selectedDates.length > 0) {
        filterOptions.push({
            value: 'selected',
            label: `Sel: ${formatCompact(selectedTotal)}`,
            badge: selectedDates.length,
            badgeType: 'cutoff'
        });
    }

    const filteredReportData = reportData.filter(row => {
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const dateMatch = row.date?.toLowerCase().includes(q);
            const tx = (reconciledDates[row.date]?.transactionId || '').toLowerCase();
            const txMatch = tx.includes(q);
            if (!dateMatch && !txMatch) return false;
        }

        const isReconciled = Boolean(reconciledDates[row.date]?.reconciled || reconciledDates[row.date] === true);
        if (statusFilter === 'payments') return (row.payments || 0) > 0;
        if (statusFilter === 'bancolombia') return (row.bancolombia || 0) > 0;
        if (statusFilter === 'reconciled') return isReconciled;
        if (statusFilter === 'pending') return !isReconciled && (row.payments || 0) > 0;
        if (statusFilter === 'selected') return selectedDates.includes(row.date);
        return true;
    });

    const activeRow = reportData.find(row => row.date === activePromptDate);
    const activeAmount = activeRow ? activeRow.bancolombia : 0;
    const activeFormattedDate = activePromptDate ? activePromptDate.split('-').reverse().join('/') : '';

    const handleDownloadReport = () => {
        if (!reportData || reportData.length === 0) return;
        const headers = ["Fecha", "Pagos", "Comisión", "Bancolombia", "Estado", "Referencia"];
        const rows = reportData.map(row => {
            const isReconciled = Boolean(reconciledDates[row.date]?.reconciled || reconciledDates[row.date] === true);
            const txId = reconciledDates[row.date]?.transactionId || '';
            return [
                row.date,
                row.payments || 0,
                row.commission || 0,
                row.bancolombia || 0,
                isReconciled ? "Conciliado" : "Pendiente",
                txId
            ];
        });
        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `reporte_conciliacion_${month}-${year}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderDateSelectors = (isMobileView = false) => (
        <div className={`date-selectors-group${isMobileView ? ' mobile-date-selectors' : ''}`}>
            <select
                value={month}
                onChange={e => setMonth(Number(e.target.value))}
                className="date-select-standard"
                aria-label="Seleccionar mes"
            >
                {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                        {new Date(0, i).toLocaleString('es-ES', { month: 'long' }).replace(/^\w/, c => c.toUpperCase())}
                    </option>
                ))}
            </select>

            <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="date-select-standard"
                aria-label="Seleccionar año"
            >
                {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
                    <option key={y} value={y}>{y}</option>
                ))}
            </select>

            {isSystemAdmin && companies.length > 0 && (
                <select
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                    className="date-select-standard"
                    aria-label="Seleccionar empresa"
                >
                    <option value="all">Todas las empresas</option>
                    {companies.map(c => (
                        <option key={c._id} value={c._id}>
                            {c.name}
                        </option>
                    ))}
                </select>
            )}
        </div>
    );

    const desktopHeader = (
        <PageHeader.Desktop
            title={t('sidebar.reports', 'Reporte de Conciliación')}
            breadcrumbs={[
                { label: 'Cobranza' },
                { label: t('sidebar.reports', 'Reporte de Conciliación') }
            ]}
            onRefresh={loadReport}
            loading={loading}
            refreshText={t('payments.refresh', 'Actualizar')}
            leadingActions={renderDateSelectors(false)}
            actions={
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    {selectedDates.length > 0 && (
                        <button
                            type="button"
                            className="select-control"
                            onClick={copySelectedTotal}
                            title={`Copiar total seleccionado: ${formatCurrency(selectedTotal)}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}
                        >
                            {copiedTotal ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                            <span>{copiedTotal ? 'Copiado!' : `Copiar ${formatCompact(selectedTotal)}`}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleDownloadReport}
                        title="Exportar CSV"
                    >
                        <Download size={16} /> Exportar CSV
                    </button>
                </div>
            }
        />
    );

    const mobileHeader = (
        <>
            <PageHeader.Mobile
                onRefresh={loadReport}
                loading={loading}
                onFilterToggle={() => setShowFilters(prev => !prev)}
                showFilters={showFilters}
                actions={
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {selectedDates.length > 0 && (
                            <button
                                type="button"
                                className="btn-mobile-header-action"
                                onClick={copySelectedTotal}
                                title={`Copiar total seleccionado: ${formatCurrency(selectedTotal)}`}
                            >
                                {copiedTotal ? <Check size={18} color="#10b981" /> : <Copy size={18} />}
                            </button>
                        )}
                        <button
                            type="button"
                            className="btn-mobile-header-action"
                            onClick={handleDownloadReport}
                            title="Exportar CSV"
                        >
                            <Download size={18} />
                        </button>
                    </div>
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
        <div className="reports-page">
            {renderHeader}

            {/* Expandable Metrics Section */}
            <div className={`expandable-metrics-container ${!isMobile || showFilters ? 'expanded' : 'collapsed'}`}>
                {/* 3 Compact Stat Cards */}
                <div className="stats-grid-mid-3">
                    <StatCard
                        title="TOTAL PAGOS"
                        value={formatCompact(totalPayments)}
                        fullValue={formatCurrency(totalPayments)}
                        uppercaseTitle
                    />
                    <StatCard
                        title="COMISIÓN"
                        value={formatCompact(totalCommission)}
                        fullValue={formatCurrency(totalCommission)}
                        valueColor="#ef4444"
                        uppercaseTitle
                    />
                    <StatCard
                        title="BANCOLOMBIA"
                        value={formatCompact(totalBancolombia)}
                        fullValue={formatCurrency(totalBancolombia)}
                        valueColor="#10b981"
                        uppercaseTitle
                    />
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
                                <th className="reports-th text-left col-header-date">
                                    <div className="date-th-wrapper">
                                        <input
                                            type="checkbox"
                                            className="bancolombia-checkbox bancolombia-checkbox--header"
                                            checked={allSelectableChecked}
                                            ref={el => {
                                                if (el) el.indeterminate = isIndeterminate;
                                            }}
                                            onChange={handleToggleSelectAll}
                                            title={allSelectableChecked ? "Deseleccionar todo" : "Seleccionar todos los abonos a Bancolombia"}
                                        />
                                        <span>Fecha</span>
                                    </div>
                                </th>
                                <th className="reports-th">Payments</th>
                                <th className="reports-th">Bancolombia</th>
                                <th className="reports-th col-commission">Commission</th>
                                <th className="reports-th">Transactions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredReportData.map((row, index) => {
                                const isReconciled = reconciledDates[row.date]?.reconciled || reconciledDates[row.date] === true;
                                const transactionId = reconciledDates[row.date]?.transactionId || '';
                                const isRowSelected = selectedDates.includes(row.date);
                                return (
                                    <tr key={row.date} className={`reports-tr ${index % 2 === 0 ? 'even' : 'odd'} ${isRowSelected ? 'reports-tr--selected' : ''}`}>
                                        <td className="reports-td col-date">
                                            <div className="date-cell-content">
                                                <input
                                                    type="checkbox"
                                                    className="bancolombia-checkbox"
                                                    checked={isRowSelected}
                                                    onChange={() => handleToggleSelectDate(row.date)}
                                                    title={`Seleccionar fecha ${row.date} (${formatCurrency(row.bancolombia)})`}
                                                />
                                                <span>{row.date.split('-').reverse().join('/')}</span>
                                            </div>
                                        </td>
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
                            {filteredReportData.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="reports-loading">
                                        {reportData.length === 0 ? 'No hay datos disponibles para este periodo.' : 'No se encontraron registros para el filtro seleccionado.'}
                                    </td>
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
                        <div className="reconcile-popover-title">
                            Confirmar Conciliación ({activeFormattedDate})
                        </div>
                        <div className="reconcile-popover-amount">
                            Abono: <strong>{formatCurrency(activeAmount)}</strong>
                        </div>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handlePromptSubmit(activePromptDate);
                            }}
                            className="reconcile-popover-form"
                        >
                            <input
                                type="text"
                                className="reconcile-popover-input"
                                placeholder="ID Transacción (opcional)"
                                value={tempTxId}
                                onChange={(e) => setTempTxId(e.target.value)}
                                autoFocus
                            />
                            <div className="reconcile-popover-actions">
                                <button
                                    type="button"
                                    className="reconcile-btn-cancel"
                                    onClick={() => setActivePromptDate(null)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="reconcile-btn-submit"
                                >
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Floating Selection Bar for Bancolombia Transfers */}
            {selectedDates.length > 0 && createPortal(
                <div className="bancolombia-floating-bar-wrapper">
                    <div className="bancolombia-floating-bar">
                        <div className="floating-bar-info">
                            <div className="floating-bar-count">
                                <span className="floating-bar-badge">{selectedDates.length}</span>
                                <span>{selectedDates.length === 1 ? 'día seleccionado' : 'días seleccionados'}</span>
                            </div>
                            <div className="floating-bar-total">
                                <span className="floating-bar-label">Total a transferir:</span>
                                <span className="floating-bar-amount">{formatCurrency(selectedTotal)}</span>
                            </div>
                        </div>
                        <div className="floating-bar-actions">
                            <button
                                type="button"
                                onClick={copySelectedTotal}
                                className={`floating-bar-btn floating-bar-btn--copy ${copiedTotal ? 'floating-bar-btn--copied' : ''}`}
                                title="Copiar monto numérico exacto para transferir en Bancolombia"
                            >
                                {copiedTotal ? (
                                    <>
                                        <Check size={16} />
                                        <span>¡Copiado!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy size={16} />
                                        <span>Copiar valor ({selectedTotal.toLocaleString('es-CO')})</span>
                                    </>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={handleClearSelection}
                                className="floating-bar-btn floating-bar-btn--clear"
                                title="Limpiar selección"
                            >
                                <X size={16} />
                                <span className="desktop-only">Limpiar</span>
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Reports;
