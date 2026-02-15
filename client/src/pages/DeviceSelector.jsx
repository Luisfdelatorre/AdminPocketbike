import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Edit, Trash2, Key, RefreshCw, Check, X, Search, Users, CheckCircle, Circle, Share2, MoreVertical, Battery, BatteryLow, BatteryMedium, BatteryFull } from 'lucide-react';
import { showToast } from '../utils/toast';
import { getAllDevices, syncDevices, createDevice, updateDevice, deleteDevice, createDeviceAccess, getFinancialReport } from '../services/api';
import { useAuth } from '../context/AuthContext';
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
    }, [viewMode]); // Reload when view mode changes

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

    const loadDevices = async () => {
        setLoading(true);
        try {
            let result;
            if (viewMode !== 'financial') {
                const financialData = await getFinancialReport();
                console.log(financialData);
                result = { success: true, devices: financialData };
            } else {
                result = await getAllDevices();
            }

            if (result.success) {
                setDevices(result.devices || []);
            }
        } catch (err) {
            console.error('Error fetching devices:', err);
            showToast('Failed to load devices', 'error');
        } finally {
            setLoading(false);
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

    // Filter devices based on search and filter
    const filteredDevices = devices.filter(device => {
        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const deviceName = device.name || device.deviceName || ''; // Handle both structures
            const deviceId = device._id || '';

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
        <div className="devices-page">
            {/* Header */}
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
                <button className="btn-primary desktop-only" onClick={handleAddDevice}>
                    <Plus /> {t('devices.addDevice')}
                </button>

                <MobileHeaderAction>
                    <button
                        onClick={handleAddDevice}
                        className="btn-mobile-header-action"

                    >
                        <Plus size={24} />
                    </button>
                    <button onClick={user?.isSuperAdmin ? handleSync : loadDevices} className="btn-mobile-header-action">
                        <RefreshCw size={20} className={loading ? 'spin' : ''} />
                    </button>
                </MobileHeaderAction>

            </div>

            {/* Stats Cards */}
            <div className="devices-stats desktop-only">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#03C9D7' }}>
                        <Users />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">{t('devices.totalDevices')}</div>
                        <div className="stat-number">{devices.length}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#00C292' }}>
                        <CheckCircle />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">{t('devices.activeContracts')}</div>
                        <div className="stat-number">{devices.filter(d => d.hasActiveContract).length}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#FB9678' }}>
                        <Circle />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">{t('devices.available')}</div>
                        <div className="stat-number">{devices.filter(d => !d.hasActiveContract && d.isActive).length}</div>
                    </div>
                </div>
            </div>




            {/* Filters */}
            <div className="devices-filters">
                <button
                    className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    {t('devices.filterAll')}
                </button>
                <button
                    className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
                    onClick={() => setFilter('active')}
                >
                    {t('devices.filterActive')}
                </button>
                <button
                    className={`filter-btn ${filter === 'available' ? 'active' : ''}`}
                    onClick={() => setFilter('available')}
                >
                    {t('devices.filterAvailable')}
                </button>
                {/* Search Bar */}

                <div className="search-box">
                    <Search className="search-icon" />
                    <input
                        type="text"
                        placeholder={t('devices.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            className="clear-search"
                            onClick={() => setSearchQuery('')}
                        >
                            <X />
                        </button>
                    )}
                </div>

            </div>

            <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100">
                {/* Header Row */}
                <div className="grid grid-cols-4 lg:grid-cols-7 gap-6 px-2 py-2 border-b border-gray-100">
                    <div className="text-xs font-semibold tracking-wide text-gray-400 uppercase flex items-center">{t('devices.table.contract')}</div>


                    <div className="text-xs font-semibold tracking-wide text-gray-400 uppercase flex items-center">Pagado</div>
                    {/* Hiding SIM and Status on Mobile/Tablet, visible on Desktop (lg) */}
                    <div className="text-xs font-semibold tracking-wide text-gray-400 uppercase hidden lg:flex items-center">Deuda</div>
                    <div className="text-xs font-semibold tracking-wide text-gray-400 uppercase hidden lg:flex items-center">Estado</div>
                    <div className="text-xs font-semibold tracking-wide text-gray-400 uppercase hidden lg:flex items-center">Dias Libres</div>


                    <div className="text-xs font-semibold tracking-wide text-gray-400 uppercase flex items-center justify-center">Motor</div>
                    <div className="text-xs font-semibold tracking-wide text-gray-400 uppercase flex items-center justify-center">{t('devices.table.actions')}</div>
                </div>

                {/* Body Rows */}
                <div className="divide-y divide-gray-50">
                    {filteredDevices.map((device) => (
                        <div key={device._id} className="grid grid-cols-4 lg:grid-cols-7 gap-6 px-2 py-2 hover:bg-gray-50/50 transition-colors items-center text-sm">
                            <div className="font-semibold text-gray-900 flex items-center">
                                <a
                                    href={`/p/${device.name}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-900 cursor-pointer hover:text-gray-600 flex flex-col"
                                >
                                    <span className="text-gray-900 font-medium">{device.name}</span>
                                    {device.contractId && (
                                        <span className="text-[8px] text-gray-400">
                                            {device.contractId}
                                        </span>
                                    )}
                                </a>
                            </div>
                            <div className="text-emerald-600 flex items-center font-bold">
                                ${(device.monthPaid || 0).toLocaleString()}
                            </div>
                            <div className={`flex items-center font-bold ${device.monthDebt > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                ${(device.monthDebt || 0).toLocaleString()}
                            </div>
                            <div className="text-gray-500 hidden lg:flex items-center">
                                {device.status ? (
                                    <span className="contract-active px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-xs font-medium">
                                        {device.status}
                                    </span>
                                ) : (
                                    <span className="contract-none text-gray-300">--</span>
                                )}
                            </div>
                            <div className="text-blue-600 flex items-center font-bold pl-4">
                                {device.freeDays || 0}
                            </div>

                            <div className="flex items-center justify-center gap-3">
                                {/* Motor Status */}
                                <div className={`flex flex-col items-center justify-center ${device.cutOff ? 'text-red-500' : device.ignition ? 'text-emerald-500' : 'text-gray-300'}`}>
                                    <MotorIcon />
                                </div>

                                {/* Battery Status */}
                                <div className={`flex items-center gap-1 ${device.batteryLevel > 70 ? 'text-emerald-500' :
                                    device.batteryLevel > 30 ? 'text-yellow-500' :
                                        'text-red-500'
                                    }`}>
                                    {device.batteryLevel > 70 ? (
                                        <BatteryFull size={20} />
                                    ) : device.batteryLevel > 30 ? (
                                        <BatteryMedium size={20} />
                                    ) : (
                                        <BatteryLow size={20} className="animate-pulse" />
                                    )}
                                </div>
                            </div>





                            <div className="flex items-center justify-center relative action-menu-container">
                                <button
                                    className=" text-left  text-sm text-gray-700  flex items-center  transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleShare(device);
                                        setActiveMenuId(null);
                                    }}
                                >
                                    <Share2 size={16} className="text-gray-500" />

                                </button>
                                <button
                                    className=" text-left px-4 py-2.5 text-sm text-gray-700  flex items-center  "
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditDevice(device);
                                        setActiveMenuId(null);
                                    }}
                                >
                                    <Edit size={16} className="text-gray-500" />

                                </button>


                            </div>
                        </div>
                    ))}
                </div>
            </div>


            {filteredDevices.length === 0 && (
                <div className="empty-state">
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
