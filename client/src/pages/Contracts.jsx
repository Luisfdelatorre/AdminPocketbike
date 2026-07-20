import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAllContracts, getDevicesWithContracts, createContract, updateContract, updateContractStatus, getSettings } from '../services/api';
import { useTranslation } from 'react-i18next';
import { FileText, Calendar, DollarSign, TrendingUp, Check, X, Edit, Plus, Search, MoreVertical, ListFilter } from 'lucide-react';
import { showToast } from '../utils/toast';
import './Contracts.css';

const Contracts = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const [contracts, setContracts] = useState([]);
    const [availableDevices, setAvailableDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, active, completed, cancelled
    const [searchQuery, setSearchQuery] = useState('');
    const [editingContract, setEditingContract] = useState(null);
    const [activeMenu, setActiveMenu] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [portalElement, setPortalElement] = useState(null);
    const [fabPortalElement, setFabPortalElement] = useState(null);
    const isContractModalOpen = new URLSearchParams(location.search).get('modal') === 'contract';
    const [isModalMounted, setIsModalMounted] = useState(isContractModalOpen);
    const [isModalClosing, setIsModalClosing] = useState(false);
    // Estructura base inicial (Los defaults reales de la BD se aplican en handleNewContract)
    const [formData, setFormData] = useState({
        deviceId: '',
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        customerDocument: '',
        dailyRate: 0,
        contractDays: 0,
        startDate: new Date().toISOString().split('T')[0],
        notes: '',
        devicePin: '',
        freeDaysLimit: 0,
        freeDayPolicy: 'FLEXIBLE',
        fixedFreeDayOfWeek: 0,
        paymentFrequency: 1,
        initialFee: 0,
        exemptFromCutOff: false,
        exemptFromCurfew: false,
        cutOffTime: ''
    });

    const [companySettings, setCompanySettings] = useState(null);

    useEffect(() => {
        if (isContractModalOpen) {
            setIsModalMounted(true);
            setIsModalClosing(false);
            return undefined;
        }

        if (!isModalMounted) {
            return undefined;
        }

        setIsModalClosing(true);
        const closeTimer = window.setTimeout(() => {
            setIsModalMounted(false);
            setIsModalClosing(false);
        }, 220);

        return () => window.clearTimeout(closeTimer);
    }, [isContractModalOpen, isModalMounted]);

    useEffect(() => {
        if (!isModalMounted) {
            return undefined;
        }

        const previousBodyOverflow = document.body.style.overflow;
        const previousDocumentOverflow = document.documentElement.style.overflow;
        const previousBodyOverscroll = document.body.style.overscrollBehavior;

        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overscrollBehavior = 'none';

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousDocumentOverflow;
            document.body.style.overscrollBehavior = previousBodyOverscroll;
        };
    }, [isModalMounted]);

    useEffect(() => {
        loadContracts();
        loadAvailableDevices();
        loadCompanySettings();
        setPortalElement(document.getElementById('mobile-header-actions'));
        setFabPortalElement(document.body);
    }, [filter]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (activeMenu && !event.target.closest('.action-menu-container')) {
                setActiveMenu(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [activeMenu]);

    useEffect(() => {
        let lastScrollY = window.scrollY;

        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            const diff = currentScrollY - lastScrollY;

            // If scrolling down, hide the filter panel
            if (diff > 10) {
                if (showFilters) {
                    setShowFilters(false);
                }
            }
            // If scrolling up (swipe down), show the filter panel
            else if (diff < -15) {
                if (!showFilters) {
                    setShowFilters(true);
                }
            }

            lastScrollY = currentScrollY;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [showFilters]);

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

    const openContractModal = () => {
        const params = new URLSearchParams(location.search);
        params.set('modal', 'contract');
        navigate(
            { pathname: location.pathname, search: `?${params.toString()}` },
            { state: { modalNavigation: true } }
        );
    };

    const closeContractModal = () => {
        if (location.state?.modalNavigation) {
            navigate(-1);
            return;
        }

        const params = new URLSearchParams(location.search);
        params.delete('modal');
        navigate(
            { pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' },
            { replace: true }
        );
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
            freeDayPolicy: defaults.freeDayPolicy || 'FLEXIBLE',
            fixedFreeDayOfWeek: defaults.fixedFreeDayOfWeek ?? 0,
            paymentFrequency: defaults.paymentFrequency || 1,
            initialFee: defaults.initialFee || 0,
            exemptFromCutOff: false,
            exemptFromCurfew: false,
            cutOffTime: companySettings?.cutOffTime || '23:59'
        });
        openContractModal();
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
            devicePin: '',
            freeDaysLimit: contract.freeDaysLimit || 4,
            freeDayPolicy: contract.freeDayPolicy || 'FLEXIBLE',
            fixedFreeDayOfWeek: contract.fixedFreeDayOfWeek ?? 0,
            paymentFrequency: contract.paymentFrequency || 1,
            exemptFromCutOff: contract.exemptFromCutOff || false,
            exemptFromCurfew: contract.exemptFromCurfew || false,
            cutOffTime: contract.cutOffTime || companySettings?.cutOffTime || '23:59'
        });
        openContractModal();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const result = editingContract
                ? await updateContract(editingContract.contractId, formData)
                : await createContract(formData);

            if (result.success) {
                closeContractModal();
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

    const formatCompact = (value) => {
        if (!value) return '$0';
        if (value >= 1000000) {
            return `$${Math.round(value / 1000000)}M`;
        }
        if (value >= 1000) {
            return `$${Math.round(value / 1000)}k`;
        }
        return `$${value}`;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (e) {
            return dateStr;
        }
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
                <Icon size={18} />
            </div>
            <div className="stat-content">
                <h3>{title}</h3>
                <div className="stat-value">{value}</div>
            </div>
        </div>
    );

    return (
        <div className="contracts-page">
            {/* Render filter toggle button in Mobile Top Bar via Portal */}
            {portalElement && createPortal(
                <button
                    type="button"
                    className={`p-2 rounded-full transition-colors flex items-center justify-center ${showFilters ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
                        }`}
                    onClick={() => setShowFilters(!showFilters)}
                    id="filterToggle"
                >
                    <ListFilter size={20} />
                </button>,
                portalElement
            )}

            {/* Desktop Header (Desktop only) */}
            <div className="page-header hidden md:flex">
                <div>
                    <h1>📋 {t('contracts.title')}</h1>
                    <p>{t('contracts.subtitle')}</p>
                </div>
                <button className="btn-primary" onClick={handleNewContract}>
                    <Plus size={24} />
                    <span className="btn-text">{t('contracts.newContract')}</span>
                </button>
            </div>

            {/* Mobile Collapsible Filter Section (Mobile only, no duplicate header) */}
            <div className={`collapsible-content max-w-[380px] mx-auto md:hidden ${showFilters ? 'expanded' : ''}`} id="filterSection">
                <div className="pt-2 pb-1 ">
                    {/* Search Bar */}
                    <div className="search-box" style={{ maxWidth: 'none', marginBottom: '.5rem' }}>
                        <Search className="search-icon" size={18} />
                        <input
                            type="text"
                            placeholder={t('contracts.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                className="clear-search"
                                onClick={() => setSearchQuery('')}
                                aria-label="Clear search"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* Filter Badges */}
                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                        <button
                            type="button"
                            className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filter === 'all'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            onClick={() => setFilter('all')}
                        >
                            {t('contracts.filters.all')}
                        </button>
                        <button
                            type="button"
                            className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filter === 'active'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            onClick={() => setFilter('active')}
                        >
                            {t('contracts.filters.active')}
                        </button>
                        <button
                            type="button"
                            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filter === 'completed'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            onClick={() => setFilter('completed')}
                        >
                            {t('contracts.filters.completed')}
                        </button>
                        <button
                            type="button"
                            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filter === 'cancelled'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            onClick={() => setFilter('cancelled')}
                        >
                            {t('contracts.filters.cancelled')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Desktop Filters (Desktop only) */}
            <div className="contracts-filters hidden md:flex">
                <button
                    type="button"
                    className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    {t('contracts.filters.all')}
                </button>
                <button
                    type="button"
                    className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
                    onClick={() => setFilter('active')}
                >
                    {t('contracts.filters.active')}
                </button>
                <button
                    type="button"
                    className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
                    onClick={() => setFilter('completed')}
                >
                    {t('contracts.filters.completed')}
                </button>
                <button
                    type="button"
                    className={`filter-btn ${filter === 'cancelled' ? 'active' : ''}`}
                    onClick={() => setFilter('cancelled')}
                >
                    {t('contracts.filters.cancelled')}
                </button>

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
                            type="button"
                            className="clear-search"
                            onClick={() => setSearchQuery('')}
                            aria-label="Clear search"
                        >
                            <X />
                        </button>
                    )}
                </div>
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
                    value={
                        <>
                            <span className="mobile-only">{formatCompact(contracts.reduce((sum, c) => sum + c.totalAmount, 0))}</span>
                            <span className="desktop-only">{formatCurrency(contracts.reduce((sum, c) => sum + c.totalAmount, 0))}</span>
                        </>
                    }
                    icon={DollarSign}
                    color="#FB9678"
                />
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
                        <div
                            key={contract.contractId}
                            className="admin-card shadow-sm max-w-[380px] w-full flex flex-col cursor-pointer hover:shadow-md transition-shadow relative"
                            onClick={(e) => {
                                handleEdit(contract);
                                setActiveMenu(null);
                            }}
                        >
                            {/* Header with ID, Badge and Menu */}
                            <header className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-x-2">
                                    <h1 className="text-[15px] font-bold text-main-dark">
                                        <a
                                            onClick={(e) => {
                                                e.stopPropagation();
                                            }}
                                            href={`/p/${contract.deviceIdName || contract.deviceId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:text-indigo-600 transition-colors"
                                            title="Open Payment Page"
                                        >
                                            {contract.deviceIdName || contract.deviceId}
                                        </a>
                                    </h1>
                                    <span
                                        className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase"
                                        style={{
                                            background: `${getStatusColor(contract.status)}20`,
                                            color: getStatusColor(contract.status)
                                        }}
                                    >
                                        {t(`common.${contract.status.toLowerCase()}`, contract.status)}
                                    </span>
                                </div>
                                <div className="action-menu-container" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        className="text-gray-400 hover:text-gray-600 transition-colors p-1"
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
                            </header>

                            <main className="space-y-3">
                                {/* Financial Figures (Two Columns) */}
                                <div className="grid grid-cols-2 gap-3 border-b border-gray-100 pb-1">
                                    <section>
                                        <p className="text-[15px] text-main-dark">
                                            {formatCurrency(contract.totalAmount)}
                                        </p>
                                    </section>
                                    <section>
                                        <p className="text-[15px] text-main-dark">
                                            {contract.contractDays} días
                                        </p>
                                    </section>
                                </div>
                                {/* Client and Rate (Compact) */}
                                <div className="grid grid-cols-2 gap-3 !mt-1.5">
                                    <section>
                                        <p className="text-[12px] font-medium text-main-dark leading-tight uppercase">
                                            {contract.customerName || 'N/A'}
                                        </p>
                                    </section>
                                    <section>
                                        <p className="text-[12px] font-medium text-main-dark">
                                            {formatCurrency(contract.dailyRate)}
                                        </p>
                                    </section>
                                </div>
                            </main>

                            {/* Progress Footer (Minimized) */}
                            <footer className="bg-gray-50 rounded-xl mt-1" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] text-gray-500">
                                        <span className="font-medium">
                                            {t('contracts.card.progress', { paid: contract.paidDays, total: contract.contractDays })}
                                        </span>
                                    </span>
                                    <span className="text-[10px] font-bold text-main-dark">
                                        {((contract.paidDays / contract.contractDays) * 100).toFixed(1)}%
                                    </span>
                                </div>
                                <div className="w-full h-1 progress-bg rounded-full mb-2 overflow-hidden">
                                    <div
                                        className="h-full progress-fill"
                                        style={{
                                            width: `${(contract.paidDays / contract.contractDays) * 100}%`,
                                            background: getStatusColor(contract.status)
                                        }}
                                    ></div>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-gray-500">
                                    <div className="flex items-center gap-x-1">
                                        <Check size={12} className="text-gray-400" strokeWidth={2.5} />
                                        <span>{formatCurrency(contract.paidAmount)}</span>
                                    </div>
                                    <div className="flex items-center gap-x-1">
                                        <Calendar size={12} className="text-gray-400" />
                                        <span>{formatDate(contract.startDate)} → {formatDate(contract.endDate)}</span>
                                    </div>
                                </div>
                            </footer>
                        </div>
                    ))
                )}
            </div>

            {/* Floating Action Button (FAB) for Mobile */}
            {fabPortalElement && !isModalMounted && createPortal(
                <button
                    type="button"
                    className="contracts-add-fab primary-blue"
                    onClick={handleNewContract}
                    aria-label="Add Contract"
                >
                    <Plus size={32} />
                </button>,
                fabPortalElement
            )}

            {/* Contract Form Modal */}
            {isModalMounted && (
                <div className={`modal-overlay ${isModalClosing ? 'modal-overlay--closing' : 'modal-overlay--opening'}`}>
                    <div className="modal-content modal-surface--contract" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingContract ? t('contracts.modal.editTitle') : t('contracts.modal.addTitle')}</h2>
                            <button className="modal-close" onClick={closeContractModal}>×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="contract-form">
                            <div className="form-grid">
                                {/* SECCIÓN 1: Dispositivo y Acceso */}
                                <div className="form-section-title" style={{ gridColumn: '1 / -1', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '0.5rem', marginTop: '0.5rem', fontWeight: 'bold', color: '#374151' }}>
                                    {t('contracts.modal.deviceSection') || 'Dispositivo y Acceso'}
                                </div>
                                <div className="form-group">
                                    <label>{t('contracts.modal.deviceId')}</label>
                                    {editingContract ? (
                                        <input
                                            type="text"
                                            value={formData.deviceId}
                                            disabled
                                        />
                                    ) : (
                                        <select
                                            value={formData.deviceId}
                                            onChange={(e) => {
                                                const selectedDeviceId = e.target.value;
                                                const selectedDevice = availableDevices.find(d => d.deviceId === selectedDeviceId * 1);
                                                const domain = companySettings?.contractDefaults?.emailDomain || 'pocketbike.app';
                                                const email = selectedDevice && selectedDevice.name
                                                    ? `${selectedDevice.name.toUpperCase()}@${domain.toLowerCase()}`
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
                                                <option key={device.deviceId} value={device.deviceId}>
                                                    {device.name || ''}
                                                </option>
                                            ))}
                                        </select>
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
                                    <div className="phone-pin-checkbox" style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            id="usePhonePin"
                                            style={{ marginRight: '0.5rem', width: 'auto', marginBottom: 0 }}
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
                                        <label htmlFor="usePhonePin" style={{ fontSize: '0.75rem', color: '#4B5563', cursor: 'pointer', marginBottom: 0 }}>
                                            {t('contracts.modal.usePhonePin')}
                                        </label>
                                    </div>
                                </div>
                                <div className="form-group" style={{ visibility: 'hidden' }}></div>

                                {/* SECCIÓN 2: Datos del Cliente */}
                                <div className="form-section-title" style={{ gridColumn: '1 / -1', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '0.5rem', marginTop: '1rem', fontWeight: 'bold', color: '#374151' }}>
                                    {t('contracts.modal.customerSection') || 'Datos del Cliente'}
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
                                    <label>{t('contracts.modal.customerName')}</label>
                                    <input
                                        type="text"
                                        value={formData.customerName}
                                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                        placeholder="John Doe"
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
                                    <label>{t('contracts.modal.customerEmail')}</label>
                                    <input
                                        type="email"
                                        value={formData.customerEmail}
                                        onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                                        placeholder="cliente@email.com"
                                    />
                                </div>

                                {/* SECCIÓN 3: Términos Financieros */}
                                <div className="form-section-title" style={{ gridColumn: '1 / -1', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '0.5rem', marginTop: '1rem', fontWeight: 'bold', color: '#374151' }}>
                                    {t('contracts.modal.financialSection') || 'Términos Financieros'}
                                </div>
                                <div className="form-group">
                                    <label>{t('contracts.modal.paymentFrequency') || 'Frecuencia de pago'}</label>
                                    <select
                                        id="paymentFrequency"
                                        value={formData.paymentFrequency}
                                        onChange={(e) => setFormData({ ...formData, paymentFrequency: parseInt(e.target.value) })}
                                    >
                                        <option value={1}>{t('contracts.modal.freqDaily') || 'Diario (1 día)'}</option>
                                        <option value={7}>{t('contracts.modal.freqWeekly') || 'Semanal (7 días)'}</option>
                                        <option value={14}>{t('contracts.modal.freqBiweekly') || 'Quincenal (14 días)'}</option>
                                    </select>
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

                                {/* SECCIÓN 4: Configuración Avanzada */}
                                <div className="form-section-title" style={{ gridColumn: '1 / -1', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '0.5rem', marginTop: '1rem', fontWeight: 'bold', color: '#374151' }}>
                                    {t('contracts.modal.advancedSection') || 'Configuración Avanzada'}
                                </div>
                                <div className="form-group">
                                    <label>{t('contracts.modal.freeDayPolicy') || 'Política de día libre'}</label>
                                    <select
                                        value={formData.freeDayPolicy}
                                        onChange={(e) => setFormData({ ...formData, freeDayPolicy: e.target.value })}
                                    >
                                        <option value="FLEXIBLE">{t('settings.general.policyFlexible') || 'Flexible (días por mes)'}</option>
                                        <option value="FIXED_WEEKDAY">{t('settings.general.policyFixed') || 'Día fijo semanal'}</option>
                                    </select>
                                </div>
                                {formData.freeDayPolicy !== 'FIXED_WEEKDAY' ? (
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
                                ) : (
                                    <div className="form-group">
                                        <label>{t('settings.general.fixedFreeDay') || 'Día libre fijo'}</label>
                                        <select
                                            value={formData.fixedFreeDayOfWeek}
                                            onChange={(e) => setFormData({ ...formData, fixedFreeDayOfWeek: parseInt(e.target.value) })}
                                        >
                                            <option value={0}>{t('settings.general.days.sun')}</option>
                                            <option value={1}>{t('settings.general.days.mon')}</option>
                                            <option value={2}>{t('settings.general.days.tue')}</option>
                                            <option value={3}>{t('settings.general.days.wed')}</option>
                                            <option value={4}>{t('settings.general.days.thu')}</option>
                                            <option value={5}>{t('settings.general.days.fri')}</option>
                                            <option value={6}>{t('settings.general.days.sat')}</option>
                                        </select>
                                    </div>
                                )}
                                <div className="form-group">
                                    <label>{t('contracts.modal.cutOffTime')}</label>
                                    <input
                                        type="time"
                                        value={formData.cutOffTime}
                                        onChange={(e) => setFormData({ ...formData, cutOffTime: e.target.value })}
                                        title={t('contracts.modal.cutOffTimeTooltip')}
                                    />
                                </div>
                                <div className="form-group" style={{ visibility: 'hidden' }}></div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                        <div className="phone-pin-checkbox" style={{ minWidth: '100px', marginTop: '0.5rem', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #e5e7eb)' }}>
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
                                        <div className="phone-pin-checkbox" style={{ minWidth: '180px', marginTop: '0.5rem', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #e5e7eb)' }}>
                                            <input
                                                type="checkbox"
                                                id="exemptFromCurfew"
                                                checked={formData.exemptFromCurfew}
                                                onChange={(e) => setFormData({ ...formData, exemptFromCurfew: e.target.checked })}
                                                style={{ marginRight: '0.5rem', width: 'auto' }}
                                            />
                                            <label htmlFor="exemptFromCurfew" style={{ fontSize: '0.7rem', cursor: 'pointer', fontWeight: '600' }}>
                                                {t('contracts.modal.exemptCurfew')}
                                            </label>
                                        </div>
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
                                <button type="button" className="btn-secondary" onClick={closeContractModal}>
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
