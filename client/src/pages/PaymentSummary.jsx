import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Download, PowerOff, Power, LayoutList, Table2, Search, X, ListFilter } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { exportPaymentsCSV, cutoffDebtors, getStatusReport, controlEngine } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Calendar, DollarSign, Activity, FileText, Check, Zap, Filter, ArrowRight, Save, MapPin, Navigation, Smartphone, ChevronDown } from 'lucide-react';
import MobileHeaderAction from '../components/MobileHeaderAction';
import { showToast } from '../utils/toast';
import useDeviceUpdates from '../hooks/useDeviceUpdates';
import './PaymentSummary.css';
import BikePaymentSummary from '../components/BikePaymentSummary';
import MatrixPaymentSummary from '../components/MatrixPaymentSummary';
import { setDayTypesConfig } from '../utils/dayTypes';
import MotorIcon from '../components/MotorIcon';
import SearchAndFilterBar from '../components/SearchAndFilterBar';
import MonthYearSelector from '../components/MonthYearSelector';
import PageHeader from '../components/PageHeader';
import useIsMobile from '../hooks/useIsMobile';
import useAssistantScreenBridge from '../hooks/useAssistantScreenBridge';
import { usePaymentSummaryQuery, useScreenQueryClient, screenQueryKeys } from '../hooks/useScreenQueries';

const InvoiceAdjustmentModal = React.lazy(() => import('../components/modals/InvoiceAdjustmentModal'));
const CreateDayInvoiceModal = React.lazy(() => import('../components/modals/CreateDayInvoiceModal'));

import { ENGINERESUME, ENGINESTOP, COLORS } from '../constants';

const DESKTOP_VIEW_STORAGE_KEY = 'payment-summary.desktop-view';

const getInitialDesktopView = () => {
    try {
        return window.localStorage.getItem(DESKTOP_VIEW_STORAGE_KEY) === 'matrix' ? 'matrix' : 'bike';
    } catch {
        return 'bike';
    }
};

const summaryKeyOf = (device) => String(device?.gpsId || device?.deviceId || device?.name || '');

const buildSummaryMap = (items) => {
    const map = {};
    (items || []).forEach(item => {
        const devKey = summaryKeyOf(item.device);
        if (devKey && devKey !== 'undefined') {
            map[devKey] = item;
        }
    });
    return map;
};

