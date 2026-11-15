import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAllContracts, getDevicesWithContracts, createContract, updateContract, updateContractStatus, getSettings, downloadContractDocument } from '../services/api';
import { useTranslation } from 'react-i18next';
import { Shield, FileText, Calendar, DollarSign, TrendingUp, Check, X, Edit, Plus, Search, MoreVertical, Camera, FileUp, Sparkles, ExternalLink, Loader2, CheckCircle2, ChevronDown, ChevronRight, ChevronLeft, ArrowLeft, User, Bike, Sliders, RefreshCw, Share2, Copy, Download, Clock, CalendarDays, CalendarRange } from 'lucide-react';
import { showToast } from '../utils/toast';
import { formatPhoneNumber, formatCurrencyCOP, formatCompact, formatCompactCOP, formatDate } from '../utils/helpers';
import { safeCalcularPrecioMoto } from '../utils/contractCalculations';
import useAdminScrollLock from '../hooks/useAdminScrollLock';
import useFilterVisibilityOnScroll from '../hooks/useFilterVisibilityOnScroll';
import PageHeader from '../components/PageHeader';
import useIsMobile from '../hooks/useIsMobile';
import ContractDocPreviewModal from '../components/modals/ContractDocPreviewModal';
import ContractEditor from '../components/ContractEditor';
import SearchAndFilterBar from '../components/SearchAndFilterBar';
import StatCard from '../components/StatCard';
import './Contracts.css';
import './ContractModalRestyle.css';

