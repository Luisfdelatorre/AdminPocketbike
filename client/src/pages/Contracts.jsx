import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAllContracts, getDevicesWithContracts, createContract, updateContract, updateContractStatus, getSettings, downloadContractDocument, extractContractDocument } from '../services/api';
import { useTranslation } from 'react-i18next';
import { Shield, FileText, Calendar, DollarSign, TrendingUp, Check, X, Edit, Plus, Search, MoreVertical, ListFilter, Camera, FileUp, Sparkles, ExternalLink, Loader2, CheckCircle2, ChevronDown, ChevronRight, ChevronLeft, ArrowLeft, User, Bike, Sliders, RefreshCw, Share2, Copy, Download } from 'lucide-react';
import { showToast } from '../utils/toast';
import { formatPhoneNumber } from '../utils/helpers';
import { safeCalcularPrecioMoto } from '../utils/contractCalculations';
import useAdminScrollLock from '../hooks/useAdminScrollLock';
import useFilterVisibilityOnScroll from '../hooks/useFilterVisibilityOnScroll';
import ContractDocPreviewModal from '../components/modals/ContractDocPreviewModal';
import ImageCropModal from '../components/modals/ImageCropModal';
import WhatsAppAttachmentModal from '../components/modals/WhatsAppAttachmentModal';
import { convertPdfToImage, isPdfDocument } from '../utils/pdfToImage';
import './Contracts.css';
import './ContractModalRestyle.css';

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
    const [downloadingDocId, setDownloadingDocId] = useState(null);
    const [previewContract, setPreviewContract] = useState(null);
    const [ocrLoadingCategory, setOcrLoadingCategory] = useState(null);
    const [ocrResultCard, setOcrResultCard] = useState(null);
    const [dismissedOcrCard, setDismissedOcrCard] = useState(false);
    const [scanningImagePreview, setScanningImagePreview] = useState(null);
    const [showVehicleDetails, setShowVehicleDetails] = useState(false);
    const [isDevicePickerOpen, setIsDevicePickerOpen] = useState(false);
    const [isVehicleDetailsOpen, setIsVehicleDetailsOpen] = useState(false);
    const [deviceSearchQuery, setDeviceSearchQuery] = useState('');
    const [cropModalState, setCropModalState] = useState({
        isOpen: false,
        imageSrc: null,
        category: null,
        filename: null
    });
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
    const [openSections, setOpenSections] = useState({
        device: false,
        customer: false,
        financial: true,
        advanced: false
    });

    const toggleSection = (sectionKey) => {
        setOpenSections(prev => ({
            ...prev,
            [sectionKey]: !prev[sectionKey]
        }));
    };

    const [showFilters, setShowFilters] = useState(false);
    const [portalElement, setPortalElement] = useState(null);
    const [fabPortalElement, setFabPortalElement] = useState(null);
    const tarjetaInputRef = useRef(null);
    const cedulaInputRef = useRef(null);
    const soatInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const photosInputRef = useRef(null);
    const docInputRef = useRef(null);
    const activeCategoryRef = useRef(null);
    const [waAttachSheet, setWaAttachSheet] = useState({
        isOpen: false,
        category: null,
        title: '',
        subtitle: ''
    });
    const isContractModalOpen = new URLSearchParams(location.search).get('modal') === 'contract';
    const [isModalMounted, setIsModalMounted] = useState(isContractModalOpen);
    const [isModalClosing, setIsModalClosing] = useState(false);
    const [editorActiveTab, setEditorActiveTab] = useState('vehicle'); // 'vehicle' | 'customer' | 'financial' | 'telemetry' | 'preview'
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
        return safeCalcularPrecioMoto({
            dailyRate: formData.dailyRate,
            contractDays: formData.contractDays,
            gastos: totalGastosFijos,
            initialFee: formData.initialFee,
            iva: 0.19,
            objetivoEA: 0.29,
            pagosPorAnio: 312,
            proporcionUPAY: 0.95
        });
    }, [formData.dailyRate, formData.contractDays, formData.initialFee, totalGastosFijos]);

    const formatCurrencyCOP = (value) => {
        return '$ ' + (Math.round(Number(value) || 0)).toLocaleString('es-CO');
    };

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
                        setFormData(parsed.formData);
                    }
                    if (parsed?.editingContract) {
                        setEditingContract(parsed.editingContract);
                    }
                    if (parsed?.ocrResultCard) {
                        setOcrResultCard(parsed.ocrResultCard);
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
                editingContract,
                ocrResultCard
            }));
        }
    }, [isContractModalOpen, formData, editingContract, ocrResultCard]);

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
        setOcrResultCard(null);
        setDismissedOcrCard(false);
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

    const handleNewContract = () => {
        setEditingContract(null);
        setOcrResultCard(null);
        setDismissedOcrCard(false);
        setShowVehicleDetails(false);
        setOpenSections({
            device: false,
            customer: false,
            financial: false,
            advanced: false
        });
        const defaults = companySettings?.contractDefaults || {};
        setEditorActiveTab('vehicle');
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
        setOcrResultCard(null);
        setDismissedOcrCard(false);
        setEditorActiveTab('vehicle');
        setOpenSections({
            device: false,
            customer: false,
            financial: false,
            advanced: false
        });
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
            startDate: contract.startDate,
            notes: contract.notes || '',
            devicePin: '',
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

    const compressImage = (file, maxDimension = 1600, quality = 0.85) => {
        return new Promise((resolve) => {
            if (!file.type || !file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(file);
                return;
            }

            const img = new Image();
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    if (width > maxDimension || height > maxDimension) {
                        if (width > height) {
                            height = Math.round((height * maxDimension) / width);
                            width = maxDimension;
                        } else {
                            width = Math.round((width * maxDimension) / height);
                            height = maxDimension;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(dataUrl);
                };
                img.onerror = () => {
                    resolve(e.target.result);
                };
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });
    };

    const executeDocumentExtraction = async (base64Data, mimeType, category, filename) => {
        if (!base64Data || typeof base64Data !== 'string' || base64Data === 'data:,' || base64Data.length < 50) {
            showToast('error', 'Error', 'La imagen capturada no es válida o está vacía.');
            return;
        }

        try {
            setOcrLoadingCategory(category);
            setScanningImagePreview(base64Data);
            setDismissedOcrCard(false);
            const categoryNames = {
                tarjeta_propiedad: 'Tarjeta de Propiedad',
                cedula: 'Cédula / PPT',
                soat: 'SOAT'
            };
            showToast('info', 'Escaneando con IA', `Analizando ${categoryNames[category] || 'documento'} con OpenAI...`);

            const res = await extractContractDocument({
                category,
                base64: base64Data,
                mimeType,
                filename
            });

            if (res.success && res.data) {
                const data = res.data;
                const fileUrl = res.fileUrl;

                const normalizeMotoPlate = (str) => {
                    if (!str) return '';
                    const clean = String(str).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                    if (clean.length === 6) {
                        const lastMap = { '1': 'I', '0': 'O', '8': 'B', '5': 'S', '2': 'Z' };
                        if (lastMap[clean[5]]) {
                            return clean.substring(0, 5) + lastMap[clean[5]];
                        }
                    }
                    return clean;
                };

                let matchedPlate = null;
                let matchedDeviceId = null;
                let matchedEmail = null;

                if (category === 'tarjeta_propiedad' && data.placa) {
                    const plateClean = String(data.placa).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                    const plateNorm = normalizeMotoPlate(plateClean);
                    const matched = availableDevices.find(d => {
                        const dName = (d.name || d.deviceName || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                        const dId = String(d.deviceId || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                        return dName === plateClean || dName === plateNorm ||
                            dName.includes(plateClean) || dName.includes(plateNorm) ||
                            dId === plateClean || dId === plateNorm;
                    });

                    if (matched) {
                        matchedDeviceId = matched.deviceId;
                        matchedPlate = matched.name || matched.deviceName || matched.deviceId;
                        const domain = companySettings?.contractDefaults?.emailDomain || 'pocketbike.app';
                        matchedEmail = `${matchedPlate.toUpperCase()}@${domain.toLowerCase()}`;
                    }
                } else if (category === 'soat' && data.placa) {
                    const plateClean = String(data.placa).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                    const plateNorm = normalizeMotoPlate(plateClean);
                    const matched = availableDevices.find(d => {
                        const dName = (d.name || d.deviceName || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                        return dName === plateClean || dName === plateNorm;
                    });
                    if (matched) {
                        matchedDeviceId = matched.deviceId;
                    }
                }

                // Robust vehicle info field extractors (supporting both normalized keys and original Colombian labels)
                const motorVal = data.numeroMotor || data['No. MOTOR'] || data['No MOTOR'] || data['MOTOR'] || data.motor || data._raw?.['No. MOTOR'] || data._raw?.numeroMotor || '';
                const chasisVal = data.numeroChasis || data['No. CHASIS ó No. SERIE'] || data['No. CHASIS o No. SERIE'] || data['No. CHASIS'] || data['No CHASIS'] || data['CHASIS'] || data.chasis || data.vin || data['No. VIN'] || data.serie || data._raw?.['No. CHASIS ó No. SERIE'] || data._raw?.['No. CHASIS'] || data._raw?.numeroChasis || '';
                const marcaVal = data.marca || data['MARCA'] || data._raw?.['MARCA'] || '';
                const lineaVal = data.linea || data['LÍNEA VEHÍCULO'] || data['LINEA'] || data._raw?.['LÍNEA VEHÍCULO'] || '';
                const modeloVal = data.modelo || data['MODELO'] || data._raw?.['MODELO'] || '';
                const colorVal = data.color || data['COLOR'] || data._raw?.['COLOR'] || '';
                const cilindrajeVal = data.cilindraje || data.cilindrada || data['CILINDRAJE/VATIOS'] || data['CILINDRADA'] || data._raw?.['CILINDRAJE/VATIOS'] || '';

                // Construct card info
                let cardInfo = null;
                if (category === 'tarjeta_propiedad') {
                    cardInfo = {
                        category,
                        title: '✨ Tarjeta de Propiedad Extraída',
                        fileUrl,
                        items: [
                            { label: 'Placa', val: data.placa ? `${data.placa}${matchedPlate && matchedPlate !== data.placa ? ` ➔ Moto: ${matchedPlate}` : (matchedPlate ? ` ➔ Moto: ${matchedPlate}` : '')}` : 'N/A' },
                            { label: 'Propietario', val: data.propietario || 'N/A' },
                            { label: 'Cédula', val: data.documentoPropietario || 'N/A' },
                            { label: 'Marca / Línea', val: `${marcaVal} ${lineaVal}`.trim() || 'N/A' },
                            { label: 'Modelo', val: modeloVal || 'N/A' },
                            { label: 'Color', val: colorVal || 'N/A' },
                            { label: 'Motor', val: motorVal || 'N/A' },
                            { label: 'Chasis (VIN)', val: chasisVal || 'N/A' }
                        ]
                    };
                } else if (category === 'cedula') {
                    cardInfo = {
                        category,
                        title: '✨ Cédula / PPT Extraída',
                        fileUrl,
                        items: [
                            { label: 'Tipo Doc', val: data.documentType || 'CC' },
                            { label: 'Número', val: data.documentNumber || data.documentNumberFormatted || 'N/A' },
                            { label: 'Nombre Completo', val: data.fullName || 'N/A' }
                        ]
                    };
                } else if (category === 'soat') {
                    cardInfo = {
                        category,
                        title: '✨ SOAT Extraído',
                        fileUrl,
                        items: [
                            { label: 'Fecha Vencimiento', val: data.fechaVencimiento || 'N/A' },
                            { label: 'Aseguradora', val: data.aseguradora || 'N/A' },
                            { label: 'Placa en SOAT', val: data.placa || 'N/A' },
                            { label: 'Póliza', val: data.numeroPoliza || 'N/A' },
                            { label: 'Motor', val: motorVal || 'N/A' },
                            { label: 'Chasis (VIN)', val: chasisVal || 'N/A' },
                            { label: 'Marca / Línea', val: `${marcaVal} ${lineaVal}`.trim() || 'N/A' }
                        ]
                    };
                }

                setDismissedOcrCard(false);
                if (cardInfo) {
                    setOcrResultCard(cardInfo);
                }

                setFormData((prev) => {
                    const next = { ...prev };
                    const keyMap = {
                        tarjeta_propiedad: 'tarjetaPropiedad',
                        cedula: 'cedula',
                        soat: 'soat'
                    };
                    const attKey = keyMap[category] || category;

                    next.attachments = {
                        ...(prev.attachments || {}),
                        [attKey]: { url: fileUrl, ...data },
                        [category]: { url: fileUrl, ...data }
                    };

                    if (category === 'tarjeta_propiedad') {
                        if (matchedDeviceId) {
                            next.deviceId = matchedDeviceId;
                            if (!next.customerEmail && matchedEmail) {
                                next.customerEmail = matchedEmail;
                            }
                        }

                        if (data.propietario) {
                            next.customerName = String(data.propietario).toUpperCase();
                        }
                        if (data.documentoPropietario) {
                            next.customerDocumentType = 'CC';
                            next.customerDocumentNumber = String(data.documentoPropietario);
                            next.customerDocument = `CC ${data.documentoPropietario}`;
                        }

                        // Guardar datos técnicos estructurados para la BD
                        next.vehicleInfo = {
                            ...(prev.vehicleInfo || {}),
                            placa: data.placa || prev.vehicleInfo?.placa || '',
                            marca: marcaVal || prev.vehicleInfo?.marca || '',
                            linea: lineaVal || prev.vehicleInfo?.linea || '',
                            modelo: modeloVal || prev.vehicleInfo?.modelo || '',
                            color: colorVal || prev.vehicleInfo?.color || '',
                            cilindraje: cilindrajeVal || prev.vehicleInfo?.cilindraje || '',
                            numeroMotor: motorVal || prev.vehicleInfo?.numeroMotor || '',
                            numeroChasis: chasisVal || prev.vehicleInfo?.numeroChasis || '',
                            propietario: data.propietario || prev.vehicleInfo?.propietario || '',
                            documentoPropietario: data.documentoPropietario || prev.vehicleInfo?.documentoPropietario || '',
                            claseVehiculo: data.claseVehiculo || prev.vehicleInfo?.claseVehiculo || 'MOTOCICLETA'
                        };

                        const vInfo = [
                            marcaVal && `Marca: ${marcaVal}`,
                            lineaVal && `Línea: ${lineaVal}`,
                            modeloVal && `Modelo: ${modeloVal}`,
                            colorVal && `Color: ${colorVal}`,
                            motorVal && `Motor: ${motorVal}`,
                            chasisVal && `Chasis: ${chasisVal}`
                        ].filter(Boolean).join(' | ');

                        if (vInfo) {
                            const header = `[Tarjeta - ${matchedPlate || data.placa}]`;
                            next.notes = next.notes ? `${next.notes}\n${header} ${vInfo}` : `${header} ${vInfo}`;
                        }
                    } else if (category === 'cedula') {
                        if (data.documentType) {
                            next.customerDocumentType = data.documentType;
                        }
                        const docNum = data.documentNumber || data.documentNumberFormatted || '';
                        if (docNum) {
                            next.customerDocumentNumber = String(docNum);
                            next.customerDocument = `${next.customerDocumentType || 'CC'} ${docNum}`;
                        }
                        if (data.fullName) {
                            next.customerName = String(data.fullName).toUpperCase();
                        }
                    } else if (category === 'soat') {
                        if (matchedDeviceId && !next.deviceId) {
                            next.deviceId = matchedDeviceId;
                        }
                        if (data.fechaVencimiento) {
                            next.soatDueDate = data.fechaVencimiento;
                            const soatNote = `SOAT vence: ${data.fechaVencimiento}${data.aseguradora ? ` (${data.aseguradora})` : ''}`;
                            if (!next.notes.includes('SOAT vence:')) {
                                next.notes = next.notes ? `${next.notes} | ${soatNote}` : soatNote;
                            }
                        }

                        // Auto-llenar vehicleInfo completo desde el SOAT
                        next.vehicleInfo = {
                            ...(prev.vehicleInfo || {}),
                            placa: data.placa || prev.vehicleInfo?.placa || '',
                            marca: marcaVal || prev.vehicleInfo?.marca || '',
                            linea: lineaVal || prev.vehicleInfo?.linea || '',
                            modelo: modeloVal || prev.vehicleInfo?.modelo || '',
                            color: colorVal || prev.vehicleInfo?.color || '',
                            cilindraje: cilindrajeVal || prev.vehicleInfo?.cilindraje || '',
                            numeroMotor: motorVal || prev.vehicleInfo?.numeroMotor || '',
                            numeroChasis: chasisVal || prev.vehicleInfo?.numeroChasis || '',
                            claseVehiculo: data.claseVehiculo || prev.vehicleInfo?.claseVehiculo || 'MOTOCICLETA',
                            servicio: data.servicio || prev.vehicleInfo?.servicio || 'PARTICULAR',
                            pasajeros: data.pasajeros ? String(data.pasajeros) : prev.vehicleInfo?.pasajeros || '',
                            propietario: data.tomador || prev.vehicleInfo?.propietario || '',
                            documentoPropietario: data.documentoTomador || prev.vehicleInfo?.documentoPropietario || '',
                            tipoDocumentoPropietario: data.tipoDocumentoTomador || prev.vehicleInfo?.tipoDocumentoPropietario || 'CC',
                            telefonoPropietario: data.telefonoTomador ? formatPhoneNumber(data.telefonoTomador) : prev.vehicleInfo?.telefonoPropietario || '',
                            ciudadPropietario: data.ciudad || prev.vehicleInfo?.ciudadPropietario || '',
                            soatAseguradora: data.aseguradora || prev.vehicleInfo?.soatAseguradora || '',
                            soatCodigoAseguradora: data.codigoAseguradora ? String(data.codigoAseguradora) : prev.vehicleInfo?.soatCodigoAseguradora || '',
                            soatNumeroPoliza: data.numeroPoliza ? String(data.numeroPoliza) : prev.vehicleInfo?.soatNumeroPoliza || '',
                            soatFechaExpedicion: data.fechaExpedicion || prev.vehicleInfo?.soatFechaExpedicion || '',
                            soatVigenciaDesde: data.fechaInicio || prev.vehicleInfo?.soatVigenciaDesde || '',
                            soatVigenciaHasta: data.fechaVencimiento || prev.vehicleInfo?.soatVigenciaHasta || '',
                            soatTotalPagar: data.totalPagar ? String(data.totalPagar) : prev.vehicleInfo?.soatTotalPagar || ''
                        };

                        // Auto-llenar datos del cliente si están vacíos
                        if (!next.customerName && data.tomador) {
                            next.customerName = String(data.tomador).toUpperCase();
                        }
                        if (!next.customerDocumentNumber && data.documentoTomador) {
                            const docType = data.tipoDocumentoTomador || 'CC';
                            next.customerDocumentType = docType;
                            next.customerDocumentNumber = String(data.documentoTomador);
                            next.customerDocument = `${docType} ${data.documentoTomador}`;
                        }
                        if (!next.customerPhone && data.telefonoTomador) {
                            next.customerPhone = formatPhoneNumber(data.telefonoTomador);
                        }
                    }

                    return next;
                });

                if (category === 'tarjeta_propiedad' || category === 'soat') {
                    setIsVehicleDetailsOpen(true);
                }

                showToast('success', '¡Documento extraído con IA!', 'Información leída y aplicada al contrato.');
            } else {
                showToast('error', 'Error', res.error || 'No se pudieron extraer datos del documento.');
            }
        } catch (err) {
            console.error('Error uploading/extracting contract document:', err);
            showToast('error', 'Error', err.message || 'Error al procesar el archivo.');
        } finally {
            setOcrLoadingCategory(null);
            setScanningImagePreview(null);
        }
    };

    const handleDocumentUpload = async (e, category) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset the input value so selecting the same file triggers again
        e.target.value = '';

        if (file.type && file.type.startsWith('image/')) {
            // Read image and open ImageCropModal for cropping and resolution reduction
            const reader = new FileReader();
            reader.onload = (event) => {
                setCropModalState({
                    isOpen: true,
                    imageSrc: event.target.result,
                    category,
                    filename: file.name
                });
            };
            reader.readAsDataURL(file);
        } else if (isPdfDocument(file)) {
            // Convert PDF page to high-res JPEG image in memory via PDF.js
            try {
                showToast('info', 'Procesando PDF', 'Renderizando página del PDF para análisis con IA...');
                const rendered = await convertPdfToImage(file, { scale: 2.0, quality: 0.92 });
                if (!rendered?.dataUrl) {
                    showToast('error', 'Error', 'No se pudo renderizar la página del documento PDF.');
                    return;
                }
                setCropModalState({
                    isOpen: true,
                    imageSrc: rendered.dataUrl,
                    category,
                    filename: file.name.replace(/\.pdf$/i, '.jpg')
                });
            } catch (err) {
                console.error('Error renderizando PDF a imagen:', err);
                showToast('warning', 'PDF', 'No se pudo renderizar como imagen, enviando archivo original...');
                try {
                    const base64Data = await compressImage(file, 1600, 0.85);
                    if (base64Data) {
                        executeDocumentExtraction(base64Data, file.type || 'application/pdf', category, file.name);
                    }
                } catch (fallbackErr) {
                    showToast('error', 'Error', 'Error al leer el archivo PDF.');
                }
            }
        } else {
            // Other formats fallback
            try {
                const base64Data = await compressImage(file, 1600, 0.85);
                if (!base64Data) {
                    showToast('error', 'Error', 'No se pudo leer el archivo seleccionado.');
                    return;
                }
                executeDocumentExtraction(base64Data, file.type || 'application/octet-stream', category, file.name);
            } catch (err) {
                console.error('Error reading document file:', err);
                showToast('error', 'Error', 'Error al leer el archivo seleccionado.');
            }
        }
    };

    const handleOpenAttachSheet = (category) => {
        activeCategoryRef.current = category;
        const titles = {
            tarjeta_propiedad: 'Tarjeta de Propiedad',
            cedula: 'Cédula / PPT',
            soat: 'SOAT'
        };
        setWaAttachSheet({
            isOpen: true,
            category,
            title: titles[category] || 'Adjuntar Documento',
            subtitle: 'Selecciona cómo deseas capturar el documento para la IA'
        });
    };

    const handleSelectAttachmentOption = (option) => {
        // Keep our sheet visible while the system picker is shown; it closes once a file is chosen
        if (option === 'camera') {
            cameraInputRef.current?.click();
        } else if (option === 'photos') {
            photosInputRef.current?.click();
        } else if (option === 'document') {
            docInputRef.current?.click();
        }
    };

    const handleAttachmentFileSelected = (e) => {
        const cat = activeCategoryRef.current;
        if (!cat) return;
        setWaAttachSheet(prev => ({ ...prev, isOpen: false }));
        handleDocumentUpload(e, cat);
    };

    const handleViewAttachment = (url, title) => {
        if (!url) {
            showToast('info', 'Documento', 'No se encontró archivo para mostrar.');
            return;
        }
        const resolvedUrl = typeof url === 'string' ? url : (url.url || url.fileUrl || '');
        if (!resolvedUrl) return;

        const isPdf = resolvedUrl.toLowerCase().includes('.pdf') || resolvedUrl.startsWith('data:application/pdf');
        setPreviewAttachmentModal({
            url: resolvedUrl,
            title: title || 'Documento Adjunto',
            isPdf
        });
    };

    const getFullAttachmentUrl = () => {
        if (!previewAttachmentModal?.url) return '';
        let fullUrl = previewAttachmentModal.url;
        if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://') && !fullUrl.startsWith('data:')) {
            fullUrl = `${window.location.origin}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
        }
        return fullUrl;
    };

    const isIOSDevice = () => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
        const ua = navigator.userAgent || navigator.vendor || window.opera || '';
        return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    };

    const isChromeOnIOS = () => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
        const ua = navigator.userAgent || '';
        return isIOSDevice() && (/CriOS/i.test(ua) || /Chrome/i.test(ua));
    };

    const isMobileOrIOS = () => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
        const ua = navigator.userAgent || navigator.vendor || window.opera || '';
        const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        return isIOS || isMobile;
    };

    const handleShareAttachment = async () => {
        if (!window.isSecureContext || typeof navigator.share !== 'function') {
            showToast(
                'error',
                'Compartir no disponible',
                'El navegador necesita HTTPS y soporte para compartir archivos.'
            );
            return;
        }

        const file = previewAttachmentFile;
        const shareUrl = previewAttachmentModal?.url
            ? new URL(previewAttachmentModal.url, window.location.href).href
            : window.location.href;
        const docTitle = previewAttachmentModal?.title || 'Documento';

        // 1. Si el archivo está listo y el navegador soporta compartir archivos (ej: Safari en iOS)
        if (file instanceof File && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({ files: [file] });
                return;
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.error('Error compartiendo archivo nativo:', err);
            }
        }

        // 2. Si no admite compartir archivos directamente (ej: Chrome en iOS), compartir vía share nativo con enlace
        try {
            await navigator.share({
                title: docTitle,
                url: shareUrl
            });
        } catch (err) {
            if (err.name === 'AbortError') return;

            console.error('Error compartiendo:', err);
            showToast(
                'error',
                'No se pudo compartir',
                'Vuelve a pulsar Compartir.'
            );
        }
    };

    const handleRemoveAttachment = (category) => {
        setFormData(prev => {
            const nextAtt = { ...(prev.attachments || {}) };
            if (category === 'tarjeta_propiedad') {
                delete nextAtt.tarjetaPropiedad;
                delete nextAtt.tarjeta_propiedad;
            } else if (category === 'cedula') {
                delete nextAtt.cedula;
            } else if (category === 'soat') {
                delete nextAtt.soat;
            }
            return {
                ...prev,
                attachments: nextAtt
            };
        });
        if (ocrResultCard && ocrResultCard.category === category) {
            setOcrResultCard(null);
        }
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

    const handleDownloadContractDoc = async (contract) => {
        try {
            setDownloadingDocId(contract.contractId);
            showToast('info', 'Contrato', t('contracts.generatingDoc', 'Generando documento de contrato...'));
            const safePlate = (contract.deviceIdName || contract.contractId || 'Contrato').replace(/[^a-zA-Z0-9_-]/g, '_');
            const filename = `Contrato_${safePlate}_${contract.contractId}.docx`;
            await downloadContractDocument(contract.contractId, filename);
            showToast('success', 'Contrato', t('contracts.docGeneratedSuccess', 'Contrato descargado correctamente'));
        } catch (error) {
            console.error('Error generating contract document:', error);
            showToast('error', 'Error', t('contracts.docGeneratedError', 'Error al generar el contrato'));
        } finally {
            setDownloadingDocId(null);
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

    // Compact COP for headers: $35K, $17.5M (up to 1 decimal, trailing .0 removed)
    const formatCompactCOP = (value) => {
        const n = Number(value) || 0;
        const trim = (x) => String(Math.round(x * 10) / 10).replace(/\.0$/, '');
        if (n >= 1000000) return `$${trim(n / 1000000)}M COP`;
        if (n >= 1000) return `$${trim(n / 1000)}K COP`;
        return `$${n} COP`;
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
            'COMPLETED': 'var(--brand-teal)',
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
        <div className="admin-page-container">
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
            <div className="page-header !hidden md:!flex">
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
                    color="var(--brand-teal)"
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
                            className="contract-card"
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
                <div className={`modal-overlay ${isModalClosing ? 'modal-overlay--closing' : 'modal-overlay--opening'} contract-editor-immersive-overlay`}>
                    <div className="modal-content modal-surface--contract" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header contract-modal-header">
                            <div className="contract-modal-title-wrap">
                                <span className="contract-status-dot" />
                                <h2>{editingContract ? t('contracts.modal.editTitle') : t('contracts.modal.addTitle')}</h2>
                            </div>
                            <button type="button" className="modal-close" onClick={closeContractModal} aria-label="Cerrar">
                                <X size={20} />
                            </button>
                        </div>
                        <form id="contract-form" onSubmit={handleSubmit} className="contract-form custom-scrollbar">
                            {/* Hidden file inputs for OCR document capture */}
                            <input
                                type="file"
                                ref={tarjetaInputRef}
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={(e) => handleDocumentUpload(e, 'tarjeta_propiedad')}
                            />
                            <input
                                type="file"
                                ref={cedulaInputRef}
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={(e) => handleDocumentUpload(e, 'cedula')}
                            />
                            <input
                                type="file"
                                ref={soatInputRef}
                                accept="application/pdf,image/*"
                                style={{ display: 'none' }}
                                onChange={(e) => handleDocumentUpload(e, 'soat')}
                            />
                            {/* WhatsApp capture options inputs */}
                            <input
                                type="file"
                                ref={cameraInputRef}
                                accept="image/*"
                                capture="environment"
                                style={{ display: 'none' }}
                                onChange={handleAttachmentFileSelected}
                            />
                            <input
                                type="file"
                                ref={photosInputRef}
                                accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
                                multiple
                                style={{ display: 'none' }}
                                onChange={handleAttachmentFileSelected}
                            />
                            <input
                                type="file"
                                ref={docInputRef}
                                accept="application/pdf,.pdf"
                                style={{ display: 'none' }}
                                onChange={handleAttachmentFileSelected}
                            />

                            {/* OCR AI Document Scanning Banner */}
                            <div className="contract-ocr-header">
                                {ocrLoadingCategory && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--brand-teal)' }}>
                                        <Loader2 size={14} className="spinner-spin" /> Procesando con OpenAI...
                                    </div>
                                )}
                            </div>

                            {(() => {
                                const tp = formData.attachments?.tarjetaPropiedad || formData.attachments?.tarjeta_propiedad;
                                const tpUrl = typeof tp === 'string' ? tp : (tp?.url || tp?.fileUrl || null);
                                const cd = formData.attachments?.cedula;
                                const cdUrl = typeof cd === 'string' ? cd : (cd?.url || cd?.fileUrl || null);
                                const st = formData.attachments?.soat;
                                const stUrl = typeof st === 'string' ? st : (st?.url || st?.fileUrl || null);

                                return (
                                    <div className="contract-ocr-buttons mb-2">
                                        {/* Tarjeta de Propiedad */}
                                        {tpUrl ? (
                                            <div
                                                className="btn-ocr-capture btn-ocr-capture--attached"
                                                onClick={() => handleViewAttachment(tpUrl, 'Tarjeta de Propiedad')}
                                                title="Clic para ver Tarjeta de Propiedad adjunta"
                                                role="button"
                                                tabIndex={0}
                                            >
                                                <div className="btn-ocr-left">
                                                    <span className="btn-ocr-icon btn-ocr-icon--attached">
                                                        <Check size={14} strokeWidth={2.5} />
                                                    </span>
                                                    <div className="btn-ocr-text-group">
                                                        <span className="btn-ocr-label">{tp?.placa ? `Tarjeta: ${tp.placa}` : 'Tarjeta Propiedad'}</span>
                                                        <span className="btn-ocr-subtext">✓ Adjunta · Clic para ver</span>
                                                    </div>
                                                </div>
                                                <div className="btn-ocr-action-group">
                                                    <button
                                                        type="button"
                                                        className="btn-ocr-mini-action"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenAttachSheet('tarjeta_propiedad');
                                                        }}
                                                        title="Volver a escanear o cambiar foto"
                                                    >
                                                        <RefreshCw size={12} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn-ocr-mini-action btn-ocr-mini-action--danger"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveAttachment('tarjeta_propiedad');
                                                        }}
                                                        title="Quitar documento"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                className={`btn-ocr-capture ${ocrLoadingCategory === 'tarjeta_propiedad' ? 'active-scanning' : ''}`}
                                                onClick={() => handleOpenAttachSheet('tarjeta_propiedad')}
                                                disabled={Boolean(ocrLoadingCategory)}
                                                title="Tomar foto o subir Tarjeta de Propiedad"
                                            >
                                                <span className="btn-ocr-icon btn-ocr-icon--teal"><Camera size={16} /></span>
                                                <span className="btn-ocr-label">Tarjeta Propiedad</span>
                                            </button>
                                        )}

                                        {/* Cédula / PPT */}
                                        {cdUrl ? (
                                            <div
                                                className="btn-ocr-capture btn-ocr-capture--attached"
                                                onClick={() => handleViewAttachment(cdUrl, 'Cédula / PPT')}
                                                title="Clic para ver Cédula / PPT adjunta"
                                                role="button"
                                                tabIndex={0}
                                            >
                                                <div className="btn-ocr-left">
                                                    <span className="btn-ocr-icon btn-ocr-icon--attached">
                                                        <Check size={14} strokeWidth={2.5} />
                                                    </span>
                                                    <div className="btn-ocr-text-group">
                                                        <span className="btn-ocr-label">{cd?.documentNumber ? `Cédula: ${cd.documentNumber}` : 'Cédula / PPT'}</span>
                                                        <span className="btn-ocr-subtext">✓ Adjunta · Clic para ver</span>
                                                    </div>
                                                </div>
                                                <div className="btn-ocr-action-group">
                                                    <button
                                                        type="button"
                                                        className="btn-ocr-mini-action"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenAttachSheet('cedula');
                                                        }}
                                                        title="Volver a escanear o cambiar foto"
                                                    >
                                                        <RefreshCw size={12} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn-ocr-mini-action btn-ocr-mini-action--danger"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveAttachment('cedula');
                                                        }}
                                                        title="Quitar documento"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                className={`btn-ocr-capture ${ocrLoadingCategory === 'cedula' ? 'active-scanning' : ''}`}
                                                onClick={() => handleOpenAttachSheet('cedula')}
                                                disabled={Boolean(ocrLoadingCategory)}
                                                title="Tomar foto o subir Cédula / PPT"
                                            >
                                                <span className="btn-ocr-icon btn-ocr-icon--indigo"><Camera size={16} /></span>
                                                <span className="btn-ocr-label">Cédula / PPT</span>
                                            </button>
                                        )}

                                        {/* SOAT */}
                                        {stUrl ? (
                                            <div
                                                className="btn-ocr-capture btn-ocr-capture--attached"
                                                onClick={() => handleViewAttachment(stUrl, 'Póliza SOAT')}
                                                title="Clic para ver SOAT adjunto"
                                                role="button"
                                                tabIndex={0}
                                            >
                                                <div className="btn-ocr-left">
                                                    <span className="btn-ocr-icon btn-ocr-icon--attached">
                                                        <Check size={14} strokeWidth={2.5} />
                                                    </span>
                                                    <div className="btn-ocr-text-group">
                                                        <span className="btn-ocr-label">{st?.numeroPoliza ? `SOAT: ${st.numeroPoliza}` : 'Póliza SOAT'}</span>
                                                        <span className="btn-ocr-subtext">✓ Adjunta · Clic para ver</span>
                                                    </div>
                                                </div>
                                                <div className="btn-ocr-action-group">
                                                    <button
                                                        type="button"
                                                        className="btn-ocr-mini-action"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenAttachSheet('soat');
                                                        }}
                                                        title="Volver a subir SOAT"
                                                    >
                                                        <RefreshCw size={12} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn-ocr-mini-action btn-ocr-mini-action--danger"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveAttachment('soat');
                                                        }}
                                                        title="Quitar documento"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                className={`btn-ocr-capture mb-2 ${ocrLoadingCategory === 'soat' ? 'active-scanning' : ''}`}
                                                onClick={() => handleOpenAttachSheet('soat')}
                                                disabled={Boolean(ocrLoadingCategory)}
                                                title="Subir SOAT (PDF o foto)"
                                            >
                                                <span className="btn-ocr-icon btn-ocr-icon--amber"><FileUp size={16} /></span>
                                                <span className="btn-ocr-label">SOAT (PDF / Foto)</span>
                                            </button>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Laser Scanning Animation Card during IA processing */}
                            {ocrLoadingCategory && (
                                <div className="ocr-scanning-card">
                                    <div className="ocr-scanning-header">
                                        <div className="ocr-scanning-title">
                                            <Sparkles size={16} className="ocr-sparkle-spin" />
                                            <span>
                                                {ocrLoadingCategory === 'tarjeta_propiedad'
                                                    ? 'Escaneando Tarjeta de Propiedad con IA...'
                                                    : ocrLoadingCategory === 'cedula'
                                                        ? 'Escaneando Cédula / PPT con IA...'
                                                        : 'Escaneando SOAT con IA...'}
                                            </span>
                                        </div>
                                        <div className="ocr-scanning-badge">
                                            <Loader2 size={13} className="animate-spin" />
                                            <span>Procesando</span>
                                        </div>
                                    </div>

                                    <div className="ocr-scanning-body">
                                        <div className="ocr-scan-photo-wrapper">
                                            {scanningImagePreview ? (
                                                <img
                                                    src={scanningImagePreview}
                                                    alt="Escaneando documento"
                                                    className="ocr-scan-photo-blurry"
                                                />
                                            ) : (
                                                <div className="ocr-scan-photo-placeholder" />
                                            )}
                                            <div className="ocr-scan-laser-line" />
                                            <div className="ocr-scan-grid-overlay" />
                                        </div>

                                        <div className="ocr-scanning-skeleton-grid">
                                            <div className="ocr-scanning-skeleton-item">
                                                <span className="ocr-skeleton-label">
                                                    {ocrLoadingCategory === 'cedula' ? 'DETECTANDO TIPO Y NÚMERO DOC...' : ocrLoadingCategory === 'tarjeta_propiedad' ? 'DETECTANDO PLACA Y MOTO...' : 'DETECTANDO VENCIMIENTO...'}
                                                </span>
                                                <div className="ocr-skeleton-bar ocr-skeleton-short" />
                                            </div>
                                            <div className="ocr-scanning-skeleton-item">
                                                <span className="ocr-skeleton-label">
                                                    {ocrLoadingCategory === 'cedula' ? 'EXTRAYENDO NOMBRE COMPLETO...' : ocrLoadingCategory === 'tarjeta_propiedad' ? 'EXTRAYENDO DATOS DEL VEHÍCULO...' : 'EXTRAYENDO PÓLIZA...'}
                                                </span>
                                                <div className="ocr-skeleton-bar ocr-skeleton-medium" />
                                            </div>
                                            <div className="ocr-scanning-skeleton-item">
                                                <span className="ocr-skeleton-label">ANALIZANDO CON OPENAI VISION...</span>
                                                <div className="ocr-skeleton-bar ocr-skeleton-long" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* AI OCR Magic Result Card */}
                            {(!ocrLoadingCategory) && (() => {
                                const tp = formData.attachments?.tarjetaPropiedad || formData.attachments?.tarjeta_propiedad;
                                const cd = formData.attachments?.cedula;
                                const st = formData.attachments?.soat;
                                const activeCard = !dismissedOcrCard ? (ocrResultCard || (tp?.placa ? {
                                    category: 'tarjeta_propiedad',
                                    title: '✨ Tarjeta de Propiedad Extraída',
                                    fileUrl: tp.url,
                                    items: [
                                        { label: 'Placa', val: `${tp.placa}${formData.deviceId ? ` ➔ Asignada` : ''}` },
                                        { label: 'Propietario', val: tp.propietario || formData.customerName || 'N/A' },
                                        { label: 'Cédula', val: tp.documentoPropietario || formData.customerDocumentNumber || 'N/A' },
                                        { label: 'Marca / Línea', val: `${tp.marca || ''} ${tp.linea || ''}`.trim() || 'N/A' },
                                        { label: 'Modelo', val: tp.modelo || 'N/A' },
                                        { label: 'Color', val: tp.color || 'N/A' },
                                        { label: 'Motor', val: tp.numeroMotor || 'N/A' },
                                        { label: 'Chasis (VIN)', val: tp.numeroChasis || 'N/A' }
                                    ]
                                } : (cd?.documentNumber ? {
                                    category: 'cedula',
                                    title: '✨ Cédula / PPT Extraída',
                                    fileUrl: cd.url,
                                    items: [
                                        { label: 'Tipo Doc', val: formData.customerDocumentType || cd.documentType || 'CC' },
                                        { label: 'Número', val: formData.customerDocumentNumber || cd.documentNumber || 'N/A' },
                                        { label: 'Nombre Completo', val: formData.customerName || cd.fullName || 'N/A' }
                                    ]
                                } : (st?.fechaVencimiento ? {
                                    category: 'soat',
                                    title: '✨ SOAT Extraído',
                                    fileUrl: st.url,
                                    items: [
                                        { label: 'Vencimiento', val: st.fechaVencimiento || 'N/A' },
                                        { label: 'Aseguradora', val: st.aseguradora || 'N/A' },
                                        { label: 'Placa SOAT', val: st.placa || 'N/A' },
                                        { label: 'Póliza', val: st.numeroPoliza || 'N/A' }
                                    ]
                                } : null)))) : null;

                                if (!activeCard) return null;

                                return (
                                    <div className="ocr-magic-card">
                                        <button
                                            type="button"
                                            className="ocr-magic-corner-close"
                                            onClick={() => {
                                                setOcrResultCard(null);
                                                setDismissedOcrCard(true);
                                            }}
                                            title="Cerrar ventana de datos extraídos"
                                            aria-label="Cerrar ventana"
                                        >
                                            <X size={16} />
                                        </button>

                                        <div className="ocr-magic-card-header">
                                            <div className="ocr-magic-title">
                                                <Sparkles size={16} /> {activeCard.title}
                                            </div>
                                        </div>

                                        <div className="ocr-magic-grid">
                                            {activeCard.items.map((it, idx) => (
                                                <div key={idx} className="ocr-magic-item">
                                                    <span className="ocr-magic-item-label">{it.label}</span>
                                                    <span className="ocr-magic-item-val">{it.val}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="contract-accordion">
                                {/* SECCIÓN 3: PRESTAMO */}
                                <div className="wa-profile-accordion-body mb-2">
                                    <div className="wa-profile-card">
                                        <button
                                            type="button"
                                            className="contract-accordion-header"
                                            onClick={() => toggleSection('financial')}
                                        >
                                            <div className="contract-accordion-title-wrap">
                                                <div className="contract-accordion-icon">
                                                    <DollarSign size={16} />
                                                </div>
                                                <div className="contract-accordion-titles">
                                                    <span className="contract-accordion-title">PRESTAMO</span>
                                                    <span className="contract-accordion-subtitle">
                                                        {formatCompactCOP(formData.dailyRate || 0)} / día • {formData.contractDays || 0} días • {formData.paymentFrequency === 1 ? 'Cobro diario' : formData.paymentFrequency === 7 ? 'Cobro semanal' : 'Cobro quincenal'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="contract-accordion-actions">
                                                <span className="contract-accordion-badge" style={{ background: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }}>
                                                    Total: {formatCompactCOP((formData.dailyRate || 0) * (formData.contractDays || 0))}
                                                </span>
                                                <ChevronDown size={18} className={`contract-accordion-chevron transition-transform duration-200 ${openSections.financial ? 'rotate-180' : ''}`} />
                                            </div>
                                        </button>
                                        {openSections.financial && (
                                            <>
                                                {/* Row 1: Frecuencia de pago */}
                                                <div className="wa-profile-row">
                                                    <span className="wa-profile-label">Frecuencia de pago</span>
                                                    <div className="wa-profile-value-wrap">
                                                        <select
                                                            id="paymentFrequency"
                                                            className="wa-profile-select"
                                                            value={formData.paymentFrequency}
                                                            onChange={(e) => setFormData({ ...formData, paymentFrequency: parseInt(e.target.value) })}
                                                        >
                                                            <option value={1}>{t('contracts.modal.freqDaily') || 'Diario (1 día)'}</option>
                                                            <option value={7}>{t('contracts.modal.freqWeekly') || 'Semanal (7 días)'}</option>
                                                            <option value={15}>{t('contracts.modal.freqBiweekly') || 'Quincenal (15 días)'}</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Row 2: Valor por día */}
                                                <div className="wa-profile-row">
                                                    <span className="wa-profile-label">Valor por día</span>
                                                    <div className="wa-profile-value-wrap">
                                                        <input
                                                            type="text"
                                                            className="wa-profile-input font-mono"
                                                            value={new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(formData.dailyRate)}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
                                                                setFormData({ ...formData, dailyRate: val });
                                                            }}
                                                            placeholder="$ 30.000"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Row 3: Días de contrato */}
                                                <div className="wa-profile-row">
                                                    <span className="wa-profile-label">Días de contrato</span>
                                                    <div className="wa-profile-value-wrap">
                                                        <input
                                                            type="number"
                                                            className="wa-profile-input font-mono"
                                                            value={formData.contractDays}
                                                            onChange={(e) => setFormData({ ...formData, contractDays: parseInt(e.target.value) })}
                                                            min="1"
                                                            max="1000"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Row 4: Cuota inicial */}
                                                <div className="wa-profile-row">
                                                    <span className="wa-profile-label">Cuota inicial</span>
                                                    <div className="wa-profile-value-wrap">
                                                        <input
                                                            type="text"
                                                            className="wa-profile-input font-mono"
                                                            value={formData.initialFee ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(formData.initialFee) : ''}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
                                                                setFormData({ ...formData, initialFee: val });
                                                            }}
                                                            placeholder="$ 0"
                                                            disabled={editingContract}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Sub-tarjeta: Desglose Financiero (Fórmula Moto) */}
                                                {contractFinancials?.isValid && contractFinancials.data && (
                                                    <div className="wa-financial-summary-box">
                                                        <div className="wa-financial-header">
                                                            <span className="wa-financial-badge">
                                                                <Sparkles size={13} /> Desglose Financiero
                                                            </span>
                                                            <span className="wa-financial-ea-tag">
                                                                E.A. {contractFinancials.data.eaCalculada ? `${(contractFinancials.data.eaCalculada * 100).toFixed(1)}%` : '29.0%'}
                                                                {contractFinancials.data.cumpleObjetivo ? ' ✓' : ''}
                                                            </span>
                                                        </div>

                                                        <div className="wa-financial-rows">
                                                            <div className="wa-fin-item">
                                                                <span className="wa-fin-label">Precio Moto (antes IVA):</span>
                                                                <span className="wa-fin-val font-mono">
                                                                    {formatCurrencyCOP(contractFinancials.data.precioAntesIVA)}
                                                                </span>
                                                            </div>
                                                            <div className="wa-fin-item">
                                                                <span className="wa-fin-label">+ IVA (19%):</span>
                                                                <span className="wa-fin-val font-mono">
                                                                    {formatCurrencyCOP(contractFinancials.data.valorIVA)}
                                                                </span>
                                                            </div>
                                                            <div className="wa-fin-item">
                                                                <span className="wa-fin-label">+ Gastos Fijos (Settings):</span>
                                                                <span className="wa-fin-val font-mono">
                                                                    {formatCurrencyCOP(contractFinancials.data.gastos)}
                                                                </span>
                                                            </div>
                                                            <div className="wa-fin-divider" />
                                                            <div className="wa-fin-item wa-fin-highlight">
                                                                <span className="wa-fin-label">Total Operación:</span>
                                                                <span className="wa-fin-val font-mono">
                                                                    {formatCurrencyCOP(contractFinancials.data.totalOperacion)}
                                                                </span>
                                                            </div>
                                                            <div className="wa-fin-item">
                                                                <span className="wa-fin-label">Saldo Financiable:</span>
                                                                <span className="wa-fin-val font-mono">
                                                                    {formatCurrencyCOP(contractFinancials.data.saldoFinanciable)}
                                                                </span>
                                                            </div>
                                                            <div className="wa-fin-divider" />
                                                            <div className="wa-fin-cuotas-grid">
                                                                <div className="wa-fin-cuota-pill">
                                                                    <span className="wa-fin-cuota-name">Cuota Fin. (50%)</span>
                                                                    <span className="wa-fin-cuota-amount font-mono">
                                                                        {formatCurrencyCOP(contractFinancials.data.cuotaFinanciera)}/día
                                                                    </span>
                                                                </div>
                                                                <div className="wa-fin-cuota-pill">
                                                                    <span className="wa-fin-cuota-name">Cuota Cloud (50%)</span>
                                                                    <span className="wa-fin-cuota-amount font-mono">
                                                                        {formatCurrencyCOP(contractFinancials.data.cuotaCloud)}/día
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                                {/* SECCIÓN 1: Dispositivo y Acceso */}
                                <div className="wa-profile-accordion-body mb-2">
                                    <div className="wa-profile-card">
                                        <button
                                            type="button"
                                            className="contract-accordion-header"
                                            onClick={() => toggleSection('device')}
                                        >
                                            <div className="contract-accordion-title-wrap">
                                                <div className="contract-accordion-icon">
                                                    <Bike size={16} />
                                                </div>
                                                <div className="contract-accordion-titles">
                                                    <span className="contract-accordion-title">DISPOSITIVO Y ACCESO</span>
                                                    <span className="contract-accordion-subtitle">
                                                        {(() => {
                                                            const dev = availableDevices.find(d => String(d.deviceId) === String(formData.deviceId));
                                                            const devName = dev?.name || dev?.deviceName || formData.deviceId;
                                                            return devName
                                                                ? `Moto: ${devName} • PIN: ${formData.devicePin || '----'}`
                                                                : 'Seleccionar vehículo, fecha y PIN de acceso';
                                                        })()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="contract-accordion-actions">
                                                {formData.deviceId && <span className="contract-accordion-badge">✓ Asignada</span>}
                                                <ChevronDown size={18} className={`contract-accordion-chevron transition-transform duration-200 ${openSections.device ? 'rotate-180' : ''}`} />
                                            </div>
                                        </button>

                                        {openSections.device && (
                                            <>
                                                {/* Row 1: Vehicle / Device */}
                                                <div
                                                    className={`wa-profile-row ${!editingContract ? 'wa-profile-row--clickable' : ''}`}
                                                    onClick={() => !editingContract && setIsDevicePickerOpen(true)}
                                                >
                                                    <span className="wa-profile-label">ID Dispositivo *</span>
                                                    <div className="wa-profile-value-wrap">
                                                        {editingContract ? (
                                                            <span className="wa-profile-text-disabled font-mono font-bold">{formData.deviceId}</span>
                                                        ) : (
                                                            <span className={formData.deviceId ? "wa-profile-text-selected font-mono font-bold" : "wa-profile-text-placeholder"}>
                                                                {(() => {
                                                                    const dev = availableDevices.find(d => String(d.deviceId) === String(formData.deviceId));
                                                                    return dev?.name || dev?.deviceName || (formData.deviceId ? `ID: ${formData.deviceId}` : 'Placa');
                                                                })()}
                                                            </span>
                                                        )}
                                                        <ChevronRight size={16} className="wa-profile-chevron" />
                                                    </div>
                                                </div>

                                                {/* Row 2: Start Date */}
                                                <div className="wa-profile-row">
                                                    <span className="wa-profile-label">Fecha Inicio *</span>
                                                    <div className="wa-profile-value-wrap">
                                                        <input
                                                            type="date"
                                                            className="wa-profile-date-input font-mono"
                                                            value={formData.startDate}
                                                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                                            required
                                                            disabled={editingContract}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Row 3: Device PIN */}
                                                <div className="wa-profile-row">
                                                    <div className="wa-profile-row-header">
                                                        <span className="wa-profile-label">PIN del Dispositivo</span>
                                                    </div>
                                                    <div className="wa-profile-value-wrap">
                                                        <input
                                                            type="text"
                                                            value={formData.devicePin}
                                                            onChange={(e) => setFormData({ ...formData, devicePin: e.target.value })}
                                                            placeholder="----"
                                                            maxLength="4"
                                                            className="wa-profile-pin-input font-mono"
                                                            required={!editingContract}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Row 4: Technical Specs & SOAT Sub-page Trigger */}
                                                <div
                                                    className="wa-profile-row wa-profile-row--clickable"
                                                    onClick={() => setIsVehicleDetailsOpen(true)}
                                                >
                                                    <span className="wa-profile-label flex items-center gap-1.5">
                                                        <Bike size={14} className="text-emerald-600" />
                                                        Datos de Tarjeta & SOAT
                                                    </span>
                                                    <div className="wa-profile-value-wrap">
                                                        <span className="wa-profile-text-placeholder truncate">
                                                            {formData.vehicleInfo?.placa
                                                                ? `${formData.vehicleInfo.placa}${formData.vehicleInfo?.marca ? ' • ' + formData.vehicleInfo.marca : ''}${formData.vehicleInfo?.numeroMotor ? ' • Mot: ' + formData.vehicleInfo.numeroMotor : ''}`
                                                                : (formData.vehicleInfo?.numeroMotor || formData.vehicleInfo?.numeroChasis)
                                                                    ? `Motor: ${formData.vehicleInfo?.numeroMotor || formData.vehicleInfo?.numeroChasis}`
                                                                    : 'Ver / Editar ›'}
                                                        </span>
                                                        <ChevronRight size={16} className="wa-profile-chevron" />
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* SECCIÓN 2: DATOS DEL CLIENTE */}
                                <div className="wa-profile-accordion-body mb-2">
                                    <div className="wa-profile-card">
                                        <button
                                            type="button"
                                            className="contract-accordion-header"
                                            onClick={() => toggleSection('customer')}
                                        >
                                            <div className="contract-accordion-title-wrap">
                                                <div className="contract-accordion-icon">
                                                    <User size={16} />
                                                </div>
                                                <div className="contract-accordion-titles">
                                                    <span className="contract-accordion-title">DATOS DEL CLIENTE</span>
                                                    <span className="contract-accordion-subtitle">
                                                        {formData.customerName
                                                            ? `${formData.customerName} • ${formData.customerDocument || 'Doc pendiente'}`
                                                            : 'Identificación, nombre y datos de contacto'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="contract-accordion-actions">
                                                {formData.customerName && formData.customerDocumentNumber && (
                                                    <span className="contract-accordion-badge">✓ Registrado</span>
                                                )}
                                                <ChevronDown size={18} className={`contract-accordion-chevron transition-transform duration-200 ${openSections.customer ? 'rotate-180' : ''}`} />
                                            </div>
                                        </button>

                                        {openSections.customer && (
                                            <>
                                                {/* Row 1: Documento del Cliente */}
                                                <div className="wa-profile-row">
                                                    <select
                                                        className="wa-profile-select-type-left"
                                                        value={formData.customerDocumentType || 'CC'}
                                                        onChange={(e) => {
                                                            const newType = e.target.value;
                                                            setFormData((prev) => {
                                                                const num = prev.customerDocumentNumber ? String(prev.customerDocumentNumber).trim() : '';
                                                                return {
                                                                    ...prev,
                                                                    customerDocumentType: newType,
                                                                    customerDocument: num ? `${newType} ${num}` : ''
                                                                };
                                                            });
                                                        }}
                                                    >
                                                        <option value="CC">CC</option>
                                                        <option value="PPT">PPT</option>
                                                        <option value="CE">CE</option>
                                                        <option value="TI">TI</option>
                                                        <option value="PASAPORTE">PAS</option>
                                                        <option value="NIT">NIT</option>
                                                    </select>
                                                    <div className="wa-profile-value-wrap">
                                                        <input
                                                            type="text"
                                                            className="wa-profile-input font-mono"
                                                            value={formData.customerDocumentNumber || ''}
                                                            onChange={(e) => {
                                                                const newNum = e.target.value;
                                                                setFormData((prev) => {
                                                                    const type = prev.customerDocumentType || 'CC';
                                                                    return {
                                                                        ...prev,
                                                                        customerDocumentNumber: newNum,
                                                                        customerDocument: newNum.trim() ? `${type} ${newNum.trim()}` : ''
                                                                    };
                                                                });
                                                            }}
                                                            placeholder={
                                                                formData.customerDocumentType === 'PPT'
                                                                    ? '5.406.528'
                                                                    : '1.044.927.176'
                                                            }
                                                        />
                                                    </div>
                                                </div>

                                                {/* Row 2: Nombre Completo */}
                                                <div className="wa-profile-row">
                                                    <span className="wa-profile-label">Cliente</span>
                                                    <div className="wa-profile-value-wrap">
                                                        <input
                                                            type="text"
                                                            className="wa-profile-input"
                                                            value={formData.customerName}
                                                            onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                                            placeholder="Nombre del cliente"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Row 3: Teléfono */}
                                                <div className="wa-profile-row">
                                                    <span className="wa-profile-label">Teléfono</span>
                                                    <div className="wa-profile-value-wrap">
                                                        <input
                                                            type="tel"
                                                            inputMode="numeric"
                                                            className="wa-profile-input font-mono"
                                                            placeholder="300 756 0069"
                                                            value={formData.customerPhone}
                                                            onChange={(e) =>
                                                                setFormData((prev) => ({
                                                                    ...prev,
                                                                    customerPhone: formatPhoneNumber(e.target.value)
                                                                }))
                                                            }
                                                        />
                                                    </div>
                                                </div>

                                                {/* Row 4: Correo Electrónico */}
                                                <div className="wa-profile-row">
                                                    <span className="wa-profile-label">Correo</span>
                                                    <div className="wa-profile-value-wrap">
                                                        <input
                                                            type="email"
                                                            className="wa-profile-input"
                                                            value={formData.customerEmail}
                                                            onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                                                            placeholder="cliente@email.com"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Row 5: Dirección de Residencia */}
                                                <div className="wa-profile-row">
                                                    <span className="wa-profile-label">Dirección</span>
                                                    <div className="wa-profile-value-wrap">
                                                        <input
                                                            type="text"
                                                            className="wa-profile-input"
                                                            value={formData.customerAddress || ''}
                                                            onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                                                            placeholder="Dirección del cliente"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Codeudor Solidario */}
                                                <div className="p-3 bg-slate-50 border-t border-slate-200 mt-1 space-y-2">
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                                                        Codeudor Solidario / Garante (Opcional)
                                                    </span>
                                                    <div className="wa-profile-row">
                                                        <span className="wa-profile-label">Nombre</span>
                                                        <div className="wa-profile-value-wrap">
                                                            <input
                                                                type="text"
                                                                className="wa-profile-input"
                                                                value={formData.guarantor?.name || ''}
                                                                onChange={(e) => setFormData({
                                                                    ...formData,
                                                                    guarantor: { ...(formData.guarantor || {}), name: e.target.value }
                                                                })}
                                                                placeholder="Nombre del codeudor"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="wa-profile-row">
                                                        <span className="wa-profile-label">Documento</span>
                                                        <div className="wa-profile-value-wrap">
                                                            <input
                                                                type="text"
                                                                className="wa-profile-input font-mono"
                                                                value={formData.guarantor?.document || ''}
                                                                onChange={(e) => setFormData({
                                                                    ...formData,
                                                                    guarantor: { ...(formData.guarantor || {}), document: e.target.value }
                                                                })}
                                                                placeholder="C.C. 1.045.000.000"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="wa-profile-row">
                                                        <span className="wa-profile-label">Teléfono</span>
                                                        <div className="wa-profile-value-wrap">
                                                            <input
                                                                type="tel"
                                                                className="wa-profile-input font-mono"
                                                                value={formData.guarantor?.phone || ''}
                                                                onChange={(e) => setFormData({
                                                                    ...formData,
                                                                    guarantor: { ...(formData.guarantor || {}), phone: formatPhoneNumber(e.target.value) }
                                                                })}
                                                                placeholder="310 000 0000"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>



                                {/* SECCIÓN 4: CONFIGURACIÓN AVANZADA & NOTAS */}
                                <div className="wa-profile-accordion-body mb-2">
                                    <div className="wa-profile-card">
                                        <button
                                            type="button"
                                            className="contract-accordion-header"
                                            onClick={() => toggleSection('advanced')}
                                        >
                                            <div className="contract-accordion-title-wrap">
                                                <div className="contract-accordion-icon">
                                                    <Sliders size={16} />
                                                </div>
                                                <div className="contract-accordion-titles">
                                                    <span className="contract-accordion-title">CONFIGURACIÓN AVANZADA & NOTAS</span>
                                                    <span className="contract-accordion-subtitle">
                                                        {formData.freeDayPolicy === 'FIXED_WEEKDAY' ? 'Día fijo semanal' : `${formData.freeDaysLimit} días libres/mes`} • Corte: {formData.cutOffTime || '23:59'}{formData.exemptFromCutOff ? ' • Exento corte' : ''}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="contract-accordion-actions">
                                                <ChevronDown size={18} className={`contract-accordion-chevron transition-transform duration-200 ${openSections.advanced ? 'rotate-180' : ''}`} />
                                            </div>
                                        </button>
                                        {openSections.advanced && (
                                            <>
                                                {/* Row 1: Política de día libre */}
                                                <div className="wa-profile-row">
                                                    <span className="wa-profile-label">Política día libre</span>
                                                    <div className="wa-profile-value-wrap">
                                                        <select
                                                            className="wa-profile-select"
                                                            value={formData.freeDayPolicy}
                                                            onChange={(e) => setFormData({ ...formData, freeDayPolicy: e.target.value })}
                                                        >
                                                            <option value="FLEXIBLE">{t('settings.general.policyFlexible') || 'Flexible (días por mes)'}</option>
                                                            <option value="FIXED_WEEKDAY">{t('settings.general.policyFixed') || 'Día fijo semanal'}</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Row 2: Días libres al mes / Día libre fijo */}
                                                {formData.freeDayPolicy !== 'FIXED_WEEKDAY' ? (
                                                    <div className="wa-profile-row">
                                                        <span className="wa-profile-label">Días libres/mes</span>
                                                        <div className="wa-profile-value-wrap">
                                                            <input
                                                                type="number"
                                                                className="wa-profile-input font-mono"
                                                                value={formData.freeDaysLimit}
                                                                onChange={(e) => setFormData({ ...formData, freeDaysLimit: parseInt(e.target.value) })}
                                                                min="0"
                                                                max="31"
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="wa-profile-row">
                                                        <span className="wa-profile-label">Día libre fijo</span>
                                                        <div className="wa-profile-value-wrap">
                                                            <select
                                                                className="wa-profile-select"
                                                                value={formData.fixedFreeDayOfWeek}
                                                                onChange={(e) => setFormData({ ...formData, fixedFreeDayOfWeek: parseInt(e.target.value) })}
                                                            >
                                                                <option value={0}>{t('settings.general.days.sun') || 'Domingo'}</option>
                                                                <option value={1}>{t('settings.general.days.mon') || 'Lunes'}</option>
                                                                <option value={2}>{t('settings.general.days.tue') || 'Martes'}</option>
                                                                <option value={3}>{t('settings.general.days.wed') || 'Miércoles'}</option>
                                                                <option value={4}>{t('settings.general.days.thu') || 'Jueves'}</option>
                                                                <option value={5}>{t('settings.general.days.fri') || 'Viernes'}</option>
                                                                <option value={6}>{t('settings.general.days.sat') || 'Sábado'}</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Row 3: Hora de corte */}
                                                <div className="wa-profile-row">
                                                    <span className="wa-profile-label">Hora de corte</span>
                                                    <div className="wa-profile-value-wrap">
                                                        <input
                                                            type="time"
                                                            className="wa-profile-date-input font-mono"
                                                            value={formData.cutOffTime}
                                                            onChange={(e) => setFormData({ ...formData, cutOffTime: e.target.value })}
                                                            title={t('contracts.modal.cutOffTimeTooltip')}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Row 4: Exenciones */}
                                                <div className="wa-profile-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.625rem', padding: '0.875rem 1.125rem' }}>
                                                    <span className="wa-profile-label" style={{ fontSize: '0.8125rem', color: '#64748B' }}>Exenciones</span>
                                                    <div className="contract-exemption-options" style={{ width: '100%', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                                        <label htmlFor="exemptFromCutOff" className="phone-pin-checkbox contract-exemption-option" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: '500', color: '#1E293B' }}>
                                                            <input
                                                                type="checkbox"
                                                                id="exemptFromCutOff"
                                                                checked={formData.exemptFromCutOff}
                                                                onChange={(e) => setFormData({ ...formData, exemptFromCutOff: e.target.checked })}
                                                                style={{ marginRight: '0.5rem', width: 'auto', cursor: 'pointer' }}
                                                            />
                                                            {t('contracts.modal.exemptCutoff') || 'Exento de hora de corte'}
                                                        </label>
                                                        <label htmlFor="exemptFromCurfew" className="phone-pin-checkbox contract-exemption-option" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: '500', color: '#1E293B' }}>
                                                            <input
                                                                type="checkbox"
                                                                id="exemptFromCurfew"
                                                                checked={formData.exemptFromCurfew}
                                                                onChange={(e) => setFormData({ ...formData, exemptFromCurfew: e.target.checked })}
                                                                style={{ marginRight: '0.5rem', width: 'auto', cursor: 'pointer' }}
                                                            />
                                                            {t('contracts.modal.exemptCurfew') || 'Exento de toque de queda'}
                                                        </label>
                                                    </div>
                                                </div>

                                                {/* Row 5: Notas */}
                                                <div className="wa-profile-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem', padding: '0.875rem 1.125rem' }}>
                                                    <span className="wa-profile-label" style={{ fontSize: '0.8125rem', color: '#64748B' }}>Notas adicionales</span>
                                                    <textarea
                                                        className="wa-profile-notes-textarea"
                                                        value={formData.notes}
                                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                                        rows="3"
                                                        placeholder={t('contracts.modal.notesPlaceholder') || 'Observaciones o acuerdos del contrato...'}
                                                        style={{
                                                            width: '100%',
                                                            border: '1px solid #E2E8F0',
                                                            borderRadius: '0.75rem',
                                                            padding: '0.625rem 0.875rem',
                                                            fontSize: '0.8125rem',
                                                            background: '#F8FAFC',
                                                            outline: 'none',
                                                            resize: 'vertical',
                                                            color: '#0F172A'
                                                        }}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </form>
                        <div className="form-actions contract-modal-actions">
                            <button type="button" className="btn-secondary" onClick={closeContractModal}>
                                {t('contracts.modal.cancelBtn')}
                            </button>
                            <button type="submit" form="contract-form" className="btn-primary" disabled={loading}>
                                {loading ? t('contracts.modal.savingBtn') : editingContract ? t('contracts.modal.updateBtn') : t('contracts.modal.createBtn')}
                            </button>
                        </div>
                        {/* Slide-in Device Selection Sub-page (Android / WhatsApp Style) */}
                        {isDevicePickerOpen && (
                            <div className="wa-picker-page wa-picker-page--slide-left">
                                <div className="wa-picker-header">
                                    <button
                                        type="button"
                                        className="wa-picker-back-btn"
                                        onClick={() => {
                                            setIsDevicePickerOpen(false);
                                            setDeviceSearchQuery('');
                                        }}
                                        aria-label="Volver"
                                    >
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div className="wa-picker-header-title">
                                        <h3>Seleccionar Placa</h3>
                                        <small>{availableDevices.filter(d => !d.hasActiveContract || d.deviceId === formData.deviceId * 1).length} disponibles</small>
                                    </div>
                                </div>

                                <div className="wa-picker-list">
                                    {availableDevices
                                        .filter(d => !d.hasActiveContract || d.deviceId === formData.deviceId * 1)
                                        .filter(d => {
                                            if (!deviceSearchQuery.trim()) return true;
                                            const q = deviceSearchQuery.toLowerCase();
                                            const name = (d.name || d.deviceName || '').toLowerCase();
                                            const id = String(d.deviceId);
                                            return name.includes(q) || id.includes(q);
                                        })
                                        .map((device) => {
                                            const isSelected = String(formData.deviceId) === String(device.deviceId);
                                            return (
                                                <button
                                                    key={device.deviceId}
                                                    type="button"
                                                    className={`wa-picker-item ${isSelected ? 'is-selected' : ''}`}
                                                    onClick={() => {
                                                        const selectedDeviceId = String(device.deviceId);
                                                        const domain = companySettings?.contractDefaults?.emailDomain || 'pocketbike.app';
                                                        const email = device.name
                                                            ? `${device.name.toUpperCase()}@${domain.toLowerCase()}`
                                                            : '';
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            deviceId: selectedDeviceId,
                                                            customerEmail: email
                                                        }));
                                                        setIsDevicePickerOpen(false);
                                                        setDeviceSearchQuery('');
                                                    }}
                                                >
                                                    <div className="wa-picker-item-icon">
                                                        <Bike size={20} />
                                                    </div>
                                                    <div className="wa-picker-item-info">
                                                        <span className="wa-picker-item-name">{device.name || `Dispositivo ${device.deviceId}`}</span>
                                                        <span className="wa-picker-item-sub">ID Dispositivo: {device.deviceId}</span>
                                                    </div>
                                                    {isSelected && (
                                                        <div className="wa-picker-item-check">
                                                            <Check size={18} />
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        {/* Slide-in Vehicle & SOAT Technical Specs Sub-page */}
                        {isVehicleDetailsOpen && (
                            <div className="wa-picker-page wa-picker-page--slide-left">
                                <div className="wa-picker-header">
                                    <button
                                        type="button"
                                        className="wa-picker-back-btn"
                                        onClick={() => setIsVehicleDetailsOpen(false)}
                                        aria-label="Volver"
                                    >
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div className="wa-picker-header-title">
                                        <h3>Datos de Tarjeta & SOAT</h3>
                                        <small>Información técnica del vehículo, tomador y póliza</small>
                                    </div>
                                </div>

                                <div className="wa-picker-list p-4 overflow-y-auto space-y-4">
                                    {/* BLOQUE 1: DATOS DEL VEHÍCULO */}
                                    <div className="wa-profile-card">
                                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 font-bold text-xs text-slate-500 uppercase tracking-wider">
                                            Datos del Vehículo
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Placa</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input uppercase font-mono font-bold"
                                                    value={formData.vehicleInfo?.placa || ''}
                                                    onChange={(e) => setFormData(p => ({
                                                        ...p,
                                                        vehicleInfo: { ...p.vehicleInfo, placa: e.target.value.toUpperCase() }
                                                    }))}
                                                    placeholder="Ej: ABC12D"
                                                />
                                            </div>
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Marca</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input uppercase"
                                                    value={formData.vehicleInfo?.marca || ''}
                                                    onChange={(e) => setFormData(p => ({
                                                        ...p,
                                                        vehicleInfo: { ...p.vehicleInfo, marca: e.target.value.toUpperCase() }
                                                    }))}
                                                    placeholder="Ej: BAJAJ, YAMAHA"
                                                />
                                            </div>
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Línea / Referencia</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input uppercase"
                                                    value={formData.vehicleInfo?.linea || ''}
                                                    onChange={(e) => setFormData(p => ({
                                                        ...p,
                                                        vehicleInfo: { ...p.vehicleInfo, linea: e.target.value.toUpperCase() }
                                                    }))}
                                                    placeholder="Ej: CT100 KS SPOKE"
                                                />
                                            </div>
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Modelo (Año)</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input font-mono"
                                                    value={formData.vehicleInfo?.modelo || ''}
                                                    onChange={(e) => setFormData(p => ({
                                                        ...p,
                                                        vehicleInfo: { ...p.vehicleInfo, modelo: e.target.value }
                                                    }))}
                                                    placeholder="Ej: 2027"
                                                />
                                            </div>
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Color</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input uppercase"
                                                    value={formData.vehicleInfo?.color || ''}
                                                    onChange={(e) => setFormData(p => ({
                                                        ...p,
                                                        vehicleInfo: { ...p.vehicleInfo, color: e.target.value.toUpperCase() }
                                                    }))}
                                                    placeholder="Ej: NEGRO CRISTAL"
                                                />
                                            </div>
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Cilindraje (cc)</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input font-mono"
                                                    value={formData.vehicleInfo?.cilindraje || ''}
                                                    onChange={(e) => setFormData(p => ({
                                                        ...p,
                                                        vehicleInfo: { ...p.vehicleInfo, cilindraje: e.target.value }
                                                    }))}
                                                    placeholder="Ej: 102"
                                                />
                                            </div>
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label font-medium text-slate-700">No. Motor</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input uppercase font-mono font-bold text-slate-900"
                                                    value={
                                                        formData.vehicleInfo?.numeroMotor ||
                                                        formData.vehicleInfo?.['No. MOTOR'] ||
                                                        formData.attachments?.tarjetaPropiedad?.numeroMotor ||
                                                        formData.attachments?.tarjetaPropiedad?.['No. MOTOR'] ||
                                                        formData.attachments?.soat?.numeroMotor ||
                                                        formData.attachments?.soat?.['No. MOTOR'] ||
                                                        ''
                                                    }
                                                    onChange={(e) => {
                                                        const val = e.target.value.toUpperCase();
                                                        setFormData(p => ({
                                                            ...p,
                                                            vehicleInfo: {
                                                                ...p.vehicleInfo,
                                                                numeroMotor: val,
                                                                'No. MOTOR': val
                                                            }
                                                        }));
                                                    }}
                                                    placeholder="Ej: Z216FMJ250018938"
                                                />
                                            </div>
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label font-medium text-slate-700">No. Chasis ó No. Serie</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input uppercase font-mono font-bold text-slate-900"
                                                    value={
                                                        formData.vehicleInfo?.numeroChasis ||
                                                        formData.vehicleInfo?.['No. CHASIS ó No. SERIE'] ||
                                                        formData.vehicleInfo?.['No. CHASIS'] ||
                                                        formData.attachments?.tarjetaPropiedad?.numeroChasis ||
                                                        formData.attachments?.tarjetaPropiedad?.['No. CHASIS ó No. SERIE'] ||
                                                        formData.attachments?.soat?.numeroChasis ||
                                                        formData.attachments?.soat?.['No. CHASIS ó No. SERIE'] ||
                                                        ''
                                                    }
                                                    onChange={(e) => {
                                                        const val = e.target.value.toUpperCase();
                                                        setFormData(p => ({
                                                            ...p,
                                                            vehicleInfo: {
                                                                ...p.vehicleInfo,
                                                                numeroChasis: val,
                                                                'No. CHASIS ó No. SERIE': val
                                                            }
                                                        }));
                                                    }}
                                                    placeholder="Ej: LB7GK5AXSF009188"
                                                />
                                            </div>
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Clase Vehículo</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input uppercase"
                                                    value={formData.vehicleInfo?.claseVehiculo || ''}
                                                    onChange={(e) => setFormData(p => ({
                                                        ...p,
                                                        vehicleInfo: { ...p.vehicleInfo, claseVehiculo: e.target.value.toUpperCase() }
                                                    }))}
                                                    placeholder="Ej: MOTOCICLETA"
                                                />
                                            </div>
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Servicio</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input uppercase"
                                                    value={formData.vehicleInfo?.servicio || ''}
                                                    onChange={(e) => setFormData(p => ({
                                                        ...p,
                                                        vehicleInfo: { ...p.vehicleInfo, servicio: e.target.value.toUpperCase() }
                                                    }))}
                                                    placeholder="Ej: PARTICULAR, PÚBLICO"
                                                />
                                            </div>
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Pasajeros</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input font-mono"
                                                    value={formData.vehicleInfo?.pasajeros || ''}
                                                    onChange={(e) => setFormData(p => ({
                                                        ...p,
                                                        vehicleInfo: { ...p.vehicleInfo, pasajeros: e.target.value }
                                                    }))}
                                                    placeholder="Ej: 2"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* BLOQUE 2: TOMADOR / PROPIETARIO */}
                                    <div className="wa-profile-card">
                                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 font-bold text-xs text-slate-500 uppercase tracking-wider">
                                            Tomador / Propietario
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Nombre Tomador</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input uppercase"
                                                    value={formData.vehicleInfo?.propietario || ''}
                                                    onChange={(e) => setFormData(p => ({
                                                        ...p,
                                                        vehicleInfo: { ...p.vehicleInfo, propietario: e.target.value.toUpperCase() }
                                                    }))}
                                                    placeholder="Nombre / Razón Social"
                                                />
                                            </div>
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Tipo Documento</span>
                                            <div className="wa-profile-value-wrap">
                                                <select
                                                    className="wa-profile-select"
                                                    value={formData.vehicleInfo?.tipoDocumentoPropietario || 'CC'}
                                                    onChange={(e) => setFormData(p => ({
                                                        ...p,
                                                        vehicleInfo: { ...p.vehicleInfo, tipoDocumentoPropietario: e.target.value }
                                                    }))}
                                                >
                                                    <option value="CC">CC</option>
                                                    <option value="NIT">NIT</option>
                                                    <option value="PPT">PPT</option>
                                                    <option value="CE">CE</option>
                                                    <option value="PASAPORTE">PAS</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">No. Documento</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input font-mono"
                                                    value={formData.vehicleInfo?.documentoPropietario || ''}
                                                    onChange={(e) => setFormData(p => ({
                                                        ...p,
                                                        vehicleInfo: { ...p.vehicleInfo, documentoPropietario: e.target.value }
                                                    }))}
                                                    placeholder="Ej: 9020132510"
                                                />
                                            </div>
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Teléfono Tomador</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="tel"
                                                    className="wa-profile-input font-mono"
                                                    value={formData.vehicleInfo?.telefonoPropietario || ''}
                                                    onChange={(e) => setFormData(p => ({
                                                        ...p,
                                                        vehicleInfo: { ...p.vehicleInfo, telefonoPropietario: formatPhoneNumber(e.target.value) }
                                                    }))}
                                                    placeholder="300 000 0000"
                                                />
                                            </div>
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Ciudad</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input uppercase"
                                                    value={formData.vehicleInfo?.ciudadPropietario || ''}
                                                    onChange={(e) => setFormData(p => ({
                                                        ...p,
                                                        vehicleInfo: { ...p.vehicleInfo, ciudadPropietario: e.target.value.toUpperCase() }
                                                    }))}
                                                    placeholder="Ej: CARTAGENA"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* BLOQUE 3: PÓLIZA SOAT & ALERTA DE VENCIMIENTO */}
                                    <div className="wa-profile-card mb-6">
                                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 font-bold text-xs text-slate-500 uppercase tracking-wider flex items-center justify-between">
                                            <span>Póliza SOAT</span>
                                            {(() => {
                                                const dueDateStr = formData.soatDueDate || formData.vehicleInfo?.soatVigenciaHasta;
                                                if (!dueDateStr) return null;
                                                const today = new Date();
                                                today.setHours(0, 0, 0, 0);
                                                const due = new Date(dueDateStr);
                                                due.setHours(0, 0, 0, 0);
                                                if (isNaN(due.getTime())) return null;
                                                const diffMs = due.getTime() - today.getTime();
                                                const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                                                if (diffDays < 0) {
                                                    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">🔴 VENCIDO</span>;
                                                }
                                                if (diffDays <= 30) {
                                                    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">🟡 VENCE EN {diffDays} DÍAS</span>;
                                                }
                                                return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">🟢 VIGENTE</span>;
                                            })()}
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Aseguradora</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input uppercase"
                                                    value={formData.vehicleInfo?.soatAseguradora || ''}
                                                    onChange={(e) => setFormData(p => ({
                                                        ...p,
                                                        vehicleInfo: { ...p.vehicleInfo, soatAseguradora: e.target.value.toUpperCase() }
                                                    }))}
                                                    placeholder="Ej: AXA COLPATRIA"
                                                />
                                            </div>
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Cód. Aseguradora</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input font-mono"
                                                    value={formData.vehicleInfo?.soatCodigoAseguradora || ''}
                                                    onChange={(e) => setFormData(p => ({
                                                        ...p,
                                                        vehicleInfo: { ...p.vehicleInfo, soatCodigoAseguradora: e.target.value }
                                                    }))}
                                                    placeholder="Ej: 112"
                                                />
                                            </div>
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">No. Póliza SOAT</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input font-mono"
                                                    value={formData.vehicleInfo?.soatNumeroPoliza || ''}
                                                    onChange={(e) => setFormData(p => ({
                                                        ...p,
                                                        vehicleInfo: { ...p.vehicleInfo, soatNumeroPoliza: e.target.value }
                                                    }))}
                                                    placeholder="Ej: 3628727500"
                                                />
                                            </div>
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Fecha Expedición</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="date"
                                                    className="wa-profile-date-input"
                                                    value={formData.vehicleInfo?.soatFechaExpedicion || ''}
                                                    onChange={(e) => setFormData(p => ({
                                                        ...p,
                                                        vehicleInfo: { ...p.vehicleInfo, soatFechaExpedicion: e.target.value }
                                                    }))}
                                                />
                                            </div>
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Vigencia Desde</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="date"
                                                    className="wa-profile-date-input"
                                                    value={formData.vehicleInfo?.soatVigenciaDesde || ''}
                                                    onChange={(e) => setFormData(p => ({
                                                        ...p,
                                                        vehicleInfo: { ...p.vehicleInfo, soatVigenciaDesde: e.target.value }
                                                    }))}
                                                />
                                            </div>
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label font-bold text-slate-900">Vencimiento SOAT</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="date"
                                                    className="wa-profile-date-input font-mono font-bold"
                                                    value={formData.soatDueDate ? String(formData.soatDueDate).split('T')[0] : (formData.vehicleInfo?.soatVigenciaHasta || '')}
                                                    onChange={(e) => {
                                                        const newDate = e.target.value;
                                                        setFormData(p => ({
                                                            ...p,
                                                            soatDueDate: newDate,
                                                            vehicleInfo: { ...p.vehicleInfo, soatVigenciaHasta: newDate }
                                                        }));
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Total a Pagar (COP)</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input font-mono"
                                                    value={formData.vehicleInfo?.soatTotalPagar || ''}
                                                    onChange={(e) => setFormData(p => ({
                                                        ...p,
                                                        vehicleInfo: { ...p.vehicleInfo, soatTotalPagar: e.target.value }
                                                    }))}
                                                    placeholder="Ej: 343300"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {previewContract && (
                <ContractDocPreviewModal
                    contract={previewContract}
                    isOpen={Boolean(previewContract)}
                    onClose={() => setPreviewContract(null)}
                />
            )}

            {cropModalState.isOpen && (
                <ImageCropModal
                    isOpen={cropModalState.isOpen}
                    imageSrc={cropModalState.imageSrc}
                    title={
                        cropModalState.category === 'tarjeta_propiedad'
                            ? 'Recortar Tarjeta de Propiedad'
                            : cropModalState.category === 'cedula'
                                ? 'Recortar Cédula / PPT'
                                : cropModalState.category === 'soat'
                                    ? 'Revisar / Recortar SOAT'
                                    : 'Recortar Documento'
                    }
                    onClose={() => setCropModalState({ isOpen: false, imageSrc: null, category: null, filename: null })}
                    onSkip={() => {
                        const { category, filename, imageSrc } = cropModalState;
                        setCropModalState({ isOpen: false, imageSrc: null, category: null, filename: null });
                        executeDocumentExtraction(imageSrc, 'image/jpeg', category, filename);
                    }}
                    onCropComplete={(croppedBase64) => {
                        const { category, filename, imageSrc } = cropModalState;
                        setCropModalState({ isOpen: false, imageSrc: null, category: null, filename: null });
                        const finalBase64 = (croppedBase64 && croppedBase64.length > 100 && croppedBase64 !== 'data:,')
                            ? croppedBase64
                            : imageSrc;
                        executeDocumentExtraction(finalBase64, 'image/jpeg', category, filename);
                    }}
                />
            )}

            <WhatsAppAttachmentModal
                isOpen={waAttachSheet.isOpen}
                title={waAttachSheet.title}
                subtitle={waAttachSheet.subtitle}
                onSelect={handleSelectAttachmentOption}
                onClose={() => setWaAttachSheet(prev => ({ ...prev, isOpen: false }))}
                allowDocument={true}
            />

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
