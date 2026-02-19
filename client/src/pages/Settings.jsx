import React, { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, DollarSign, Clock, Database, Save, Image as ImageIcon, Edit2, ZoomIn, ZoomOut } from 'lucide-react';
import { getSettings, updateSettings } from '../services/api';
import './Settings.css';

const Settings = () => {
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
                    <h1>⚙️ Settings</h1>
                    <p>Configure your application preferences</p>
                </div>
            </div>

            {/* Settings Sections */}
            <div className="settings-container">
                {/* Company Branding */}
                <div className="settings-section">
                    <div className="section-header">
                        <ImageIcon size={20} />
                        <h2>Company Branding</h2>
                        <button
                            className={`btn-save-section ${savedSections.branding ? 'btn-saved' : ''}`}
                            onClick={() => handleSaveSection('branding')}
                            disabled={savingSections.branding}
                        >
                            {savingSections.branding ? 'Saving...' : savedSections.branding ? 'Saved' : <Save size={16} />}
                        </button>
                    </div>

                    <div className="setting-item">
                        <label htmlFor="displayName">
                            <ImageIcon size={16} />
                            Company Display Name
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
                            This name will be displayed on the payment page.
                        </p>
                    </div>

                    <div className="setting-item">
                        <label htmlFor="companyLogo">
                            <ImageIcon size={16} />
                            Company Logo
                        </label>
                        <div className="branding-upload-area">
                            <div className="current-logo-container">
                                <img
                                    src={settings.companyLogo}
                                    alt="Company Logo"
                                    onError={(e) => {
                                        e.target.src = '/pocketbike_60x60.jpg';
                                    }}
                                />
                                <button
                                    type="button"
                                    className="btn-edit-logo"
                                    onClick={() => document.getElementById('companyLogo').click()}
                                    title="Change Logo"
                                >
                                    <Edit2 size={14} />
                                </button>
                            </div>

                            <div
                                className="upload-dropzone"
                                onClick={() => document.getElementById('companyLogo').click()}
                            >
                                <span className="upload-text">Upload New Logo</span>
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
                            RECOMMENDED: 60X60PX, PNG OR JPG, MAX 2MB
                        </p>
                    </div>
                </div>
                {/* General Settings */}
                <div className="settings-section">
                    <div className="section-header">
                        <Database size={20} />
                        <h2>General Settings</h2>
                        <button
                            className={`btn-save-section ${savedSections.general ? 'btn-saved' : ''}`}
                            onClick={() => handleSaveSection('general')}
                            disabled={savingSections.general}
                        >
                            {savingSections.general ? 'Saving...' : savedSections.general ? 'Saved' : <Save size={16} />}
                        </button>
                    </div>



                    <div className="setting-item">
                        <label htmlFor="emailDomain">Default Email Domain</label>
                        <div className="input-group">
                            <span className="input-prefix">@</span>
                            <input
                                id="emailDomain"
                                type="text"
                                value={settings.contractDefaults?.emailDomain || 'tumotoya.online'}
                                onChange={(e) => handleNestedChange('contractDefaults', 'emailDomain', e.target.value)}
                                placeholder="tumotoya.online"
                            />
                        </div>
                        <p className="setting-description">
                            Domain used for auto-generated customer emails
                        </p>
                    </div>

                    <div className="setting-item">
                        <label htmlFor="dailyRate">Default Daily Rate (COP)</label>
                        <div className="input-group">
                            <input
                                id="dailyRate"
                                type="number"
                                value={settings.contractDefaults?.dailyRate || 30000}
                                onChange={(e) => handleNestedChange('contractDefaults', 'dailyRate', parseInt(e.target.value))}
                                placeholder="30000"
                            />
                            <span className="input-hint">{formatCurrency(settings.contractDefaults?.dailyRate || 30000)}</span>
                        </div>
                        <p className="setting-description">
                            Base rate per day in cents
                        </p>
                    </div>

                    <div className="setting-item">
                        <label htmlFor="contractDays">Default Contract Days</label>
                        <input
                            id="contractDays"
                            type="number"
                            value={settings.contractDefaults?.contractDays || 500}
                            onChange={(e) => handleNestedChange('contractDefaults', 'contractDays', parseInt(e.target.value))}
                            placeholder="500"
                        />
                        <p className="setting-description">
                            Default duration for new contracts
                        </p>
                    </div>

                    <div className="setting-item">
                        <label htmlFor="freeDaysLimit">Default Free Days Limit</label>
                        <input
                            id="freeDaysLimit"
                            type="number"
                            value={settings.contractDefaults?.freeDaysLimit || 4}
                            onChange={(e) => handleNestedChange('contractDefaults', 'freeDaysLimit', parseInt(e.target.value))}
                            placeholder="4"
                        />
                        <p className="setting-description">
                            Default monthly free days for new contracts
                        </p>
                    </div>

                    <div className="setting-item">
                        <label htmlFor="initialFee">Default Initial Fee</label>
                        <div className="input-group">
                            <input
                                id="initialFee"
                                type="number"
                                value={settings.contractDefaults?.initialFee || 0}
                                onChange={(e) => handleNestedChange('contractDefaults', 'initialFee', parseInt(e.target.value))}
                                placeholder="0"
                            />
                            <span className="input-hint">{formatCurrency(settings.contractDefaults?.initialFee || 0)}</span>
                        </div>
                        <p className="setting-description">
                            Default initial fee for new contracts
                        </p>
                    </div>
                    <div className="setting-item">
                        <label htmlFor="currency">Currency</label>
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
                            Display currency for amounts
                        </p>
                    </div>

                    <div className="setting-item">
                        <label htmlFor="timezone">Timezone</label>
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
                            Timezone for dates and times
                        </p>
                    </div>



                </div>

                {/* GPS Integration */}
                <div className="settings-section">
                    <div className="section-header">
                        <Database size={20} />
                        <h2>GPS Service Integration</h2>
                        <button
                            className={`btn-save-section ${savedSections.gps ? 'btn-saved' : ''}`}
                            onClick={() => handleSaveSection('gps')}
                            disabled={savingSections.gps}
                        >
                            {savingSections.gps ? 'Saving...' : savedSections.gps ? 'Saved' : <Save size={16} />}
                        </button>
                    </div>

                    <div className="setting-item">
                        <label htmlFor="gpsService">Select Provider</label>
                        <select
                            id="gpsService"
                            value={settings.gpsService}
                            onChange={(e) => handleChange('gpsService', e.target.value)}
                        >
                            <option value="megarastreo">MegaRastreo</option>
                            <option value="traccar">Traccar (Not implemented yet)</option>
                        </select>
                    </div>

                    {settings.gpsService === 'megarastreo' && (
                        <div className="integration-fields">
                            <div className="setting-item">
                                <label htmlFor="mrUser">MegaRastreo Username</label>
                                <input
                                    id="mrUser"
                                    type="text"
                                    value={settings.gpsConfig.user}
                                    onChange={(e) => handleNestedChange('gpsConfig', 'user', e.target.value)}
                                    placeholder="Enter username"
                                />
                            </div>
                            <div className="setting-item">
                                <label htmlFor="mrPass">MegaRastreo Password</label>
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
                                <label htmlFor="trHost">Traccar Host</label>
                                <input
                                    id="trHost"
                                    type="text"
                                    value={settings.gpsConfig.host}
                                    onChange={(e) => handleNestedChange('gpsConfig', 'host', e.target.value)}
                                    placeholder="e.g. 198.74.54.252"
                                />
                            </div>
                            <div className="setting-item">
                                <label htmlFor="trUser">Username</label>
                                <input
                                    id="trUser"
                                    type="text"
                                    value={settings.gpsConfig.user}
                                    onChange={(e) => handleNestedChange('gpsConfig', 'user', e.target.value)}
                                />
                            </div>
                            <div className="setting-item">
                                <label htmlFor="trPass">Password</label>
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

                {/* Wompi Integration */}
                <div className="settings-section">
                    <div className="section-header">
                        <DollarSign size={20} />
                        <h2>Wompi Payments Configuration</h2>
                        <button
                            className={`btn-save-section ${savedSections.wompi ? 'btn-saved' : ''}`}
                            onClick={() => handleSaveSection('wompi')}
                            disabled={savingSections.wompi}
                        >
                            {savingSections.wompi ? 'Saving...' : savedSections.wompi ? 'Saved' : <Save size={16} />}
                        </button>
                    </div>

                    <div className="setting-item">
                        <label htmlFor="wPubKey">Public Key</label>
                        <input
                            id="wPubKey"
                            type="text"
                            value={settings.wompiConfig.publicKey}
                            onChange={(e) => handleNestedChange('wompiConfig', 'publicKey', e.target.value)}
                            placeholder="pub_test_..."
                        />
                    </div>

                    <div className="setting-item">
                        <label htmlFor="wPrivKey">Private Key</label>
                        <input
                            id="wPrivKey"
                            type="password"
                            value={settings.wompiConfig.privateKey}
                            onChange={(e) => handleNestedChange('wompiConfig', 'privateKey', e.target.value)}
                            placeholder="prv_test_..."
                        />
                    </div>

                    <div className="setting-item">
                        <label htmlFor="wInteg">Integrity Secret</label>
                        <input
                            id="wInteg"
                            type="password"
                            value={settings.wompiConfig.integritySecret}
                            onChange={(e) => handleNestedChange('wompiConfig', 'integritySecret', e.target.value)}
                            placeholder="test_integrity_..."
                        />
                    </div>

                    <div className="setting-item">
                        <label htmlFor="wEvents">Events Secret</label>
                        <input
                            id="wEvents"
                            type="password"
                            value={settings.wompiConfig.eventsSecret}
                            onChange={(e) => handleNestedChange('wompiConfig', 'eventsSecret', e.target.value)}
                            placeholder="test_events_..."
                        />
                    </div>
                </div>

                {/* Automatic Cut-Off Settings */}
                <div className="settings-section">
                    <div className="section-header">
                        <Clock size={20} />
                        <h2>Automatic Cut-Off Control</h2>
                        <button
                            className={`btn-save-section ${savedSections.cutoff ? 'btn-saved' : ''}`}
                            onClick={() => handleSaveSection('cutoff')}
                            disabled={savingSections.cutoff}
                        >
                            {savingSections.cutoff ? 'Saving...' : savedSections.cutoff ? 'Saved' : <Save size={16} />}
                        </button>
                    </div>

                    <div className="setting-item toggle-item">
                        <div className="setting-info">
                            <label htmlFor="automaticCutOff">Enable Automatic Engine Stop</label>
                            <p className="setting-description">
                                Automatically turn off engines at 11:59 PM for devices with unpaid invoices.
                            </p>
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
                            <label htmlFor="cutOffStrategy">Cut-Off Strategy</label>
                            <select
                                id="cutOffStrategy"
                                value={settings.cutOffStrategy}
                                onChange={(e) => handleChange('cutOffStrategy', parseInt(e.target.value))}
                                className="strategy-select"
                            >
                                <option value={1}>1. Invoice de hoy no está pago</option>
                                <option value={2}>2. Invoice de ayer no está pago</option>
                                <option value={3}>3. No apagar / Dejar libre</option>
                            </select>
                            <p className="setting-description">
                                Choose which payment condition triggers the automatic cutoff.
                            </p>
                        </div>
                    )}
                </div>


                {/* System Info */}
                <div className="settings-section">
                    <div className="section-header">
                        <Database size={20} />
                        <h2>System Information</h2>
                    </div>

                    <div className="info-grid">
                        <div className="info-item">
                            <div className="info-label">Application Version</div>
                            <div className="info-value">1.0.0</div>
                        </div>
                        <div className="info-item">
                            <div className="info-label">Database Status</div>
                            <div className="info-value status-connected">Connected</div>
                        </div>
                        <div className="info-item">
                            <div className="info-label">API Status</div>
                            <div className="info-value status-connected">Active</div>
                        </div>
                        <div className="info-item">
                            <div className="info-label">Last Backup</div>
                            <div className="info-value">Never</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Save All Button */}
            <div className="settings-actions">
                <button
                    className={`btn-save ${saved ? 'btn-saved' : ''}`}
                    onClick={handleSave}
                >
                    <Save />
                    {saved ? 'All Settings Saved!' : 'Save All Settings'}
                </button>
            </div>

            {/* Crop Modal */}
            {showCropModal && (
                <div className="crop-modal-overlay">
                    <div className="crop-modal-content">
                        <h3 className="crop-modal-title">Crop Your Logo</h3>

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

                            <p className="crop-hint">Drag to reposition • Use slider to zoom</p>
                        </div>

                        <div className="crop-actions">
                            <button
                                className="btn-cancel"
                                onClick={closeCropModal}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-crop"
                                onClick={performCrop}
                            >
                                Crop & Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;