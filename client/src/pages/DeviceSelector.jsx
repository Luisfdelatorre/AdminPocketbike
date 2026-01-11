import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Edit, Trash2, Key, RefreshCw, Check, X, Search, Users, CheckCircle, Circle, Share2, MoreVertical } from 'lucide-react';
import { getAllDevices, syncDevices, createDevice, updateDevice, deleteDevice, createDeviceAccess } from '../services/api';
import DeviceFormModal from '../components/modals/DeviceFormModal';
import PinInputModal from '../components/modals/PinInputModal';
import PinDisplayModal from '../components/modals/PinDisplayModal';
import ShareDeviceModal from '../components/modals/ShareDeviceModal';
import DeleteConfirmationModal from '../components/modals/DeleteConfirmationModal';
import './DeviceSelector.css';

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
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingDevice, setEditingDevice] = useState(null);
    const [showPinModal, setShowPinModal] = useState(false);
    const [showPinInputModal, setShowPinInputModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const [generatedPin, setGeneratedPin] = useState('');
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [customPin, setCustomPin] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deviceToDelete, setDeviceToDelete] = useState(null);
    const [filter, setFilter] = useState('all'); // all, active, available
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
    }, []);

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
        const url = `${window.location.origin}/#/Id/${device._id}`;
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
                alert('Failed to copy link manually.');
            }
            document.body.removeChild(textArea);
        }
    };

    const loadDevices = async () => {
        setLoading(true);
        try {
            const result = await getAllDevices();//getAllDevices

            if (result.success) {
                setDevices(result.devices);
            }
        } catch (err) {
            console.error('Error fetching devices:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        console.log('Sync button clicked');
        // Removed confirm for now/debugging

        console.log('Starting sync...');
        setLoading(true);
        try {
            const result = await syncDevices();
            console.log('Sync result:', result);

            if (result.success) {
                alert(result.message);
                loadDevices();
            } else {
                alert(result.error || 'Sync failed');
            }
        } catch (err) {
            console.error('Error syncing devices:', err);
            alert('Failed to sync devices: ' + err.message);
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
            } else {
                alert(result.error || 'Failed to save device');
            }
        } catch (err) {
            console.error('Error saving device:', err);
            alert('Failed to save device');
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
            } else {
                alert(result.error);
            }
        } catch (err) {
            console.error('Error deleting device:', err);
            alert(`Failed to delete device: ${err.message || 'Unknown error'}`);
        }
    };

    const handleOpenPinInput = (deviceId) => {
        setSelectedDeviceId(deviceId);
        setCustomPin('');
        setShowPinInputModal(true);
    };

    const handleSubmitPin = async (useCustom) => {
        const deviceId = selectedDeviceId;
        const pinToUse = useCustom ? customPin : undefined;

        // Validate custom PIN
        if (useCustom && (!/^\d{4}$/.test(customPin))) {
            alert('PIN must be exactly 4 digits');
            return;
        }

        try {
            const result = await createDeviceAccess({
                deviceId,
                pin: pinToUse
            });

            if (result.success) {
                setGeneratedPin(result.data.pin);
                setShowPinInputModal(false);
                setShowPinModal(true);
                loadDevices();
            } else {
                alert(result.error);
            }
        } catch (err) {
            console.error('Error generating PIN:', err);
            alert('Failed to generate PIN');
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
            if (!String(device._id).includes(query) &&
                !device.deviceName.toLowerCase().includes(query)) {
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

                <button className="btn-secondary desktop-only" onClick={handleSync} disabled={loading} style={{ marginRight: '1rem' }}>
                    <RefreshCw className={loading ? 'spin' : ''} /> {t('devices.sync')}
                </button>
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
                    <button onClick={handleSync} className="btn-mobile-header-action">
                        <RefreshCw size={20} />
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

            {/* Search Bar */}
            <div className="devices-search">
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
            </div>

            <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100">
                {/* Header Row */}
                <div className="grid grid-cols-4 lg:grid-cols-7 gap-6 px-2 py-2 border-b border-gray-100">
                    <div className="text-xs font-semibold tracking-wide text-gray-400 uppercase flex items-center">{t('devices.table.name')}</div>
                    <div className="text-xs font-semibold tracking-wide text-gray-400 uppercase flex items-center">{t('devices.table.nequi')}</div>
                    {/* Hiding SIM and Status on Mobile/Tablet, visible on Desktop (lg) */}
                    <div className="text-xs font-semibold tracking-wide text-gray-400 uppercase hidden lg:flex items-center">{t('devices.table.sim')}</div>
                    <div className="text-xs font-semibold tracking-wide text-gray-400 uppercase hidden lg:flex items-center">{t('devices.table.status')}</div>
                    <div className="text-xs font-semibold tracking-wide text-gray-400 uppercase flex items-center">{t('devices.table.pin')}</div>
                    <div className="text-xs font-semibold tracking-wide text-gray-400 uppercase hidden lg:flex items-center">{t('devices.table.contract')}</div>
                    <div className="text-xs font-semibold tracking-wide text-gray-400 uppercase flex items-center justify-center">{t('devices.table.actions')}</div>
                </div>

                {/* Body Rows */}
                <div className="divide-y divide-gray-50">
                    {filteredDevices.map((device) => (
                        <div key={device._id} className="grid grid-cols-4 lg:grid-cols-7 gap-6 px-2 py-2 hover:bg-gray-50/50 transition-colors items-center text-sm">
                            <div className="font-semibold text-gray-900 flex items-center">{device.deviceName}</div>
                            <div className="text-gray-700 flex items-center">{device.nequiNumber || '-'}</div>
                            {/* Hiding SIM and Status content on Mobile/Tablet */}
                            <div className="text-gray-500 hidden lg:flex items-center">{device.simCardNumber || '-'}</div>
                            <div className="hidden lg:flex items-center">
                                <button
                                    className={`status-toggle ${device.isActive ? 'active' : 'inactive'}`}
                                    onClick={() => handleToggleActive(device)}
                                >
                                    {device.isActive ? <><Check size={14} /> {t('common.active')}</> : <><X size={14} /> {t('common.inactive')}</>}
                                </button>
                            </div>
                            <div className="flex items-center">
                                {device.hasPin ? (
                                    <div className="pin-actions flex items-center gap-2">
                                        <span className="pin-set font-mono text-emerald-500 font-medium">●●●●</span>
                                        <button
                                            className="btn-icon p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                                            onClick={() => handleOpenPinInput(device._id)}
                                            title={t('devices.pin.regenerate')}
                                        >
                                            <RefreshCw size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        className="btn-generate-pin flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors"
                                        onClick={() => handleOpenPinInput(device._id)}
                                    >
                                        <Key size={14} /> {t('devices.pin.generate')}
                                    </button>
                                )}
                            </div>
                            <div className="text-gray-500 hidden lg:flex items-center">
                                {device.hasActiveContract ? (
                                    <span className="contract-active px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-xs font-medium">{t('common.active')}</span>
                                ) : (
                                    <span className="contract-none text-gray-300">-</span>
                                )}
                            </div>
                            <div className="flex items-center justify-center relative action-menu-container">
                                <button
                                    className={`p-2 rounded-full transition-all duration-200 ${activeMenuId === device._id ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuId(activeMenuId === device._id ? null : device._id);
                                    }}
                                >
                                    <MoreVertical size={20} />
                                </button>

                                {activeMenuId === device._id && (
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden transform origin-top-right animate-in fade-in zoom-in-95 duration-200">
                                        <div className="py-1">
                                            <button
                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleShare(device);
                                                    setActiveMenuId(null);
                                                }}
                                            >
                                                <Share2 size={16} className="text-gray-500" />
                                                {t('devices.share.title')}
                                            </button>
                                            <button
                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditDevice(device);
                                                    setActiveMenuId(null);
                                                }}
                                            >
                                                <Edit size={16} className="text-gray-500" />
                                                {t('common.edit')}
                                            </button>
                                            <div className="border-t border-gray-100 my-1"></div>
                                            <button
                                                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteClick(device);
                                                    setActiveMenuId(null);
                                                }}
                                            >
                                                <Trash2 size={16} />
                                                {t('common.delete')}
                                            </button>
                                        </div>
                                    </div>
                                )}
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

            <PinInputModal
                isOpen={showPinInputModal}
                onClose={() => setShowPinInputModal(false)}
                deviceId={selectedDeviceId}
                customPin={customPin}
                setCustomPin={setCustomPin}
                onSubmit={handleSubmitPin}
            />

            <PinDisplayModal
                isOpen={showPinModal}
                onClose={() => setShowPinModal(false)}
                deviceId={selectedDeviceId}
                pin={generatedPin}
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