const Contracts = () => {
    const isMobile = useIsMobile();
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
    const [downloadingDocId, setDownloadingDocId] = useState(null);
    const [previewContract, setPreviewContract] = useState(null);
    const [previewAttachmentModal, setPreviewAttachmentModal] = useState(null);
    const [previewAttachmentFile, setPreviewAttachmentFile] = useState(null);

    // Prefetch attachment as a File object so iOS Safari can share the real PDF/image natively without losing user gesture
    useEffect(() => {
        if (!previewAttachmentModal?.url) {
            setPreviewAttachmentFile(null);
            return;
        }

        let isCancelled = false;
        (async () => {
            try {
                const response = await fetch(previewAttachmentModal.url);
                if (!response.ok) return;
                const blob = await response.blob();
                if (!isCancelled) {
                    const isPdf = previewAttachmentModal.isPdf;
                    const cleanTitle = (previewAttachmentModal.title || 'documento')
                        .toLowerCase()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .replace(/[^a-z0-9_-]/g, '_');
                    const filename = `${cleanTitle}.${isPdf ? 'pdf' : 'jpg'}`;
                    const mimeType = isPdf ? 'application/pdf' : (blob.type || 'image/jpeg');
                    const file = new File([blob], filename, { type: mimeType });
                    setPreviewAttachmentFile(file);
                }
            } catch (err) {
                console.debug('Prefetch for native share not available:', err);
            }
        })();

        return () => {
            isCancelled = true;
        };
    }, [previewAttachmentModal?.url, previewAttachmentModal?.isPdf, previewAttachmentModal?.title]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && previewAttachmentModal) {
                setPreviewAttachmentModal(null);
            }
        };
        if (previewAttachmentModal) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [previewAttachmentModal]);
    const [showFilters, setShowFilters] = useState(false);
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
        customerDocumentType: 'CC',
        customerDocumentNumber: '',
        customerAddress: '',
        guarantor: {
            name: '',
            document: '',
            phone: '',
            email: '',
            address: ''
        },
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
        cutOffTime: '',
        vehicleInfo: {
            placa: '',
            marca: '',
            linea: '',
            modelo: '',
            color: '',
            cilindraje: '',
            numeroMotor: '',
            numeroChasis: '',
            propietario: '',
            documentoPropietario: '',
            tipoDocumentoPropietario: 'CC',
            telefonoPropietario: '',
            ciudadPropietario: '',
            claseVehiculo: 'MOTOCICLETA',
            servicio: 'PARTICULAR',
            pasajeros: '',
            soatAseguradora: '',
            soatCodigoAseguradora: '',
            soatNumeroPoliza: '',
            soatFechaExpedicion: '',
            soatVigenciaDesde: '',
            soatVigenciaHasta: '',
            soatTotalPagar: ''
        },
        attachments: {
            tarjetaPropiedad: null,
            cedula: null,
            soat: null
        }
    });

    const [companySettings, setCompanySettings] = useState(null);

    const totalGastosFijos = useMemo(() => {
        const fixed = companySettings?.contractDefaults?.fixedCosts;
        return (
            (Number(fixed?.gps) || 500000) +
            (Number(fixed?.soatPosterior) || 370000) +
            (Number(fixed?.traspasoPosterior) || 273000) +
            (Number(fixed?.registro) || 217000)
        );
    }, [companySettings]);

    const contractFinancials = useMemo(() => {
        const fp = companySettings?.contractDefaults?.financialParameters || {};
        return safeCalcularPrecioMoto({
            dailyRate: formData.dailyRate,
            contractDays: formData.contractDays,
            gastos: totalGastosFijos,
            initialFee: formData.initialFee,
            iva: fp.iva !== undefined && fp.iva !== null && fp.iva !== '' ? Number(fp.iva) : 0.19,
            objetivoEA: fp.objetivoEA !== undefined && fp.objetivoEA !== null && fp.objetivoEA !== '' ? Number(fp.objetivoEA) : 0.29,
            pagosPorAnio: fp.pagosPorAnio !== undefined && fp.pagosPorAnio !== null && fp.pagosPorAnio !== '' ? Number(fp.pagosPorAnio) : 312,
            proporcionUPAY: fp.proporcionUPAY !== undefined && fp.proporcionUPAY !== null && fp.proporcionUPAY !== '' ? Number(fp.proporcionUPAY) : 0.95
        });
    }, [formData.dailyRate, formData.contractDays, formData.initialFee, totalGastosFijos, companySettings]);

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

    useAdminScrollLock(isModalMounted);

    // Restore modal draft on mount/refresh if modal was open
    useEffect(() => {
        if (isContractModalOpen) {
            try {
                const savedDraft = sessionStorage.getItem('pocketbike_contract_draft');
                if (savedDraft) {
                    const parsed = JSON.parse(savedDraft);
                    if (parsed?.formData) {
                        const rawForm = parsed.formData;
                        if (!rawForm.devicePin && parsed.editingContract) {
                            const ec = parsed.editingContract;
                            rawForm.devicePin = ec.plainPin || ((ec.customerPhone || '').replace(/\D/g, '').slice(-4)) || ((ec.customerDocument || '').replace(/\D/g, '').slice(-4)) || '1234';
                        }
                        if (rawForm.startDate) {
                            rawForm.startDate = toDateInputValue(rawForm.startDate);
                        } else if (parsed.editingContract?.startDate) {
                            rawForm.startDate = toDateInputValue(parsed.editingContract.startDate);
                        }
                        setFormData(rawForm);
                    }
                    if (parsed?.editingContract) {
                        setEditingContract(parsed.editingContract);
                    }
                }
            } catch (e) {
                console.warn('Error restoring contract draft:', e);
            }
        }
    }, [isContractModalOpen]);

    useEffect(() => {
        if (isModalMounted) {
            document.body.classList.add('modal-open-hide-header');
        } else {
            document.body.classList.remove('modal-open-hide-header');
        }
        return () => {
            document.body.classList.remove('modal-open-hide-header');
        };
    }, [isModalMounted]);

    // Save draft continuously while modal is open
    useEffect(() => {
        if (isContractModalOpen && formData && (formData.deviceId || formData.customerName || formData.customerDocumentNumber || formData.attachments?.tarjetaPropiedad || formData.attachments?.cedula || formData.attachments?.soat)) {
            sessionStorage.setItem('pocketbike_contract_draft', JSON.stringify({
                formData,
                editingContract
            }));
        }
    }, [isContractModalOpen, formData, editingContract]);

    useEffect(() => {
        loadContracts();
        loadAvailableDevices();
        loadCompanySettings();
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

    useFilterVisibilityOnScroll(setShowFilters);

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

    const handleRefresh = async () => {
        await Promise.all([loadContracts(), loadAvailableDevices(), loadCompanySettings()]);
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
        try {
            sessionStorage.removeItem('pocketbike_contract_draft');
        } catch (e) { }
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

    const parseCustomerDocument = (docStr) => {
        if (!docStr || typeof docStr !== 'string' || !docStr.trim()) {
            return { type: 'CC', number: '' };
        }
        const trimmed = docStr.trim();
        const match = trimmed.match(/^(CC|C\.C\.|PPT|CE|TI|NIT|PASAPORTE|PAS)\s*(.*)$/i);
        if (match) {
            let type = match[1].toUpperCase().replace(/\./g, '');
            if (type === 'PAS') type = 'PASAPORTE';
            return { type, number: match[2].trim() };
        }
        return { type: 'CC', number: trimmed };
    };

    const toDateInputValue = (dateVal) => {
        if (!dateVal) return '';
        if (typeof dateVal === 'string') {
            const match = dateVal.match(/^(\d{4}-\d{2}-\d{2})/);
            if (match) return match[1];
        }
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return '';
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
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
            customerDocumentType: 'CC',
            customerDocumentNumber: '',
            customerAddress: '',
            guarantor: {
                name: '',
                document: '',
                phone: '',
                email: '',
                address: ''
            },
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
            cutOffTime: companySettings?.cutOffTime || '23:59',
            vehicleInfo: {
                placa: '',
                marca: '',
                linea: '',
                modelo: '',
                color: '',
                cilindraje: '',
                numeroMotor: '',
                numeroChasis: '',
                propietario: '',
                documentoPropietario: '',
                claseVehiculo: 'MOTOCICLETA'
            },
            attachments: {
                tarjetaPropiedad: null,
                cedula: null,
                soat: null
            }
        });
        openContractModal();
    };

    const handleEdit = (contract) => {
        setEditingContract(contract);
        const parsedDoc = parseCustomerDocument(contract.customerDocument || '');
        const rawV = contract.vehicleInfo || {};
        const vInfo = {
            placa: rawV.placa || '',
            marca: rawV.marca || '',
            linea: rawV.linea || '',
            modelo: rawV.modelo || '',
            color: rawV.color || '',
            cilindraje: rawV.cilindraje || rawV.cilindrada || '',
            numeroMotor: rawV.numeroMotor || rawV['No. MOTOR'] || contract.attachments?.tarjetaPropiedad?.numeroMotor || contract.attachments?.tarjetaPropiedad?.['No. MOTOR'] || contract.attachments?.soat?.numeroMotor || contract.attachments?.soat?.['No. MOTOR'] || '',
            numeroChasis: rawV.numeroChasis || rawV['No. CHASIS ó No. SERIE'] || rawV['No. CHASIS'] || contract.attachments?.tarjetaPropiedad?.numeroChasis || contract.attachments?.tarjetaPropiedad?.['No. CHASIS ó No. SERIE'] || contract.attachments?.soat?.numeroChasis || contract.attachments?.soat?.['No. CHASIS ó No. SERIE'] || '',
            propietario: rawV.propietario || '',
            documentoPropietario: rawV.documentoPropietario || '',
            tipoDocumentoPropietario: rawV.tipoDocumentoPropietario || 'CC',
            telefonoPropietario: rawV.telefonoPropietario || '',
            ciudadPropietario: rawV.ciudadPropietario || '',
            claseVehiculo: rawV.claseVehiculo || 'MOTOCICLETA',
            servicio: rawV.servicio || 'PARTICULAR',
            pasajeros: rawV.pasajeros || '',
            soatAseguradora: rawV.soatAseguradora || '',
            soatCodigoAseguradora: rawV.soatCodigoAseguradora || '',
            soatNumeroPoliza: rawV.soatNumeroPoliza || '',
            soatFechaExpedicion: rawV.soatFechaExpedicion || '',
            soatVigenciaDesde: rawV.soatVigenciaDesde || '',
            soatVigenciaHasta: rawV.soatVigenciaHasta || contract.soatDueDate || '',
            soatTotalPagar: rawV.soatTotalPagar || ''
        };

        if (!vInfo.numeroMotor && contract.notes) {
            const mMatch = contract.notes.match(/Motor:\s*([A-Za-z0-9_-]+)/i);
            if (mMatch && mMatch[1]) vInfo.numeroMotor = mMatch[1].toUpperCase();
        }
        if (!vInfo.numeroChasis && contract.notes) {
            const cMatch = contract.notes.match(/Chasis:\s*([A-Za-z0-9_-]+)/i);
            if (cMatch && cMatch[1]) vInfo.numeroChasis = cMatch[1].toUpperCase();
        }

        setShowVehicleDetails(Boolean(vInfo.placa || vInfo.marca || vInfo.numeroChasis || vInfo.numeroMotor));
        setFormData({
            deviceId: contract.deviceId,
            customerName: contract.customerName || '',
            customerEmail: contract.customerEmail || '',
            customerPhone: contract.customerPhone || '',
            customerDocument: contract.customerDocument || '',
            customerDocumentType: parsedDoc.type,
            customerDocumentNumber: parsedDoc.number,
            customerAddress: contract.customerAddress || '',
            guarantor: {
                name: contract.guarantor?.name || contract.guarantorName || '',
                document: contract.guarantor?.document || contract.guarantorDocument || '',
                phone: contract.guarantor?.phone || contract.guarantorPhone || '',
                email: contract.guarantor?.email || contract.guarantorEmail || '',
                address: contract.guarantor?.address || contract.guarantorAddress || ''
            },
            dailyRate: contract.dailyRate,
            contractDays: contract.contractDays,
            startDate: toDateInputValue(contract.startDate),
            notes: contract.notes || '',
            devicePin: contract.plainPin || ((contract.customerPhone || '').replace(/\D/g, '').slice(-4)) || ((contract.customerDocument || '').replace(/\D/g, '').slice(-4)) || '1234',
            freeDaysLimit: contract.freeDaysLimit || 4,
            freeDayPolicy: contract.freeDayPolicy || 'FLEXIBLE',
            fixedFreeDayOfWeek: contract.fixedFreeDayOfWeek ?? 0,
            paymentFrequency: contract.paymentFrequency || 1,
            initialFee: contract.financialBreakdown?.initialFee || contract.initialFee || 0,
            exemptFromCutOff: contract.exemptFromCutOff || false,
            exemptFromCurfew: contract.exemptFromCurfew || false,
            cutOffTime: contract.cutOffTime || companySettings?.cutOffTime || '23:59',
            vehicleInfo: vInfo,
            attachments: contract.attachments || {
                tarjetaPropiedad: null,
                cedula: null,
                soat: null
            }
        });
        openContractModal();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const trimmedNumber = formData.customerDocumentNumber ? String(formData.customerDocumentNumber).trim() : '';
            const combinedDocument = trimmedNumber
                ? `${formData.customerDocumentType || 'CC'} ${trimmedNumber}`
                : (formData.customerDocument || '');

            const payload = {
                ...formData,
                customerDocument: combinedDocument,
                financialBreakdown: contractFinancials?.isValid ? contractFinancials.data : undefined
            };

            const result = editingContract
                ? await updateContract(editingContract.contractId, payload)
                : await createContract(payload);

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



    const getStatusColor = (status) => {
        const colors = {
            'ACTIVE': '#00C292',
            'COMPLETED': 'var(--brand-teal)',
            'CANCELLED': '#EF4444',
            'SUSPENDED': '#FB9678'
        };
        return colors[status] || '#6B7280';
    };

    const getFrequencyBadge = (freq = 1) => {
        const f = Number(freq) || 1;
        if (f >= 12) {
            return {
                label: 'Quincenal',
                title: `Cobro quincenal (${f} días)`,
                icon: CalendarRange,
                className: 'bg-purple-50 text-purple-700 border-purple-200'
            };
        }
        if (f >= 6) {
            return {
                label: 'Semanal',
                title: `Cobro semanal (${f} días)`,
                icon: CalendarDays,
                className: 'bg-indigo-50 text-indigo-700 border-indigo-200'
            };
        }
        return {
            label: 'Diario',
            title: 'Cobro diario (1 día)',
            icon: Clock,
            className: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
    };

    const filteredContracts = contracts.filter(contract => {
        // Status / payment frequency filter
        if (filter === 'weekly') {
            if ((contract.paymentFrequency || 1) <= 1) {
                return false;
            }
        } else if (filter !== 'all' && contract.status?.toLowerCase() !== filter.toLowerCase()) {
            return false;
        }

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                (contract.deviceId || '').toLowerCase().includes(query) ||
                (contract.contractId || '').toLowerCase().includes(query) ||
                (contract.customerName || '').toLowerCase().includes(query) ||
                (contract.customerEmail || '').toLowerCase().includes(query)
            );
        }

        return true;
    });

    const filterOptions = [
        { value: 'all', label: t('contracts.filters.all') },
        { value: 'active', label: t('contracts.filters.active') },
        { value: 'completed', label: t('contracts.filters.completed') },
        { value: 'cancelled', label: t('contracts.filters.cancelled') },
        { value: 'weekly', label: t('contracts.filters.weekly', 'Semanal+') }
    ];

    const desktopHeader = (
        <PageHeader.Desktop
            title={t('contracts.title')}
            breadcrumbs={[
                { label: 'Operaciones' },
                { label: t('contracts.title') }
            ]}
            onRefresh={handleRefresh}
            loading={loading}
            refreshText={t('payments.refresh', 'Actualizar')}
            actions={
                <button
                    type="button"
                    className="btn-primary"
                    onClick={handleNewContract}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                    <Plus size={18} /> {t('contracts.newContract', 'Nuevo Contrato')}
                </button>
            }
        />
    );

    const mobileHeader = (
        <PageHeader.Mobile
            onRefresh={handleRefresh}
            loading={loading}
            onFilterToggle={() => setShowFilters(!showFilters)}
            showFilters={showFilters}
        />
    );

    const renderHeader = isMobile ? mobileHeader : desktopHeader;

    return (
        <div className="admin-page-container">
            {renderHeader}

            {/* Expandable Metrics and Search & Filter Section */}
            <div className={`expandable-metrics-container ${!isMobile || showFilters ? 'expanded' : 'collapsed'}`}>
                {/* Summary Stats — Minimalist iOS style consistent with DeviceSelector */}
                <div className="contracts-stats">
                    <StatCard
                        title={t('contracts.stats.total', 'TOTAL')}
                        value={contracts.length}
                    />
                    <StatCard
                        title={t('contracts.stats.active', 'ACTIVOS')}
                        value={contracts.filter(c => c.status === 'ACTIVE').length}
                        valueColor="#00C292"
                    />
                    <StatCard
                        title={t('contracts.stats.completed', 'FINALIZADOS')}
                        value={contracts.filter(c => c.status === 'COMPLETED').length}
                        valueColor="#0070eb"
                    />
                    <StatCard
                        title={t('contracts.stats.totalValue', 'VALOR TOTAL')}
                        value={formatCompactCOP(contracts.reduce((sum, c) => sum + (c.totalAmount || 0), 0))}
                        fullValue={formatCurrencyCOP(contracts.reduce((sum, c) => sum + (c.totalAmount || 0), 0), true)}
                        valueColor="#1a1c1c"
                    />
                </div>

                <SearchAndFilterBar
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    searchPlaceholder={t('contracts.searchPlaceholder', 'Buscar por ID, nombre o email…')}
                    filter={filter}
                    setFilter={setFilter}
                    filterOptions={filterOptions}
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
                            className="contract-card"
                            onClick={(e) => {
                                handleEdit(contract);
                                setActiveMenu(null);
                            }}
                        >
                            {/* Header with ID, Badge and Menu */}
                            <header className="flex items-center justify-between mb-1">
                                <div className="flex items-center flex-wrap gap-1.5">
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
                                    {(() => {
                                        const freqInfo = getFrequencyBadge(contract.paymentFrequency);
                                        const FreqIcon = freqInfo.icon;
                                        return (
                                            <span
                                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${freqInfo.className}`}
                                                title={freqInfo.title}
                                            >
                                                <FreqIcon size={11} strokeWidth={2.2} />
                                                {freqInfo.label}
                                            </span>
                                        );
                                    })()}
                                    <span
                                        className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200"
                                        title="PIN de acceso"
                                    >
                                        PIN: {contract.plainPin || ((contract.customerPhone || '').replace(/\D/g, '').slice(-4)) || '----'}
                                    </span>
                                </div>
                                <div className="action-menu-container" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => {
                                            setPreviewContract(contract);
                                            setActiveMenu(null);
                                        }}

                                    >
                                        <FileText size={16} />
                                    </button>
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
                                            {formatCurrencyCOP(contract.totalAmount)}
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
                                            {formatCurrencyCOP(contract.dailyRate)}
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
                                        <span>{formatCurrencyCOP(contract.paidAmount)}</span>
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

            {/* Floating Action Button (FAB) for Desktop & Mobile */}
            {fabPortalElement && !isModalMounted && createPortal(
                <button
                    type="button"
                    className="contracts-add-fab primary-blue"
                    onClick={handleNewContract}
                    aria-label={t('contracts.newContract', 'Nuevo Contrato')}
                    title={t('contracts.newContract', 'Nuevo Contrato')}
                >
                    <Plus size={30} />
                </button>,
                fabPortalElement
            )}

            {/* Immersive Contract Editor (Slide-in View) */}
            {isModalMounted && (
                <ContractEditor
                    isOpen={isModalMounted}
                    isClosing={isModalClosing}
                    onClose={closeContractModal}
                    onSubmit={handleSubmit}
                    editingContract={editingContract}
                    formData={formData}
                    setFormData={setFormData}
                    availableDevices={availableDevices}
                    companySettings={companySettings}
                    loading={loading}
                />
            )}

            {previewContract && (
                <ContractDocPreviewModal
                    contract={previewContract}
                    isOpen={Boolean(previewContract)}
                    onClose={() => setPreviewContract(null)}
                />
            )}



            {previewAttachmentModal && createPortal(
                <div
                    className="attachment-preview-backdrop"
                    onClick={() => setPreviewAttachmentModal(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label={previewAttachmentModal.title}
                >
                    <div className="attachment-preview-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="attachment-preview-header">
                            <div className="attachment-preview-title">
                                <FileText size={18} style={{ color: 'var(--brand-teal, #0D9488)' }} />
                                <span>{previewAttachmentModal.title}</span>
                            </div>
                            <div className="attachment-preview-actions">
                                <button
                                    type="button"
                                    className="btn-attachment-preview-ext btn-attachment-preview-share"
                                    onClick={handleShareAttachment}
                                    title="Compartir documento"
                                >
                                    <Share2 size={14} />
                                    <span>Compartir</span>
                                </button>
                                <a
                                    href={previewAttachmentModal.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-attachment-preview-ext"
                                    title="Abrir archivo en pestaña nueva"
                                >
                                    <ExternalLink size={14} />
                                    <span>Abrir</span>
                                </a>
                                <button
                                    type="button"
                                    className="btn-attachment-preview-close"
                                    onClick={() => setPreviewAttachmentModal(null)}
                                    title="Cerrar visor"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="attachment-preview-body">
                            {previewAttachmentModal.isPdf ? (
                                <iframe
                                    src={previewAttachmentModal.url}
                                    className="attachment-preview-iframe"
                                    title={previewAttachmentModal.title}
                                />
                            ) : (
                                <img
                                    src={previewAttachmentModal.url}
                                    alt={previewAttachmentModal.title}
                                    className="attachment-preview-img"
                                />
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );

};

export default Contracts;
