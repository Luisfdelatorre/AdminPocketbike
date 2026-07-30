import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Edit, Trash2, Key, RefreshCw, Check, X, Search, Users, CheckCircle, Circle, Share2, MoreVertical, Battery, BatteryLow, BatteryMedium, BatteryFull, Power, PowerOff, ZapOff, ListFilter } from 'lucide-react';
import { showToast } from '../utils/toast';
import { getAllDevices, syncDevices, createDevice, updateDevice, deleteDevice, createDeviceAccess, getStatusReport, controlEngine, cutoffDebtors } from '../services/api';
import { useAuth } from '../context/AuthContext';
import useFilterVisibilityOnScroll from '../hooks/useFilterVisibilityOnScroll';
import DeviceFormModal from '../components/modals/DeviceFormModal';
import ShareDeviceModal from '../components/modals/ShareDeviceModal';
import DeleteConfirmationModal from '../components/modals/DeleteConfirmationModal';
import './DeviceSelector.css';
import MotorIcon from '../components/MotorIcon';

const MobileHeaderAction = ({ children }) => {
    const [container, setContainer] = useState(null);

    useEffect(() => {
        setContainer(document.getElementById('mobile-header-actions'));
    }, []);

    return container ? createPortal(children, container) : null;
};

const DeviceManagement = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user } = useAuth();
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingDevice, setEditingDevice] = useState(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deviceToDelete, setDeviceToDelete] = useState(null);
    const [filter, setFilter] = useState('all'); // all, active, available
    const [viewMode, setViewMode] = useState('technical'); // technical, financial
    const [activeMenuId, setActiveMenuId] = useState(null);
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
        isActive: true,
        notes: ''
    });

    useEffect(() => {
        loadDevices();
        const handlePaymentUpdate = (e) => {
            const detail = e.detail;
            if (detail?.type === 'gps_update' && Array.isArray(detail.devices)) {
                setDevices(prev => prev.map(dev => {
                    const match = detail.devices.find(u => {
                        const targetId = String(u.gpsId || u.filter?.gpsId || u.filter?.deviceId || '');
                        return targetId && (
                            String(dev.deviceId) === targetId ||
                            String(dev.id) === targetId ||
                            String(dev.gpsId) === targetId ||
                            String(dev.name) === targetId
                        );
                    });
                    if (match) {
                        return {
                            ...dev,
                            ...(match.batteryLevel != null && { batteryLevel: match.batteryLevel }),
                            ...(match.ignition != null && { ignition: match.ignition }),
                            ...(match.cutOff != null && { cutOff: match.cutOff ? 1 : 0 }),
                            ...(match.lastUpdate && { lastUpdate: match.lastUpdate })
                        };
                    }
                    return dev;
                }));
            } else if (detail?.type === 'engine' && detail?.deviceId) {
                const targetCutOff = detail.command === 0 ? 1 : 0;
                setDevices(prev => prev.map(dev => {
                    const id = dev.id || dev.deviceId || dev.name;
                    if (id === detail.deviceId || dev.name === detail.deviceId) {
                        return { ...dev, cutOff: targetCutOff };
                    }
                    return dev;
                }));
            }
        };
        window.addEventListener('payment-update', handlePaymentUpdate);
        return () => window.removeEventListener('payment-update', handlePaymentUpdate);
    }, [viewMode]);

    // Real-time SSE listening for device status updates (multi-tenant aware)
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

                    setDevices((prevDevices) => {
                        let matchFound = false;
                        const updatedList = prevDevices.map((d) => {
                            const isMatch = (
                                (data.gpsId && (d.gpsId === data.gpsId || d.deviceId === data.gpsId)) ||
                                (data._id && d._id === data._id) ||
                                (data.name && d.name === data.name)
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

                        return matchFound ? updatedList : prevDevices;
                    });
                } catch (err) {
                    console.error('Error parsing SSE device_update:', err);
                }
            });

            eventSource.onerror = (err) => {
                console.warn('SSE connection error in DeviceSelector, EventSource will automatically retry:', err);
            };
        } catch (err) {
            console.error('Failed to initialize SSE in DeviceSelector:', err);
        }

        return () => {
            if (eventSource) {
                eventSource.close();
            }
        };
    }, [user?.companyId]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (activeMenuId && !event.target.closest('.action-menu-container')) {
                setActiveMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeMenuId]);

    const handleShare = (device) => {
        const url = `${window.location.origin}/p/${device.name}`;
        setShareUrl(url);
        setSelectedDeviceId(device.deviceId);
        setShowShareModal(true);
    };

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
        } catch (err) {
            console.error('Failed to copy text: ', err);

            const textArea = document.createElement("textarea");
            textArea.value = shareUrl;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            textArea.setSelectionRange(0, 99999); /* For mobile devices */
            try {
                document.execCommand('copy');
            } catch (err) {
                console.error('Unable to copy', err);
                showToast('Failed to copy link manually.', 'error');
            }
            document.body.removeChild(textArea);
        }
    };

    const loadDevices = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            let result;
            if (viewMode !== 'financial') {
                const financialData = await getStatusReport();
                const deviceList = Array.isArray(financialData) ? financialData
                    : (financialData?.data ?? financialData?.devices ?? []);
                result = { success: true, devices: deviceList };
            } else {
                result = await getAllDevices();
            }

            if (result.success) {
                setDevices(result.devices || []);
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

    const handleSync = async () => {
        console.log('Sync button clicked');
        // Removed confirm for now/debugging

        console.log('Starting sync...');
        setLoading(true);
        try {
            const result = await syncDevices();
            console.log('Sync result:', result);

            if (result.success) {
                showToast(result.message, 'success');
                loadDevices();
            } else {
                showToast(result.error || 'Sync failed', 'error');
            }
        } catch (err) {
            console.error('Error syncing devices:', err);
            showToast('Failed to sync devices: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddDevice = () => {
        setEditingDevice(null);
        setFormData({
            _id: '',
            deviceName: '',
            nequiNumber: '',
            simCardNumber: '',
            isActive: true,
            notes: ''
        });
        setShowModal(true);
    };

    const handleEditDevice = (device) => {
        setEditingDevice(device);
        setFormData({
            _id: device._id,
            deviceName: device.deviceName,
            nequiNumber: device.nequiNumber || '',
            simCardNumber: device.simCardNumber || '',
            isActive: device.isActive,
            notes: device.notes || ''
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const result = editingDevice
                ? await updateDevice(editingDevice._id, formData)
                : await createDevice(formData);

            if (result.success) {
                setShowModal(false);
                loadDevices();
                showToast(editingDevice ? 'Device updated successfully' : 'Device created successfully', 'success');
            } else {
                showToast(result.error || 'Failed to save device', 'error');
            }
        } catch (err) {
            console.error('Error saving device:', err);
            showToast('Failed to save device', 'error');
        }
    };

    const handleDeleteClick = (device) => {
        setDeviceToDelete(device);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!deviceToDelete) return;
        const deviceId = deviceToDelete._id;

        try {
            const result = await deleteDevice(deviceId);

            if (result.success) {
                loadDevices();
                setShowDeleteModal(false);
                setDeviceToDelete(null);
                showToast('Device deactivated successfully', 'success');
            } else {
                showToast(result.error, 'error');
            }
        } catch (err) {
            console.error('Error deleting device:', err);
            showToast(`Failed to delete device: ${err.message || 'Unknown error'}`, 'error');
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
            if (result.success) {
                showToast(result.message, 'success');
                loadDevices();
            } else {
                showToast(result.error || 'Failed to control engine', 'error');
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

    // Filter devices based on search and filter
    const filteredDevices = devices.filter(device => {
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
                {user?.isSuperAdmin ? (
                    <button className="btn-secondary desktop-only" onClick={handleSync} disabled={loading} style={{ marginRight: '1rem' }}>
                        <RefreshCw className={loading ? 'spin' : ''} /> {t('devices.sync')}
                    </button>
                ) : (
                    <button className="btn-secondary desktop-only" onClick={loadDevices} disabled={loading} style={{ marginRight: '1rem' }}>
                        <RefreshCw className={loading ? 'spin' : ''} /> {t('payments.refresh')}
                    </button>
                )}
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
                    <button onClick={user?.isSuperAdmin ? handleSync : loadDevices} className="btn-mobile-header-action">
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
                                <span className="stat-value-ios">{devices.length}</span>
                            </div>
                        </div>
                    </div>
                    <div className="stat-card-ios">
                        <div className="stat-content-ios">
                            <h3 className="uppercase-title-ios">{t('devices.activeContracts')}</h3>
                            <div className="stat-value-container-ios">
                                <span className="stat-value-ios" style={{ color: '#34C759' }}>
                                    {devices.filter(d => d.hasActiveContract).length}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="stat-card-ios">
                        <div className="stat-content-ios">
                            <h3 className="uppercase-title-ios">{t('devices.available')}</h3>
                            <div className="stat-value-container-ios">
                                <span className="stat-value-ios" style={{ color: '#FF9500' }}>
                                    {devices.filter(d => !d.hasActiveContract && d.isActive).length}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="search-ios">
                    <Search size={15} className="search-ios-icon" />
                    <input
                        type="text"
                        className="search-ios-input"
                        placeholder={t('devices.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="search-ios-clear" onClick={() => setSearchQuery('')}>
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

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

            {/* Filters + Search */}
            <div className="devices-filter-row-ios">
                <div className="filter-pills-ios">
                    <button data-filter="all" className={`filter-pill-ios ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
                        {t('devices.filterAll')}
                    </button>
                    <button data-filter="active" className={`filter-pill-ios ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')}>
                        {t('devices.filterActive')}
                    </button>
                    <button data-filter="available" className={`filter-pill-ios ${filter === 'available' ? 'active' : ''}`} onClick={() => setFilter('available')}>
                        {t('devices.filterAvailable')}
                    </button>
                </div>

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

                            {/* Motor: icon + battery + toggle */}
                            <div className="col-center device-motor-col">
                                <div className={`motor-icon-wrap ${Boolean(device.cutOff) ? 'motor-off' : device.ignition ? 'motor-on' : 'motor-idle'}`}>
                                    <MotorIcon />
                                </div>
                                <div className={`battery-wrap ${device.batteryLevel > 70 ? 'bat-full' : device.batteryLevel > 30 ? 'bat-mid' : 'bat-low'}`}>
                                    {device.batteryLevel > 70 ? (
                                        <BatteryFull size={15} />
                                    ) : device.batteryLevel > 30 ? (
                                        <BatteryMedium size={15} />
                                    ) : (
                                        <BatteryLow size={15} className={device.batteryLevel <= 30 ? 'animate-pulse' : ''} />
                                    )}
                                </div>
                                {user?.role !== 'viewer' ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleEngineToggle(device); }}
                                        disabled={pendingCommands[device.id]}
                                        className={`engine-toggle-slider ${Boolean(device.cutOff) ? 'deactivated' : 'active'} ${pendingCommands[device.id] ? 'pending' : ''}`}
                                        title={Boolean(device.cutOff) ? 'Activar Moto' : 'Desactivar Moto'}
                                    >
                                        <div className="slider-knob">
                                            {pendingCommands[device.id] ? <RefreshCw size={12} className="spin" /> : <Power size={12} />}
                                        </div>
                                    </button>
                                ) : (
                                    <div className={`engine-toggle-slider ${Boolean(device.cutOff) ? 'deactivated' : 'active'}`} style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                                        <div className="slider-knob"><Power size={12} /></div>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="col-center device-actions-col">
                                <button className="action-icon-btn" onClick={(e) => { e.stopPropagation(); handleShare(device); setActiveMenuId(null); }} title="Compartir">
                                    <Share2 size={15} />
                                </button>
                                {user?.role !== 'viewer' && (
                                    <button className="action-icon-btn" onClick={(e) => { e.stopPropagation(); handleEditDevice(device); setActiveMenuId(null); }} title="Editar">
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

            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={confirmDelete}
                deviceId={deviceToDelete?._id}
            />
        </div>
    );
};

export default DeviceManagement;
