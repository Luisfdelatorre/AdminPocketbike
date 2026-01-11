import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Edit, Trash2, Key, RefreshCw, Check, X, Search, Users, CheckCircle, Circle, Share2, Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getAllDevices, syncDevices, createDevice, updateDevice, deleteDevice, createDeviceAccess } from '../services/api';
import './DeviceSelector.css';

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
    const [searchQuery, setSearchQuery] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deviceToDelete, setDeviceToDelete] = useState(null);
    const [filter, setFilter] = useState('all'); // all, active, available

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

    const handleShare = (device) => {
        const url = `${window.location.origin}/#/Id/${device._id}`;
        setShareUrl(url);
        setSelectedDeviceId(device.deviceId);
        setShowShareModal(true);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
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
                <div>
                    <h1>🏍️ {t('devices.title')}</h1>
                    <p>{t('devices.subtitle')}</p>
                </div>
                <button className="btn-secondary" onClick={handleSync} disabled={loading} style={{ marginRight: '1rem' }}>
                    <RefreshCw className={loading ? 'spin' : ''} /> {t('devices.sync')}
                </button>
                <button className="btn-primary" onClick={handleAddDevice}>
                    <Plus /> {t('devices.addDevice')}
                </button>
            </div>

            {/* Stats Cards */}
            <div className="devices-stats">
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

            {/* Devices Table */}
            <div className="devices-table-container">
                <table className="devices-table">
                    <thead>
                        <tr>
                            { /*<th>Device ID</th>*/}
                            <th>{t('devices.table.name')}</th>
                            <th>{t('devices.table.nequi')}</th>
                            <th>{t('devices.table.sim')}</th>
                            <th>{t('devices.table.status')}</th>
                            <th>{t('devices.table.pin')}</th>
                            <th>{t('devices.table.contract')}</th>
                            <th>{t('devices.table.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredDevices.map((device) => (
                            <tr key={device._id}>
                                {/* <td className="device-id-cell">{device._id}</td> */}
                                <td>{device.deviceName}</td>
                                <td>{device.nequiNumber || '-'}</td>
                                <td>{device.simCardNumber || '-'}</td>
                                <td>
                                    <button
                                        className={`status - toggle ${device.isActive ? 'active' : 'inactive'} `}
                                        onClick={() => handleToggleActive(device)}
                                    >
                                        {device.isActive ? <><Check size={14} /> {t('common.active')}</> : <><X size={14} /> {t('common.inactive')}</>}
                                    </button>
                                </td>
                                <td>
                                    {device.hasPin ? (
                                        <div className="pin-actions">
                                            <span className="pin-set">●●●● {t('devices.pin.set')}</span>
                                            <button
                                                className="btn-icon"
                                                onClick={() => handleOpenPinInput(device._id)}
                                                title={t('devices.pin.regenerate')}
                                            >
                                                <RefreshCw size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            className="btn-generate-pin"
                                            onClick={() => handleOpenPinInput(device._id)}
                                        >
                                            <Key size={14} /> {t('devices.pin.generate')}
                                        </button>
                                    )}
                                </td>
                                <td>
                                    {device.hasActiveContract ? (
                                        <span className="contract-active">{t('common.active')}</span>
                                    ) : (
                                        <span className="contract-none">-</span>
                                    )}
                                </td>
                                <td className="actions-cell">
                                    <button
                                        className="btn-icon"
                                        onClick={() => handleShare(device)}
                                        title={t('devices.share.title')}
                                    >
                                        <Share2 size={16} />
                                    </button>
                                    <button
                                        className="btn-icon"
                                        onClick={() => handleEditDevice(device)}
                                        title={t('common.edit')}
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-icon btn-delete"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteClick(device);
                                        }}
                                        title={t('common.delete')}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {devices.length === 0 && (
                    <div className="empty-state">
                        <p>{t('devices.emptyState')}</p>
                    </div>
                )}
            </div>

            {/* Add/Edit Device Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>{editingDevice ? t('devices.form.editTitle') : t('devices.form.addTitle')}</h2>

                        <form onSubmit={handleSubmit}>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>{t('devices.form.deviceId')}</label>
                                    <input
                                        type="text"
                                        value={formData._id}
                                        onChange={(e) => setFormData({ ...formData, _id: e.target.value })}
                                        disabled={!!editingDevice}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>{t('devices.form.name')}</label>
                                    <input
                                        type="text"
                                        value={formData.deviceName}
                                        onChange={(e) => setFormData({ ...formData, deviceName: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>{t('devices.form.nequi')}</label>
                                    <input
                                        type="text"
                                        value={formData.nequiNumber}
                                        onChange={(e) => setFormData({ ...formData, nequiNumber: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>{t('devices.form.sim')}</label>
                                    <input
                                        type="text"
                                        value={formData.simCardNumber}
                                        onChange={(e) => setFormData({ ...formData, simCardNumber: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>{t('devices.form.notes')}</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows="3"
                                />
                            </div>

                            <div className="form-group checkbox-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={formData.isActive}
                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    />
                                    {t('devices.form.active')}
                                </label>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                                    {t('common.cancel')}
                                </button>
                                <button type="submit" className="btn-primary">
                                    {editingDevice ? t('common.update') : t('common.create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* PIN Input Modal */}
            {showPinInputModal && (
                <div className="modal-overlay" onClick={() => setShowPinInputModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>{t('devices.pin.modalTitle')}</h2>
                        <p>{t('devices.pin.modalSubtitle')} <strong>{selectedDeviceId}</strong></p>

                        <div className="pin-input-section">
                            <label>{t('devices.pin.customLabel')}</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength="4"
                                value={customPin}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (/^\d*$/.test(value)) {
                                        setCustomPin(value);
                                    }
                                }}
                                placeholder={t('devices.pin.customPlaceholder')}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '0.5rem',
                                    fontSize: '1.5rem',
                                    textAlign: 'center',
                                    letterSpacing: '0.5rem',
                                    marginTop: '0.5rem'
                                }}
                            />
                            <p style={{ color: '#6B7280', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                                {t('devices.pin.autoHelper')}
                            </p>
                        </div>

                        <div className="modal-actions">
                            <button
                                className="btn-secondary"
                                onClick={() => setShowPinInputModal(false)}
                            >
                                {t('common.cancel')}
                            </button>
                            {customPin.length === 4 ? (
                                <button
                                    className="btn-primary"
                                    onClick={() => handleSubmitPin(true)}
                                >
                                    {t('devices.pin.useCustom')}
                                </button>
                            ) : (
                                <button
                                    className="btn-primary"
                                    onClick={() => handleSubmitPin(false)}
                                >
                                    {t('devices.pin.autoGenerate')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* PIN Display Modal */}
            {showPinModal && (
                <div className="modal-overlay" onClick={() => setShowPinModal(false)}>
                    <div className="modal-content pin-modal" onClick={(e) => e.stopPropagation()}>
                        <h2>{t('devices.pin.generatedTitle')}</h2>
                        <p>{t('devices.pin.saveWarning')}</p>

                        <div className="pin-display">
                            <div className="device-info">Device: <strong>{selectedDeviceId}</strong></div>
                            <div className="pin-code">{generatedPin}</div>
                        </div>

                        <div className="pin-instructions">
                            <p>{t('devices.pin.instruction1')}</p>
                            <p>{t('devices.pin.instruction2')}</p>
                            <p>{t('devices.pin.instruction3')}</p>
                        </div>

                        <button className="btn-primary full-width" onClick={() => setShowPinModal(false)}>
                            {t('common.gotIt')}
                        </button>
                    </div>
                </div>
            )}

            {/* Share Modal */}
            {showShareModal && (
                <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>{t('devices.share.title')}</h2>
                        <p>{t('devices.share.subtitle')}</p>

                        <div className="qr-code-display" style={{
                            display: 'flex',
                            justifyContent: 'center',
                            margin: '1.5rem 0',
                            padding: '1rem',
                            background: 'white',
                            borderRadius: '0.5rem'
                        }}>
                            <QRCodeSVG value={shareUrl} size={200} />
                        </div>

                        <div className="share-link-box" style={{
                            display: 'flex',
                            gap: '0.5rem',
                            marginBottom: '1.5rem',
                            background: '#F3F4F6',
                            padding: '0.75rem',
                            borderRadius: '0.5rem',
                            border: '1px solid #E5E7EB'
                        }}>
                            <input
                                type="text"
                                value={shareUrl}
                                readOnly
                                style={{
                                    flex: 1,
                                    background: 'transparent',
                                    border: 'none',
                                    fontSize: '0.875rem',
                                    color: '#4B5563',
                                    outline: 'none'
                                }}
                            />
                            <button
                                onClick={copyToClipboard}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#03C9D7',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                }}
                            >
                                <Copy /> {t('devices.share.copy')}
                            </button>
                        </div>

                        <div className="pin-warning" style={{
                            background: '#FEF3C7',
                            color: '#92400E',
                            padding: '0.75rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            marginBottom: '1.5rem'
                        }}>
                            <strong>{t('devices.share.note')}</strong> {t('devices.share.noteText')}
                        </div>

                        <button className="btn-primary full-width" onClick={() => setShowShareModal(false)}>
                            {t('common.done')}
                        </button>
                    </div>
                </div>
            )}
            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <h2>{t('common.confirmDelete')}</h2>
                        <p>{t('devices.deleteConfirmText')} <strong>{deviceToDelete?._id}</strong>?</p>
                        <p style={{ color: '#6B7280', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                            {t('devices.deleteNote')}
                        </p>

                        <div className="modal-actions">
                            <button
                                className="btn-secondary"
                                onClick={() => setShowDeleteModal(false)}
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                className="btn-primary"
                                style={{ background: '#EF4444' }}
                                onClick={confirmDelete}
                            >
                                {t('common.delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeviceManagement;
