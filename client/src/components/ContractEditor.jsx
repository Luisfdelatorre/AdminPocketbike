import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { 
    ArrowLeft, Bike, ChevronRight, ChevronDown, Check, X, Camera, FileUp, 
    Sparkles, Loader2, DollarSign, Calendar, Sliders, RefreshCw, User 
} from 'lucide-react';
import { showToast } from '../utils/toast';
import { formatPhoneNumber, formatCompactCOP } from '../utils/helpers';
import { safeCalcularPrecioMoto } from '../utils/contractCalculations';
import { convertPdfToImage, isPdfDocument } from '../utils/pdfToImage';
import { extractContractDocument } from '../services/api';
import ImageCropModal from './modals/ImageCropModal';
import WhatsAppAttachmentModal from './modals/WhatsAppAttachmentModal';

const ContractEditor = ({
    isOpen,
    isClosing,
    onClose,
    onSubmit,
    editingContract,
    formData,
    setFormData,
    availableDevices = [],
    companySettings = null,
    loading = false
}) => {
    const { t } = useTranslation();

    // Local UI states exclusive to the Contract Editor
    const [openSections, setOpenSections] = useState({
        device: false,
        customer: false,
        financial: true,
        advanced: false
    });
    const [isDevicePickerOpen, setIsDevicePickerOpen] = useState(false);
    const [deviceSearchQuery, setDeviceSearchQuery] = useState('');
    const [isVehicleDetailsOpen, setIsVehicleDetailsOpen] = useState(false);
    const [showVehicleDetails, setShowVehicleDetails] = useState(false);

    // Document extraction and OCR states
    const [ocrLoadingCategory, setOcrLoadingCategory] = useState(null);
    const [ocrResultCard, setOcrResultCard] = useState(null);
    const [dismissedOcrCard, setDismissedOcrCard] = useState(false);
    const [scanningImagePreview, setScanningImagePreview] = useState(null);

    // Attachment action sheet & Crop modal states
    const [cropModalState, setCropModalState] = useState({
        isOpen: false,
        imageSrc: null,
        category: null,
        filename: null
    });
    const [waAttachSheet, setWaAttachSheet] = useState({
        isOpen: false,
        category: null,
        title: '',
        subtitle: ''
    });

    // Hidden file input refs
    const tarjetaInputRef = useRef(null);
    const cedulaInputRef = useRef(null);
    const soatInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const photosInputRef = useRef(null);
    const docInputRef = useRef(null);
    const activeCategoryRef = useRef(null);

    // Financial calculations
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

    const toggleSection = (sectionKey) => {
        setOpenSections(prev => ({
            ...prev,
            [sectionKey]: !prev[sectionKey]
        }));
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

                const motorVal = data.numeroMotor || data['No. MOTOR'] || data['No MOTOR'] || data['MOTOR'] || data.motor || data._raw?.['No. MOTOR'] || data._raw?.numeroMotor || '';
                const chasisVal = data.numeroChasis || data['No. CHASIS ó No. SERIE'] || data['No. CHASIS o No. SERIE'] || data['No. CHASIS'] || data['No CHASIS'] || data['CHASIS'] || data.chasis || data.vin || data['No. VIN'] || data.serie || data._raw?.['No. CHASIS ó No. SERIE'] || data._raw?.['No. CHASIS'] || data._raw?.numeroChasis || '';
                const marcaVal = data.marca || data['MARCA'] || data._raw?.['MARCA'] || '';
                const lineaVal = data.linea || data['LÍNEA VEHÍCULO'] || data['LINEA'] || data._raw?.['LÍNEA VEHÍCULO'] || '';
                const modeloVal = data.modelo || data['MODELO'] || data._raw?.['MODELO'] || '';
                const colorVal = data.color || data['COLOR'] || data._raw?.['COLOR'] || '';
                const cilindrajeVal = data.cilindraje || data.cilindrada || data['CILINDRAJE/VATIOS'] || data['CILINDRADA'] || data._raw?.['CILINDRAJE/VATIOS'] || '';

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

                setFormData(prev => {
                    const next = { ...prev };
                    if (!next.attachments) next.attachments = {};

                    if (category === 'tarjeta_propiedad') {
                        next.attachments.tarjetaPropiedad = {
                            url: fileUrl,
                            extractedData: data,
                            uploadedAt: new Date().toISOString()
                        };
                    } else if (category === 'cedula') {
                        next.attachments.cedula = {
                            url: fileUrl,
                            extractedData: data,
                            uploadedAt: new Date().toISOString()
                        };
                    } else if (category === 'soat') {
                        next.attachments.soat = {
                            url: fileUrl,
                            extractedData: data,
                            uploadedAt: new Date().toISOString()
                        };
                    }

                    if (category === 'tarjeta_propiedad') {
                        if (matchedDeviceId && !next.deviceId) {
                            next.deviceId = matchedDeviceId;
                        }
                        if (matchedEmail && !next.customerEmail) {
                            next.customerEmail = matchedEmail;
                        }
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
                            tipoDocumentoPropietario: data.tipoDocumentoPropietario || prev.vehicleInfo?.tipoDocumentoPropietario || 'CC',
                            telefonoPropietario: data.telefonoPropietario ? formatPhoneNumber(data.telefonoPropietario) : prev.vehicleInfo?.telefonoPropietario || '',
                            ciudadPropietario: data.ciudadPropietario || prev.vehicleInfo?.ciudadPropietario || '',
                            claseVehiculo: data.claseVehiculo || prev.vehicleInfo?.claseVehiculo || 'MOTOCICLETA',
                            servicio: data.servicio || prev.vehicleInfo?.servicio || 'PARTICULAR',
                            pasajeros: data.pasajeros ? String(data.pasajeros) : prev.vehicleInfo?.pasajeros || ''
                        };

                        const vInfo = [
                            data.marca && `Marca: ${data.marca}`,
                            data.linea && `Línea: ${data.linea}`,
                            data.modelo && `Modelo: ${data.modelo}`,
                            data.color && `Color: ${data.color}`,
                            data.cilindraje && `Cilindraje: ${data.cilindraje}`,
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

        e.target.value = '';

        if (file.type && file.type.startsWith('image/')) {
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
            subtitle: 'Selecciona cómo deseas capturar el documento'
        });
    };

    const handleSelectAttachmentOption = (optionId) => {
        const cat = activeCategoryRef.current;
        if (!cat) return;

        if (optionId === 'camera') {
            cameraInputRef.current?.click();
        } else if (optionId === 'photos') {
            photosInputRef.current?.click();
        } else if (optionId === 'document') {
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
        if (!resolvedUrl) {
            showToast('info', 'Documento', 'No se encontró archivo para mostrar.');
            return;
        }
        window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
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

    if (!isOpen) return null;

    const tp = formData.attachments?.tarjetaPropiedad || formData.attachments?.tarjeta_propiedad;
    const tpUrl = typeof tp === 'string' ? tp : (tp?.url || tp?.fileUrl || null);
    const cd = formData.attachments?.cedula;
    const cdUrl = typeof cd === 'string' ? cd : (cd?.url || cd?.fileUrl || null);
    const st = formData.attachments?.soat;
    const stUrl = typeof st === 'string' ? st : (st?.url || st?.fileUrl || null);

    return createPortal(
        <div 
            className={`contract-editor-view ${isClosing ? 'contract-editor-view--closing' : 'contract-editor-view--opening'} contract-editor-immersive-overlay`}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="contract-editor-surface modal-surface--contract">
                {/* ── Native Top Navigation Header ── */}
                <header className="contract-editor-header modal-header">
                    <div className="contract-editor-header-left">
                        <button
                            type="button"
                            className="contract-editor-back-btn"
                            onClick={onClose}
                            aria-label="Volver a Contratos"
                            title="Volver a la lista de contratos"
                        >
                            <ArrowLeft size={18} />
                            <span>Volver</span>
                        </button>
                        <div className="contract-editor-header-title">
                            <span className="contract-status-dot" />
                            <h2>{editingContract ? t('contracts.modal.editTitle') : t('contracts.modal.addTitle')}</h2>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <button
                            type="button"
                            className={`contract-header-device-selector ${formData.deviceId ? 'has-device' : 'no-device'} ${editingContract ? 'is-disabled' : ''}`}
                            onClick={() => !editingContract && setIsDevicePickerOpen(true)}
                            disabled={Boolean(editingContract)}
                            title={editingContract ? `Dispositivo asignado: ${formData.deviceId}` : (formData.deviceId ? 'Clic para cambiar placa / moto' : 'Seleccionar moto para este contrato')}
                            aria-label="Seleccionar dispositivo"
                        >
                            <span className="contract-header-device-icon">
                                <Bike size={16} />
                            </span>
                            <span className="contract-header-device-label font-mono font-bold">
                                {(() => {
                                    if (!formData.deviceId) return 'Seleccionar Moto';
                                    const dev = availableDevices.find(d => String(d.deviceId) === String(formData.deviceId));
                                    return dev?.name || dev?.deviceName || `ID: ${formData.deviceId}`;
                                })()}
                            </span>
                            {formData.deviceId ? (
                                <span className="contract-header-device-tag">✓</span>
                            ) : (
                                <ChevronRight size={14} className="contract-header-device-arrow" />
                            )}
                        </button>

                        <button
                            type="button"
                            className="modal-close"
                            onClick={onClose}
                            aria-label="Cerrar editor"
                            title="Cerrar"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </header>

                {/* ── Main Scrollable Body & Form ── */}
                <form id="contract-form" onSubmit={onSubmit} className="contract-form custom-scrollbar contract-editor-body">
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

                    {/* OCR Document Capture Buttons Row */}
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
                                    <div className="btn-ocr-text-group">
                                        <span className="btn-ocr-label">{tp?.placa ? `Tarjeta: ${tp.placa}` : 'Tarjeta Propiedad'}</span>
                                        <span className="btn-ocr-subtext">✓</span>
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
                                    <div className="btn-ocr-text-group">
                                        <span className="btn-ocr-label">{cd?.documentNumber ? `Cédula: ${cd.documentNumber}` : 'Cédula / PPT'}</span>
                                        <span className="btn-ocr-subtext">✓</span>
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
                                    <div className="btn-ocr-text-group">
                                        <span className="btn-ocr-label">{st?.numeroPoliza ? `SOAT: ${st.numeroPoliza}` : 'Póliza SOAT'}</span>
                                        <span className="btn-ocr-subtext">✓</span>
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
                                className={`btn-ocr-capture ${ocrLoadingCategory === 'soat' ? 'active-scanning' : ''}`}
                                onClick={() => handleOpenAttachSheet('soat')}
                                disabled={Boolean(ocrLoadingCategory)}
                                title="Subir SOAT (PDF o foto)"
                            >
                                <span className="btn-ocr-icon btn-ocr-icon--amber"><FileUp size={16} /></span>
                                <span className="btn-ocr-label">SOAT (PDF / Foto)</span>
                            </button>
                        )}
                    </div>

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

                    {/* ── Form Accordions ── */}
                    <div className="contract-accordion">
                        {/* SECCIÓN 1: PRÉSTAMO / FINANCIERO */}
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
                                            <span className="contract-accordion-title">PRÉSTAMO</span>
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
                                        {/* Frecuencia de pago */}
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

                                        {/* Valor por día */}
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

                                        {/* Días de contrato */}
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

                                        {/* Cuota inicial */}
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
                                                />
                                            </div>
                                        </div>

                                        {/* Fecha inicio */}
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Fecha inicio</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="date"
                                                    className="wa-profile-date-input font-mono"
                                                    value={formData.startDate}
                                                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        {/* Resumen Financiero Dinámico */}
                                        {contractFinancials?.isValid && (
                                            <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-col gap-1.5 text-xs">
                                                <div className="flex justify-between text-slate-500 font-medium">
                                                    <span>Precio Base Moto:</span>
                                                    <span className="font-mono text-slate-700 font-bold">
                                                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(contractFinancials.data.precioMoto)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-slate-500 font-medium">
                                                    <span>Gastos Fijos Total:</span>
                                                    <span className="font-mono text-slate-700">
                                                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(contractFinancials.data.gastos)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-indigo-600 font-semibold border-t border-slate-200/60 pt-1">
                                                    <span>Valor a Financiar:</span>
                                                    <span className="font-mono font-bold">
                                                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(contractFinancials.data.valorFinanciar)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* SECCIÓN 2: VEHÍCULO */}
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
                                            <span className="contract-accordion-title">VEHÍCULO</span>
                                            <span className="contract-accordion-subtitle">
                                                {(() => {
                                                    const d = availableDevices.find(dev => String(dev.deviceId) === String(formData.deviceId));
                                                    const placaText = formData.vehicleInfo?.placa || d?.name || d?.deviceName;
                                                    return placaText ? `Placa: ${placaText}` : 'Sin moto asignada';
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="contract-accordion-actions">
                                        {formData.deviceId ? (
                                            <span className="contract-accordion-badge" style={{ background: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }}>
                                                Asignada ✓
                                            </span>
                                        ) : (
                                            <span className="contract-accordion-badge" style={{ background: '#FFFBEB', color: '#B45309', borderColor: '#FDE68A' }}>
                                                Pendiente
                                            </span>
                                        )}
                                        <ChevronDown size={18} className={`contract-accordion-chevron transition-transform duration-200 ${openSections.device ? 'rotate-180' : ''}`} />
                                    </div>
                                </button>
                                {openSections.device && (
                                    <>
                                        {/* Botón Seleccionar Moto */}
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Motocicleta / GPS</span>
                                            <div className="wa-profile-value-wrap">
                                                <button
                                                    type="button"
                                                    className={`wa-profile-selector-btn ${editingContract ? 'cursor-not-allowed opacity-80' : ''}`}
                                                    onClick={() => !editingContract && setIsDevicePickerOpen(true)}
                                                >
                                                    <span className="font-mono font-bold">
                                                        {(() => {
                                                            if (!formData.deviceId) return 'Seleccionar Moto';
                                                            const dev = availableDevices.find(d => String(d.deviceId) === String(formData.deviceId));
                                                            return dev?.name || dev?.deviceName || `ID: ${formData.deviceId}`;
                                                        })()}
                                                    </span>
                                                    {!editingContract && <ChevronRight size={16} className="text-slate-400" />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Placa */}
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

                                        {/* Marca */}
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

                                        {/* Modelo */}
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Modelo</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input"
                                                    value={formData.vehicleInfo?.modelo || ''}
                                                    onChange={(e) => setFormData(p => ({
                                                        ...p,
                                                        vehicleInfo: { ...p.vehicleInfo, modelo: e.target.value }
                                                    }))}
                                                    placeholder="Ej: 2024"
                                                />
                                            </div>
                                        </div>

                                        {/* Botón Ver Todos los Detalles Técnicos */}
                                        <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                                            <button
                                                type="button"
                                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                                onClick={() => setIsVehicleDetailsOpen(true)}
                                            >
                                                <span>Ver especificaciones completas (Chasis, Motor, SOAT)</span>
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* SECCIÓN 3: CLIENTE */}
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
                                            <span className="contract-accordion-title">CLIENTE</span>
                                            <span className="contract-accordion-subtitle">
                                                {formData.customerName ? formData.customerName : 'Sin asignar'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="contract-accordion-actions">
                                        {formData.customerName ? (
                                            <span className="contract-accordion-badge" style={{ background: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }}>
                                                Asignado ✓
                                            </span>
                                        ) : (
                                            <span className="contract-accordion-badge" style={{ background: '#FFFBEB', color: '#B45309', borderColor: '#FDE68A' }}>
                                                Pendiente
                                            </span>
                                        )}
                                        <ChevronDown size={18} className={`contract-accordion-chevron transition-transform duration-200 ${openSections.customer ? 'rotate-180' : ''}`} />
                                    </div>
                                </button>
                                {openSections.customer && (
                                    <>
                                        {/* Nombre */}
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Nombre completo</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input uppercase font-semibold"
                                                    value={formData.customerName}
                                                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value.toUpperCase() })}
                                                    placeholder="Nombre y Apellidos"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Tipo y Número de Documento */}
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Documento</span>
                                            <div className="wa-profile-value-wrap flex gap-2">
                                                <select
                                                    className="wa-profile-select w-24 shrink-0 font-bold"
                                                    value={formData.customerDocumentType}
                                                    onChange={(e) => setFormData({ ...formData, customerDocumentType: e.target.value })}
                                                >
                                                    <option value="CC">CC</option>
                                                    <option value="PPT">PPT</option>
                                                    <option value="CE">CE</option>
                                                    <option value="TI">TI</option>
                                                    <option value="NIT">NIT</option>
                                                    <option value="PASAPORTE">PAS</option>
                                                </select>
                                                <input
                                                    type="text"
                                                    className="wa-profile-input font-mono font-bold flex-1"
                                                    value={formData.customerDocumentNumber}
                                                    onChange={(e) => setFormData({ ...formData, customerDocumentNumber: e.target.value })}
                                                    placeholder="Número de documento"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Teléfono */}
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Teléfono celular</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="tel"
                                                    className="wa-profile-input font-mono"
                                                    value={formData.customerPhone}
                                                    onChange={(e) => setFormData({ ...formData, customerPhone: formatPhoneNumber(e.target.value) })}
                                                    placeholder="300 123 4567"
                                                />
                                            </div>
                                        </div>

                                        {/* Correo Electrónico */}
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Correo electrónico</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="email"
                                                    className="wa-profile-input"
                                                    value={formData.customerEmail}
                                                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                                                    placeholder="correo@ejemplo.com"
                                                />
                                            </div>
                                        </div>

                                        {/* Dirección */}
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Dirección</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input"
                                                    value={formData.customerAddress}
                                                    onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                                                    placeholder="Dirección de residencia"
                                                />
                                            </div>
                                        </div>

                                        {/* Bloque Fiador / Codeudor */}
                                        <div className="p-3 bg-slate-50 border-t border-slate-100 font-bold text-xs text-slate-500 uppercase tracking-wider">
                                            Fiador / Codeudor (Opcional)
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Nombre fiador</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input uppercase"
                                                    value={formData.guarantor?.name || ''}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        guarantor: { ...(formData.guarantor || {}), name: e.target.value.toUpperCase() }
                                                    })}
                                                    placeholder="Nombre del fiador"
                                                />
                                            </div>
                                        </div>
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Teléfono fiador</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="tel"
                                                    className="wa-profile-input font-mono"
                                                    value={formData.guarantor?.phone || ''}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        guarantor: { ...(formData.guarantor || {}), phone: formatPhoneNumber(e.target.value) }
                                                    })}
                                                    placeholder="300 000 0000"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* SECCIÓN 4: PARÁMETROS AVANZADOS */}
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
                                            <span className="contract-accordion-title">PARÁMETROS AVANZADOS</span>
                                            <span className="contract-accordion-subtitle">
                                                PIN {formData.devicePin || '—'} • {formData.freeDaysLimit || 0} días libres • {formData.exemptFromCutOff ? 'Exento corte' : 'Corte activo'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="contract-accordion-actions">
                                        <ChevronDown size={18} className={`contract-accordion-chevron transition-transform duration-200 ${openSections.advanced ? 'rotate-180' : ''}`} />
                                    </div>
                                </button>
                                {openSections.advanced && (
                                    <>
                                        {/* PIN de la Moto */}
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">PIN del Vehículo</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="text"
                                                    className="wa-profile-input font-mono font-bold"
                                                    value={formData.devicePin}
                                                    onChange={(e) => setFormData({ ...formData, devicePin: e.target.value })}
                                                    placeholder="4 dígitos"
                                                    maxLength={6}
                                                />
                                            </div>
                                        </div>

                                        {/* Límite de Días Libres */}
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Días libres permitidos</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="number"
                                                    className="wa-profile-input font-mono"
                                                    value={formData.freeDaysLimit}
                                                    onChange={(e) => setFormData({ ...formData, freeDaysLimit: parseInt(e.target.value) || 0 })}
                                                    min="0"
                                                    max="30"
                                                />
                                            </div>
                                        </div>

                                        {/* Hora de Corte Automático */}
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Hora de corte</span>
                                            <div className="wa-profile-value-wrap">
                                                <input
                                                    type="time"
                                                    className="wa-profile-input font-mono"
                                                    value={formData.cutOffTime || '23:59'}
                                                    onChange={(e) => setFormData({ ...formData, cutOffTime: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        {/* Exenciones */}
                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Exento de corte automático</span>
                                            <div className="wa-profile-value-wrap flex justify-end">
                                                <input
                                                    type="checkbox"
                                                    className="toggle-checkbox"
                                                    checked={formData.exemptFromCutOff}
                                                    onChange={(e) => setFormData({ ...formData, exemptFromCutOff: e.target.checked })}
                                                />
                                            </div>
                                        </div>

                                        <div className="wa-profile-row">
                                            <span className="wa-profile-label">Exento de toque de queda</span>
                                            <div className="wa-profile-value-wrap flex justify-end">
                                                <input
                                                    type="checkbox"
                                                    className="toggle-checkbox"
                                                    checked={formData.exemptFromCurfew}
                                                    onChange={(e) => setFormData({ ...formData, exemptFromCurfew: e.target.checked })}
                                                />
                                            </div>
                                        </div>

                                        {/* Notas del contrato */}
                                        <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-col gap-1.5">
                                            <span className="font-bold text-xs text-slate-500 uppercase">Observaciones y Notas</span>
                                            <textarea
                                                className="wa-profile-input w-full p-2 border border-slate-200 rounded-lg text-xs"
                                                rows={3}
                                                value={formData.notes || ''}
                                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                                placeholder="Notas internas del contrato..."
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </form>

                {/* ── Fixed Bottom Actions Bar ── */}
                <footer className="contract-editor-actions contract-modal-actions">
                    <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
                        {t('contracts.modal.cancelBtn') || 'Cancelar'}
                    </button>
                    <button type="submit" form="contract-form" className="btn-primary" disabled={loading}>
                        {loading ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Loader2 size={16} className="animate-spin" />
                                {t('contracts.modal.savingBtn') || 'Guardando...'}
                            </span>
                        ) : editingContract ? (
                            t('contracts.modal.updateBtn') || 'Guardar Cambios'
                        ) : (
                            t('contracts.modal.createBtn') || 'Crear Contrato'
                        )}
                    </button>
                </footer>

                {/* ── Slide-in Sub-Page 1: Device Selection ── */}
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

                        <div className="wa-picker-search-box">
                            <input
                                type="text"
                                className="wa-picker-search-input"
                                placeholder="Buscar placa, nombre o ID..."
                                value={deviceSearchQuery}
                                onChange={(e) => setDeviceSearchQuery(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="wa-picker-list">
                            {availableDevices
                                .filter(d => !d.hasActiveContract || d.deviceId === formData.deviceId * 1)
                                .filter(d => {
                                    if (!deviceSearchQuery) return true;
                                    const q = deviceSearchQuery.toLowerCase();
                                    return (
                                        (d.name || '').toLowerCase().includes(q) ||
                                        (d.deviceName || '').toLowerCase().includes(q) ||
                                        String(d.deviceId).includes(q)
                                    );
                                })
                                .map(d => {
                                    const isSelected = String(d.deviceId) === String(formData.deviceId);
                                    const displayName = d.name || d.deviceName || `ID ${d.deviceId}`;
                                    return (
                                        <button
                                            key={d.deviceId}
                                            type="button"
                                            className={`wa-picker-item ${isSelected ? 'wa-picker-item--selected' : ''}`}
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    deviceId: d.deviceId,
                                                    vehicleInfo: {
                                                        ...(prev.vehicleInfo || {}),
                                                        placa: prev.vehicleInfo?.placa || d.name || d.deviceName || ''
                                                    }
                                                }));
                                                setIsDevicePickerOpen(false);
                                                setDeviceSearchQuery('');
                                            }}
                                        >
                                            <div className="wa-picker-item-avatar">
                                                <Bike size={18} />
                                            </div>
                                            <div className="wa-picker-item-info">
                                                <span className="wa-picker-item-title font-mono font-bold">{displayName}</span>
                                                <span className="wa-picker-item-sub">ID: {d.deviceId} • {d.uniqueId || 'Sin IMEI'}</span>
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

                {/* ── Slide-in Sub-Page 2: Vehicle & SOAT Technical Specs ── */}
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
                                    <span className="wa-profile-label">Línea</span>
                                    <div className="wa-profile-value-wrap">
                                        <input
                                            type="text"
                                            className="wa-profile-input uppercase"
                                            value={formData.vehicleInfo?.linea || ''}
                                            onChange={(e) => setFormData(p => ({
                                                ...p,
                                                vehicleInfo: { ...p.vehicleInfo, linea: e.target.value.toUpperCase() }
                                            }))}
                                            placeholder="Ej: BOXER CT 100"
                                        />
                                    </div>
                                </div>
                                <div className="wa-profile-row">
                                    <span className="wa-profile-label">Modelo</span>
                                    <div className="wa-profile-value-wrap">
                                        <input
                                            type="text"
                                            className="wa-profile-input"
                                            value={formData.vehicleInfo?.modelo || ''}
                                            onChange={(e) => setFormData(p => ({
                                                ...p,
                                                vehicleInfo: { ...p.vehicleInfo, modelo: e.target.value }
                                            }))}
                                            placeholder="Ej: 2024"
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
                                            placeholder="Ej: NEGRO NEBULOSA"
                                        />
                                    </div>
                                </div>
                                <div className="wa-profile-row">
                                    <span className="wa-profile-label">Cilindraje (CC)</span>
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
                                    <span className="wa-profile-label">Número de Motor</span>
                                    <div className="wa-profile-value-wrap">
                                        <input
                                            type="text"
                                            className="wa-profile-input uppercase font-mono font-bold"
                                            value={formData.vehicleInfo?.numeroMotor || ''}
                                            onChange={(e) => setFormData(p => ({
                                                ...p,
                                                vehicleInfo: { ...p.vehicleInfo, numeroMotor: e.target.value.toUpperCase() }
                                            }))}
                                            placeholder="Ej: DUMK48291..."
                                        />
                                    </div>
                                </div>
                                <div className="wa-profile-row">
                                    <span className="wa-profile-label">Número de Chasis (VIN)</span>
                                    <div className="wa-profile-value-wrap">
                                        <input
                                            type="text"
                                            className="wa-profile-input uppercase font-mono font-bold"
                                            value={formData.vehicleInfo?.numeroChasis || ''}
                                            onChange={(e) => setFormData(p => ({
                                                ...p,
                                                vehicleInfo: { ...p.vehicleInfo, numeroChasis: e.target.value.toUpperCase() }
                                            }))}
                                            placeholder="Ej: 9F2KC1028..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* BLOQUE 2: PROPIETARIO REGISTRADO */}
                            <div className="wa-profile-card">
                                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 font-bold text-xs text-slate-500 uppercase tracking-wider">
                                    Propietario / Tomador (Tarjeta de Propiedad)
                                </div>
                                <div className="wa-profile-row">
                                    <span className="wa-profile-label">Nombre Propietario</span>
                                    <div className="wa-profile-value-wrap">
                                        <input
                                            type="text"
                                            className="wa-profile-input uppercase font-semibold"
                                            value={formData.vehicleInfo?.propietario || ''}
                                            onChange={(e) => setFormData(p => ({
                                                ...p,
                                                vehicleInfo: { ...p.vehicleInfo, propietario: e.target.value.toUpperCase() }
                                            }))}
                                            placeholder="Nombre del propietario en tarjeta"
                                        />
                                    </div>
                                </div>
                                <div className="wa-profile-row">
                                    <span className="wa-profile-label">Cédula Propietario</span>
                                    <div className="wa-profile-value-wrap">
                                        <input
                                            type="text"
                                            className="wa-profile-input font-mono font-bold"
                                            value={formData.vehicleInfo?.documentoPropietario || ''}
                                            onChange={(e) => setFormData(p => ({
                                                ...p,
                                                vehicleInfo: { ...p.vehicleInfo, documentoPropietario: e.target.value }
                                            }))}
                                            placeholder="Ej: 1047482910"
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

                            {/* BLOQUE 3: PÓLIZA SOAT */}
                            <div className="wa-profile-card">
                                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 font-bold text-xs text-slate-500 uppercase tracking-wider">
                                    Detalles Póliza SOAT
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
                                            placeholder="Ej: SEGUROS MUNDIAL"
                                        />
                                    </div>
                                </div>
                                <div className="wa-profile-row">
                                    <span className="wa-profile-label">Número de Póliza</span>
                                    <div className="wa-profile-value-wrap">
                                        <input
                                            type="text"
                                            className="wa-profile-input font-mono font-bold"
                                            value={formData.vehicleInfo?.soatNumeroPoliza || ''}
                                            onChange={(e) => setFormData(p => ({
                                                ...p,
                                                vehicleInfo: { ...p.vehicleInfo, soatNumeroPoliza: e.target.value }
                                            }))}
                                            placeholder="Ej: 38291048291"
                                        />
                                    </div>
                                </div>
                                <div className="wa-profile-row">
                                    <span className="wa-profile-label">Vigencia Hasta</span>
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

                {/* ── Child Modals: Image Cropper & WhatsApp Attachment Selector ── */}
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
            </div>
        </div>,
        document.body
    );
};

export default ContractEditor;

