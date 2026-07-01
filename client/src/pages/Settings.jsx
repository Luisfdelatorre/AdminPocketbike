import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import { Settings as SettingsIcon, DollarSign, Clock, Database, Save, Image as ImageIcon, Edit2, ZoomIn, ZoomOut, RefreshCw, Upload, Building, ArrowLeft } from 'lucide-react';
import { getSettings, updateSettings, syncDevices } from '../services/api';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './Settings.css';

const Settings = () => {
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
            emailDomain: 'pocketbike.app'
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
            eventsSecret: ''
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
    const [portalElement, setPortalElement] = useState(null);

    useEffect(() => {
        setPortalElement(document.getElementById('mobile-header-actions'));
    }, []);


    const handleSyncDevices = async () => {
        setSyncState({ loading: true, result: null, error: null });
        try {
            const res = await syncDevices();
            setSyncState({ loading: false, result: res, error: null });
        } catch (err) {
            setSyncState({ loading: false, result: null, error: err.message || 'Sync failed' });
        }
    };

    const canvasRef = useRef(null);
    const imageRef = useRef(null);

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
                    setSettings(prev => ({
                        ...prev,
                        ...rest,
                        contractDefaults: {
                            ...prev.contractDefaults,
                            ...(rest.contractDefaults || {})
                        },
                        companyLogo: rest.logo || prev.companyLogo // Map logo to companyLogo for state
                    }));
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
        ctx.strokeStyle = '#3b82f6';
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

    const handleSave = async () => {
        await handleSaveSection('all');
    };

    const handleSaveSection = async (section) => {
        setSavingSections(prev => ({ ...prev, [section]: true }));
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('auth_token');

            // Prepare payload based on section
            let payload = {};
            if (section === 'all') {
                payload = { ...settings, logo: settings.companyLogo };
            } else if (section === 'branding') {
                payload = {
                    displayName: settings.displayName,
                    logo: settings.companyLogo
                };
            } else if (section === 'gps') {
                payload = {
                    gpsService: settings.gpsService,
                    gpsConfig: settings.gpsConfig
                };
            } else if (section === 'wompi') {
                payload = {
                    wompiConfig: settings.wompiConfig
                };
            } else if (section === 'cutoff') {
                payload = {
                    automaticCutOff: settings.automaticCutOff,
                    cutOffTime: settings.cutOffTime,
                    cutOffStrategy: settings.cutOffStrategy
                };
            } else if (section === 'curfew') {
                payload = {
                    curfew: settings.curfew
                };
            } else if (section === 'general') {
                payload = {
                    currency: settings.currency,
                    timezone: settings.timezone,
                    contractDefaults: settings.contractDefaults
                };
            }

            const data = await updateSettings(payload);

            if (data.success) {
                console.log(`${section} settings saved successfully`);

                // Mark section as saved
                setSavedSections(prev => ({ ...prev, [section]: true }));
                setTimeout(() => {
                    setSavedSections(prev => ({ ...prev, [section]: false }));
                }, 3000);

                if (section === 'all' || section === 'branding') {
                    localStorage.setItem('companyLogo', settings.companyLogo);
                    localStorage.setItem('displayName', settings.displayName);
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

    return (
        <div className="settings-page">
            {portalElement && createPortal(
                <button
                    onClick={handleSave}
                    className="btn-header-save"
                    title={t('settings.actions.save')}
                    style={{ border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '8px' }}
                >
                    <Save size={20} style={{ color: '#0d9488' }} />
                </button>,
                portalElement
            )}
            {/* Header */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>⚙️ {t('settings.title')}</h1>
                    <p style={{ margin: '4px 0 0 0', color: '#6B7280', fontSize: '14px' }} className="desktop-only">{t('settings.subtitle')}</p>
                </div>
                <button
                    onClick={handleSave}
                    className="btn-header-save"
                    title={t('settings.actions.save')}
                    style={{ background: '#f0fdfa', border: '1px solid #0d9488', color: '#0d9488', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                    <Save size={18} />
                </button>
            </div>

            {/* Settings Sections */}
            <div className="settings-container">
                {/* Settings Tabs */}
                <div className="settings-tabs">
                    <button
                        className={`tab-button ${activeTab === 'branding' ? 'active' : ''}`}
                        onClick={() => setActiveTab('branding')}
                    >
                        <ImageIcon size={18} /> {t('settings.tabs.branding')}
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
                    <div className="settings-card-section">
                        <div className="card-section-header" style={{ marginBottom: '1rem' }}>
                            <div className="card-title-group">
                                <Building size={20} className="card-icon" style={{ color: '#0d9488' }} />
                                <h2 style={{ fontSize: '1rem', color: '#0f172a', margin: 0 }}>Configuración de Empresa</h2>
                            </div>
                            <i className="info-icon-mobile" title={t('settings.branding.displayNameDesc')}>i</i>
                        </div>

                        <div className="setting-item" style={{ marginBottom: '1rem' }}>
                            <label htmlFor="displayName" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <ImageIcon size={16} />
                                    Nombre visible de la Empresa
                                </span>
                                <i className="info-icon-mobile" title={t('settings.branding.displayNameDesc')}>i</i>
                            </label>
                            <input
                                id="displayName"
                                type="text"
                                value={settings.displayName}
                                onChange={(e) => handleChange('displayName', e.target.value)}
                                placeholder="PocketBike"
                                className="input-display-name"
                            />
                            <div className="settings-inline-row">
                                <div className="settings-form-group" style={{ flex: 1 }}>
                                    <label htmlFor="emailDomain" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Dominio de Correo por Defecto</span>
                                        <i className="info-icon-mobile" title={t('settings.branding.emailDomainDesc')}></i>
                                    </label>
                                    <div className="input-group" style={{ display: 'flex', gap: '0.5rem' }}>
                                        <div style={{ background: '#F1F5F9', border: '1px solid #D1D5DB', padding: '0.875rem 1.25rem', borderRadius: '0.5rem', color: '#6B7280', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>@</div>
                                        <input
                                            id="emailDomain"
                                            type="text"
                                            value={settings.contractDefaults?.emailDomain || 'pocketbike.app'}
                                            onChange={(e) => handleNestedChange('contractDefaults', 'emailDomain', e.target.value)}
                                            placeholder="pocketbike.app"
                                            className="input-display-name"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="setting-item" style={{ marginBottom: 0 }}>
                                <label htmlFor="companyLogo" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <ImageIcon size={16} />
                                    LOGO DE LA EMPRESA
                                </label>
                                <div className="branding-upload-area" style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', alignItems: 'center' }}>
                                    <div
                                        className="current-logo-container"
                                        onClick={() => document.getElementById('companyLogo').click()}
                                        style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '12px', cursor: 'pointer' }}
                                    >
                                        <img
                                            src={settings.companyLogo}
                                            alt={t('settings.branding.logo')}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }}
                                            onError={(e) => {
                                                e.target.src = '/pocketbike_60x60.jpg';
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="btn-edit-logo"
                                            onClick={(e) => { e.stopPropagation(); document.getElementById('companyLogo').click(); }}
                                            title={t('settings.branding.changeLogo')}
                                            style={{ position: 'absolute', bottom: '-6px', right: '-6px', width: '28px', height: '28px', borderRadius: '50%', background: '#0d9488', border: '2px solid white', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                    </div>

                                    <input
                                        id="companyLogo"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoUpload}
                                        style={{ display: 'none' }}
                                    />
                                </div>
                                <p className="upload-hint-text" style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
                                    RECOMENDADO: 60X60PX, PNG O JPG, MÁX 2MB
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── BUSINESS TAB ── */}
                {activeTab === 'business' && (
                    <div className="settings-modern-container">
                        {/* Automatic Cut-Off */}
                        <div className="settings-card-section">
                            <div className="card-section-header">
                                <div className="card-title-group">
                                    <Clock size={20} className="card-icon" style={{ color: '#0d9488' }} />
                                    <h2 style={{ fontSize: '1rem', color: '#0f172a', margin: 0 }}>Corte Automático</h2>
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
                                    <Clock size={20} className="card-icon" style={{ color: '#0d9488' }} />
                                    <h2 style={{ fontSize: '1rem', color: '#0f172a', margin: 0 }}>Apagado Nocturno</h2>
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
                                        <label htmlFor="curfewStartTime" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: '#64748b' }}>
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
                                        <label htmlFor="curfewEndTime" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: '#64748b' }}>
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
                                    <Database size={20} className="card-icon" style={{ color: '#0d9488' }} />
                                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>Ajustes Generales</h2>
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
                    </div>
                )}

                {/* ── INTEGRATIONS TAB ── */}
                {activeTab === 'integrations' && (
                    <div className="settings-section">
                        <div className="setting-item">
                            <label htmlFor="gpsService">{t('settings.integrations.selectProvider')}</label>
                            <select
                                id="gpsService"
                                value={settings.gpsService}
                                onChange={(e) => handleChange('gpsService', e.target.value)}
                            >
                                {(availableGpsServices.length
                                    ? availableGpsServices
                                    : ['megarastreo', 'traccar']
                                ).map(svc => {
                                    const GPS_LABELS = {
                                        megarastreo: 'MegaRastreo',
                                        traccar: 'Traccar'
                                    };
                                    return (
                                        <option key={svc} value={svc}>
                                            {GPS_LABELS[svc] ?? svc}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {settings.gpsService === 'megarastreo' && (
                            <div className="integration-fields">
                                <div className="setting-item">
                                    <label htmlFor="mrUser">{t('settings.integrations.megarastreoUsername')}</label>
                                    <input
                                        id="mrUser"
                                        type="text"
                                        value={settings.gpsConfig.user}
                                        onChange={(e) => handleNestedChange('gpsConfig', 'user', e.target.value)}
                                        placeholder="Enter username"
                                    />
                                </div>
                                <div className="setting-item">
                                    <label htmlFor="mrPass">{t('settings.integrations.megarastreoPassword')}</label>
                                    <input
                                        id="mrPass"
                                        type="password"
                                        value={settings.gpsConfig.password}
                                        onChange={(e) => handleNestedChange('gpsConfig', 'password', e.target.value)}
                                        placeholder="Enter password"
                                    />
                                </div>
                            </div>
                        )}

                        {settings.gpsService === 'traccar' && (
                            <div className="integration-fields">
                                <div className="setting-item">
                                    <label htmlFor="trHost">{t('settings.integrations.traccarHost')}</label>
                                    <input
                                        id="trHost"
                                        type="text"
                                        value={settings.gpsConfig.host}
                                        onChange={(e) => handleNestedChange('gpsConfig', 'host', e.target.value)}
                                        placeholder="e.g. 198.74.54.252"
                                    />
                                </div>
                                <div className="setting-item">
                                    <label htmlFor="trUser">{t('settings.integrations.traccarUser')}</label>
                                    <input
                                        id="trUser"
                                        type="text"
                                        value={settings.gpsConfig.user}
                                        onChange={(e) => handleNestedChange('gpsConfig', 'user', e.target.value)}
                                    />
                                </div>
                                <div className="setting-item">
                                    <label htmlFor="trPass">{t('settings.integrations.traccarPass')}</label>
                                    <input
                                        id="trPass"
                                        type="password"
                                        value={settings.gpsConfig.password}
                                        onChange={(e) => handleNestedChange('gpsConfig', 'password', e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Wompi */}
                        <div className="setting-item">
                            <label htmlFor="wPubKey">{t('settings.integrations.publicKey')}</label>
                            <input
                                id="wPubKey"
                                type="text"
                                value={settings.wompiConfig.publicKey}
                                onChange={(e) => handleNestedChange('wompiConfig', 'publicKey', e.target.value)}
                                placeholder="pub_test_..."
                                autoComplete="off"
                            />
                        </div>

                        <div className="setting-item">
                            <label htmlFor="wPrivKey">{t('settings.integrations.privateKey')}</label>
                            <input
                                id="wPrivKey"
                                type="password"
                                value={settings.wompiConfig.privateKey}
                                onChange={(e) => handleNestedChange('wompiConfig', 'privateKey', e.target.value)}
                                placeholder="prv_test_..."
                                autoComplete="new-password"
                            />
                        </div>

                        <div className="setting-item">
                            <label htmlFor="wInteg">{t('settings.integrations.integritySecret')}</label>
                            <input
                                id="wInteg"
                                type="password"
                                value={settings.wompiConfig.integritySecret}
                                onChange={(e) => handleNestedChange('wompiConfig', 'integritySecret', e.target.value)}
                                placeholder="test_integrity_..."
                                autoComplete="new-password"
                            />
                        </div>

                        <div className="setting-item">
                            <label htmlFor="wEvents">{t('settings.integrations.eventsSecret')}</label>
                            <input
                                id="wEvents"
                                type="password"
                                value={settings.wompiConfig.eventsSecret}
                                onChange={(e) => handleNestedChange('wompiConfig', 'eventsSecret', e.target.value)}
                                placeholder="test_events_..."
                                autoComplete="new-password"
                            />
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
                        <div className="setting-item sync-devices-row" style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #E5E7EB', display: 'block' }}>
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
                                    style={{ padding: '0.75rem 1.5rem', background: '#03C9D7', color: 'white', border: 'none', borderRadius: '0.5rem' }}
                                >
                                    <RefreshCw size={15} className={syncState.loading ? 'spin' : ''} />
                                    {syncState.loading ? t('settings.system.syncing') : t('settings.system.syncNow')}
                                </button>
                                {syncState.result && (
                                    <span className="sync-result success" style={{ marginLeft: '1rem' }}>
                                        ✓ {syncState.result.message}
                                    </span>
                                )}
                                {syncState.error && (
                                    <span className="sync-result error" style={{ marginLeft: '1rem' }}>✗ {syncState.error}</span>
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