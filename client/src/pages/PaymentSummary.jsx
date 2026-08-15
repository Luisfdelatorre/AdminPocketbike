import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Download, ZapOff, Power, LayoutList, Table2, Search, X, ListFilter } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getPaymentSummary, exportPaymentsCSV, cutoffDebtors, getStatusReport, controlEngine } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Calendar, DollarSign, Activity, FileText, ChevronDown, Check, Zap, Filter, ArrowRight, Save, MapPin, Navigation, Smartphone } from 'lucide-react';
import MobileHeaderAction from '../components/MobileHeaderAction';
import { useSSE } from '../context/SSEContext';
import { showToast } from '../utils/toast';
import './PaymentSummary.css';
import BikePaymentSummary from '../components/BikePaymentSummary';
import MatrixPaymentSummary from '../components/MatrixPaymentSummary';
import MotorIcon from '../components/MotorIcon';
import SearchAndFilterBar from '../components/SearchAndFilterBar';
import PageHeader from '../components/PageHeader';
import { ENGINERESUME, ENGINESTOP, COLORS } from '../constants';

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
    const { subscribe } = useSSE();
    const [loading, setLoading] = useState(false);
    const { t } = useTranslation();
    const [downloading, setDownloading] = useState(false);
    const [summaryDataMap, setSummaryDataMap] = useState({});
    const summaryData = useMemo(() => Object.values(summaryDataMap), [summaryDataMap]);
    const [bulkOffLoading, setBulkOffLoading] = useState(false);
    const [bulkOffModal, setBulkOffModal] = useState(false);
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
    const [showFilters, setShowFilters] = useState(true);

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

    const syncMatrixHeaderScroll = (scrollLeft) => {
        if (matrixHeaderViewportRef.current) {
            matrixHeaderViewportRef.current.scrollLeft = scrollLeft;
        }
    };

    const handleMatrixScroll = (event) => {
        syncMatrixHeaderScroll(event.currentTarget.scrollLeft);
    };



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
            const response = await getPaymentSummary({
                month: selectedMonth,
                year: selectedYear
            });

            if (response.success && Array.isArray(response.data)) {
                const map = {};
                response.data.forEach(item => map[item.device.gpsId] = item);

                // Anti-Race Condition: If the API response has older data than our local SSE cache, keep the local SSE device state!
                setSummaryDataMap(prev => {
                    const next = { ...map };
                    Object.keys(next).forEach(key => {
                        const prevDev = prev[key]?.device;
                        const nextDev = next[key].device;
                        if (prevDev?.lastUpdate && nextDev?.lastUpdate) {
                            if (new Date(prevDev.lastUpdate) > new Date(nextDev.lastUpdate)) {
                                next[key].device = { ...nextDev, ...prevDev };
                            }
                        }
                    });
                    return next;
                });
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


    const handleEngineToggle = async (device) => {
        const gpsId = device.gpsId;
        const command = device.cutOff ? ENGINERESUME : ENGINESTOP;
        setPendingCommands(prev => ({ ...prev, [gpsId]: true }));
        try {
            const result = await controlEngine(gpsId, command);
            const data = result.data || result;
            const resObj = data.response || data;

            if (data.success || resObj.success) {
                showToast(`Comando encolado en Traccar para ${dev.name}`, 'info');
                setSummaryDataMap(prev => {
                    const next = { ...prev };
                    const primaryKey = String(gpsId);
                    if (next[primaryKey]) {
                        // Anti-Race Condition: Only set queued: true if the cutOff state hasn't already been flipped by a blazing-fast SSE webhook!
                        if (next[primaryKey].device.cutOff === !!dev.cutOff) {
                            next[primaryKey] = {
                                ...next[primaryKey],
                                device: { ...next[primaryKey].device, queued: true }
                            };
                        }
                    }
                    return next;
                });
            }
        } catch (err) {
            showToast(err.message || 'Error', 'error');
        }
    };

    useEffect(() => {
        fetchData();
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



    // Real-time SSE listening for device status updates in summary view
    useEffect(() => {
        const unsub = subscribe('device_update', (e) => {
            try {
                const data = e.parsedData;
                if (!data) return;
                const updates = Array.isArray(data) ? data : [data];
                setSummaryDataMap(prev => {
                    const next = { ...prev };
                    let matchFound = false;
                    updates.forEach(u => {
                        const key = String(u.gpsId);
                        if (next[key]) {
                            matchFound = true;
                            next[key] = {
                                ...next[key],
                                device: {
                                    ...next[key].device,
                                    ...u
                                }
                            };
                        }
                    });
                    return matchFound ? next : prev;
                });
            } catch (err) {
                console.error('Error parsing SSE device_update in PaymentSummary:', err);
            }
        });

        return () => {
            unsub();
        };
    }, [subscribe, user?.companyId]);

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

    const renderEngineButton = (item) => {
        const dev = item.device;
        const devId = dev.deviceId;
        const isOff = !!dev.cutOff;
        const isPending = !!pendingCommands[devId] || dev.queued;

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



    const handleFilterToggle = () => setShowFilters(prev => !prev);

    const renderViews = useMemo(() => {
        if (isMobile || desktopView === 'bike') {
            return (
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
                />
            );
        }

        return (
            <MatrixPaymentSummary
                matrixHeaderViewportRef={matrixHeaderViewportRef}
                matrixGeometry={matrixGeometry}
                tableContainerRef={tableContainerRef}
                handleMatrixScroll={handleMatrixScroll}
                matrixTableRef={matrixTableRef}
                loading={loading}
                daysInMonth={daysInMonth}
                filteredSummaryData={filteredSummaryData}
                daysArray={daysArray}
                isFutureSummaryDay={isFutureSummaryDay}
                renderEngineButton={renderEngineButton}
            />
        );
    }, [
        isMobile, desktopView, filteredSummaryData, daysArray, currentDay,
        loading, user, pendingCommands, matrixGeometry
    ]);

    return (
        <div className="payment-summary-container" style={{ '--summary-header-height': `${summaryHeaderHeight}px` }} >

            {/* Desktop Header */}
            <PageHeader
                title={<h1>Estatus de Pagos</h1>}
                onRefresh={fetchData}
                loading={loading}
                refreshText="Actualizar"
                onFilterToggle={handleFilterToggle}
                showFilters={showFilters}
                desktopActions={
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
                }
            />
            <div ref={summaryHeaderRef} className={`summary-header${isSummaryHeaderStuck ? ' is-stuck' : ''}`} >

                {/* ── Controles: mes / año / acciones ────────────────────────────── */}
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
                </div>
            </div>

            <div className={`expandable-metrics-container ${showFilters ? 'expanded' : 'collapsed'}`}>
                <SearchAndFilterBar
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    searchPlaceholder="Buscar moto o conductor…"
                    filter={statusFilter}
                    setFilter={setStatusFilter}
                    filterOptions={[
                        { value: 'all', label: 'Todos' },
                        { value: 'debt', label: 'Con deuda' },
                        { value: 'ok', label: 'Al día' },
                        { value: 'cutoff', label: 'Apagados' }
                    ]}
                    filterRowClass="summary-filter-row-ios"
                />
            </div>

            {renderViews}


        </div>
    );
};

export default PaymentSummary;
