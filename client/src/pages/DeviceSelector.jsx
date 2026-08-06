import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Edit, Trash2, Key, RefreshCw, Check, X, Search, Users, CheckCircle, Circle, Share2, MoreVertical, Battery, BatteryLow, BatteryMedium, BatteryFull, Power, PowerOff, ZapOff, ListFilter } from 'lucide-react';
import { showToast } from '../utils/toast';
import { formatOfflineTime, formatOfflineTimeShort } from '../utils/helpers';
import { getAllDevices, updateDevice, createDeviceAccess, getStatusReport, controlEngine, cutoffDebtors, getDashboardStats } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSSE } from '../context/SSEContext';
import useFilterVisibilityOnScroll from '../hooks/useFilterVisibilityOnScroll';
import DeviceFormModal from '../components/modals/DeviceFormModal';
import ShareDeviceModal from '../components/modals/ShareDeviceModal';

import './DeviceSelector.css';
import SearchAndFilterBar from '../components/SearchAndFilterBar';
import MotorIcon from '../components/MotorIcon';

const MobileHeaderAction = ({ children }) => {
    const [container, setContainer] = useState(null);

    useEffect(() => {
        setContainer(document.getElementById('mobile-header-actions'));
    }, []);

    return container ? createPortal(children, container) : null;
};

