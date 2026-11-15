import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Edit, RefreshCw, Share2, BatteryLow, BatteryMedium, BatteryFull, Power, ZapOff } from 'lucide-react';
import { showToast } from '../utils/toast';
import { formatOfflineTimeShort } from '../utils/helpers';
import { getAllDevices, updateDevice, controlEngine } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSSE } from '../context/SSEContext';
import DeviceFormModal from '../components/modals/DeviceFormModal';
import ShareDeviceModal from '../components/modals/ShareDeviceModal';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import useIsMobile from '../hooks/useIsMobile';
import './DeviceSelector.css';
import SearchAndFilterBar from '../components/SearchAndFilterBar';
import MotorIcon from '../components/MotorIcon';

import { ENGINERESUME, ENGINESTOP, COLORS } from '../constants';


const DeviceManagement = () => {
    const isMobile = useIsMobile();
    const { subscribe } = useSSE();
    const { t } = useTranslation();
    const { user } = useAuth();
    const [devices, setDevices] = useState({});
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingDevice, setEditingDevice] = useState(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [selectedShareDevice, setSelectedShareDevice] = useState(null);
    const [shareUrl, setShareUrl] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('all'); // all, active, available, off, on, offline
    const [sortBy, setSortBy] = useState('default'); // default, offline
    const [pendingCommands, setPendingCommands] = useState({});
    const [showFilters, setShowFilters] = useState(false);

    const [formData, setFormData] = useState({
        _id: '',
        deviceName: '',
        nequiNumber: '',
        simCardNumber: '',
        DailyPayment: false
    });
    const loadDevices = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            let result = await getAllDevices();
            if (result.success) {
                const deviceArray = result.devices || [];
                const deviceMap = {};
                deviceArray.forEach(d => {
                    if (d.gpsId) deviceMap[String(d.gpsId)] = d;
                });
                setDevices(deviceMap);
            }
        } catch (err) {
            console.error('Error fetching devices:', err);
            if (!isSilent) showToast('Failed to load devices', 'error');
        } finally {
            if (!isSilent) setLoading(false);
        }
    };
    useEffect(() => {
        loadDevices();
    }, []);

    useEffect(() => {
        const unsub = subscribe('device_update', (e) => {
            try {
                const data = e.parsedData;
                if (!data) return;
                const updates = Array.isArray(data) ? data : [data];
                setDevices((prevDevices) => {
                    let matchFound = false;
                    const next = { ...prevDevices };
                    updates.forEach(u => {
                        const targetId = String(u.gpsId);
                        if (targetId && next[targetId]) {
                            matchFound = true;
                            next[targetId] = {
                                ...next[targetId],
                                ...u
                            };
                        }
                    });
                    return matchFound ? next : prevDevices;
                });

                // Clear pending commands for updated devices
                setPendingCommands(prev => {
                    let changed = false;
                    const next = { ...prev };
                    updates.forEach(u => {
                        const gpsKey = u.gpsId ? String(u.gpsId) : null;
                        const devKey = u._id ? String(u._id) : (u.id ? String(u.id) : null);
                        if (gpsKey && next[gpsKey]) {
                            delete next[gpsKey];
                            changed = true;
                        }
                        if (devKey && next[devKey]) {
                            delete next[devKey];
                            changed = true;
                        }
                    });
                    return changed ? next : prev;
                });
            } catch (err) {
                console.error('Error in DeviceSelector SSE listener:', err);
            }
        });

        return () => {
            unsub();
        };
    }, [subscribe]);


    const handleShare = (device) => {
        setSelectedShareDevice(device);
        const url = `${window.location.origin}/p/${device.name}`;
        setShareUrl(url);
        setShowShareModal(true);
    };

    const copyToClipboard = async () => {
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(shareUrl);
                showToast('Enlace copiado al portapapeles', 'success');
                return;
            } catch (err) {
                console.error('Failed to copy text with clipboard API: ', err);
            }
        }

        // Fallback for non-secure contexts or older browsers
        try {
            const textArea = document.createElement("textarea");
            textArea.value = shareUrl;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            textArea.setSelectionRange(0, 99999); /* For mobile devices */
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast('Enlace copiado al portapapeles', 'success');
        } catch (err) {
            console.error('Unable to copy', err);
            showToast('Error al copiar el enlace manualmente.', 'error');
        }
    };


    const handleEditDevice = (device) => {
        setEditingDevice(device);
        setFormData({
            _id: device._id || device.id,
            deviceName: device.deviceName || device.name || '',
            nequiNumber: device.nequiNumber || '',
            simCardNumber: device.simCardNumber || '',
            DailyPayment: Boolean(device.attributes?.DailyPayment)
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const result = await updateDevice(formData._id, formData);
            if (result.success) {
                setShowModal(false);
                loadDevices();
                showToast('Información de la SIM guardada', 'success');
            } else {
                showToast(result.error || 'Failed to update device', 'error');
            }
        } catch (err) {
            console.error('Error saving device:', err);
            showToast('Failed to save device', 'error');
        }
    };


    const handleEngineToggle = async (device) => {
        const vehicleId = device._id || device.id || device.gpsId;
        const gpsId = device.gpsId;
        const command = device.cutOff ? ENGINERESUME : ENGINESTOP;
        setPendingCommands(prev => ({ ...prev, [gpsId]: true, [vehicleId]: true }));
        try {
            const data = await controlEngine(vehicleId, command);
            if (data.success) {
                setDevices((prevDevices) => {
                    const next = { ...prevDevices };
                    const targetId = String(gpsId || vehicleId);
                    if (targetId && next[targetId]) {
                        next[targetId] = {
                            ...next[targetId],
                            queued: true,
                            ...(data.device || {})
                        };
                    }
                    return next;
                });
            } else {
                showToast(data.error || 'No se pudo enviar el comando', 'error');
                setPendingCommands(prev => {
                    const next = { ...prev };
                    delete next[gpsId];
                    delete next[vehicleId];
                    return next;
                });
            }
        } catch (err) {
            console.error('Engine control error:', err);
            showToast('Error de conexión al enviar comando', 'error');
            setPendingCommands(prev => {
                const next = { ...prev };
                delete next[gpsId];
                delete next[vehicleId];
                return next;
            });
        }
    };

    const getOfflineMs = (device) => {
        if (!device?.lastUpdate) return -1;
        let lastMs = typeof device.lastUpdate === 'number' ? device.lastUpdate : new Date(device.lastUpdate).getTime();
        if (isNaN(lastMs)) {
            lastMs = new Date(String(device.lastUpdate).replace(' ', 'T')).getTime();
        }
        if (isNaN(lastMs)) return -1;
        return Math.max(0, Date.now() - lastMs);
    };

    const isDeviceOffline = (device) => {
        if (!device?.lastUpdate) return true;
        const diffMs = getOfflineMs(device);
        return diffMs >= 3 * 60 * 1000; // >= 3 minutes matching DEVICE_ONLINE_TIMEOUT
    };

    const devicesList = Object.values(devices);
    const offlineDevicesCount = devicesList.filter(isDeviceOffline).length;

    const filteredDevices = devicesList.filter(device => {
        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const deviceName = device.name || device.deviceName || ''; // Handle both structures
            const deviceId = device.id || '';

            if (!String(deviceId).includes(query) &&
                !deviceName.toLowerCase().includes(query)) {
                return false;
            }
        }

        // Status filter
        if (filter === 'active' && !device.hasActiveContract) return false;
        if (filter === 'available' && (device.hasActiveContract || !device.isActive)) return false;
        if (filter === 'off' && !device.cutOff) return false;
        if (filter === 'on' && !device.ignition) return false;
        if (filter === 'offline' && !isDeviceOffline(device)) return false;
        return true;
    });

    const sortedDevices = [...filteredDevices].sort((a, b) => {
        if (filter === 'offline' || sortBy === 'offline') {
            const msA = getOfflineMs(a);
            const msB = getOfflineMs(b);
            // Both have positive offline timestamps: largest elapsed time first (e.g. 35d before 2d)
            if (msA > 0 && msB > 0) return msB - msA;
            // Known offline time comes before unknown signal
            if (msA > 0 && msB <= 0) return -1;
            if (msB > 0 && msA <= 0) return 1;
            return 0;
        }
        return 0;
    });

    if (loading) {
        return (
            <div className="devices-page">
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>{t('common.loading')}</p>
                </div>
            </div>
        );
    }

    const desktopHeader = (
        <PageHeader.Desktop
            title={t('devices.title')}
            breadcrumbs={[
                { label: 'Flota' },
                { label: t('devices.title') }
            ]}
            onRefresh={loadDevices}
            loading={loading}
            refreshText={t('payments.refresh')}
        />
    );

    const mobileHeader = (
        <PageHeader.Mobile
            onRefresh={loadDevices}
            loading={loading}
            onFilterToggle={() => setShowFilters(!showFilters)}
            showFilters={showFilters}
        />
    );

    const renderHeader = isMobile ? mobileHeader : desktopHeader;

    return (
        <div className="admin-page-container ios-devices-page">
            {renderHeader}

            {/* Expandable Metrics Section */}
            <div className={`expandable-metrics-container ${!isMobile || showFilters ? 'expanded' : 'collapsed'}`}>
                <div className="devices-stats-ios">
                    <StatCard
                        title={t('devices.totalDevices')}
                        value={devicesList.length}
                    />
                    <StatCard
                        title={t('devices.activeContracts')}
                        value={devicesList.filter(d => d.hasActiveContract).length}
                        valueColor={COLORS.SUCCESS}
                    />
                    <StatCard
                        title={t('devices.available')}
                        value={devicesList.filter(d => !d.hasActiveContract && (d.isActive !== false)).length}
                        valueColor={COLORS.WARNING}
                    />
                </div>
                <SearchAndFilterBar
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    searchPlaceholder={t('devices.searchPlaceholder')}
                    filter={filter}
                    setFilter={setFilter}
                    filterOptions={[
                        { value: 'all', label: t('devices.filterAll') },
                        {
                            value: 'offline', label: 'Desconexión',
                            badge: offlineDevicesCount,
                            badgeType: 'cutoff'
                        },
                        { value: 'active', label: t('devices.filterActive') },
                        { value: 'on', label: t('devices.filterOn') },
                        { value: 'off', label: t('devices.filterOff') },

                    ]}
                />
            </div>

            {/* iOS Device Table */}
            <div className="devices-table-card-ios">
                {/* Table Header Band */}
                <div className="devices-table-header-ios">
                    <span>{t('devices.table.contract')}</span>
                    <span className="col-center">Pagado</span>
                    <span className="col-center desktop-col">Deuda</span>
                    <span className="col-center desktop-col">Estado</span>
                    <span className="col-center desktop-col">Días</span>
                    <span
                        className="col-center table-header-sortable"
                        onClick={() => setSortBy(prev => prev === 'offline' ? 'default' : 'offline')}
                        title="Clic para alternar orden por mayor tiempo de desconexión"
                    >
                        Motor {sortBy === 'offline' || filter === 'offline' ? '⏱️↓' : ''}
                    </span>
                    <span className="col-center">Acc.</span>
                </div>

                {/* Table Rows */}
                <div className="devices-table-rows-ios">
                    {sortedDevices.map((device) => (
                        <div key={device._id} className="devices-row-ios">
                            {/* Device Name + Contract ID */}
                            <div className="device-name-col">
                                <a href={`/p/${device.name}`} target="_blank" rel="noopener noreferrer" className="device-name-link">
                                    <span className="device-name-text">{device.name}</span>
                                    {device.contractId && (
                                        <span className="device-contract-id">{device.contractId}</span>
                                    )}
                                </a>
                            </div>

                            {/* Pagado */}
                            <div className={`col-center device-paid-col ${(device.monthPaid || 0) > 0 ? 'paid-positive' : 'paid-zero'}`}>
                                ${(device.monthPaid || 0).toLocaleString()}
                            </div>

                            {/* Deuda — desktop only */}
                            <div className={`col-center device-debt-col desktop-col ${(device.monthDebt || 0) > 0 ? 'debt-positive' : 'debt-zero'}`}>
                                ${(device.monthDebt || 0).toLocaleString()}
                            </div>

                            {/* Status badge — desktop only */}
                            <div className="col-center desktop-col">
                                {device.status ? (
                                    <span className={`status-badge-device-ios ${device.monthDebt > 0 ? 'debt' : device.hasActiveContract ? 'active' : 'free'}`}>
                                        {device.status}
                                    </span>
                                ) : (
                                    <span className="status-badge-device-ios free">Libre</span>
                                )}
                            </div>

                            {/* Free days — desktop only */}
                            <div className="col-center desktop-col device-freedays-col">
                                {device.freeDays || 0}
                            </div>

                            {/* Motor: icon + battery (with offline text) + toggle */}
                            <div className="col-center device-motor-col">
                                <div className={`motor-icon-wrap ${Boolean(device.cutOff) ? 'motor-off' : device.ignition ? 'motor-on' : 'motor-idle'}`}>
                                    <MotorIcon />
                                </div>
                                <div className="battery-column-container">
                                    <div
                                        className={`battery-wrap ${device.powerCut ? 'bat-powercut' : device.batteryLevel > 70 ? 'bat-full' : device.batteryLevel > 30 ? 'bat-mid' : 'bat-low'}`}
                                        title={device.powerCut ? '¡Alerta! Batería principal desconectada' : `Batería: ${device.batteryLevel ?? 'N/A'}%`}
                                    >
                                        {device.powerCut ? (
                                            <ZapOff size={15} className="animate-pulse" />
                                        ) : device.batteryLevel > 70 ? (
                                            <BatteryFull size={15} />
                                        ) : device.batteryLevel > 30 ? (
                                            <BatteryMedium size={15} />
                                        ) : (
                                            <BatteryLow size={15} className={device.batteryLevel <= 30 ? 'animate-pulse' : ''} />
                                        )}
                                    </div>
                                    {device.lastUpdate ? (
                                        formatOfflineTimeShort(device.lastUpdate) && (
                                            <span
                                                className="battery-offline-subtext"
                                                title={`Inactivo desde: ${new Date(device.lastUpdate).toLocaleString('es-CO')}`}
                                            >
                                                {formatOfflineTimeShort(device.lastUpdate)}
                                            </span>
                                        )
                                    ) : (
                                        <span
                                            className="battery-offline-subtext"
                                            style={{ color: '#94a3b8' }}
                                            title="Sin reportes GPS registrados"
                                        >
                                            Sin GPS
                                        </span>
                                    )}
                                </div>
                                {user?.role !== 'viewer' ? (() => {
                                    const isQueued = Boolean(device.queued);
                                    return (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleEngineToggle(device); }}
                                            disabled={pendingCommands[device.id]}
                                            className={`engine-toggle-slider ${Boolean(device.cutOff) ? 'deactivated' : 'active'} ${pendingCommands[device.id] ? 'pending' : ''} ${isQueued ? 'queued' : ''}`}
                                            title={isQueued ? 'Comando en cola (esperando señal GPS)' : (Boolean(device.cutOff) ? 'Activar Moto' : 'Desactivar Moto')}
                                        >
                                            <div className="slider-knob">
                                                {pendingCommands[device.id] ? <RefreshCw size={12} className="spin" /> : <Power size={12} />}
                                            </div>
                                        </button>
                                    );
                                })() : (
                                    <div className={`engine-toggle-slider ${Boolean(device.cutOff) ? 'deactivated' : 'active'}`} style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                                        <div className="slider-knob"><Power size={12} /></div>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="col-center device-actions-col">
                                <button className="action-icon-btn" onClick={(e) => { e.stopPropagation(); handleShare(device); }} title="Compartir">
                                    <Share2 size={15} />
                                </button>
                                {user?.role !== 'viewer' && (
                                    <button className="action-icon-btn" onClick={(e) => { e.stopPropagation(); handleEditDevice(device); }} title="Editar">
                                        <Edit size={15} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {sortedDevices.length === 0 && (
                <div className="empty-state-ios">
                    <p>{t('devices.emptyState')}</p>
                </div>
            )}

            <DeviceFormModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSubmit={handleSubmit}
                formData={formData}
                setFormData={setFormData}
                isEditing={!!editingDevice}
            />

            <ShareDeviceModal
                isOpen={showShareModal}
                onClose={() => {
                    setShowShareModal(false);
                    setSelectedShareDevice(null);
                }}
                shareUrl={shareUrl}
                device={selectedShareDevice}
                onCopy={copyToClipboard}
            />


        </div>

    );
};

export default DeviceManagement;
