import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Download, ZapOff, Power, LayoutList, Table2, Search, X, ListFilter } from 'lucide-react';

import { getPaymentSummary, exportPaymentsCSV, cutoffDebtors, getStatusReport, controlEngine } from '../services/api';
import { useAuth } from '../context/AuthContext';
import useFilterVisibilityOnScroll from '../hooks/useFilterVisibilityOnScroll';
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
    const [showFilters, setShowFilters] = useState(false);
    const [portalElement, setPortalElement] = useState(null);

    useEffect(() => {
        setPortalElement(document.getElementById('mobile-header-actions'));
    }, []);

    useFilterVisibilityOnScroll(setShowFilters);

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

    const fetchData = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
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
            if (!isSilent) setLoading(false);
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

    const getDeviceStatus = (deviceId) => {
        const item = summaryData.find(s => s.device?.deviceId === deviceId || s.device?.name === deviceId || s.device?.id === deviceId);
        return item ? item.device : null;
    };


    const handleEngineToggle = async (deviceObj) => {
        const dev = deviceObj.device || deviceObj;
        const id = dev.deviceId || dev.id || dev.name;
        const command = dev.cutOff ? 1 : 0;
        setPendingCommands(prev => ({ ...prev, [id]: true }));
        try {
            const result = await controlEngine(id, command);
            if (result.success) {
                const msg = result.message || result.response?.message || 'Comando enviado con éxito';
                showToast(msg, 'success');
                const nextCutOff = command === 0;
                setSummaryData(prev => prev.map(item => {
                    const currentId = item.device.deviceId || item.device.id || item.device.name;
                    if (currentId === id || item.device.name === id) {
                        return {
                            ...item,
                            device: { ...item.device, cutOff: nextCutOff }
                        };
                    }
                    return item;
                }));
            } else {
                showToast(result.error || 'Error controlando motor', 'error');
            }
        } catch (err) {
            showToast(err.message || 'Error', 'error');
        } finally {
            setPendingCommands(prev => ({ ...prev, [id]: false }));
        }
    };

    useEffect(() => {
        fetchData();
        const handlePaymentUpdate = (e) => {
            const detail = e.detail;
            if (!detail) return;

            if (detail?.type === 'gps_update' && Array.isArray(detail.devices)) {
                setSummaryData(prev => prev.map(item => {
                    const devId = String(item.device.deviceId || item.device.id || item.device.name || '');
                    const devGpsId = String(item.device.gpsId || '');
                    const match = detail.devices.find(u => {
                        const targetId = String(u.gpsId || u.filter?.gpsId || u.filter?.deviceId || '');
                        return targetId && (devId === targetId || devGpsId === targetId || item.device.name?.toUpperCase() === targetId.toUpperCase());
                    });
                    if (match) {
                        return {
                            ...item,
                            device: {
                                ...item.device,
                                ...(match.cutOff != null && { cutOff: match.cutOff ? 1 : 0 }),
                                ...(match.batteryLevel != null && { batteryLevel: match.batteryLevel }),
                                ...(match.ignition != null && { ignition: match.ignition })
                            }
                        };
                    }
                    return item;
                }));
            } else if (detail?.type === 'engine' && detail?.deviceId) {
                const targetCutOff = (detail.command === 0 || detail.command === '0' || detail.command === false) ? 1 : 0;
                setSummaryData(prev => prev.map(item => {
                    const targetStr = String(detail.deviceId).toUpperCase();
                    const isMatch =
                        String(item.device._id) === targetStr ||
                        String(item.device.gpsId) === targetStr ||
                        item.device.name?.toUpperCase() === targetStr;

                    if (isMatch) {
                        return {
                            ...item,
                            device: { ...item.device, cutOff: targetCutOff }
                        };
                    }
                    return item;
                }));
            } else if (detail?.type === 'cutoff-batch') {
                fetchData();
            }
        };

        const handleDeviceUpdate = (e) => {
            const detail = e.detail;
            if (!detail) return;

            setSummaryData(prev => prev.map(item => {
                const isMatch =
                    (detail.gpsId != null && String(item.device.gpsId) === String(detail.gpsId)) ||
                    (detail.name && item.device.name?.toUpperCase() === detail.name?.toUpperCase()) ||
                    (detail._id && String(item.device._id) === String(detail._id));

                if (isMatch) {
                    return {
                        ...item,
                        device: {
                            ...item.device,
                            ...(detail.cutOff != null && { cutOff: (detail.cutOff === true || detail.cutOff === 1 || detail.cutOff === '1') ? 1 : 0 }),
                            ...(detail.batteryLevel != null && { batteryLevel: detail.batteryLevel }),
                            ...(detail.ignition != null && { ignition: detail.ignition })
                        }
                    };
                }
                return item;
            }));
        };

        window.addEventListener('payment-update', handlePaymentUpdate);
        window.addEventListener('device-update', handleDeviceUpdate);
        return () => {
            window.removeEventListener('payment-update', handlePaymentUpdate);
            window.removeEventListener('device-update', handleDeviceUpdate);
        };
    }, [selectedMonth, selectedYear]);

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

    const hasInitialScrolledRef = useRef(false);

    useEffect(() => {
        hasInitialScrolledRef.current = false;
    }, [selectedMonth, selectedYear, desktopView]);

    useEffect(() => {
        if (!isMobile && desktopView === 'matrix' && !loading && tableContainerRef.current) {
            if (!hasInitialScrolledRef.current) {
                const { scrollWidth } = tableContainerRef.current;
                tableContainerRef.current.scrollLeft = scrollWidth;
                syncMatrixHeaderScroll(tableContainerRef.current.scrollLeft);
                hasInitialScrolledRef.current = true;
            }
        }
    }, [desktopView, isMobile, loading]);

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

    const renderEngineButton = (deviceObj) => {
        const dev = deviceObj.device || deviceObj;
        const devId = dev.deviceId || dev.id || dev.name;
        const isOff = !!dev.cutOff;
        const isPending = !!pendingCommands[devId];

        if (user?.role === 'viewer') {
            return (
                <div
                    className={`engine-toggle-slider ${isOff ? 'deactivated' : 'active'}`}
                    style={{ opacity: 0.5, cursor: 'not-allowed', transform: 'scale(0.75)', transformOrigin: 'center', display: 'inline-flex' }}
                >
                    <div className="slider-knob"><Power size={10} /></div>
                </div>
            );
        }
        return (
            <button
                onClick={() => handleEngineToggle(dev)}
                disabled={isPending}
                className={`engine-toggle-slider ${isOff ? 'deactivated' : 'active'} ${isPending ? 'pending' : ''}`}
                title={isOff ? 'Activar Moto' : 'Desactivar Moto'}
                style={{ transform: 'scale(0.75)', transformOrigin: 'center' }}
            >
                <div className="slider-knob">
                    {isPending
                        ? <RefreshCw size={10} className="spin" />
                        : <Power size={10} />}
                </div>
            </button>
        );
    };

    const renderDayCell = (dayData) => {
        let cellClass = 'status-cell empty';
        let content = '--';
        if (dayData) {
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

            {portalElement && createPortal(
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                        type="button"
                        className={`btn-mobile-header-action ${showFilters ? 'active text-blue-600' : ''}`}
                        onClick={() => setShowFilters(!showFilters)}
                        id="filterToggle"
                        title="Filtros"
                    >
                        <ListFilter size={20} />
                    </button>
                    <button
                        type="button"
                        className="btn-mobile-header-action"
                        onClick={fetchData}
                        disabled={loading}
                        title="Actualizar datos"
                    >
                        <RefreshCw size={20} className={loading ? 'spin' : ''} />
                    </button>
                </div>,
                portalElement
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


            </div>

            {/* ── Controles: mes / año / acciones ────────────────────────────── */}
            <div className={`expandable-metrics-container ${showFilters ? 'expanded' : 'collapsed'}`}>
                <div className="dashboard-controls-row">
                    <div className="select-wrapper-month">
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="select-control-ios"
                        >
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
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="select-control-ios"
                        >
                            <option value={2025}>2025</option>
                            <option value={2026}>2026</option>
                            <option value={2027}>2027</option>
                        </select>
                    </div>

                    {user?.role !== 'viewer' && (
                        <button
                            type="button"
                            className={`btn-icon-ios btn-ios-red refresh-btn ${bulkOffLoading ? 'spinning' : ''}`}
                            onClick={() => setBulkOffModal(true)}
                            disabled={bulkOffLoading || morososCount === 0}
                            title={`Apagar motor de vehículos morosos (${morososCount})`}
                            style={{ opacity: morososCount === 0 ? 0.4 : 1 }}
                        >
                            {bulkOffLoading ? <RefreshCw size={18} /> : <ZapOff size={18} />}
                        </button>
                    )}
                </div>
                <div className="search-ios">
                    <Search size={15} className="search-ios-icon" />
                    <input
                        type="text"
                        className="search-ios-input"
                        placeholder="Buscar moto o conductor…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            className="search-ios-clear"
                            onClick={() => setSearchQuery('')}
                            aria-label="Limpiar búsqueda"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Filtros: pills + búsqueda ───────────────────────────────────── */}
            <div className="summary-filter-row-ios">
                <div className="filter-pills-ios">
                    <button
                        type="button"
                        data-filter="all"
                        className={`filter-pill-ios ${statusFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('all')}
                    >
                        Todos
                    </button>
                    <button
                        type="button"
                        data-filter="debt"
                        className={`filter-pill-ios ${statusFilter === 'debt' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('debt')}
                    >
                        Con deuda
                    </button>
                    <button
                        type="button"
                        data-filter="ok"
                        className={`filter-pill-ios ${statusFilter === 'ok' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('ok')}
                    >
                        Al día
                    </button>
                    <button
                        type="button"
                        data-filter="cutoff"
                        className={`filter-pill-ios ${statusFilter === 'cutoff' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('cutoff')}
                    >
                        Apagados
                    </button>
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
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                                            <div className={cellClass}>
                                                                {content}
                                                            </div>
                                                            {dayData && (
                                                                <span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                                                                    {dayData.distance > 0 ? `${Math.round(dayData.distance)}km` : '0km'}
                                                                </span>
                                                            )}
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
