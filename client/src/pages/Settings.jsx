import React, { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, DollarSign, Clock, Database, Save, Image as ImageIcon, Edit2, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { getSettings, updateSettings, syncDevices } from '../services/api';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './Settings.css';

const Settings = () => {
    const { t } = useTranslation();
    const [settings, setSettings] = useState({
        currency: 'COP',
        timezone: 'America/Bogota',
        contractDefaults: {
            dailyRate: 30000,
            contractDays: 500,
            freeDaysLimit: 4,
            initialFee: 0,
            emailDomain: 'tumotoya.online'
        },
        displayName: 'PocketBike',
        companyLogo: '/pocketbike_60x60.jpg',
        automaticCutOff: false,
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
    const [activeTab, setActiveTab] = useState('branding');

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
                    setSettings(prev => ({
                        ...prev,
                        ...data.data,
                        contractDefaults: {
                            ...prev.contractDefaults,
                            ...(data.data.contractDefaults || {})
                        },
                        companyLogo: data.data.logo || prev.companyLogo // Map logo to companyLogo for state
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
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1>⚙️ {t('settings.title')}</h1>
                    <p>{t('settings.subtitle')}</p>
                </div>
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

                {/* Company Branding */}
                {activeTab === 'branding' && (
                    <div className="settings-section">
                        <div className="section-header">
                            <ImageIcon size={20} />
                            <h2>{t('settings.branding.title')}</h2>
                            <button
                                className={`btn-save-section ${savedSections.branding ? 'btn-saved' : ''}`}
                                onClick={() => handleSaveSection('branding')}
                                disabled={savingSections.branding}
                            >
                                {savingSections.branding ? t('settings.actions.saving') : savedSections.branding ? t('settings.actions.saveSection') : <Save size={16} />}
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                            <div className="setting-item" style={{ flex: 1, marginBottom: 0 }}>
                                <label htmlFor="displayName">
                                    <ImageIcon size={16} />
                                    {t('settings.branding.displayName')}
                                </label>
                                <input
                                    id="displayName"
                                    type="text"
                                    value={settings.displayName}
                                    onChange={(e) => handleChange('displayName', e.target.value)}
                                    placeholder="PocketBike"
                                    className="input-display-name"
                                />
                                <p className="setting-description">
                                    {t('settings.branding.displayNameDesc')}
                                </p>
                            </div>
                            <div className="setting-item" style={{ flex: 1, marginBottom: 0 }}>
                                <label htmlFor="emailDomain">{t('settings.branding.emailDomain')}</label>
                                <div className="input-group">
                                    <span className="input-prefix" style={{ background: '#F9FAFB', border: '1px solid #D1D5DB', borderRight: 'none', padding: '0.875rem 1rem', borderRadius: '0.5rem 0 0 0.5rem', color: '#6B7280', fontSize: '1rem', display: 'flex', alignItems: 'center', height: '100%' }}>@</span>
                                    <input
                                        id="emailDomain"
                                        type="text"
                                        value={settings.contractDefaults?.emailDomain || 'tumotoya.online'}
                                        onChange={(e) => handleNestedChange('contractDefaults', 'emailDomain', e.target.value)}
                                        placeholder="tumotoya.online"
                                        className="input-display-name"
                                        style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, marginLeft: '-1rem' }}
                                    />
                                </div>
                                <p className="setting-description">
                                    {t('settings.branding.emailDomainDesc')}
                                </p>
                            </div>
                        </div>

                        <div className="setting-item">
                            <label htmlFor="companyLogo">
                                <ImageIcon size={16} />
                                {t('settings.branding.logo')}
                            </label>
                            <div className="branding-upload-area">
                                <div className="current-logo-container">
                                    <img
                                        src={settings.companyLogo}
                                        alt={t('settings.branding.logo')}
                                        onError={(e) => {
                                            e.target.src = '/pocketbike_60x60.jpg';
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="btn-edit-logo"
                                        onClick={() => document.getElementById('companyLogo').click()}
                                        title={t('settings.branding.changeLogo')}
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                </div>

                                <div
                                    className="upload-dropzone"
                                    onClick={() => document.getElementById('companyLogo').click()}
                                >
                                    <span className="upload-text">{t('settings.branding.uploadNew')}</span>
                                </div>

                                <input
                                    id="companyLogo"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    style={{ display: 'none' }}
                                />
                            </div>
                            <p className="upload-hint-text">
                                {t('settings.branding.recommended')}
                            </p>
                        </div>
                    </div>
                )}
                {/* Automatic Cut-Off & Curfew Settings */}
                {activeTab === 'business' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>

                        {/* Automatic Cut-Off Settings */}
                        <div className="settings-section">
                            <div className="section-header">
                                <Clock size={20} />
                                <h2>{t('settings.cutoff.title')}</h2>
                                <button
                                    className={`btn-save-section ${savedSections.cutoff ? 'btn-saved' : ''}`}
                                    onClick={() => handleSaveSection('cutoff')}
                                    disabled={savingSections.cutoff}
                                >
                                    {savingSections.cutoff ? t('settings.actions.saving') : savedSections.cutoff ? t('settings.actions.saveSection') : <Save size={16} />}
                                </button>
                            </div>

                            <div className="setting-item toggle-item">
                                <div className="setting-info">
                                    <label htmlFor="automaticCutOff">{t('settings.cutoff.enable')}</label>

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
                                <div className="setting-item">
                                    <label htmlFor="cutOffStrategy">{t('settings.cutoff.strategy')}</label>
                                    <select
                                        id="cutOffStrategy"
                                        value={settings.cutOffStrategy}
                                        onChange={(e) => handleChange('cutOffStrategy', parseInt(e.target.value))}
                                        className="strategy-select"
                                    >
                                        <option value={1}>{t('settings.cutoff.strategy1')}</option>
                                        <option value={2}>{t('settings.cutoff.strategy2')}</option>
                                        <option value={3}>{t('settings.cutoff.strategy3')}</option>
                                    </select>
                                    <p className="setting-description">
                                        {t('settings.cutoff.strategyDesc')}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Nightly Curfew Settings */}
                        <div className="settings-section">
                            <div className="section-header">
                                <Clock size={20} />
                                <h2>{t('settings.cutoff.curfewTitle')}</h2>
                                <button
                                    className={`btn-save-section ${savedSections.curfew ? 'btn-saved' : ''}`}
                                    onClick={() => handleSaveSection('curfew')}
                                    disabled={savingSections.curfew}
                                >
                                    {savingSections.curfew ? t('settings.actions.saving') : savedSections.curfew ? t('settings.actions.saveSection') : <Save size={16} />}
                                </button>
                            </div>

                            <div className="setting-item toggle-item">
                                <div className="setting-info">
                                    <label htmlFor="curfewEnabled">{t('settings.cutoff.curfewEnable')}</label>

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
                                <div className="integration-fields">
                                    <div className="setting-item">
                                        <label htmlFor="curfewStartTime">{t('settings.cutoff.startTime')}</label>
                                        <input
                                            id="curfewStartTime"
                                            type="time"
                                            value={settings.curfew?.startTime || '00:05'}
                                            onChange={(e) => handleNestedChange('curfew', 'startTime', e.target.value)}
                                            className="time-input"
                                        />
                                        <p className="setting-description">
                                            {t('settings.cutoff.startTimeDesc')}
                                        </p>
                                    </div>
                                    <div className="setting-item">
                                        <label htmlFor="curfewEndTime">{t('settings.cutoff.endTime')}</label>
                                        <input
                                            id="curfewEndTime"
                                            type="time"
                                            value={settings.curfew?.endTime || '04:00'}
                                            onChange={(e) => handleNestedChange('curfew', 'endTime', e.target.value)}
                                            className="time-input"
                                        />
                                        <p className="setting-description">
                                            {t('settings.cutoff.endTimeDesc')}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {/* General Settings */}
                {activeTab === 'business' && (
                    <div className="settings-section">
                        <div className="section-header">
                            <Database size={20} />
                            <h2>{t('settings.general.title')}</h2>
                            <button
                                className={`btn-save-section ${savedSections.general ? 'btn-saved' : ''}`}
                                onClick={() => handleSaveSection('general')}
                                disabled={savingSections.general}
                            >
                                {savingSections.general ? t('settings.actions.saving') : savedSections.general ? t('settings.actions.saveSection') : <Save size={16} />}
                            </button>
                        </div>

                        {/* 2-Column Grid Container */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

                            <div className="setting-item">
                                <label htmlFor="dailyRate">{t('settings.general.dailyRate')}</label>
                                <div className="input-group">
                                    <input
                                        id="dailyRate"
                                        type="number"
                                        value={settings.contractDefaults?.dailyRate || 35000}
                                        onChange={(e) => handleNestedChange('contractDefaults', 'dailyRate', parseInt(e.target.value))}
                                        placeholder={formatCurrency(settings.contractDefaults?.dailyRate || '$35000')}
                                    />

                                </div>
                                <p className="setting-description">
                                    {t('settings.general.dailyRateDesc')}
                                </p>
                            </div>

                            <div className="setting-item">
                                <label htmlFor="contractDays">{t('settings.general.contractDays')}</label>
                                <input
                                    id="contractDays"
                                    type="number"
                                    value={settings.contractDefaults?.contractDays || 500}
                                    onChange={(e) => handleNestedChange('contractDefaults', 'contractDays', parseInt(e.target.value))}
                                    placeholder="500"
                                />
                                <p className="setting-description">
                                    {t('settings.general.contractDaysDesc')}
                                </p>
                            </div>

                            <div className="setting-item">
                                <label htmlFor="freeDayPolicy">{t('settings.general.freeDayPolicy')}</label>
                                <select
                                    id="freeDayPolicy"
                                    value={settings.contractDefaults?.freeDayPolicy || 'FLEXIBLE'}
                                    onChange={(e) => handleNestedChange('contractDefaults', 'freeDayPolicy', e.target.value)}
                                >
                                    <option value="FLEXIBLE">{t('settings.general.policyFlexible')}</option>
                                    <option value="FIXED_WEEKDAY">{t('settings.general.policyFixed')}</option>
                                </select>
                                <p className="setting-description">
                                    {t('settings.general.freeDayPolicyDesc')}
                                </p>
                            </div>

                            {settings.contractDefaults?.freeDayPolicy !== 'FIXED_WEEKDAY' ? (
                                <div className="setting-item" style={{ marginLeft: '1rem', borderLeft: '2px solid var(--border-color)', paddingLeft: '1rem' }}>
                                    <label htmlFor="freeDaysLimit">{t('settings.general.freeDaysLimit')}</label>
                                    <input
                                        id="freeDaysLimit"
                                        type="number"
                                        value={settings.contractDefaults?.freeDaysLimit || 4}
                                        onChange={(e) => handleNestedChange('contractDefaults', 'freeDaysLimit', parseInt(e.target.value))}
                                        placeholder="4"
                                    />
                                    <p className="setting-description">
                                        {t('settings.general.freeDaysLimitDesc')}
                                    </p>
                                </div>
                            ) : (
                                <div className="setting-item" style={{ borderLeft: '2px solid var(--border-color)' }}>
                                    <label htmlFor="fixedFreeDayOfWeek">{t('settings.general.fixedFreeDay')}</label>
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
                                    <p className="setting-description">
                                        {t('settings.general.fixedFreeDayDesc')}
                                    </p>
                                </div>
                            )}

                            <div className="setting-item">
                                <label htmlFor="initialFee">{t('settings.general.initialFee')}</label>
                                <div className="input-group">
                                    <input
                                        id="initialFee"
                                        type="number"
                                        value={settings.contractDefaults?.initialFee || 0}
                                        onChange={(e) => handleNestedChange('contractDefaults', 'initialFee', parseInt(e.target.value))}
                                        placeholder={formatCurrency(settings.contractDefaults?.initialFee || 0)}
                                    />

                                </div>
                                <p className="setting-description">
                                    {t('settings.general.initialFeeDesc')}
                                </p>
                            </div>

                            <div className="setting-item">
                                <label htmlFor="currency">{t('settings.general.currency')}</label>
                                <select
                                    id="currency"
                                    value={settings.currency}
                                    onChange={(e) => handleChange('currency', e.target.value)}
                                >
                                    <option value="COP">COP (Colombian Peso)</option>
                                    <option value="USD">USD (US Dollar)</option>
                                    <option value="EUR">EUR (Euro)</option>
                                </select>
                                <p className="setting-description">
                                    {t('settings.general.currencyDesc')}
                                </p>
                            </div>

                            <div className="setting-item">
                                <label htmlFor="timezone">{t('settings.general.timezone')}</label>
                                <select
                                    id="timezone"
                                    value={settings.timezone}
                                    onChange={(e) => handleChange('timezone', e.target.value)}
                                >
                                    <option value="America/Bogota">America/Bogota (UTC-5)</option>
                                    <option value="America/New_York">America/New_York (UTC-5)</option>
                                    <option value="America/Los_Angeles">America/Los_Angeles (UTC-8)</option>
                                    <option value="Europe/London">Europe/London (UTC+0)</option>
                                </select>
                                <p className="setting-description">
                                    {t('settings.general.timezoneDesc')}
                                </p>
                            </div>

                        </div>



                    </div>
                )}

                {/* GPS Integration */}
                {activeTab === 'integrations' && (
                    <div className="settings-section">
                        <div className="section-header">
                            <Database size={20} />
                            <h2>{t('settings.integrations.gpsTitle')}</h2>
                            <button
                                className={`btn-save-section ${savedSections.gps ? 'btn-saved' : ''}`}
                                onClick={() => handleSaveSection('gps')}
                                disabled={savingSections.gps}
                            >
                                {savingSections.gps ? t('settings.actions.saving') : savedSections.gps ? t('settings.actions.saveSection') : <Save size={16} />}
                            </button>
                        </div>

                        <div className="setting-item">
                            <label htmlFor="gpsService">{t('settings.integrations.selectProvider')}</label>
                            <select
                                id="gpsService"
                                value={settings.gpsService}
                                onChange={(e) => handleChange('gpsService', e.target.value)}
                            >
                                <option value="megarastreo">MegaRastreo</option>
                                <option value="traccar">{t('settings.integrations.traccarNotImplemented')}</option>
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

                    </div>
                )}

                {/* Wompi Integration */}
                {activeTab === 'integrations' && (
                    <div className="settings-section">
                        <div className="section-header">
                            <DollarSign size={20} />
                            <h2>{t('settings.integrations.wompiTitle')}</h2>
                            <button
                                className={`btn-save-section ${savedSections.wompi ? 'btn-saved' : ''}`}
                                onClick={() => handleSaveSection('wompi')}
                                disabled={savingSections.wompi}
                            >
                                {savingSections.wompi ? t('settings.actions.saving') : savedSections.wompi ? t('settings.actions.saveSection') : <Save size={16} />}
                            </button>
                        </div>

                        <div className="setting-item">
                            <label htmlFor="wPubKey">{t('settings.integrations.publicKey')}</label>
                            <input
                                id="wPubKey"
                                type="text"
                                value={settings.wompiConfig.publicKey}
                                onChange={(e) => handleNestedChange('wompiConfig', 'publicKey', e.target.value)}
                                placeholder="pub_test_..."
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
                            />
                        </div>
                    </div>
                )}




                {/* System Info */}
                {activeTab === 'system' && (
                    <div className="settings-section">
                        <div className="section-header">
                            <Database size={20} />
                            <h2>{t('settings.system.title')}</h2>
                        </div>

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
            </div>

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