const DeviceManagement = () => {
    const { subscribe } = useSSE();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user } = useAuth();
    const [devices, setDevices] = useState({});
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingDevice, setEditingDevice] = useState(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('all'); // all, active, available
    const [viewMode, setViewMode] = useState('technical'); // technical, financial
    const [pendingCommands, setPendingCommands] = useState({});
    const [bulkOffLoading, setBulkOffLoading] = useState(false);
    const [bulkOffModal, setBulkOffModal] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    useFilterVisibilityOnScroll(setShowFilters);


    const [formData, setFormData] = useState({
        _id: '',
        deviceName: '',
        nequiNumber: '',
        simCardNumber: '',
        DailyPayment: false
    });

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
            } catch (err) {
                console.error('Error in DeviceSelector SSE listener:', err);
            }
        });

        return () => {
            unsub();
        };
    }, [subscribe]);


    const handleShare = (device) => {
        const url = `${window.location.origin}/p/${device.name}`;
        setShareUrl(url);
        setSelectedDeviceId(device.deviceId);
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

    // ... rest of handlers ... hiding for brevity ...
    // ... kept existing handlers ...



    const handleAddDevice = () => {
        setEditingDevice(null);
        setFormData({
            _id: '',
            deviceName: '',
            nequiNumber: '',
            simCardNumber: '',
            DailyPayment: false
        });
        setShowModal(true);
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




    const handleToggleActive = async (device) => {
        try {
            const result = await updateDevice(device._id, { isActive: !device.isActive });

            if (result.success) {
                loadDevices();
            }
        } catch (err) {
            console.error('Error toggling device status:', err);
        }
    };

    const handleEngineToggle = async (device) => {
        const id = device.id;
        // cutOff=1 → device stopped → toggle to resume (command=1)
        // cutOff=0 → device active  → toggle to stop  (command=0)
        const command = device.cutOff ? 1 : 0;
        setPendingCommands(prev => ({ ...prev, [id]: true }));

        try {
            const result = await controlEngine(id, command);
            const data = result.data || result;
            const resObj = data.response || data;

            if (data.success || resObj.success) {
                const isQueued = Boolean(resObj.queued || resObj.offline || data.queued || data.offline);
                setDevices(prev => {
                    const next = { ...prev };
                    const keyToUpdate = Object.keys(next).find(k => (next[k]._id && next[k]._id === device._id) || (next[k].id && next[k].id === device.id));
                    if (keyToUpdate) {
                        // Anti-Race Condition: Only set queued: true if the cutOff state hasn't already been flipped by a blazing-fast SSE webhook!
                        if (next[keyToUpdate].cutOff === !!device.cutOff) {
                            next[keyToUpdate] = { ...next[keyToUpdate], queued: isQueued };
                        }
                    }
                    return next;
                });

                if (isQueued) {
                    const offlineStr = formatOfflineTime(resObj.lastUpdate || device.lastUpdate) || 'offline';
                    showToast(`Comando encolado en Traccar. El vehículo ${device.name} está inactivo (${offlineStr}). Se aplicará apenas recupere señal.`, 'info');
                } else {
                    showToast(resObj.message || data.message || 'Comando enviado exitosamente', 'success');
                }
            } else {
                showToast(resObj.error || data.error || 'Failed to control engine', 'error');
            }
        } catch (err) {
            console.error('Engine control error:', err);
            showToast(err.message || 'Error controlling engine', 'error');
        } finally {
            setPendingCommands(prev => ({ ...prev, [id]: false }));
        }
    };

    const handleBulkEngineOff = async () => {
        setBulkOffModal(false);
        setBulkOffLoading(true);
        try {
            const result = await cutoffDebtors();
            if (result.success) {
                showToast(result.message, 'success');
            } else {
                showToast(result.error || 'Failed to control engines', 'error');
            }
        } catch (err) {
            console.error('Bulk cutoff error:', err);
            showToast(err.message || 'Error executing bulk engine off', 'error');
        } finally {
            setBulkOffLoading(false);
            loadDevices();
        }
    };

    const devicesList = Object.values(devices);
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

        return true;
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

    return (
        <div className="devices-page ios-devices-page">
            {/* Desktop Header */}
            <div className="page-header">
                <div className="desktop-only">
                    <h1>{t('devices.title')}</h1>
                </div>
                <button className="btn-secondary desktop-only" onClick={loadDevices} disabled={loading} style={{ marginRight: '1rem' }}>
                    <RefreshCw className={loading ? 'spin' : ''} /> {t('payments.refresh')}
                </button>
                <MobileHeaderAction>
                    <button
                        type="button"
                        className={`btn-mobile-header-action ${showFilters ? 'active text-blue-600' : ''}`}
                        onClick={() => setShowFilters(!showFilters)}
                        id="filterToggle"
                        title="Filtros"
                    >
                        <ListFilter size={20} />
                    </button>
                    <button onClick={loadDevices} className="btn-mobile-header-action">
                        <RefreshCw size={20} className={loading ? 'spin' : ''} />
                    </button>
                </MobileHeaderAction>
            </div>

            {/* Expandable Metrics Section */}
            <div className={`expandable-metrics-container ${showFilters ? 'expanded' : 'collapsed'}`}>
                <div className="devices-stats-ios">
                    <div className="stat-card-ios">
                        <div className="stat-content-ios">
                            <h3 className="uppercase-title-ios">{t('devices.totalDevices')}</h3>
                            <div className="stat-value-container-ios">
                                <span className="stat-value-ios">{devicesList.length}</span>
                            </div>
                        </div>
                    </div>
                    <div className="stat-card-ios">
                        <div className="stat-content-ios">
                            <h3 className="uppercase-title-ios">{t('devices.activeContracts')}</h3>
                            <div className="stat-value-container-ios">
                                <span className="stat-value-ios" style={{ color: '#34C759' }}>
                                    {devicesList.filter(d => d.hasActiveContract).length}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="stat-card-ios">
                        <div className="stat-content-ios">
                            <h3 className="uppercase-title-ios">{t('devices.available')}</h3>
                            <div className="stat-value-container-ios">
                                <span className="stat-value-ios" style={{ color: '#FF9500' }}>
                                    {devicesList.filter(d => !d.hasActiveContract && (d.isActive !== false)).length}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <SearchAndFilterBar
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    searchPlaceholder={t('devices.searchPlaceholder')}
                    filter={filter}
                    setFilter={setFilter}
                    filterOptions={[
                        { value: 'all', label: t('devices.filterAll') },
                        { value: 'active', label: t('devices.filterActive') },
                        { value: 'available', label: t('devices.filterAvailable') }
                    ]}
                    filterRowClass="devices-filter-row-ios"
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
                    <span className="col-center">Motor</span>
                    <span className="col-center">Acc.</span>
                </div>

                {/* Table Rows */}
                <div className="devices-table-rows-ios">
                    {filteredDevices.map((device) => (
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
                                    <div className={`battery-wrap ${device.batteryLevel > 70 ? 'bat-full' : device.batteryLevel > 30 ? 'bat-mid' : 'bat-low'}`}>
                                        {device.batteryLevel > 70 ? (
                                            <BatteryFull size={15} />
                                        ) : device.batteryLevel > 30 ? (
                                            <BatteryMedium size={15} />
                                        ) : (
                                            <BatteryLow size={15} className={device.batteryLevel <= 30 ? 'animate-pulse' : ''} />
                                        )}
                                    </div>
                                    {formatOfflineTimeShort(device.lastUpdate) && (
                                        <span
                                            className="battery-offline-subtext"
                                            title={`Inactivo desde: ${device.lastUpdate ? new Date(device.lastUpdate).toLocaleString('es-CO') : 'Desconocido'}`}
                                        >
                                            {formatOfflineTimeShort(device.lastUpdate)}
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

            {filteredDevices.length === 0 && (
                <div className="empty-state-ios">
                    <p>{t('devices.emptyState')}</p>
                </div>
            )}
            {/* Bulk Engine Off Confirmation Modal */}
            {bulkOffModal && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
                    onClick={() => setBulkOffModal(false)}
                >
                    <div className="bulk-off-modal-ios" onClick={e => e.stopPropagation()}>
                        <div className="bulk-off-modal-header">
                            <div className="bulk-off-icon-wrap">
                                <ZapOff size={22} style={{ color: '#FF3B30' }} />
                            </div>
                            <div>
                                <div className="bulk-off-title">Apagar vehículos con deuda</div>
                                <div className="bulk-off-subtitle">
                                    {devices.filter(d => d.id && (d.monthDebt || 0) > 0).length} moto(s) con deuda serán apagadas
                                </div>
                            </div>
                        </div>
                        <p className="bulk-off-body">
                            Se enviará comando de <strong>corte de motor</strong> solo a dispositivos con{' '}
                            <strong style={{ color: '#FF3B30' }}>deuda pendiente</strong>. ¿Confirmar?
                        </p>
                        <div className="bulk-off-actions">
                            <button className="bulk-off-btn-cancel" onClick={() => setBulkOffModal(false)}>Cancelar</button>
                            <button className="bulk-off-btn-confirm" onClick={handleBulkEngineOff}>
                                <ZapOff size={15} /> Apagar Todo
                            </button>
                        </div>
                    </div>
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
                onClose={() => setShowShareModal(false)}
                shareUrl={shareUrl}
                onCopy={copyToClipboard}
            />


        </div>

    );
};

export default DeviceManagement;