const PaymentSummary = () => {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [pendingCommands, setPendingCommands] = useState({});
    const isMobile = useIsMobile();
    const [desktopView, setDesktopView] = useState(getInitialDesktopView);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all | debt | ok | cutoff
    const [showFilters, setShowFilters] = useState(false);

    // Modals for day pill action (adjustment if invoice exists, create day invoice if not)
    const [adjustmentModal, setAdjustmentModal] = useState({ open: false, invoice: null });
    const [createInvoiceModal, setCreateInvoiceModal] = useState({ open: false, deviceName: '', date: '', driverName: '' });

    const handleDayClick = (item, day, dayData) => {
        const monthStr = String(selectedMonth).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `${selectedYear}-${monthStr}-${dayStr}`;
        const deviceName = item.device?.name || item.device?.deviceId || '';

        if (dayData) {
            setAdjustmentModal({
                open: true,
                invoice: {
                    invoiceId: dayData.invoiceId || dayData._id || `${deviceName}-${dateStr}`,
                    _id: dayData.invoiceId || dayData._id || `${deviceName}-${dateStr}`,
                    deviceIdName: deviceName,
                    amount: dayData.amount !== undefined && dayData.amount !== null ? dayData.amount : 35000,
                    date: dayData.date || dateStr,
                    dayType: dayData.dayType,
                    adjustmentType: dayData.adjustmentType,
                    adjustmentReference: dayData.adjustmentReference,
                    adjustmentComment: dayData.adjustmentComment
                }
            });
        } else {
            setCreateInvoiceModal({
                open: true,
                deviceName,
                date: dateStr,
                driverName: item.device?.customerName || item.device?.driverName || ''
            });
        }
    };

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

    // Cached per month/year: coming back to the tab paints the last data instantly
    const summaryQuery = usePaymentSummaryQuery({ month: selectedMonth, year: selectedYear });
    const { queryClient, companyKey } = useScreenQueryClient();
    const loading = summaryQuery.isPending;
    const refreshing = summaryQuery.isFetching;
    const [summaryDataMap, setSummaryDataMap] = useState(() => {
        if (summaryQuery.data?.dayTypesConfig) setDayTypesConfig(summaryQuery.data.dayTypesConfig);
        return buildSummaryMap(summaryQuery.data?.data);
    });
    const summaryData = useMemo(() => Object.values(summaryDataMap), [summaryDataMap]);

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

    // Sync the screen map from the cache. Anti-race: if the API response is older
    // than the device state we already got through SSE, keep the SSE state.
    useEffect(() => {
        const response = summaryQuery.data;
        if (!response) return;
        if (response.dayTypesConfig) setDayTypesConfig(response.dayTypesConfig);
        const map = buildSummaryMap(response.data);
        setSummaryDataMap(prev => {
            const next = { ...map };
            Object.keys(next).forEach(key => {
                const prevDev = prev[key]?.device;
                const nextDev = next[key].device;
                if (prevDev?.lastUpdate && nextDev?.lastUpdate) {
                    if (new Date(prevDev.lastUpdate) > new Date(nextDev.lastUpdate)) {
                        next[key] = { ...next[key], device: { ...nextDev, ...prevDev } };
                    }
                }
            });
            return next;
        });
    }, [summaryQuery.data]);

    useEffect(() => {
        if (summaryQuery.error) console.error('Error fetching summary:', summaryQuery.error);
    }, [summaryQuery.error]);

    const fetchData = () => summaryQuery.refetch();

    // Realtime (SSE) device changes live in the local map. When leaving the tab, write
    // them back into the cache so coming back doesn't paint older engine states. The
    // original fetch time is kept, so the entry still goes stale on schedule.
    const latestSummaryRef = useRef({ map: summaryDataMap, month: selectedMonth, year: selectedYear });
    latestSummaryRef.current = { map: summaryDataMap, month: selectedMonth, year: selectedYear };
    useEffect(() => () => {
        const { map, month, year } = latestSummaryRef.current;
        const key = screenQueryKeys.paymentSummary(companyKey, month, year);
        const state = queryClient.getQueryState(key);
        if (!state?.data) return;
        const items = Object.values(map).map(item => {
            if (!item?.device?.queued) return item;
            const { queued: _queued, ...device } = item.device;
            return { ...item, device };
        });
        queryClient.setQueryData(key, old => (old ? { ...old, data: items } : old), { updatedAt: state.dataUpdatedAt });
    }, [queryClient, companyKey]);

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
        const vehicleId = device._id || device.id || device.gpsId;
        const gpsId = device.gpsId;
        const command = device.cutOff ? ENGINERESUME : ENGINESTOP;
        setPendingCommands(prev => ({ ...prev, [gpsId]: true, [vehicleId]: true }));
        try {
            const result = await controlEngine(vehicleId, command);
            const data = result.data || result;
            const resObj = data.response || data;

            if (data.success || resObj.success) {
                showToast(`Comando encolado en Traccar para ${device.name}`, 'info');
                setSummaryDataMap(prev => {
                    const next = { ...prev };
                    const primaryKey = String(gpsId || vehicleId);
                    if (next[primaryKey]) {
                        // Anti-Race Condition: Only set queued: true if the cutOff state hasn't already been flipped by a blazing-fast SSE webhook!
                        if (next[primaryKey].device.cutOff === !!device.cutOff) {
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
        } finally {
            setPendingCommands(prev => {
                const next = { ...prev };
                delete next[gpsId];
                delete next[vehicleId];
                return next;
            });
        }
    };

    const [bulkOffLoading, setBulkOffLoading] = useState(false);
    const [showBulkOffModal, setShowBulkOffModal] = useState(false);

    const handleBulkEngineOff = async () => {
        setShowBulkOffModal(false);
        setBulkOffLoading(true);
        try {
            const result = await cutoffDebtors();
            const msg = result?.message || (result?.success ? 'Comandos de apagado encolados para vehículos morosos' : 'Error al apagar morosos');
            showToast(msg, result?.success ? 'success' : 'error');
            await fetchData(true);
        } catch (err) {
            showToast(err.message || 'Error al apagar morosos', 'error');
        } finally {
            setBulkOffLoading(false);
        }
    };

    // Real-time SSE listening for device status updates in summary view
    useDeviceUpdates((updates) => {
        setSummaryDataMap(prev => {
            const next = { ...prev };
            let matchFound = false;
            updates.forEach(u => {
                const key = String(u.gpsId || u.deviceId || u.name || '');
                if (key && next[key]) {
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
    });

    const morososCount = useMemo(() => {
        return summaryData.filter(item => (item.device.unpaidTotal || 0) > 0).length;
    }, [summaryData]);

    const okCount = useMemo(() => {
        return summaryData.filter(item => (item.device.unpaidTotal || 0) === 0).length;
    }, [summaryData]);

    const cutoffCount = useMemo(() => {
        return summaryData.filter(item => {
            const status = getDeviceStatus(item.device.deviceId || item.device.name);
            return Boolean(status?.cutOff);
        }).length;
    }, [summaryData, getDeviceStatus]);

    const weeklyCount = useMemo(() => {
        return summaryData.filter(item => (item.device?.paymentFrequency || 1) > 1).length;
    }, [summaryData]);

    // ── Frontend filter (no extra API call) ─────────────────────────────────
    const filteredSummaryData = summaryData.filter(item => {
        // Text search: device name or driver name
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const nameMatch = item.device.name?.toLowerCase().includes(q);
            const driverMatch = (item.device.customerName || item.device.driverName)?.toLowerCase().includes(q);
            if (!nameMatch && !driverMatch) return false;
        }
        // Status pill filter
        if (statusFilter === 'debt') return (item.device.unpaidTotal || 0) > 0;
        if (statusFilter === 'ok') return (item.device.unpaidTotal || 0) === 0;
        if (statusFilter === 'cutoff') {
            const status = getDeviceStatus(item.device.deviceId || item.device.name);
            return Boolean(status?.cutOff);
        }
        if (statusFilter === 'weekly') {
            return (item.device?.paymentFrequency || 1) > 1;
        }
        return true;
    });

    const filteredDebtTotal = useMemo(
        () =>
            filteredSummaryData.reduce(
                (sum, item) => sum + (Number(item.device?.unpaidTotal) || 0),
                0
            ),
        [filteredSummaryData]
    );

    const weeklyDebtorsCount = useMemo(
        () =>
            summaryData.filter(
                (item) =>
                    (item.device?.paymentFrequency || 1) > 1 &&
                    (item.device?.unpaidTotal || 0) > 0
            ).length,
        [summaryData]
    );

    const weeklyDebtTotal = useMemo(
        () =>
            summaryData
                .filter(
                    (item) =>
                        (item.device?.paymentFrequency || 1) > 1 &&
                        (item.device?.unpaidTotal || 0) > 0
                )
                .reduce((sum, item) => sum + (Number(item.device?.unpaidTotal) || 0), 0),
        [summaryData]
    );

    const assistantSummaryCards = useMemo(() => {
        const sourceList =
            statusFilter === 'all' && !searchQuery
                ? [...filteredSummaryData]
                      .filter((it) => (Number(it.device?.unpaidTotal) || 0) > 0)
                      .sort((a, b) => (Number(b.device?.unpaidTotal) || 0) - (Number(a.device?.unpaidTotal) || 0))
                : [...filteredSummaryData].sort(
                      (a, b) => (Number(b.device?.unpaidTotal) || 0) - (Number(a.device?.unpaidTotal) || 0)
                  );
        if (!sourceList.length) return null;
        const fmtCop = (n) =>
            new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency: 'COP',
                maximumFractionDigits: 0,
            }).format(Number(n) || 0);
        return {
            kind: 'list',
            items: sourceList.slice(0, 5).map((item) => ({
                title: item.device?.name || item.device?.deviceId || 'Moto',
                subtitle:
                    item.device?.customerName ||
                    item.device?.driverName ||
                    (item.device?.unpaidCount ? `${item.device.unpaidCount} días pendientes` : 'Al día'),
                value: fmtCop(item.device?.unpaidTotal || 0),
            })),
        };
    }, [filteredSummaryData, statusFilter, searchQuery]);

    useAssistantScreenBridge('summary', {
        loading,
        activeFilters: {
            status: statusFilter,
            searchQuery,
            month: selectedMonth,
            year: selectedYear,
            view: desktopView,
        },
        metrics: {
            filteredCount: filteredSummaryData.length,
            debtorsCount: morososCount,
            okCount,
            cutoffCount,
            filteredDebtTotal,
            weeklyDebtorsCount,
            weeklyDebtTotal,
        },
        cardsData: assistantSummaryCards,
        singleMatchItem:
            Boolean(searchQuery || statusFilter !== 'all') && filteredSummaryData.length === 1
                ? filteredSummaryData[0]?.device?.name || filteredSummaryData[0]?.device?.deviceId || null
                : null,
        applyFilter: (params = {}) => {
            if (params.status) setStatusFilter(params.status);
            if (params.month) setSelectedMonth(Number(params.month));
            if (params.year) setSelectedYear(Number(params.year));
            if (params.view) handleDesktopViewChange(params.view);
            return true;
        },
        search: (q) => {
            setSearchQuery(q);
            return true;
        },
        clearFilters: () => {
            setStatusFilter('all');
            setSearchQuery('');
            return true;
        },
    });

    const renderEngineButton = (item) => {
        const dev = item.device;
        const devId = dev.deviceId;
        const isOff = !!dev.cutOff;
        const isPendingCommand = !!pendingCommands[devId];
        const isQueued = !!dev.queued;
        const isDisabled = isPendingCommand || isQueued;

        return (
            <button
                onClick={() => handleEngineToggle(dev)}
                disabled={isDisabled}
                className={`engine-toggle-slider summary-engine-toggle-compact ${isOff ? 'deactivated' : 'active'} ${isPendingCommand ? 'pending' : ''} ${isQueued ? 'queued' : ''}`}
                title={isQueued ? 'Comando en cola (esperando señal GPS)' : (isOff ? 'Activar Moto' : 'Desactivar Moto')}
            >
                <div className="slider-knob">
                    {isPendingCommand
                        ? <RefreshCw size={10} className="spin" />
                        : <Power size={10} />}
                </div>
            </button>
        );
    };



    const handleFilterToggle = () => setShowFilters(prev => !prev);

    const renderViews = useMemo(() => {
        if (desktopView === 'bike') {
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
                    onDayClick={handleDayClick}
                />
            );
        }

        return (
            <MatrixPaymentSummary
                loading={loading}
                daysInMonth={daysInMonth}
                filteredSummaryData={filteredSummaryData}
                daysArray={daysArray}
                isFutureSummaryDay={isFutureSummaryDay}
                renderEngineButton={renderEngineButton}
                onDayClick={handleDayClick}
            />
        );
    }, [
        desktopView, filteredSummaryData, daysArray, currentDay,
        loading, user, pendingCommands, handleDayClick
    ]);

    const autoOffButton = (
        <button
            type="button"
            className="select-control auto-cutoff-btn"
            title={`Apagar motor de vehículos morosos (${morososCount})`}
            onClick={() => setShowBulkOffModal(true)}
            disabled={bulkOffLoading || morososCount === 0}
        >
            <Power size={19} className={bulkOffLoading ? 'spin' : ''} aria-hidden="true" />
        </button>
    );

    const viewToggleSegment = (
        <div className="summary-view-segment" role="group" aria-label="Vista del resumen de pagos">
            <button
                type="button"
                className={`summary-view-option${desktopView === 'bike' ? ' active' : ''}`}
                onClick={() => handleDesktopViewChange('bike')}
                aria-pressed={desktopView === 'bike'}
                title="Vista por tarjeta / moto"
            >
                <LayoutList size={16} aria-hidden="true" />
                <span>Tarjetas</span>
            </button>
            <button
                type="button"
                className={`summary-view-option${desktopView === 'matrix' ? ' active' : ''}`}
                onClick={() => handleDesktopViewChange('matrix')}
                aria-pressed={desktopView === 'matrix'}
                title="Vista de matriz / tabla"
            >
                <Table2 size={16} aria-hidden="true" />
                <span>Matriz</span>
            </button>
        </div>
    );

    const desktopHeader = (
        <PageHeader.Desktop
            title={t('sidebar.summary', 'Estatus de Pagos')}
            breadcrumbs={[
                { label: 'Cobranza' },
                { label: t('sidebar.summary', 'Estatus de Pagos') }
            ]}
            onRefresh={fetchData}
            loading={refreshing}
            refreshText={t('payments.refresh', 'Actualizar')}
            leadingActions={
                <div className="summary-header-action-group">
                    <MonthYearSelector
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        onChangeMonth={(m) => setSelectedMonth(m)}
                        onChangeYear={(y) => setSelectedYear(y)}
                        includeAllMonths={false}
                    />
                </div>
            }
            actions={
                <div className="summary-header-action-group">
                    {viewToggleSegment}
                    {autoOffButton}
                </div>
            }
        />
    );

    const mobileHeader = (
        <PageHeader.Mobile
            onRefresh={fetchData}
            loading={refreshing}
            onFilterToggle={handleFilterToggle}
            showFilters={showFilters}
            datePicker={{
                selectedMonth,
                selectedYear,
                onSelect: (m) => setSelectedMonth(m)
            }}
        />
    );

    const renderHeader = isMobile ? mobileHeader : desktopHeader;

    return (
        <div className="payment-summary-container">

            {renderHeader}

            {/* Mobile Collapsible Filter & Search Section */}
            {isMobile && showFilters && (
                <div className="mobile-filter-section">
                    <div className="mobile-search-bar">
                        <Search size={16} className="search-icon" />
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar moto o conductor…"
                            className="mobile-search-input"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="clear-search"
                                title="Limpiar búsqueda"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <div className="filter-pills-row no-scrollbar">
                        <button
                            type="button"
                            onClick={() => setStatusFilter('all')}
                            className={`filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
                        >
                            <span>Todos</span>
                            <span className="pill-count">{loading ? <span className="skeleton skeleton-sm" aria-hidden="true" /> : summaryData.length}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('debt')}
                            className={`filter-pill ${statusFilter === 'debt' ? 'active' : ''}`}
                        >
                            <span>Con deuda</span>
                            <span className="pill-count pill-count--debt">{loading ? <span className="skeleton skeleton-sm" aria-hidden="true" /> : morososCount}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('ok')}
                            className={`filter-pill ${statusFilter === 'ok' ? 'active' : ''}`}
                        >
                            <span>Al día</span>
                            <span className="pill-count pill-count--ok">{loading ? <span className="skeleton skeleton-sm" aria-hidden="true" /> : okCount}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('cutoff')}
                            className={`filter-pill ${statusFilter === 'cutoff' ? 'active' : ''}`}
                        >
                            <span>Apagados</span>
                            <span className="pill-count pill-count--cutoff">{loading ? <span className="skeleton skeleton-sm" aria-hidden="true" /> : cutoffCount}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('weekly')}
                            className={`filter-pill ${statusFilter === 'weekly' ? 'active' : ''}`}
                        >
                            <span>Semanal+</span>
                            <span className="pill-count pill-count--weekly">{loading ? <span className="skeleton skeleton-sm" aria-hidden="true" /> : weeklyCount}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Desktop Filters (Desktop only) */}
            {!isMobile && (
                <SearchAndFilterBar
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    searchPlaceholder="Buscar moto o conductor…"
                    filter={statusFilter}
                    setFilter={setStatusFilter}
                    filterOptions={[
                        { value: 'all', label: 'Todos', badge: loading ? null : summaryData.length, badgeType: 'all' },
                        { value: 'debt', label: 'Con deuda', badge: loading ? null : morososCount, badgeType: 'debt' },
                        { value: 'ok', label: 'Al día', badge: loading ? null : okCount, badgeType: 'ok' },
                        { value: 'cutoff', label: 'Apagados', badge: loading ? null : cutoffCount, badgeType: 'cutoff' },
                        { value: 'weekly', label: 'Semanal+', badge: loading ? null : weeklyCount, badgeType: 'weekly' }
                    ]}
                    filterRowClass="summary-filter-row-ios"
                />
            )}

            {renderViews}

            {showBulkOffModal && (
                <div className="modal-overlay">
                    <div className="modal-content bulk-cutoff-modal">
                        <div className="bulk-cutoff-modal-icon">
                            <PowerOff size={24} />
                        </div>
                        <h3 className="bulk-cutoff-modal-title">
                            ¿Apagar motor de morosos?
                        </h3>
                        <p className="bulk-cutoff-modal-desc">
                            Se enviará la orden de apagado de motor a los <strong>{morososCount}</strong> vehículos que presentan saldo pendiente.
                        </p>
                        <div className="bulk-cutoff-modal-actions">
                            <button
                                type="button"
                                className="bulk-cutoff-modal-btn-cancel"
                                onClick={() => setShowBulkOffModal(false)}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="bulk-cutoff-modal-btn-confirm"
                                onClick={handleBulkEngineOff}
                                disabled={bulkOffLoading}
                            >
                                {bulkOffLoading ? 'Enviando…' : 'Sí, Apagar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modales Inmersivos con carga bajo demanda (React.lazy) */}
            <Suspense fallback={null}>
                {adjustmentModal.open && (
                    <InvoiceAdjustmentModal
                        isOpen={adjustmentModal.open}
                        invoice={adjustmentModal.invoice}
                        onClose={() => setAdjustmentModal({ open: false, invoice: null })}
                        onSuccess={() => fetchData()}
                    />
                )}

                {createInvoiceModal.open && (
                    <CreateDayInvoiceModal
                        isOpen={createInvoiceModal.open}
                        deviceName={createInvoiceModal.deviceName}
                        date={createInvoiceModal.date}
                        driverName={createInvoiceModal.driverName}
                        onClose={() => setCreateInvoiceModal({ open: false, deviceName: '', date: '', driverName: '' })}
                        onSuccess={() => fetchData()}
                    />
                )}
            </Suspense>

        </div>
    );
};

export default PaymentSummary;
