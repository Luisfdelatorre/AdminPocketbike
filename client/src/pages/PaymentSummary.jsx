import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { RefreshCw, Download, ZapOff, Power, LayoutList, Table2, Search, X } from 'lucide-react';

import { getPaymentSummary, exportPaymentsCSV, cutoffDebtors, getStatusReport, controlEngine } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../utils/toast';
import './PaymentSummary.css';
import BikePaymentSummary from '../components/BikePaymentSummary';
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

const DESKTOP_VIEW_STORAGE_KEY = 'payment-summary.desktop-view';

const getInitialDesktopView = () => {
    try {
        return window.localStorage.getItem(DESKTOP_VIEW_STORAGE_KEY) === 'matrix' ? 'matrix' : 'bike';
    } catch {
        return 'bike';
    }
};

const PaymentSummary = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [summaryData, setSummaryData] = useState([]);
    const [bulkOffLoading, setBulkOffLoading] = useState(false);
    const [bulkOffModal, setBulkOffModal] = useState(false);
    const [deviceStatuses, setDeviceStatuses] = useState([]);
    const [pendingCommands, setPendingCommands] = useState({});
    const summaryHeaderRef = useRef(null);
    const tableContainerRef = useRef(null);
    const matrixTableRef = useRef(null);
    const matrixHeaderViewportRef = useRef(null);
    const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
    const [desktopView, setDesktopView] = useState(getInitialDesktopView);
    const [summaryHeaderHeight, setSummaryHeaderHeight] = useState(0);
    const [isSummaryHeaderStuck, setIsSummaryHeaderStuck] = useState(false);
    const [matrixGeometry, setMatrixGeometry] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all | debt | ok | cutoff

    useEffect(() => {
        const mobileMediaQuery = window.matchMedia('(max-width: 768px)');
        const handleBreakpointChange = (event) => setIsMobile(event.matches);
        mobileMediaQuery.addEventListener('change', handleBreakpointChange);
        return () => mobileMediaQuery.removeEventListener('change', handleBreakpointChange);
    }, []);

    const handleDesktopViewChange = (view) => {
        setDesktopView(view);
        try {
            window.localStorage.setItem(DESKTOP_VIEW_STORAGE_KEY, view);
        } catch {
            // The selected view still works for the current session when storage is unavailable.
        }
    };

    // Default to current month/year
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());

    // Generate days 1..31 based on month
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const isCurrentPeriod = selectedMonth === today.getMonth() + 1 && selectedYear === today.getFullYear();
    const currentDay = isCurrentPeriod ? today.getDate() : null;
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isFutureSummaryDay = (day) => new Date(selectedYear, selectedMonth - 1, day) > todayStart;

    // Find maximum day with data
    const maxRecordedDay = summaryData.length > 0
        ? Math.max(...summaryData.map(item => {
            const days = Object.keys(item.days).map(Number);
            return days.length > 0 ? Math.max(...days) : 0;
        }))
        : 0;

    const selectedPeriodStart = new Date(selectedYear, selectedMonth - 1, 1);
    const currentPeriodStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const isPastPeriod = selectedPeriodStart < currentPeriodStart;
    const lastVisibleDay = isPastPeriod
        ? daysInMonth
        : isCurrentPeriod
            ? Math.max(currentDay, maxRecordedDay)
            : maxRecordedDay;

    const daysArray = Array.from({ length: lastVisibleDay }, (_, i) => i + 1);


    // Vertical sum of totalPaid per day across all devices
    const dailyTotals = daysArray.reduce((acc, day) => {
        acc[day] = summaryData.reduce((sum, item) => sum + (item.days[day]?.totalPaid || 0), 0);
        return acc;
    }, {});

    const renderMatrixHeader = (className = '') => (
        <thead className={className}>
            <tr>
                <th>DISPOSITIVO</th>
                <th>Deuda</th>
                {daysArray.map(day => (
                    <th key={day}>{String(day).padStart(2, '0')}</th>
                ))}
                <th style={{ textAlign: 'center', minWidth: '60px' }}>Motor</th>
            </tr>
            <tr className="daily-totals-row">
                <th className="totals-label">Total día</th>
                <th></th>
                {daysArray.map(day => (
                    <th key={day} className="daily-total-cell">
                        {dailyTotals[day] > 0 ? formatCurrency(dailyTotals[day]) : '--'}
                    </th>
                ))}
                <th></th>
            </tr>
        </thead>
    );

    const syncMatrixHeaderScroll = (scrollLeft) => {
        if (matrixHeaderViewportRef.current) {
            matrixHeaderViewportRef.current.scrollLeft = scrollLeft;
        }
    };

    const handleMatrixScroll = (event) => {
        syncMatrixHeaderScroll(event.currentTarget.scrollLeft);
    };

    useLayoutEffect(() => {
        const header = summaryHeaderRef.current;
        if (!header) return undefined;

        const updateHeaderHeight = () => {
            setSummaryHeaderHeight(Math.ceil(header.getBoundingClientRect().height));
        };

        updateHeaderHeight();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateHeaderHeight);
            return () => window.removeEventListener('resize', updateHeaderHeight);
        }

        const observer = new ResizeObserver(updateHeaderHeight);
        observer.observe(header);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const updateStickyState = () => {
            const headerTop = summaryHeaderRef.current?.getBoundingClientRect().top;
            const nextIsStuck = typeof headerTop === 'number' && headerTop <= -3;

            setIsSummaryHeaderStuck((previous) => (
                previous === nextIsStuck ? previous : nextIsStuck
            ));
        };

        updateStickyState();
        window.addEventListener('scroll', updateStickyState, { capture: true, passive: true });
        window.addEventListener('resize', updateStickyState);

        return () => {
            window.removeEventListener('scroll', updateStickyState, true);
            window.removeEventListener('resize', updateStickyState);
        };
    }, []);

    useLayoutEffect(() => {
        if (isMobile || desktopView !== 'matrix') {
            setMatrixGeometry(null);
            return undefined;
        }

        const table = matrixTableRef.current;
        const container = tableContainerRef.current;
        if (!table || !container) return undefined;

        const updateMatrixGeometry = () => {
            const cells = Array.from(table.querySelectorAll('tbody tr:first-child > td'));
            const expectedColumnCount = daysArray.length + 3;

            if (cells.length !== expectedColumnCount) return;

            const widths = cells.map((cell) => Math.round(cell.getBoundingClientRect().width));
            const width = Math.round(table.getBoundingClientRect().width);

            if (!width || widths.some((columnWidth) => !columnWidth)) return;

            setMatrixGeometry((previous) => {
                const isUnchanged = previous?.width === width
                    && previous.widths.length === widths.length
                    && previous.widths.every((columnWidth, index) => columnWidth === widths[index]);

                return isUnchanged ? previous : { width, widths };
            });
        };

        updateMatrixGeometry();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateMatrixGeometry);
            return () => window.removeEventListener('resize', updateMatrixGeometry);
        }

        const observer = new ResizeObserver(updateMatrixGeometry);
        observer.observe(table);
        observer.observe(container);
        return () => observer.disconnect();
    }, [daysArray.length, desktopView, isMobile, loading, summaryData]);

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

    const handleExport = async () => {
        setDownloading(true);
        try {
            await exportPaymentsCSV(selectedMonth, selectedYear);
        } catch (err) {
            console.error('CSV export error:', err);
            alert('Error al descargar el CSV: ' + err.message);
        } finally {
            setDownloading(false);
        }
    };


    const loadDeviceStatuses = async () => {
        try {
            const data = await getStatusReport();
            const list = Array.isArray(data) ? data : (data?.data ?? data?.devices ?? []);
            setDeviceStatuses(list);
        } catch (err) {
            console.error('Error loading device statuses:', err);
        }
    };

    const getDeviceStatus = (deviceId) =>
        deviceStatuses.find(d => d.id === deviceId || d.name === deviceId);

    const handleEngineToggle = async (device) => {
        const status = getDeviceStatus(device.deviceId || device.name);
        if (!status) return;
        const id = status.id;
        const isCutOff = Boolean(status.cutOff);
        const command = isCutOff ? 1 : 0;
        setPendingCommands(prev => ({ ...prev, [id]: true }));
        try {
            const result = await controlEngine(id, command);
            if (result.success) {
                showToast(result.message, 'success');
                loadDeviceStatuses();
            } else {
                showToast(result.error || 'Error controlando motor', 'error');
            }
        } catch (err) {
            showToast(err.message || 'Error', 'error');
        } finally {
            setPendingCommands(prev => ({ ...prev, [id]: false }));
        }
    };

    const handleBulkEngineOff = async () => {
        setBulkOffModal(false);
        setBulkOffLoading(true);
        try {
            const result = await cutoffDebtors();
            const msg = result?.message || (result?.success ? 'Listo' : 'Error');
            showToast(msg, result?.success ? 'success' : 'error');
            fetchData(); // Reload to reflect new cutoff state in table
        } catch (err) {
            showToast(err.message || 'Error al apagar morosos', 'error');
        } finally {
            setBulkOffLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        loadDeviceStatuses();
    }, [selectedMonth, selectedYear]);

    // Real-time SSE listening for device status updates in summary view
    useEffect(() => {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('adminToken');
        if (!token) return;

        const activeCompanyId = user?.companyId || '';
        const sseUrl = `/apinode/sse/subscribe?token=${encodeURIComponent(token)}${activeCompanyId ? `&companyId=${encodeURIComponent(activeCompanyId)}` : ''}`;

        let eventSource;
        try {
            eventSource = new EventSource(sseUrl);

            eventSource.addEventListener('device_update', (e) => {
                try {
                    const data = JSON.parse(e.data);
                    if (!data) return;

                    setDeviceStatuses((prevList) => {
                        let matchFound = false;
                        const updatedList = prevList.map((d) => {
                            const isMatch = (
                                (data.name && (d.name === data.name || d.deviceIdName === data.name)) ||
                                (data.deviceIdName && (d.name === data.deviceIdName || d.deviceIdName === data.deviceIdName)) ||
                                (data.gpsId && (d.gpsId === data.gpsId || d.id === data.gpsId || d.deviceId === data.gpsId)) ||
                                (data._id && (d._id === data._id || d.id === data._id))
                            );

                            if (isMatch) {
                                matchFound = true;
                                return {
                                    ...d,
                                    ignition: data.ignition !== undefined ? data.ignition : d.ignition,
                                    batteryLevel: data.batteryLevel !== null && data.batteryLevel !== undefined ? data.batteryLevel : d.batteryLevel,
                                    cutOff: data.cutOff !== undefined ? data.cutOff : d.cutOff,
                                    lastUpdate: data.lastUpdate ? data.lastUpdate : d.lastUpdate,
                                };
                            }
                            return d;
                        });

                        return matchFound ? updatedList : prevList;
                    });
                } catch (err) {
                    console.error('Error parsing SSE device_update in PaymentSummary:', err);
                }
            });

            // Listen for financial, payment, and reconciliation real-time updates
            const handleRealtimeReload = () => {
                fetchData();
                loadDeviceStatuses();
            };

            eventSource.addEventListener('payment_update', handleRealtimeReload);
            eventSource.addEventListener('reconciliation_update', handleRealtimeReload);
            eventSource.addEventListener('invoice_update', handleRealtimeReload);
            eventSource.addEventListener('summary_update', handleRealtimeReload);

            eventSource.onerror = (err) => {
                console.warn('SSE connection error in PaymentSummary, EventSource will automatically retry:', err);
            };
        } catch (err) {
            console.error('Failed to initialize SSE in PaymentSummary:', err);
        }

        return () => {
            if (eventSource) {
                eventSource.close();
            }
        };
    }, [user?.companyId]);

    useEffect(() => {
        if (!isMobile && desktopView === 'matrix' && !loading && summaryData.length > 0 && tableContainerRef.current) {
            const { scrollWidth } = tableContainerRef.current;
            tableContainerRef.current.scrollLeft = scrollWidth;
            syncMatrixHeaderScroll(tableContainerRef.current.scrollLeft);
        }
    }, [desktopView, isMobile, loading, summaryData]);

    useEffect(() => {
        if (matrixGeometry && tableContainerRef.current) {
            syncMatrixHeaderScroll(tableContainerRef.current.scrollLeft);
        }
    }, [matrixGeometry]);

    const morososCount = summaryData.filter(item => (item.device.unpaidTotal || 0) > 0).length;

    // ── Frontend filter (no extra API call) ─────────────────────────────────
    const filteredSummaryData = summaryData.filter(item => {
        // Text search: device name or driver name
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const nameMatch = item.device.name?.toLowerCase().includes(q);
            const driverMatch = item.device.driverName?.toLowerCase().includes(q);
            if (!nameMatch && !driverMatch) return false;
        }
        // Status pill filter
        if (statusFilter === 'debt') return (item.device.unpaidTotal || 0) > 0;
        if (statusFilter === 'ok') return (item.device.unpaidTotal || 0) === 0;
        if (statusFilter === 'cutoff') {
            const status = getDeviceStatus(item.device.deviceId || item.device.name);
            return Boolean(status?.cutOff);
        }
        return true;
    });

    const renderEngineButton = (device) => {
        const status = getDeviceStatus(device.deviceId || device.name);
        if (!status) return <span style={{ color: '#D1D5DB', fontSize: '0.7rem' }}>--</span>;
        const isCutOff = Boolean(status.cutOff);
        if (user?.role === 'viewer') {
            return (
                <div
                    className={`engine-toggle-slider ${isCutOff ? 'deactivated' : 'active'}`}
                    style={{ opacity: 0.5, cursor: 'not-allowed', transform: 'scale(0.75)', transformOrigin: 'center', display: 'inline-flex' }}
                >
                    <div className="slider-knob"><Power size={10} /></div>
                </div>
            );
        }
        return (
            <button
                onClick={() => handleEngineToggle(device)}
                disabled={!!pendingCommands[status.id]}
                className={`engine-toggle-slider ${isCutOff ? 'deactivated' : 'active'} ${pendingCommands[status.id] ? 'pending' : ''}`}
                title={isCutOff ? 'Activar Moto' : 'Desactivar Moto'}
                style={{ transform: 'scale(0.75)', transformOrigin: 'center' }}
            >
                <div className="slider-knob">
                    {pendingCommands[status.id]
                        ? <RefreshCw size={10} className="spin" />
                        : <Power size={10} />}
                </div>
            </button>
        );
    };

    const renderDayCell = (dayData) => {
        let cellClass = 'status-cell empty';
        let content = '--';
        let paymentTime = null;

        if (dayData) {
            const rawDate = dayData.latestPaymentAt || dayData.paidAt || (dayData.paid && dayData.updatedAt ? dayData.updatedAt : null);
            if (rawDate) {
                const dateObj = new Date(rawDate);
                if (!isNaN(dateObj.getTime())) {
                    const hours = String(dateObj.getHours()).padStart(2, '0');
                    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                    paymentTime = `${hours}:${minutes}`;
                }
            }

            if (dayData.dayType === 'LOAN') {
                cellClass = 'status-cell loand';
                content = '--';
            } else if (dayData.dayType === 'PAID') {
                cellClass = 'status-cell approved';
                content = dayData?.totalPaid > 0 ? formatCurrency(dayData?.totalPaid) : '✓';
            } else if (dayData.dayType === 'FREE') {
                cellClass = 'status-cell free';
                content = dayData?.totalPaid > 0 ? formatCurrency(dayData?.totalPaid) : '✓';
            } else if (dayData.dayType === 'ADJUSTMENT') {
                cellClass = 'status-cell adjusted';
                content = '🔧';
            } else {
                cellClass = 'status-cell pending';
                content = dayData?.totalPaid > 0 ? formatCurrency(dayData?.totalPaid) : '-';
            }

            content = (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.1 }}>
                    <span style={{ fontSize: '10.5px' }}>{content}</span>
                    {paymentTime && (
                        <span className="payment-time-sub">
                            {paymentTime}
                        </span>
                    )}
                </div>
            );

            if (dayData.cutOff) {
                content = (
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {content}
                        <div style={{ position: 'absolute', top: '-8px', right: '-18px' }}>
                            <MotorIcon color="#ef4444" size={14} />
                        </div>
                    </div>
                );
            }
        }
        return { cellClass, content };
    };

    return (
        <div
            className="payment-summary-container"
            style={{ '--summary-header-height': `${summaryHeaderHeight}px` }}
        >

            {bulkOffModal && (
                <div
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
                    }}
                    onClick={() => setBulkOffModal(false)}
                >
                    <div
                        style={{
                            background: '#fff', borderRadius: '16px', padding: '28px 24px',
                            maxWidth: '340px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <div style={{
                                background: '#FEF2F2', borderRadius: '10px', padding: '10px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <ZapOff size={22} style={{ color: '#EF4444' }} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#111' }}>Apagar veh&iacute;culos morosos</div>
                                <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '2px' }}>
                                    {morososCount} moto(s) con deuda ser&aacute;n apagadas
                                </div>
                            </div>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#374151', marginBottom: '20px', lineHeight: 1.5 }}>
                            Se enviar&aacute; comando de <strong>corte de motor</strong> solo a los dispositivos con <strong style={{ color: '#EF4444' }}>deuda pendiente</strong>. &iquest;Confirmar?
                        </p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setBulkOffModal(false)}
                                style={{
                                    flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #E5E7EB',
                                    background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#374151'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleBulkEngineOff}
                                style={{
                                    flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                                    background: '#EF4444', color: '#fff', cursor: 'pointer',
                                    fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                }}
                            >
                                <ZapOff size={15} /> Apagar Todo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div
                ref={summaryHeaderRef}
                className={`summary-header${isSummaryHeaderStuck ? ' is-stuck' : ''}`}
            >
                <div className="summary-heading">
                    <h1>Estatus de Pagos</h1>

                    {!isMobile && (
                        <div className="summary-view-segment" role="group" aria-label="Vista del resumen de pagos">
                            <button
                                type="button"
                                className={`summary-view-option${desktopView === 'bike' ? ' active' : ''}`}
                                onClick={() => handleDesktopViewChange('bike')}
                                aria-pressed={desktopView === 'bike'}
                            >
                                <LayoutList size={16} aria-hidden="true" />
                                <span>Por moto</span>
                            </button>
                            <button
                                type="button"
                                className={`summary-view-option${desktopView === 'matrix' ? ' active' : ''}`}
                                onClick={() => handleDesktopViewChange('matrix')}
                                aria-pressed={desktopView === 'matrix'}
                            >
                                <Table2 size={16} aria-hidden="true" />
                                <span>Matriz</span>
                            </button>
                        </div>
                    )}
                </div>

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

                    {user?.role !== 'viewer' && (
                        <button
                            className={`select-control refresh-btn ${bulkOffLoading ? 'spinning' : ''}`}
                            onClick={() => setBulkOffModal(true)}
                            disabled={bulkOffLoading || morososCount === 0}
                            title={`Apagar motor de vehículos morosos (${morososCount})`}
                            style={{
                                background: bulkOffLoading ? '#FEE2E2' : '#EF4444',
                                color: bulkOffLoading ? '#EF4444' : '#fff',
                                border: 'none',
                                opacity: morososCount === 0 ? 0.45 : 1,
                                cursor: morososCount === 0 ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {bulkOffLoading ? (
                                <RefreshCw size={20} />
                            ) : (
                                <ZapOff size={20} />
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Filter bar (mirrors Contracts page) ───────────────────────── */}
            <div className="contracts-filters" style={{ flexWrap: 'wrap', gap: '8px' }}>
                <button
                    type="button"
                    className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('all')}
                >
                    Todos
                </button>
                <button
                    type="button"
                    className={`filter-btn ${statusFilter === 'debt' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('debt')}
                >
                    Con deuda
                </button>
                <button
                    type="button"
                    className={`filter-btn ${statusFilter === 'ok' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('ok')}
                >
                    Al día
                </button>
                <button
                    type="button"
                    className={`filter-btn ${statusFilter === 'cutoff' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('cutoff')}
                >
                    Apagados
                </button>

                <div className="search-box" style={{ marginLeft: 'auto' }}>
                    <Search className="search-icon" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar moto o conductor…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            className="clear-search"
                            onClick={() => setSearchQuery('')}
                            aria-label="Limpiar búsqueda"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {isMobile || desktopView === 'bike' ? (
                <BikePaymentSummary
                    summaryData={filteredSummaryData}
                    daysArray={daysArray}
                    currentDay={currentDay}
                    isFutureSummaryDay={isFutureSummaryDay}
                    loading={loading}
                    user={user}
                    handleEngineToggle={handleEngineToggle}
                    pendingCommands={pendingCommands}
                    getDeviceStatus={getDeviceStatus}
                    renderDayCell={renderDayCell}
                />
            ) : (
                <div className="matrix-shell">
                    <div className="matrix-sticky-header">
                        <div ref={matrixHeaderViewportRef} className="matrix-sticky-header-viewport" aria-hidden="true">
                            <table
                                className="summary-table summary-table--sticky-header"
                                style={matrixGeometry ? { width: `${matrixGeometry.width}px` } : undefined}
                            >
                                {matrixGeometry && (
                                    <colgroup>
                                        {matrixGeometry.widths.map((width, index) => (
                                            <col key={index} style={{ width: `${width}px` }} />
                                        ))}
                                    </colgroup>
                                )}
                                {renderMatrixHeader('matrix-visual-thead')}
                            </table>
                        </div>
                    </div>

                    <div className="matrix-container" ref={tableContainerRef} onScroll={handleMatrixScroll}>
                        <table ref={matrixTableRef} className="summary-table">
                            {renderMatrixHeader('matrix-semantic-thead')}
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={daysInMonth + 3}>Cargando...</td></tr>
                                ) : (
                                    summaryData.map((item) => (
                                        <tr key={item.device.deviceId} className="bike-summary">
                                            <td>
                                                <div className="device-cell">
                                                    <span className="device-name">{item.device.name}</span>
                                                    <span className="driver-name">{item.device.driverName || 'Sin Conductor'}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="device-cell">
                                                    {item.device.unpaidTotal > 0 ? (
                                                        <span className="debt-badge">{formatCurrency(item.device.unpaidTotal)}</span>
                                                    ) : (
                                                        <span className="no-debt">✓</span>
                                                    )}
                                                </div>
                                            </td>
                                            {daysArray.map(day => {
                                                const dayData = item.days[day];
                                                const isEmptyFutureDay = !dayData && isFutureSummaryDay(day);
                                                const { cellClass, content } = renderDayCell(dayData);
                                                return (
                                                    <td key={day} className={`bike-summary-day${isEmptyFutureDay ? ' empty-day' : ''}`}>
                                                        <div className={cellClass}>
                                                            {content}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                            {/* Motor toggle per row */}
                                            <td style={{ textAlign: 'center' }}>
                                                {renderEngineButton(item)}
                                            </td>
                                        </tr>
                                    )))
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            )}


            {/*<div className="legend">
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
            </div>*/}
        </div>
    );
};

export default PaymentSummary;
