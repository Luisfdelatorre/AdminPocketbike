import React, { useState, useEffect } from 'react';
import { getAllContracts, getDevicesWithContracts, createContract, updateContract, updateContractStatus, getSettings } from '../services/api';
import { useTranslation } from 'react-i18next';
import { FileText, Calendar, DollarSign, TrendingUp, Check, X, Edit, Plus, Search, MoreVertical } from 'lucide-react';
import { showToast } from '../utils/toast';
import './Contracts.css';

const Contracts = () => {
    const { t } = useTranslation();
    const [contracts, setContracts] = useState([]);
    const [availableDevices, setAvailableDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, active, completed, cancelled
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingContract, setEditingContract] = useState(null);
    const [activeMenu, setActiveMenu] = useState(null);
    const [formData, setFormData] = useState({
        deviceId: '',
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        customerDocument: '',
        dailyRate: 30000, // 30,000 COP
        contractDays: 500,
        startDate: new Date().toISOString().split('T')[0],
        notes: '',
        devicePin: '',
        freeDaysLimit: 4,
        initialFee: 0,
        exemptFromCutOff: false
    });

    const [companySettings, setCompanySettings] = useState(null);

    useEffect(() => {
        loadContracts();
        loadAvailableDevices();
        loadCompanySettings();

        const handleClickOutside = (event) => {
            if (activeMenu && !event.target.closest('.action-menu-container')) {
                setActiveMenu(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [filter, activeMenu]);

    const loadCompanySettings = async () => {
        try {
            // Fetch settings including contractDefaults from /companies/settings
            const response = await getSettings();
            if (response.success) {
                setCompanySettings(response.data);
            }
        } catch (error) {
            console.error('Error loading company settings:', error);
        }
    };

    const loadContracts = async () => {
        setLoading(true);
        try {
            const result = await getAllContracts();

            if (result.success) {
                setContracts(result.contracts || []);
            } else {
                console.error('Failed to fetch contracts:', result.error);
            }
        } catch (error) {
            console.error('Error loading contracts:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadAvailableDevices = async () => {
        try {
            const result = await getDevicesWithContracts();

            if (result.success) {
                setAvailableDevices(result.devices || []);
            }
        } catch (error) {
            console.error('Error loading devices:', error);
        }
    };

    const handleNewContract = () => {
        setEditingContract(null);
        const defaults = companySettings?.contractDefaults || {};
        setFormData({
            deviceId: '',
            customerName: '',
            customerEmail: '',
            customerPhone: '',
            customerDocument: '',
            dailyRate: defaults.dailyRate || 30000,
            contractDays: defaults.contractDays || 500,
            startDate: new Date().toISOString().split('T')[0],
            notes: '',
            devicePin: Math.floor(1000 + Math.random() * 9000).toString(),
            freeDaysLimit: defaults.freeDaysLimit || 4,
            initialFee: defaults.initialFee || 0,
            exemptFromCutOff: false
        });
        setShowModal(true);
    };

    const handleEdit = (contract) => {
        setEditingContract(contract);
        setFormData({
            deviceId: contract.deviceId,
            customerName: contract.customerName || '',
            customerEmail: contract.customerEmail || '',
            customerPhone: contract.customerPhone || '',
            customerDocument: contract.customerDocument || '',
            dailyRate: contract.dailyRate,
            contractDays: contract.contractDays,
            startDate: contract.startDate,
            notes: contract.notes || '',
            devicePin: '', // Keep empty to not change unless user enters new one
            freeDaysLimit: contract.freeDaysLimit || 4,
            exemptFromCutOff: contract.exemptFromCutOff || false
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const result = editingContract
                ? await updateContract(editingContract.contractId, formData)
                : await createContract(formData);

            if (result.success) {
                setShowModal(false);
                loadContracts();
                showToast(editingContract ? t('contracts.modal.successUpdate') : t('contracts.modal.successCreate'), 'success');
            } else {
                showToast(`Error: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error saving contract:', error);
            showToast(t('contracts.modal.errorSave'), 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (contractId, newStatus) => {
        if (!window.confirm(t('contracts.card.statusConfirm', { status: newStatus }))) {
            return;
        }

        try {
            const result = await updateContractStatus(contractId, newStatus);

            if (result.success) {
                loadContracts();
                showToast(t('contracts.modal.successUpdate'), 'success');
            } else {
                showToast(`Error: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error updating status:', error);
            showToast(t('common.error'), 'error');
        }
    };

    const formatCurrency = (amount) => {
        return `$${amount.toLocaleString()} COP`;
    };

    const getStatusColor = (status) => {
        const colors = {
            'ACTIVE': '#00C292',
            'COMPLETED': '#03C9D7',
            'CANCELLED': '#EF4444',
            'SUSPENDED': '#FB9678'
        };
        return colors[status] || '#6B7280';
    };

    const filteredContracts = contracts.filter(contract => {
        // Status filter
        if (filter !== 'all' && contract.status.toLowerCase() !== filter.toLowerCase()) {
            return false;
        }

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                contract.deviceId.toLowerCase().includes(query) ||
                contract.contractId.toLowerCase().includes(query) ||
                contract.customerName?.toLowerCase().includes(query) ||
                contract.customerEmail?.toLowerCase().includes(query)
            );
        }

        return true;
    });

    const StatCard = ({ title, value, icon: Icon, color }) => (
        <div className="contract-stat-card">
            <div className="stat-icon" style={{ background: color }}>
                <Icon size={20} />
            </div>
            <div className="stat-info">
                <div className="stat-label">{title}</div>
                <div className="stat-number">{value}</div>
            </div>
        </div>
    );

    return (
        <div className="contracts-page">
            <div className="page-header">
                <div>
                    <h1>📋 {t('contracts.title')}</h1>
                    <p>{t('contracts.subtitle')}</p>
                </div>
                <button className="btn-primary" onClick={handleNewContract}>
                    <Plus /> {t('contracts.newContract')}
                </button>
            </div>

            {/* Summary Stats */}
            <div className="contracts-stats">
                <StatCard
                    title={t('contracts.stats.total')}
                    value={contracts.length}
                    icon={FileText}
                    color="#03C9D7"
                />
                <StatCard
                    title={t('contracts.stats.active')}
                    value={contracts.filter(c => c.status === 'ACTIVE').length}
                    icon={TrendingUp}
                    color="#00C292"
                />
                <StatCard
                    title={t('contracts.stats.completed')}
                    value={contracts.filter(c => c.status === 'COMPLETED').length}
                    icon={Check}
                    color="#7460EE"
                />
                <StatCard
                    title={t('contracts.stats.totalValue')}
                    value={formatCurrency(contracts.reduce((sum, c) => sum + c.totalAmount, 0))}
                    icon={DollarSign}
                    color="#FB9678"
                />
            </div>



            {/* Filters */}
            <div className="contracts-filters">
                <button
                    className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    {t('contracts.filters.all')}
                </button>
                <button
                    className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
                    onClick={() => setFilter('active')}
                >
                    {t('contracts.filters.active')}
                </button>
                <button
                    className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
                    onClick={() => setFilter('completed')}
                >
                    {t('contracts.filters.completed')}
                </button>
                <button
                    className={`filter-btn ${filter === 'cancelled' ? 'active' : ''}`}
                    onClick={() => setFilter('cancelled')}
                >
                    {t('contracts.filters.cancelled')}
                </button>
                {/* Search Bar */}

                <div className="search-box">
                    <Search className="search-icon" />
                    <input
                        type="text"
                        placeholder={t('contracts.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            className="clear-search"
                            onClick={() => setSearchQuery('')}
                            aria-label="Clear search"
                        >
                            <X />
                        </button>
                    )}

                </div>
            </div>

            {/* Contracts List */}
            <div className="contracts-list">
                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>{t('contracts.loading')}</p>
                    </div>
                ) : filteredContracts.length === 0 ? (
                    <div className="empty-state">
                        <FileText size={48} />
                        <h3>{t('contracts.empty.title')}</h3>
                        <p>{t('contracts.empty.subtitle')}</p>
                    </div>
                ) : (
                    filteredContracts.map(contract => (
                        <div key={contract.contractId} className="contract-card">


                            <div className="contract-body" onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(contract);
                                setActiveMenu(null);
                            }}>
                                <div className="contract-info-grid">
                                    <div className="contract-title">
                                        <h3>

                                            {contract.deviceIdName || contract.deviceId}

                                        </h3>
                                        <a
                                            //stop propagation
                                            onClick={(e) => {
                                                e.stopPropagation();
                                            }}
                                            href={`/p/${contract.deviceIdName || contract.deviceId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-gray-900 hover:text-indigo-600 transition-colors"
                                            title="Open Payment Page"
                                        >
                                            <span
                                                className="status-badge"
                                                style={{
                                                    background: `${getStatusColor(contract.status)}20`,
                                                    color: getStatusColor(contract.status)
                                                }}
                                            >
                                                {t(`common.${contract.status.toLowerCase()}`, contract.status)}
                                            </span>
                                        </a>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">{t('contracts.card.customer')}</span>
                                        <span className="info-value">{contract.customerName || 'N/A'}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">{t('contracts.card.dailyRate')}</span>
                                        <span className="info-value">{formatCurrency(contract.dailyRate)}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">{t('contracts.card.totalDays')}</span>
                                        <span className="info-value">{contract.contractDays} días</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">{t('contracts.card.totalAmount')}</span>
                                        <span className="info-value">{formatCurrency(contract.totalAmount)}</span>
                                    </div>

                                    <div className="info-item action-menu-wrapper">
                                        <div className="action-menu-container">
                                            <button
                                                className={`action-menu-btn ${activeMenu === contract.contractId ? 'active' : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveMenu(activeMenu === contract.contractId ? null : contract.contractId);
                                                }}
                                            >
                                                <MoreVertical size={20} />
                                            </button>
                                            {activeMenu === contract.contractId && (
                                                <div className="action-menu-dropdown">
                                                    <button onClick={() => {
                                                        handleEdit(contract);
                                                        setActiveMenu(null);
                                                    }}>
                                                        <Edit size={16} /> {t('contracts.card.edit')}
                                                    </button>
                                                    {contract.status === 'ACTIVE' && (
                                                        <>
                                                            <button onClick={() => {
                                                                handleStatusChange(contract.contractId, 'COMPLETED');
                                                                setActiveMenu(null);
                                                            }}>
                                                                <Check size={16} /> {t('contracts.card.complete')}
                                                            </button>
                                                            <button className="text-danger" onClick={() => {
                                                                handleStatusChange(contract.contractId, 'CANCELLED');
                                                                setActiveMenu(null);
                                                            }}>
                                                                <X size={16} /> {t('contracts.card.cancel')}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>



                                </div>

                                <div className="contract-progress">
                                    <div className="progress-header">
                                        <span>{t('contracts.card.progress', { paid: contract.paidDays, total: contract.contractDays })}</span>
                                        <span className="progress-percent">
                                            {((contract.paidDays / contract.contractDays) * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{
                                                width: `${(contract.paidDays / contract.contractDays) * 100}%`,
                                                background: getStatusColor(contract.status)
                                            }}
                                        ></div>
                                    </div>
                                    <div className="progress-details">
                                        <div>
                                            <Check size={14} />
                                            {t('contracts.card.paid')} {formatCurrency(contract.paidAmount)}
                                        </div>
                                        <div>
                                            <Calendar size={14} />
                                            {contract.startDate} → {contract.endDate}
                                        </div>
                                    </div>
                                </div>
                            </div>


                        </div>
                    ))
                )}
            </div>

            {/* Contract Form Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingContract ? t('contracts.modal.editTitle') : t('contracts.modal.addTitle')}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="contract-form">
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>{t('contracts.modal.deviceId')}</label>
                                    {editingContract ? (
                                        <input
                                            type="text"
                                            value={formData.deviceId}
                                            disabled
                                        />
                                    ) : (
                                        <>
                                            <select
                                                value={formData.deviceId}
                                                onChange={(e) => {
                                                    const selectedDeviceId = e.target.value;
                                                    console.log(selectedDeviceId);
                                                    console.log(availableDevices);
                                                    const selectedDevice = availableDevices.find(d => d.deviceId === selectedDeviceId * 1);
                                                    console.log(selectedDevice);
                                                    const domain = companySettings?.contractDefaults?.emailDomain || 'pocketbike.app';
                                                    const email = selectedDevice && selectedDevice.name
                                                        ? `${selectedDevice.name.trim()}@${domain}`.toLowerCase()
                                                        : '';
                                                    setFormData({
                                                        ...formData,
                                                        deviceId: selectedDeviceId,
                                                        customerEmail: email
                                                    });
                                                }}
                                                required
                                            >
                                                <option value="">{t('contracts.modal.selectDevice')}</option>
                                                {availableDevices.filter(d => !d.hasActiveContract).map(device => (
                                                    <option
                                                        key={device.deviceId}
                                                        value={device.deviceId}
                                                    >
                                                        {device.name || ''}
                                                    </option>
                                                ))}
                                            </select>

                                        </>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>{t('contracts.modal.startDate')}</label>
                                    <input
                                        type="date"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                        required
                                        disabled={editingContract}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('contracts.modal.customerPhone')}</label>
                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        placeholder="300 756 0069"
                                        value={formData.customerPhone}
                                        onChange={(e) =>
                                            setFormData((p) => {
                                                const d = e.target.value.replace(/\D/g, "").slice(0, 10);
                                                const v = d.length > 6 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
                                                    : d.length > 3 ? `${d.slice(0, 3)} ${d.slice(3)}`
                                                        : d;
                                                return { ...p, customerPhone: v };
                                            })
                                        }
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('contracts.modal.devicePin')}</label>
                                    <input
                                        type="text"
                                        value={formData.devicePin}
                                        onChange={(e) => setFormData({ ...formData, devicePin: e.target.value })}
                                        placeholder={t('contracts.modal.devicePin')}
                                        maxLength="4"
                                        className="font-mono"
                                        required={!editingContract}
                                    />
                                    <div className="phone-pin-checkbox">
                                        <input
                                            type="checkbox"
                                            id="usePhonePin"
                                            style={{ marginRight: '0.5rem', width: 'auto' }}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    const phone = formData.customerPhone || '';
                                                    const digits = phone.replace(/\D/g, '');
                                                    if (digits.length >= 4) {
                                                        setFormData(prev => ({ ...prev, devicePin: digits.slice(-4) }));
                                                    } else {
                                                        showToast(t('contracts.modal.usePhonePinError'), 'error');
                                                        e.target.checked = false;
                                                    }
                                                }
                                            }}
                                        />
                                        <label htmlFor="usePhonePin" style={{ fontSize: '0.6rem', color: '#4B5563', cursor: 'pointer' }}>
                                            {t('contracts.modal.usePhonePin')}
                                        </label>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>{t('contracts.modal.customerName')}</label>
                                    <input
                                        type="text"
                                        value={formData.customerName}
                                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('contracts.modal.customerEmail')}</label>
                                    <input
                                        type="email"
                                        value={formData.customerEmail}
                                        onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                                        placeholder="cliente@email.com"
                                    />
                                </div>




                                <div className="form-group">
                                    <label>{t('contracts.modal.customerDocument')}</label>
                                    <input
                                        type="text"
                                        value={formData.customerDocument}
                                        onChange={(e) => setFormData({ ...formData, customerDocument: e.target.value })}
                                        placeholder={t('contracts.modal.customerDocumentPlaceholder')}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('contracts.modal.dailyRateCop')}</label>
                                    <input
                                        type="text"
                                        value={new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(formData.dailyRate)}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
                                            setFormData({ ...formData, dailyRate: val });
                                        }}
                                        placeholder="$ 30.000"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('contracts.modal.contractDays')}</label>
                                    <input
                                        type="number"
                                        value={formData.contractDays}
                                        onChange={(e) => setFormData({ ...formData, contractDays: parseInt(e.target.value) })}
                                        min="1"
                                        max="1000"

                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('contracts.modal.initialFeeCop')}</label>
                                    <input
                                        type="text"
                                        value={formData.initialFee ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(formData.initialFee) : ''}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
                                            setFormData({ ...formData, initialFee: val });
                                        }}
                                        placeholder="$ 0"
                                        disabled={editingContract}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('contracts.modal.freeDaysMonth')}</label>
                                    <input
                                        type="number"
                                        value={formData.freeDaysLimit}
                                        onChange={(e) => setFormData({ ...formData, freeDaysLimit: parseInt(e.target.value) })}
                                        min="0"
                                        max="31"
                                    />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <div className="phone-pin-checkbox" style={{ marginTop: '0.5rem', padding: '10px', borderRadius: '8px' }}>
                                        <input
                                            type="checkbox"
                                            id="exemptFromCutOff"
                                            checked={formData.exemptFromCutOff}
                                            onChange={(e) => setFormData({ ...formData, exemptFromCutOff: e.target.checked })}
                                            style={{ marginRight: '0.5rem', width: 'auto' }}
                                        />
                                        <label htmlFor="exemptFromCutOff" style={{ fontSize: '0.7rem', cursor: 'pointer', fontWeight: '600' }}>
                                            {t('contracts.modal.exemptCutoff')}
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="form-group full-width">
                                <label>{t('contracts.modal.notes')}</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows="3"
                                    placeholder={t('contracts.modal.notesPlaceholder')}
                                />
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                                    {t('contracts.modal.cancelBtn')}
                                </button>
                                <button type="submit" className="btn-primary" disabled={loading}>
                                    {loading ? t('contracts.modal.savingBtn') : editingContract ? t('contracts.modal.updateBtn') : t('contracts.modal.createBtn')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Contracts;
