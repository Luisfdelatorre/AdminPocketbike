import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
    Settings as SettingsIcon, DollarSign, Clock, Database, Save, Image as ImageIcon, 
    Edit2, ZoomIn, ZoomOut, RefreshCw, Upload, Building, ArrowLeft, Percent, 
    Zap, MapPin, Bell, BellRing, ShieldCheck, Server, Globe, User, Key, Eye, EyeOff, 
    Smartphone, QrCode, CheckCircle, Check, Radio, Info, Mail
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import useIsMobile from '../hooks/useIsMobile';
import { getSettings, updateSettings, syncDevices, validateTraccarConnection, getTraccarNotifications, updateTraccarNotifications } from '../services/api';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './Settings.css';

const Settings = () => {
    const isMobile = useIsMobile();
    const { settingsTab, setSettingsTab } = useOutletContext() || {};
    const [localActiveTab, setLocalActiveTab] = useState('branding');

    const activeTab = settingsTab || localActiveTab;
    const setActiveTab = setSettingsTab || setLocalActiveTab;

    const { t } = useTranslation();
    const [settings, setSettings] = useState({
        currency: 'COP',
        timezone: 'America/Bogota',
        contractDefaults: {
            dailyRate: 30000,
            contractDays: 500,
            freeDaysLimit: 4,
            initialFee: 0,
            emailDomain: 'pocketbike.app',
            fixedCosts: {
                gps: 500000,
                soatPosterior: 370000,
                traspasoPosterior: 273000,
                registro: 217000
            },
            financialParameters: {
                iva: 0.19,
                objetivoEA: 0.29,
                pagosPorAnio: 312,
                proporcionUPAY: 0.95
            }
        },
        displayName: 'PocketBike',
        companyLogo: '/pocketbike_60x60.jpg',
        automaticCutOff: false,
        cutOffTime: '23:59',
        cutOffStrategy: 1,
        gpsService: 'megarastreo',
        gpsConfig: {
            host: '',
            port: '',
            user: '',
            password: '',
            token: ''
        },
        wompiConfig: {
            publicKey: '',
            privateKey: '',
            integritySecret: '',
            eventsSecret: '',
            paymentMethod: 'NEQUI_PUSH'
        }
    });

    const [availableGpsServices, setAvailableGpsServices] = useState([]);

    const [saved, setSaved] = useState(false);
    const [savingSections, setSavingSections] = useState({});
    const [savedSections, setSavedSections] = useState({});
    const [showCropModal, setShowCropModal] = useState(false);
    const [imageToCrop, setImageToCrop] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [syncState, setSyncState] = useState({ loading: false, result: null, error: null });
    const [isValidatingTraccar, setIsValidatingTraccar] = useState(false);
    const [traccarValidationResult, setTraccarValidationResult] = useState(null);
    const [traccarNotifs, setTraccarNotifs] = useState({
        batteryAlerts: false,
        geofenceAlerts: false,
        vibrationAlerts: false
    });
    const [isLoadingTraccarNotifs, setIsLoadingTraccarNotifs] = useState(false);
    const [isUpdatingTraccarNotif, setIsUpdatingTraccarNotif] = useState(false);
    const [showTraccarPassword, setShowTraccarPassword] = useState(false);
    const [showWompiPrivKey, setShowWompiPrivKey] = useState(false);
    const [showWompiIntegrity, setShowWompiIntegrity] = useState(false);
    const [showWompiEvents, setShowWompiEvents] = useState(false);

    const loadTraccarNotifications = async () => {
        if (!settings.gpsConfig?.user) return;
        setIsLoadingTraccarNotifs(true);
        try {
            const res = await getTraccarNotifications('me');
            if (res?.success && res.settings) {
                setTraccarNotifs(res.settings);
            }
        } catch (err) {
            console.warn('[Settings] Error fetching Traccar notifications:', err.message);
        } finally {
            setIsLoadingTraccarNotifs(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'integrations' && settings.gpsConfig?.user) {
            loadTraccarNotifications();
        }
    }, [activeTab, settings.gpsConfig?.user]);

    const handleToggleTraccarNotif = async (key, val) => {
        const nextState = { ...traccarNotifs, [key]: val };
        setTraccarNotifs(nextState);
        setIsUpdatingTraccarNotif(true);
        try {
            const res = await updateTraccarNotifications('me', nextState);
            if (res?.success && res.settings) {
                setTraccarNotifs(res.settings);
            }
        } catch (err) {
            console.error('Error updating Traccar notification:', err);
            setTraccarNotifs(prev => ({ ...prev, [key]: !val }));
        } finally {
            setIsUpdatingTraccarNotif(false);
        }
    };


    const handleSyncDevices = async () => {
        setSyncState({ loading: true, result: null, error: null });
        try {
            const res = await syncDevices();
            setSyncState({ loading: false, result: res, error: null });
        } catch (err) {
            setSyncState({ loading: false, result: null, error: err.message || 'Sync failed' });
        }
    };

    const handleValidateTraccar = async () => {
        setIsValidatingTraccar(true);
        setTraccarValidationResult(null);
        try {
            const payload = {
                host: settings.gpsConfig?.host,
                user: settings.gpsConfig?.user,
                password: settings.gpsConfig?.password
            };
            const res = await validateTraccarConnection(payload);
            const isSuccess = res?.success ?? res?.data?.success;
            const data = res?.data?.data ?? res?.data;
            if (isSuccess && data) {
                const groupName = data.selectedGroup ? `${data.selectedGroup.name} (ID: ${data.selectedGroup.id})` : 'Sin grupo asignado';
                const timingStr = data.timing?.totalMs ? ` [${data.timing.totalMs}ms]` : '';
                if (data.timing) {
                    console.log('⏱️ [Traccar Timers]', data.timing);
                }
                setTraccarValidationResult({
                    success: true,
                    message: `Conexión exitosa. Usuario: ${data.user?.name || data.user?.email || 'OK'} | Grupo: ${groupName}${timingStr}`
                });
                if (data.selectedGroup?.id) {
                    handleNestedChange('gpsConfig', 'groupId', data.selectedGroup.id);
                }
                loadTraccarNotifications();
            } else {
                setTraccarValidationResult({
                    success: false,
                    message: res?.error || res?.data?.error || 'Error al validar credenciales de Traccar'
                });
            }
        } catch (err) {
            setTraccarValidationResult({
                success: false,
                message: err.response?.data?.error || err.message || 'Error de conexión con Traccar'
            });
        } finally {
            setIsValidatingTraccar(false);
        }
    };

    const canvasRef = useRef(null);
    const imageRef = useRef(null);
    const initialSettingsRef = useRef(null);

    const handleChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            [field]: value
        }));
        setSaved(false);
    };

    // Fetch branding from server
    useEffect(() => {
        const fetchBranding = async () => {
            try {
                const data = await getSettings();
                if (data.success) {
                    const { availableGpsServices: gpsList, ...rest } = data.data;
                    if (gpsList?.length) setAvailableGpsServices(gpsList);
                    setSettings(prev => {
                        const loaded = {
                            ...prev,
                            ...rest,
                            contractDefaults: {
                                ...prev.contractDefaults,
                                ...(rest.contractDefaults || {}),
                                fixedCosts: {
                                    ...(prev.contractDefaults?.fixedCosts || {}),
                                    ...(rest.contractDefaults?.fixedCosts || {})
                                },
                                financialParameters: {
                                    ...(prev.contractDefaults?.financialParameters || {}),
                                    ...(rest.contractDefaults?.financialParameters || {})
                                }
                            },
                            companyLogo: rest.logo || prev.companyLogo // Map logo to companyLogo for state
                        };
                        initialSettingsRef.current = JSON.parse(JSON.stringify(loaded));
                        return loaded;
                    });
                }
            } catch (error) {
                console.error('Error fetching settings:', error);
            }
        };
        fetchBranding();
    }, []);

    // Draw on canvas whenever image, zoom, or position changes
    useEffect(() => {
        if (showCropModal && canvasRef.current && imageRef.current) {
            drawCanvas();
        }
    }, [showCropModal, imageToCrop, zoom, position]);

    const drawCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = imageRef.current;

        if (!img || !img.complete) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw image
        ctx.save();
        ctx.translate(canvas.width / 2 + position.x, canvas.height / 2 + position.y);
        ctx.drawImage(img, -img.width * zoom / 2, -img.height * zoom / 2, img.width * zoom, img.height * zoom);
        ctx.restore();

        // Draw square crop overlay with darkened area outside
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const cropSize = Math.min(canvas.width, canvas.height) * 0.8;
        const halfSize = cropSize / 2;

        // Draw semi-transparent overlay over entire canvas
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Clear the crop area (making it fully visible)
        ctx.clearRect(centerX - halfSize, centerY - halfSize, cropSize, cropSize);

        // Redraw the image only in the crop area
        ctx.save();
        ctx.beginPath();
        ctx.rect(centerX - halfSize, centerY - halfSize, cropSize, cropSize);
        ctx.clip();
        ctx.translate(canvas.width / 2 + position.x, canvas.height / 2 + position.y);
        ctx.drawImage(img, -img.width * zoom / 2, -img.height * zoom / 2, img.width * zoom, img.height * zoom);
        ctx.restore();

        // Draw square border
        ctx.strokeStyle = '#03C9D7';
        ctx.lineWidth = 3;
        ctx.strokeRect(centerX - halfSize, centerY - halfSize, cropSize, cropSize);
    };

    const handleMouseDown = (e) => {
        setIsDragging(true);
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;

        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleTouchStart = (e) => {
        const touch = e.touches[0];
        setIsDragging(true);
        setDragStart({
            x: touch.clientX - position.x,
            y: touch.clientY - position.y
        });
    };

    const handleTouchMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();

        const touch = e.touches[0];
        setPosition({
            x: touch.clientX - dragStart.x,
            y: touch.clientY - dragStart.y
        });
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
    };

    const getNestedDiff = (currentObj = {}, initialObj = {}) => {
        const diff = {};
        const allKeys = new Set([...Object.keys(currentObj || {}), ...Object.keys(initialObj || {})]);

        for (const key of allKeys) {
            const currentVal = currentObj?.[key];
            const initialVal = initialObj?.[key];

            // Never treat masked placeholder passwords or secrets as a real change
            if (currentVal === '********') {
                continue;
            }

            if (currentVal !== undefined && typeof currentVal === 'object' && currentVal !== null && !Array.isArray(currentVal)) {
                const subDiff = getNestedDiff(currentVal, initialVal);
                if (Object.keys(subDiff).length > 0) {
                    diff[key] = subDiff;
                }
            } else if (currentVal !== undefined && currentVal !== initialVal) {
                diff[key] = currentVal;
            }
        }
        return diff;
    };

    const getChangedSettings = (current, initial) => {
        if (!initial) return { ...current, logo: current.companyLogo };
        const diff = {};

        // Top-level scalar fields
        const scalarKeys = [
            'currency', 'timezone', 'displayName',
            'automaticCutOff', 'cutOffTime', 'cutOffStrategy',
            'gpsService'
        ];
        scalarKeys.forEach(key => {
            if (current[key] !== undefined && current[key] !== initial[key]) {
                diff[key] = current[key];
            }
        });

        // Logo mapping
        if (current.companyLogo !== undefined && current.companyLogo !== initial.companyLogo) {
            diff.logo = current.companyLogo;
        }

        // Object: curfew (atomic update if changed)
        if (current.curfew !== undefined && JSON.stringify(current.curfew) !== JSON.stringify(initial.curfew)) {
            diff.curfew = current.curfew;
        }

        // Granular Nested Objects: contractDefaults, gpsConfig, wompiConfig, billingConfig
        if (current.contractDefaults) {
            const contractDiff = getNestedDiff(current.contractDefaults, initial.contractDefaults);
            if (Object.keys(contractDiff).length > 0) {
                diff.contractDefaults = contractDiff;
            }
        }

        if (current.gpsConfig) {
            const gpsDiff = getNestedDiff(current.gpsConfig, initial.gpsConfig);
            if (Object.keys(gpsDiff).length > 0) {
                diff.gpsConfig = gpsDiff;
            }
        }

        if (current.wompiConfig) {
            const wompiDiff = getNestedDiff(current.wompiConfig, initial.wompiConfig);
            if (Object.keys(wompiDiff).length > 0) {
                diff.wompiConfig = wompiDiff;
            }
        }

        if (current.billingConfig) {
            const billingDiff = getNestedDiff(current.billingConfig, initial.billingConfig);
            if (Object.keys(billingDiff).length > 0) {
                diff.billingConfig = billingDiff;
            }
        }

        return diff;
    };

    const handleSave = async () => {
        await handleSaveSection('all');
    };

    const handleSaveSection = async (section) => {
        setSavingSections(prev => ({ ...prev, [section]: true }));
        try {
            // Compute dirty diff against initial loaded snapshot
            const allDirty = getChangedSettings(settings, initialSettingsRef.current);

            // Filter dirty fields if saving a specific section
            let payload = {};
            if (section === 'all') {
                payload = allDirty;
            } else if (section === 'branding') {
                if (allDirty.displayName !== undefined) payload.displayName = allDirty.displayName;
                if (allDirty.logo !== undefined) payload.logo = allDirty.logo;
                if (allDirty.contractDefaults?.emailDomain !== undefined) {
                    payload.contractDefaults = { emailDomain: allDirty.contractDefaults.emailDomain };
                }
            } else if (section === 'gps') {
                if (allDirty.gpsService !== undefined) payload.gpsService = allDirty.gpsService;
                if (allDirty.gpsConfig !== undefined) payload.gpsConfig = allDirty.gpsConfig;
            } else if (section === 'wompi') {
                if (allDirty.wompiConfig !== undefined) payload.wompiConfig = allDirty.wompiConfig;
            } else if (section === 'cutoff') {
                if (allDirty.automaticCutOff !== undefined) payload.automaticCutOff = allDirty.automaticCutOff;
                if (allDirty.cutOffTime !== undefined) payload.cutOffTime = allDirty.cutOffTime;
                if (allDirty.cutOffStrategy !== undefined) payload.cutOffStrategy = allDirty.cutOffStrategy;
            } else if (section === 'curfew') {
                if (allDirty.curfew !== undefined) payload.curfew = allDirty.curfew;
            } else if (section === 'general') {
                if (allDirty.currency !== undefined) payload.currency = allDirty.currency;
                if (allDirty.timezone !== undefined) payload.timezone = allDirty.timezone;
                if (allDirty.contractDefaults !== undefined) payload.contractDefaults = allDirty.contractDefaults;
            }

            // If nothing changed, do not send an HTTP request
            if (Object.keys(payload).length === 0) {
                console.log(`[Settings] No changes detected for section: ${section}`);
                setSavedSections(prev => ({ ...prev, [section]: true }));
                setTimeout(() => {
                    setSavedSections(prev => ({ ...prev, [section]: false }));
                }, 2000);
                if (section === 'all') {
                    setSaved(true);
                    setTimeout(() => setSaved(false), 2000);
                }
                return;
            }

            const data = await updateSettings(payload);

            if (data.success) {
                console.log(`${section} settings saved successfully:`, Object.keys(payload));

                // Update baseline snapshot so subsequent saves know these are persisted
                initialSettingsRef.current = JSON.parse(JSON.stringify(settings));

                // Mark section as saved
                setSavedSections(prev => ({ ...prev, [section]: true }));
                setTimeout(() => {
                    setSavedSections(prev => ({ ...prev, [section]: false }));
                }, 3000);

                if (payload.logo || payload.displayName) {
                    if (payload.logo) localStorage.setItem('companyLogo', payload.logo);
                    if (payload.displayName) localStorage.setItem('displayName', payload.displayName);
                }

                if (section === 'all') {
                    setSaved(true);
                    setTimeout(() => setSaved(false), 3000);
                }
            } else {
                alert(`Error saving ${section} settings: ` + data.error);
            }
        } catch (error) {
            console.error(`Error saving ${section} settings:`, error);
            alert(`Error saving ${section} settings`);
        } finally {
            setSavingSections(prev => ({ ...prev, [section]: false }));
        }
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                alert('Please upload an image file');
                return;
            }

            // Validate file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                alert('Image size should be less than 2MB');
                return;
            }

            // Read file and show crop modal
            const reader = new FileReader();
            reader.onloadend = () => {
                const img = new Image();
                img.onload = () => {
                    imageRef.current = img;

                    // Calculate initial zoom and position to center image
                    if (canvasRef.current) {
                        const canvas = canvasRef.current;
                        const scaleX = canvas.width / img.width;
                        const scaleY = canvas.height / img.height;
                        const initialZoom = Math.max(scaleX, scaleY) * 0.8;

                        setZoom(initialZoom);
                        setPosition({ x: 0, y: 0 });
                    }
                    setImageToCrop(reader.result);
                    setShowCropModal(true);
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);

            // Clear input
            e.target.value = '';
        }
    };

    const performCrop = () => {
        const canvas = canvasRef.current;
        const img = imageRef.current;

        if (!canvas || !img) return;

        // Create a new canvas for the cropped image
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = 300;
        cropCanvas.height = 300;
        const cropCtx = cropCanvas.getContext('2d');

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const cropSize = Math.min(canvas.width, canvas.height) * 0.8;
        const halfSize = cropSize / 2;

        // Calculate source position
        const sourceX = centerX - halfSize;
        const sourceY = centerY - halfSize;

        // Draw the cropped square region
        cropCtx.drawImage(
            canvas,
            sourceX + 2, sourceY + 2, cropSize - 4, cropSize - 4,
            0, 0, 300, 300
        );

        const croppedImage = cropCanvas.toDataURL('image/png');
        handleChange('companyLogo', croppedImage);

        closeCropModal();
    };

    const closeCropModal = () => {
        setShowCropModal(false);
        setImageToCrop(null);
        setZoom(1);
        setPosition({ x: 0, y: 0 });
        setIsDragging(false);
    };

    const handleZoomChange = (e) => {
        setZoom(parseFloat(e.target.value));
    };

    const handleZoomIn = () => {
        setZoom(prev => Math.min(prev + 0.05, 3));
    };

    const handleZoomOut = () => {
        setZoom(prev => Math.max(prev - 0.1, 0.5));
    };

    const handleWheel = (e) => {
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(prev => Math.min(Math.max(prev + delta, 0.5), 3));
    };

    const formatCurrency = (amount) => {
        return `$${amount.toLocaleString()} COP`;
    };

    const handleNestedChange = (category, field, value) => {
        setSettings(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [field]: value
            }
        }));
        setSaved(false);
    };

    const handleFixedCostChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            contractDefaults: {
                ...prev.contractDefaults,
                fixedCosts: {
                    ...(prev.contractDefaults?.fixedCosts || {}),
                    [field]: value
                }
            }
        }));
        setSaved(false);
    };

    const handleFinancialParamChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            contractDefaults: {
                ...prev.contractDefaults,
                financialParameters: {
                    ...(prev.contractDefaults?.financialParameters || {}),
                    [field]: value
                }
            }
        }));
        setSaved(false);
    };

    const desktopHeader = (
        <PageHeader.Desktop
            title={t('settings.title')}
            subtitle={t('settings.subtitle')}
            actions={
                <button
                    onClick={handleSave}
                    className="btn-primary"
                    title={t('settings.actions.save')}
                >
                    <Save size={16} /> {t('settings.actions.save')}
                </button>
            }
        />
    );

    const mobileHeader = (
        <PageHeader.Mobile
            actions={
                <button
                    onClick={handleSave}
                    className="btn-mobile-header-action"
                    title={t('settings.actions.save')}
                    aria-label={t('settings.actions.save')}
                >
                    <Save size={20} />
                </button>
            }
        />
    );

    const renderHeader = isMobile ? mobileHeader : desktopHeader;

    return (
        <div className="settings-page">
            {renderHeader}

            {/* Settings Sections */}
            <div className="settings-container">
                {/* Settings Tabs */}
                <div className="settings-tabs">
                    <button
                        className={`tab-button ${activeTab === 'branding' ? 'active' : ''}`}
                        onClick={() => setActiveTab('branding')}
                    >
                        <Building size={18} /> {t('settings.tabs.branding') || 'Empresa'}
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'business' ? 'active' : ''}`}
                        onClick={() => setActiveTab('business')}
                    >
                        <SettingsIcon size={18} /> {t('settings.tabs.business')}
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'integrations' ? 'active' : ''}`}
                        onClick={() => setActiveTab('integrations')}
                    >
                        <Database size={18} /> {t('settings.tabs.integrations')}
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'system' ? 'active' : ''}`}
                        onClick={() => setActiveTab('system')}
                    >
                        <RefreshCw size={18} /> {t('settings.tabs.system')}
                    </button>
                </div>

                {/* ── BRANDING TAB ── */}
                {activeTab === 'branding' && (
                    <div className="company-profile-container">
                        <section className="company-profile-card">
                            {/* Header of Card */}
                            <div className="company-card-header">
                                <div className="company-header-title-group">
                                    <div className="company-header-icon">
                                        <Building size={20} />
                                    </div>
                                    <div>
                                        <h2 className="company-header-title">Configuración de Empresa</h2>
                                        <p className="company-header-subtitle">Datos públicos y perfil de negocio</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="company-header-info-btn"
                                    title={t('settings.branding.displayNameDesc') || 'Información de sección'}
                                    aria-label="Información de sección"
                                >
                                    <Info size={16} />
                                </button>
                            </div>

                            {/* Field 1: Business Visible Name */}
                            <div className="company-field-group">
                                <div className="company-field-label-row">
                                    <label className="company-field-label" htmlFor="company-name">
                                        <ImageIcon size={14} />
                                        <span>Nombre visible de la Empresa</span>
                                    </label>
                                    <span className="company-field-badge-required">Requerido</span>
                                </div>
                                <div className="company-input-relative">
                                    <input
                                        id="company-name"
                                        name="company_name"
                                        type="text"
                                        value={settings.displayName || ''}
                                        onChange={(e) => handleChange('displayName', e.target.value)}
                                        placeholder="Ej. PocketBike Store"
                                        className="company-text-input"
                                    />
                                    {Boolean(settings.displayName?.trim()) && (
                                        <div className="company-input-icon-right">
                                            <Check size={18} color="#10b981" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Field 2: Default Email Domain */}
                            <div className="company-field-group">
                                <div className="company-field-label-row">
                                    <label className="company-field-label" htmlFor="email-domain">
                                        <Mail size={14} />
                                        <span>Dominio de Correo por Defecto</span>
                                    </label>
                                    <button
                                        type="button"
                                        className="company-header-info-btn"
                                        title={t('settings.branding.emailDomainDesc') || 'Ayuda sobre dominio'}
                                        aria-label="Ayuda sobre dominio"
                                    >
                                        <Info size={14} />
                                    </button>
                                </div>
                                <div className="company-email-domain-group">
                                    <span className="company-email-at-prefix">@</span>
                                    <input
                                        id="email-domain"
                                        name="email_domain"
                                        type="text"
                                        value={settings.contractDefaults?.emailDomain || ''}
                                        onChange={(e) => handleNestedChange('contractDefaults', 'emailDomain', e.target.value)}
                                        placeholder="ejemplo.com"
                                        className="company-email-domain-input"
                                    />
                                </div>
                            </div>

                            {/* Field 3: Company Logo Section */}
                            <div className="company-logo-section">
                                <label className="company-field-label">
                                    <ImageIcon size={14} />
                                    <span>Logo de la Empresa</span>
                                </label>
                                <div className="company-logo-box">
                                    {/* Logo Preview Container with Edit Pin */}
                                    <div className="company-logo-preview-wrapper">
                                        <div
                                            className="company-logo-preview"
                                            onClick={() => document.getElementById('companyLogo')?.click()}
                                            title={t('settings.branding.changeLogo') || 'Cambiar logo'}
                                        >
                                            <img
                                                src={settings.companyLogo || '/pocketbike_60x60.jpg'}
                                                alt={settings.displayName || 'Logo Empresa'}
                                                className="company-logo-img"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = '/pocketbike_60x60.jpg';
                                                }}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            className="company-logo-floating-edit"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                document.getElementById('companyLogo')?.click();
                                            }}
                                            aria-label="Cambiar logo"
                                            title="Cambiar logo"
                                        >
                                            <Edit2 size={13} />
                                        </button>
                                    </div>

                                    {/* Upload Guidelines & Actions */}
                                    <div className="company-logo-actions-wrapper">
                                        <div className="company-logo-btn-group">
                                            <button
                                                type="button"
                                                className="company-logo-btn-change"
                                                onClick={() => document.getElementById('companyLogo')?.click()}
                                            >
                                                Cambiar foto
                                            </button>
                                            <button
                                                type="button"
                                                className="company-logo-btn-delete"
                                                onClick={() => handleChange('companyLogo', '')}
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                        <p className="company-logo-hint">
                                            Recomendado: <strong>60×60 px</strong>, formatos PNG o JPG, máx 2 MB.
                                        </p>
                                    </div>

                                    <input
                                        id="companyLogo"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoUpload}
                                        style={{ display: 'none' }}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Domain Status Badge */}
                        <section className="tenant-status-card">
                            <div className="tenant-status-left">
                                <span className="tenant-status-pulse-container">
                                    <span className="tenant-status-pulse-ring"></span>
                                    <span className="tenant-status-pulse-dot"></span>
                                </span>
                                <div className="tenant-status-info">
                                    <p className="tenant-status-title">Tenant Activo y Verificado</p>
                                    <p className="tenant-status-host">
                                        {(settings.displayName ? settings.displayName.toLowerCase().replace(/[^a-z0-9]/g, '') : 'pocketbike') + '.' + (settings.contractDefaults?.emailDomain || 'tumotoya.online')}
                                    </p>
                                </div>
                            </div>
                            <span className="tenant-status-badge">
                                {typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'SSL Activo' : 'Conexión Segura'}
                            </span>
                        </section>
                    </div>
                )}

                {/* ── BUSINESS TAB ── */}
                {activeTab === 'business' && (
                    <div className="settings-modern-container">
                        {/* Automatic Cut-Off */}
                        <div className="settings-card-section">
                            <div className="card-section-header">
                                <div className="card-title-group">
                                    <Clock size={20} className="card-icon" />
                                    <h2 className="card-title-text">Corte Automático</h2>
                                </div>
                                <input
                                    id="automaticCutOff"
                                    type="checkbox"
                                    checked={settings.automaticCutOff}
                                    onChange={(e) => handleChange('automaticCutOff', e.target.checked)}
                                    className="toggle-checkbox"
                                />
                            </div>

                            {settings.automaticCutOff && (
                                <div className="settings-card-content">
                                    <div className="settings-card-row">
                                        <label htmlFor="cutOffTime">Hora de Corte</label>
                                        <div className="settings-card-input-wrapper">
                                            <input
                                                id="cutOffTime"
                                                type="time"
                                                value={settings.cutOffTime || '23:59'}
                                                onChange={(e) => handleChange('cutOffTime', e.target.value)}
                                                className="modern-time-input"
                                            />
                                            <Clock size={16} className="input-inner-icon" />
                                            <i className="info-icon-mobile" title={t('settings.cutoff.cutOffTimeDesc')}>i</i>
                                        </div>
                                    </div>
                                    <div className="settings-card-row">
                                        <label htmlFor="cutOffStrategy">Estrategia de Corte</label>
                                        <div className="settings-card-input-wrapper">
                                            <select
                                                id="cutOffStrategy"
                                                value={settings.cutOffStrategy}
                                                onChange={(e) => handleChange('cutOffStrategy', parseInt(e.target.value))}
                                                className="modern-select"
                                            >
                                                <option value={1}>{t('settings.cutoff.strategy1')}</option>
                                                <option value={2}>{t('settings.cutoff.strategy2')}</option>
                                                <option value={3}>{t('settings.cutoff.strategy3')}</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Nightly Curfew */}
                        <div className="settings-card-section">
                            <div className="card-section-header">
                                <div className="card-title-group">
                                    <Clock size={20} className="card-icon" />
                                    <h2 className="card-title-text">Apagado Nocturno</h2>
                                </div>
                                <input
                                    id="curfewEnabled"
                                    type="checkbox"
                                    checked={settings.curfew?.enabled || false}
                                    onChange={(e) => handleNestedChange('curfew', 'enabled', e.target.checked)}
                                    className="toggle-checkbox"
                                />
                            </div>

                            {settings.curfew?.enabled && (
                                <div className="settings-card-content curfew-grid">
                                    <div className="curfew-col">
                                        <label htmlFor="curfewStartTime" className="curfew-label">
                                            <Clock size={14} /> Apagado
                                        </label>
                                        <div className="settings-card-input-wrapper">
                                            <input
                                                id="curfewStartTime"
                                                type="time"
                                                value={settings.curfew?.startTime || '00:05'}
                                                onChange={(e) => handleNestedChange('curfew', 'startTime', e.target.value)}
                                                className="modern-time-input"
                                            />
                                            <Clock size={16} className="input-inner-icon" />
                                        </div>
                                    </div>
                                    <div className="curfew-col">
                                        <label htmlFor="curfewEndTime" className="curfew-label">
                                            <Clock size={14} /> Encendido
                                        </label>
                                        <div className="settings-card-input-wrapper">
                                            <input
                                                id="curfewEndTime"
                                                type="time"
                                                value={settings.curfew?.endTime || '04:00'}
                                                onChange={(e) => handleNestedChange('curfew', 'endTime', e.target.value)}
                                                className="modern-time-input"
                                            />
                                            <Clock size={16} className="input-inner-icon" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* General Settings */}
                        <div className="settings-card-section">
                            <div className="card-section-header">
                                <div className="card-title-group">
                                    <Database size={20} className="card-icon" />
                                    <h2 className="card-title-text">Ajustes Generales</h2>
                                </div>
                            </div>

                            <div className="settings-card-content general-form">
                                <div className="settings-form-row">
                                    <div className="settings-form-group">
                                        <label htmlFor="dailyRate">Tarifa Diaria base (COP)</label>
                                        <div className="modern-input-box">
                                            <span className="prefix">$</span>
                                            <input
                                                id="dailyRate"
                                                type="number"
                                                value={settings.contractDefaults?.dailyRate || 35000}
                                                onChange={(e) => handleNestedChange('contractDefaults', 'dailyRate', parseInt(e.target.value))}
                                                placeholder="35000"
                                            />
                                            <i className="info-icon-mobile" title={t('settings.general.dailyRateDesc')}>i</i>
                                        </div>
                                    </div>

                                    <div className="settings-form-group">
                                        <label htmlFor="contractDays">Días de Contrato</label>
                                        <div className="modern-input-box">
                                            <input
                                                id="contractDays"
                                                type="number"
                                                value={settings.contractDefaults?.contractDays || 500}
                                                onChange={(e) => handleNestedChange('contractDefaults', 'contractDays', parseInt(e.target.value))}
                                                placeholder="500"
                                            />
                                            <span className="suffix">días</span>
                                            <i className="info-icon-mobile" title={t('settings.general.contractDaysDesc')}>i</i>
                                        </div>
                                    </div>
                                </div>

                                <div className="settings-form-row">
                                    <div className="settings-form-group">
                                        <label htmlFor="freeDayPolicy">Política de Días Libres</label>
                                        <div className="modern-input-box">
                                            <select
                                                id="freeDayPolicy"
                                                value={settings.contractDefaults?.freeDayPolicy || 'FLEXIBLE'}
                                                onChange={(e) => handleNestedChange('contractDefaults', 'freeDayPolicy', e.target.value)}
                                            >
                                                <option value="FLEXIBLE">{t('settings.general.policyFlexible')}</option>
                                                <option value="FIXED_WEEKDAY">{t('settings.general.policyFixed')}</option>
                                            </select>
                                        </div>
                                    </div>

                                    {settings.contractDefaults?.freeDayPolicy !== 'FIXED_WEEKDAY' ? (
                                        <div className="settings-form-group">
                                            <label htmlFor="freeDaysLimit">Límite de Días Libres</label>
                                            <div className="modern-input-box">
                                                <input
                                                    id="freeDaysLimit"
                                                    type="number"
                                                    value={settings.contractDefaults?.freeDaysLimit || 4}
                                                    onChange={(e) => handleNestedChange('contractDefaults', 'freeDaysLimit', parseInt(e.target.value))}
                                                    placeholder="4"
                                                />
                                                <span className="suffix">días</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="settings-form-group">
                                            <label htmlFor="fixedFreeDayOfWeek">Día Libre Fijo</label>
                                            <div className="modern-input-box">
                                                <select
                                                    id="fixedFreeDayOfWeek"
                                                    value={settings.contractDefaults?.fixedFreeDayOfWeek || 0}
                                                    onChange={(e) => handleNestedChange('contractDefaults', 'fixedFreeDayOfWeek', parseInt(e.target.value))}
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
                                        </div>
                                    )}
                                </div>

                                <div className="settings-inline-row">
                                    <div className="settings-form-group" style={{ flex: 1 }}>
                                        <label htmlFor="initialFee">Cuota Inicial</label>
                                        <div className="modern-input-box">
                                            <span className="prefix">$</span>
                                            <input
                                                id="initialFee"
                                                type="number"
                                                value={settings.contractDefaults?.initialFee || 0}
                                                onChange={(e) => handleNestedChange('contractDefaults', 'initialFee', parseInt(e.target.value))}
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                    <div className="settings-form-group" style={{ flex: 1 }}>
                                        <label htmlFor="currency">Moneda</label>
                                        <select
                                            id="currency"
                                            value={settings.currency}
                                            onChange={(e) => handleChange('currency', e.target.value)}
                                            className="modern-select"
                                        >
                                            <option value="COP">COP</option>
                                            <option value="USD">USD</option>
                                            <option value="EUR">EUR</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="settings-card-row">
                                    <label htmlFor="timezone">Zona Horaria</label>
                                    <select
                                        id="timezone"
                                        value={settings.timezone}
                                        onChange={(e) => handleChange('timezone', e.target.value)}
                                        className="modern-select"
                                    >
                                        <option value="America/Bogota">America/Bogota (UTC-5)</option>
                                        <option value="America/New_York">America/New_York (UTC-5)</option>
                                        <option value="America/Los_Angeles">America/Los_Angeles (UTC-8)</option>
                                        <option value="Europe/London">Europe/London (UTC+0)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Costos Fijos del Contrato */}
                        <div className="settings-card-section">
                            <div className="card-section-header">
                                <div className="card-title-group">
                                    <DollarSign size={20} className="card-icon" />
                                    <div>
                                        <h2 className="card-title-text">Costos Fijos del Contrato</h2>
                                        <p className="card-subheading">
                                            Valores base y gastos fijos asociados a la configuración de contratos
                                        </p>
                                    </div>
                                </div>
                                <div className="contract-accordion-badge">
                                    Total: {formatCurrency(
                                        (Number(settings.contractDefaults?.fixedCosts?.gps) || 0) +
                                        (Number(settings.contractDefaults?.fixedCosts?.soatPosterior) || 0) +
                                        (Number(settings.contractDefaults?.fixedCosts?.traspasoPosterior) || 0) +
                                        (Number(settings.contractDefaults?.fixedCosts?.registro) || 0)
                                    )}
                                </div>
                            </div>

                            <div className="settings-card-content general-form">
                                <div className="settings-form-row">
                                    <div className="settings-form-group">
                                        <label htmlFor="fixedCostGps">GPS</label>
                                        <div className="modern-input-box">
                                            <span className="prefix">$</span>
                                            <input
                                                id="fixedCostGps"
                                                type="number"
                                                value={settings.contractDefaults?.fixedCosts?.gps ?? 500000}
                                                onChange={(e) => handleFixedCostChange('gps', parseInt(e.target.value, 10) || 0)}
                                                placeholder="500000"
                                            />
                                            <span className="suffix">COP</span>
                                        </div>
                                    </div>

                                    <div className="settings-form-group">
                                        <label htmlFor="fixedCostSoat">SOAT posterior (x2)</label>
                                        <div className="modern-input-box">
                                            <span className="prefix">$</span>
                                            <input
                                                id="fixedCostSoat"
                                                type="number"
                                                value={settings.contractDefaults?.fixedCosts?.soatPosterior ?? 370000}
                                                onChange={(e) => handleFixedCostChange('soatPosterior', parseInt(e.target.value, 10) || 0)}
                                                placeholder="370000"
                                            />
                                            <span className="suffix">COP</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="settings-form-row">
                                    <div className="settings-form-group">
                                        <label htmlFor="fixedCostTraspaso">Traspaso posterior</label>
                                        <div className="modern-input-box">
                                            <span className="prefix">$</span>
                                            <input
                                                id="fixedCostTraspaso"
                                                type="number"
                                                value={settings.contractDefaults?.fixedCosts?.traspasoPosterior ?? 273000}
                                                onChange={(e) => handleFixedCostChange('traspasoPosterior', parseInt(e.target.value, 10) || 0)}
                                                placeholder="273000"
                                            />
                                            <span className="suffix">COP</span>
                                        </div>
                                    </div>

                                    <div className="settings-form-group">
                                        <label htmlFor="fixedCostRegistro">Registro</label>
                                        <div className="modern-input-box">
                                            <span className="prefix">$</span>
                                            <input
                                                id="fixedCostRegistro"
                                                type="number"
                                                value={settings.contractDefaults?.fixedCosts?.registro ?? 217000}
                                                onChange={(e) => handleFixedCostChange('registro', parseInt(e.target.value, 10) || 0)}
                                                placeholder="217000"
                                            />
                                            <span className="suffix">COP</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── PARÁMETROS FINANCIEROS DEL CONTRATO ── */}
                        <div className="settings-card-section" style={{ marginTop: '1.5rem' }}>
                            <div className="card-section-header">
                                <div className="card-title-group">
                                    <Percent size={20} className="card-icon" />
                                    <div>
                                        <h2 className="card-title-text">
                                            Parámetros Financieros del Contrato
                                        </h2>
                                        <p className="card-subheading">
                                            Tasas, impuestos y proporciones utilizadas en el cálculo matemático y financiero del contrato
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="settings-card-content general-form">
                                <div className="settings-form-row">
                                    <div className="settings-form-group">
                                        <label htmlFor="finIva">IVA Intereses / Cálculo</label>
                                        <div className="modern-input-box">
                                            <input
                                                id="finIva"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="1"
                                                value={settings.contractDefaults?.financialParameters?.iva ?? 0.19}
                                                onChange={(e) => handleFinancialParamChange('iva', parseFloat(e.target.value) || 0)}
                                                placeholder="0.19"
                                            />
                                            <span className="suffix">{(Number(settings.contractDefaults?.financialParameters?.iva ?? 0.19) * 100).toFixed(0)}%</span>
                                        </div>
                                    </div>

                                    <div className="settings-form-group">
                                        <label htmlFor="finObjetivoEA">Tasa Objetivo E.A.</label>
                                        <div className="modern-input-box">
                                            <input
                                                id="finObjetivoEA"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="2"
                                                value={settings.contractDefaults?.financialParameters?.objetivoEA ?? 0.29}
                                                onChange={(e) => handleFinancialParamChange('objetivoEA', parseFloat(e.target.value) || 0)}
                                                placeholder="0.29"
                                            />
                                            <span className="suffix">{(Number(settings.contractDefaults?.financialParameters?.objetivoEA ?? 0.29) * 100).toFixed(1)}%</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="settings-form-row">
                                    <div className="settings-form-group">
                                        <label htmlFor="finPagosPorAnio">Pagos por Año</label>
                                        <div className="modern-input-box">
                                            <input
                                                id="finPagosPorAnio"
                                                type="number"
                                                step="1"
                                                min="1"
                                                max="366"
                                                value={settings.contractDefaults?.financialParameters?.pagosPorAnio ?? 312}
                                                onChange={(e) => handleFinancialParamChange('pagosPorAnio', parseInt(e.target.value, 10) || 312)}
                                                placeholder="312"
                                            />
                                            <span className="suffix">días/año</span>
                                        </div>
                                    </div>

                                    <div className="settings-form-group">
                                        <label htmlFor="finProporcionUPAY">Proporción UPAY / Pocketbike</label>
                                        <div className="modern-input-box">
                                            <input
                                                id="finProporcionUPAY"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="1"
                                                value={settings.contractDefaults?.financialParameters?.proporcionUPAY ?? 0.95}
                                                onChange={(e) => handleFinancialParamChange('proporcionUPAY', parseFloat(e.target.value) || 0)}
                                                placeholder="0.95"
                                            />
                                            <span className="suffix">{(Number(settings.contractDefaults?.financialParameters?.proporcionUPAY ?? 0.95) * 100).toFixed(0)}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── INTEGRATIONS TAB ── */}
                {activeTab === 'integrations' && (
                    <div className="integrations-container">
                        {/* ── SECCIÓN 1: Conexión al Servidor GPS ── */}
                        <div className="integrations-card">
                            <div className="integrations-section-header">
                                <div className="integrations-section-title-group">
                                    <div className="integrations-section-icon">
                                        <Server size={20} />
                                    </div>
                                    <div>
                                        <h3 className="integrations-section-title">Servidor</h3>
                                    </div>
                                </div>
                            </div>

                            {/* Selector de Proveedor */}
                            <div className="integrations-field-group">
                                <label className="integrations-field-label">
                                    Proveedor de Telemetría <span className="required-star">*</span>
                                </label>
                                <div className="integrations-provider-box">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flex: 1, minWidth: 0 }}>
                                        <Radio size={20} className="provider-radio-icon" />
                                        <select
                                            id="gpsService"
                                            value={settings.gpsService || 'traccar'}
                                            onChange={(e) => handleChange('gpsService', e.target.value)}
                                            className="integrations-provider-select"
                                        >
                                            <option value="traccar">Traccar GPS Enterprise Engine</option>
                                            <option value="megarastreo">MegaRastreo GPS Engine</option>
                                        </select>
                                    </div>
                                    {settings.gpsService === 'traccar' && (
                                        <span className="badge-oficial">OFICIAL</span>
                                    )}
                                </div>
                            </div>

                            {/* MegaRastreo Fields */}
                            {settings.gpsService === 'megarastreo' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div className="integrations-field-group">
                                        <label className="integrations-field-label">{t('settings.integrations.megarastreoUsername')}</label>
                                        <div className="integrations-input-box">
                                            <User size={18} className="field-prefix-icon" />
                                            <input
                                                className="integrations-input"
                                                id="mrUser"
                                                type="text"
                                                value={settings.gpsConfig?.user || ''}
                                                onChange={(e) => handleNestedChange('gpsConfig', 'user', e.target.value)}
                                                placeholder="Usuario MegaRastreo"
                                            />
                                        </div>
                                    </div>
                                    <div className="integrations-field-group">
                                        <label className="integrations-field-label">{t('settings.integrations.megarastreoPassword')}</label>
                                        <div className="integrations-input-box">
                                            <Key size={18} className="field-prefix-icon" />
                                            <input
                                                className="integrations-input"
                                                id="mrPass"
                                                type={showTraccarPassword ? 'text' : 'password'}
                                                value={settings.gpsConfig?.password || ''}
                                                onChange={(e) => handleNestedChange('gpsConfig', 'password', e.target.value)}
                                                placeholder="Contraseña MegaRastreo"
                                                style={{ letterSpacing: showTraccarPassword ? 'normal' : '0.15em' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowTraccarPassword(!showTraccarPassword)}
                                                className="btn-input-eye-toggle"
                                                aria-label="Alternar visibilidad de contraseña"
                                            >
                                                {showTraccarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Traccar Fields */}
                            {settings.gpsService === 'traccar' && (
                                <>
                                    {/* Host Traccar */}
                                    <div className="integrations-field-group">
                                        <label className="integrations-field-label">Host Traccar</label>
                                        <div className="integrations-input-box">
                                            <Globe size={18} className="field-prefix-icon" />
                                            <input
                                                className="integrations-input"
                                                id="input-host"
                                                type="text"
                                                value={settings.gpsConfig?.host || ''}
                                                onChange={(e) => handleNestedChange('gpsConfig', 'host', e.target.value)}
                                                placeholder="ej. pocketbike.app"
                                            />
                                        </div>
                                    </div>

                                    {/* Usuario y Contraseña Grid */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {/* Usuario */}
                                        <div className="integrations-field-group">
                                            <label className="integrations-field-label">Usuario / Operador</label>
                                            <div className="integrations-input-box">
                                                <User size={18} className="field-prefix-icon" />
                                                <input
                                                    className="integrations-input"
                                                    id="input-user"
                                                    type="text"
                                                    value={settings.gpsConfig?.user || ''}
                                                    onChange={(e) => handleNestedChange('gpsConfig', 'user', e.target.value)}
                                                    placeholder="Usuario administrador"
                                                />
                                            </div>
                                        </div>

                                        {/* Contraseña */}
                                        <div className="integrations-field-group">
                                            <label className="integrations-field-label">Contraseña de Telemetría</label>
                                            <div className="integrations-input-box">
                                                <Key size={18} className="field-prefix-icon" />
                                                <input
                                                    className="integrations-input"
                                                    id="input-password"
                                                    type={showTraccarPassword ? 'text' : 'password'}
                                                    value={settings.gpsConfig?.password || ''}
                                                    onChange={(e) => handleNestedChange('gpsConfig', 'password', e.target.value)}
                                                    placeholder="Contraseña"
                                                    style={{ letterSpacing: showTraccarPassword ? 'normal' : '0.15em' }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowTraccarPassword(!showTraccarPassword)}
                                                    className="btn-input-eye-toggle"
                                                    aria-label="Alternar visibilidad de contraseña"
                                                >
                                                    {showTraccarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Botón de Test y Latencia Card */}
                                    <div style={{ paddingTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <button
                                            type="button"
                                            className="btn-validate-traccar"
                                            id="btn-validate-connection"
                                            onClick={handleValidateTraccar}
                                            disabled={isValidatingTraccar || !settings.gpsConfig?.user}
                                        >
                                            <RefreshCw size={18} className={isValidatingTraccar ? 'spinning' : ''} />
                                            <span>{isValidatingTraccar ? 'Validando conexión...' : 'Validar Conexión Traccar'}</span>
                                        </button>

                                        {traccarValidationResult && (
                                            <div className="traccar-status-pill" id="connection-status-pill">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span
                                                        className={`status-dot-pulse ${traccarValidationResult.success ? 'status-dot-success' : 'status-dot-error'}`}
                                                    />
                                                    <span className="connection-status-label">
                                                        {traccarValidationResult.message}
                                                    </span>
                                                </div>
                                                {traccarValidationResult.success && (
                                                    <span className="connection-status-badge">
                                                        Traccar HTTP 200
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* ── SECCIÓN 2: Estado de Vinculación y Eventos Telemétricos (Traccar) ── */}
                        {settings.gpsService === 'traccar' && (
                            <div className="integrations-card">
                                <div className="integrations-section-header">
                                    <div className="integrations-section-title-group">
                                        <div className="integrations-section-icon">
                                            <ShieldCheck size={20} />
                                        </div>
                                        <div>
                                            <h3 className="integrations-section-title">Eventos Telemétricos</h3>
                                            <p className="integrations-section-subtitle">Reglas de eventos y hardware IoT</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Linked Group Badge Banner */}
                                <div className="linked-group-banner">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                                        <div className="group-badge-icon">
                                            <Check size={14} />
                                        </div>
                                        <p className="group-badge-title">
                                            {settings.gpsConfig?.groupId ? `Grupo vinculado: ID ${settings.gpsConfig.groupId}` : 'Sin grupo vinculado'}
                                        </p>
                                    </div>
                                    <span className="group-badge-counter">
                                        Canales {[traccarNotifs.batteryAlerts, traccarNotifs.geofenceAlerts, traccarNotifs.vibrationAlerts].filter(Boolean).length}/3
                                    </span>
                                </div>

                                {/* Canales de Alerta Activos (Switches táctiles modernos) */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {/* Canal 1: Batería */}
                                    <div className="telemetry-channel-item">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                                            <div className="channel-icon-box channel-icon-amber">
                                                <Zap size={20} />
                                            </div>
                                            <p className="channel-title truncate">Alerta Batería Baja / Desconexión</p>
                                        </div>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={Boolean(traccarNotifs.batteryAlerts)}
                                            disabled={isUpdatingTraccarNotif || isLoadingTraccarNotifs}
                                            onClick={() => handleToggleTraccarNotif('batteryAlerts', !traccarNotifs.batteryAlerts)}
                                            className={`switch-control-btn ${traccarNotifs.batteryAlerts ? 'checked' : 'unchecked'}`}
                                        >
                                            <span className="switch-knob" />
                                        </button>
                                    </div>

                                    {/* Canal 2: Geocerca */}
                                    <div className="telemetry-channel-item">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                                            <div className="channel-icon-box channel-icon-sky">
                                                <MapPin size={20} />
                                            </div>
                                            <p className="channel-title truncate">Control de Geocercas</p>
                                        </div>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={Boolean(traccarNotifs.geofenceAlerts)}
                                            disabled={isUpdatingTraccarNotif || isLoadingTraccarNotifs}
                                            onClick={() => handleToggleTraccarNotif('geofenceAlerts', !traccarNotifs.geofenceAlerts)}
                                            className={`switch-control-btn ${traccarNotifs.geofenceAlerts ? 'checked' : 'unchecked'}`}
                                        >
                                            <span className="switch-knob" />
                                        </button>
                                    </div>

                                    {/* Canal 3: Vibración / Sabotaje */}
                                    <div className="telemetry-channel-item">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                                            <div className="channel-icon-box channel-icon-purple">
                                                <Bell size={20} />
                                            </div>
                                            <p className="channel-title truncate">Sensor Vibración / Movimiento</p>
                                        </div>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={Boolean(traccarNotifs.vibrationAlerts)}
                                            disabled={isUpdatingTraccarNotif || isLoadingTraccarNotifs}
                                            onClick={() => handleToggleTraccarNotif('vibrationAlerts', !traccarNotifs.vibrationAlerts)}
                                            className={`switch-control-btn ${traccarNotifs.vibrationAlerts ? 'checked' : 'unchecked'}`}
                                        >
                                            <span className="switch-knob" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── SECCIÓN 3: Claves de API & Seguridad (Wompi) ── */}
                        <div className="integrations-card">
                            <div className="integrations-section-header">
                                <div className="integrations-section-title-group">
                                    <div className="integrations-section-icon">
                                        <Key size={20} />
                                    </div>
                                    <div>
                                        <h3 className="integrations-section-title">Credenciales API &amp; Webhooks (Wompi)</h3>
                                    </div>
                                </div>
                            </div>

                            {/* 1. Llave Pública (API Token) */}
                            <div className="integrations-field-group">
                                <label className="integrations-field-label">{t('settings.integrations.publicKey')}</label>
                                <div className="integrations-input-box">
                                    <input
                                        className="integrations-input"
                                        id="public-token"
                                        type="text"
                                        value={settings.wompiConfig?.publicKey || ''}
                                        onChange={(e) => handleNestedChange('wompiConfig', 'publicKey', e.target.value)}
                                        placeholder="pub_prod_... o pub_test_..."
                                        onClick={(e) => e.target.select()}
                                    />
                                </div>
                            </div>

                            {/* 2. Llave Privada (Webhook Secret) */}
                            <div className="integrations-field-group">
                                <label className="integrations-field-label">{t('settings.integrations.privateKey')}</label>
                                <div className="integrations-input-box">
                                    <input
                                        className="integrations-input"
                                        id="private-secret"
                                        type={showWompiPrivKey ? 'text' : 'password'}
                                        value={settings.wompiConfig?.privateKey || ''}
                                        onChange={(e) => handleNestedChange('wompiConfig', 'privateKey', e.target.value)}
                                        placeholder="prv_prod_... o prv_test_..."
                                        style={{ letterSpacing: showWompiPrivKey ? 'normal' : '0.15em' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowWompiPrivKey(!showWompiPrivKey)}
                                        className="btn-input-eye-toggle"
                                        aria-label="Revelar Llave Privada"
                                    >
                                        {showWompiPrivKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* 3. Secreto de Integridad */}
                            <div className="integrations-field-group">
                                <label className="integrations-field-label">{t('settings.integrations.integritySecret')}</label>
                                <div className="integrations-input-box">
                                    <input
                                        className="integrations-input"
                                        id="integrity-secret"
                                        type={showWompiIntegrity ? 'text' : 'password'}
                                        value={settings.wompiConfig?.integritySecret || ''}
                                        onChange={(e) => handleNestedChange('wompiConfig', 'integritySecret', e.target.value)}
                                        placeholder="prod_integrity_... o test_integrity_..."
                                        style={{ letterSpacing: showWompiIntegrity ? 'normal' : '0.15em' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowWompiIntegrity(!showWompiIntegrity)}
                                        className="btn-input-eye-toggle"
                                        aria-label="Revelar Secreto de Integridad"
                                    >
                                        {showWompiIntegrity ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* 4. Secreto de Eventos */}
                            <div className="integrations-field-group">
                                <label className="integrations-field-label">{t('settings.integrations.eventsSecret')}</label>
                                <div className="integrations-input-box">
                                    <input
                                        className="integrations-input"
                                        id="events-secret"
                                        type={showWompiEvents ? 'text' : 'password'}
                                        value={settings.wompiConfig?.eventsSecret || ''}
                                        onChange={(e) => handleNestedChange('wompiConfig', 'eventsSecret', e.target.value)}
                                        placeholder="prod_events_... o test_events_..."
                                        style={{ letterSpacing: showWompiEvents ? 'normal' : '0.15em' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowWompiEvents(!showWompiEvents)}
                                        className="btn-input-eye-toggle"
                                        aria-label="Revelar Secreto de Eventos"
                                    >
                                        {showWompiEvents ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Método de Pago Wompi Toggle Pill */}
                            <div className="wompi-method-section">
                                <label className="integrations-field-label">Método de Pago Wompi</label>
                                <div 
                                    className={`wompi-toggle-pill ${settings.wompiConfig?.paymentMethod === 'BANCOLOMBIA_QR' ? 'is-qr' : 'is-nequi'}`} 
                                    role="radiogroup" 
                                    aria-label="Método de Pago Wompi"
                                >
                                    <div className="wompi-toggle-indicator" aria-hidden="true" />
                                    <button
                                        type="button"
                                        id="btn-pay-nequi"
                                        onClick={() => handleNestedChange('wompiConfig', 'paymentMethod', 'NEQUI_PUSH')}
                                        className={`wompi-toggle-btn ${(settings.wompiConfig?.paymentMethod ?? 'NEQUI_PUSH') === 'NEQUI_PUSH' ? 'active' : 'inactive'}`}
                                    >
                                        <BellRing size={18} />
                                        <span>Nequi Push</span>
                                    </button>
                                    <button
                                        type="button"
                                        id="btn-pay-bancolombia"
                                        onClick={() => handleNestedChange('wompiConfig', 'paymentMethod', 'BANCOLOMBIA_QR')}
                                        className={`wompi-toggle-btn ${settings.wompiConfig?.paymentMethod === 'BANCOLOMBIA_QR' ? 'active' : 'inactive'}`}
                                    >
                                        <QrCode size={18} />
                                        <span>Bancolombia QR</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── SYSTEM TAB ── */}
                {activeTab === 'system' && (
                    <div className="settings-section">
                        <div className="info-grid">
                            <div className="info-item">
                                <div className="info-label">{t('settings.system.version')}</div>
                                <div className="info-value">1.0.0</div>
                            </div>
                            <div className="info-item">
                                <div className="info-label">{t('settings.system.dbStatus')}</div>
                                <div className="info-value status-connected">{t('settings.system.connected')}</div>
                            </div>
                            <div className="info-item">
                                <div className="info-label">{t('settings.system.apiStatus')}</div>
                                <div className="info-value status-connected">{t('settings.system.active')}</div>
                            </div>
                            <div className="info-item">
                                <div className="info-label">{t('settings.system.lastBackup')}</div>
                                <div className="info-value">{t('settings.system.never')}</div>
                            </div>
                        </div>

                        {/* Sync Devices */}
                        <div className="setting-item sync-devices-row">
                            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>{t('settings.system.discoveryTitle')}</h3>
                            <p className="setting-description" style={{ marginBottom: '1.25rem' }}>
                                {t('settings.system.discoveryDesc')}
                            </p>
                            <div className="sync-devices-controls">
                                <button
                                    className={`btn-sync-devices ${syncState.loading ? 'loading' : ''}`}
                                    onClick={handleSyncDevices}
                                    disabled={syncState.loading}
                                    title="Fetch devices from GPS provider"
                                >
                                    <RefreshCw size={15} className={syncState.loading ? 'spin' : ''} />
                                    {syncState.loading ? t('settings.system.syncing') : t('settings.system.syncNow')}
                                </button>
                                {syncState.result && (
                                    <span className="sync-result success">
                                        ✓ {syncState.result.message}
                                    </span>
                                )}
                                {syncState.error && (
                                    <span className="sync-result error">✗ {syncState.error}</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Save All Button */}
                <div className="settings-actions">
                    <button
                        className={`btn-save ${saved ? 'btn-saved' : ''}`}
                        onClick={handleSave}
                    >
                        <Save />
                        {saved ? t('settings.actions.allSaved') : t('settings.actions.saveAll')}
                    </button>
                </div>
            </div>

            {/* Crop Modal */}
            {showCropModal && (
                <div className="crop-modal-overlay">
                    <div className="crop-modal-content">
                        <h3 className="crop-modal-title">{t('settings.crop.title')}</h3>

                        <div className="crop-canvas-container">
                            <canvas
                                ref={canvasRef}
                                width={600}
                                height={600}
                                className="crop-canvas"
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                onWheel={handleWheel}
                            />
                        </div>

                        <div className="crop-controls">
                            <div className="zoom-controls">
                                <button
                                    className="btn-zoom"
                                    onClick={handleZoomOut}
                                    title="Zoom Out"
                                >
                                    <ZoomOut size={20} />
                                </button>

                                <input
                                    type="range"
                                    min="0.5"
                                    max="3"
                                    step="0.01"
                                    value={zoom}
                                    onChange={handleZoomChange}
                                    className="zoom-slider"
                                />

                                <button
                                    className="btn-zoom"
                                    onClick={handleZoomIn}
                                    title="Zoom In"
                                >
                                    <ZoomIn size={20} />
                                </button>
                            </div>

                            <p className="crop-hint">{t('settings.crop.hint')}</p>
                        </div>

                        <div className="crop-actions">
                            <button
                                className="btn-cancel"
                                onClick={closeCropModal}
                            >
                                {t('settings.crop.cancel')}
                            </button>
                            <button
                                className="btn-crop"
                                onClick={performCrop}
                            >
                                {t('settings.crop.save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
