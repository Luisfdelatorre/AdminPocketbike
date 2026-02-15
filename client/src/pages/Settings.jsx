import React, { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, DollarSign, Clock, Database, Save, Image as ImageIcon, Edit2, ZoomIn, ZoomOut } from 'lucide-react';
import './Settings.css';

const Settings = () => {
    const [settings, setSettings] = useState({
        dailyRate: 35000, // 30,000 COP in cents
        contractDays: 500,
        currency: 'COP',
        timezone: 'America/Bogota',
        displayName: 'PocketBike',
        companyLogo: '/pocketbike_60x60.jpg',
        automaticCutOff: false,
        cutOffStrategy: 1
    });

    const [saved, setSaved] = useState(false);
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
                const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
                const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

                const response = await fetch('/apinode/companies/branding', {
                    headers
                });
                const data = await response.json();
                if (data.success) {
                    setSettings(prev => ({
                        ...prev,
                        displayName: data.data.displayName,
                        companyLogo: data.data.logo,
                        automaticCutOff: data.data.automaticCutOff,
                        cutOffStrategy: data.data.cutOffStrategy
                    }));
                }
            } catch (error) {
                console.error('Error fetching branding:', error);
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
        try {
            // Save branding to server
            const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
            const response = await fetch('/apinode/companies/branding/update', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    displayName: settings.displayName,
                    logo: settings.companyLogo,
                    automaticCutOff: settings.automaticCutOff,
                    cutOffStrategy: settings.cutOffStrategy
                })
            });

            const data = await response.json();
            if (data.success) {
                console.log('Branding saved successfully');
                // Also save to localStorage for offline access
                localStorage.setItem('appSettings', JSON.stringify(settings));
                localStorage.setItem('companyLogo', settings.companyLogo);
                localStorage.setItem('displayName', settings.displayName);
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            } else {
                alert('Error saving branding: ' + data.error);
            }
        } catch (error) {
            console.error('Error saving branding:', error);
            alert('Error saving branding');
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
                {/* Contract Settings */}
                <div className="settings-section">
                    <div className="section-header">
                        <SettingsIcon size={20} />
                        <h2>Contract Settings</h2>
                    </div>

                    <div className="setting-item">
                        <label htmlFor="dailyRate">
                            <DollarSign size={16} />
                            Default Daily Rate
                        </label>
                        <div className="input-group">
                            <input
                                id="dailyRate"
                                type="number"
                                value={settings.dailyRate}
                                onChange={(e) => handleChange('dailyRate', parseInt(e.target.value))}
                                step="1000"
                                min="0"
                            />
                            <span className="input-hint">{formatCurrency(settings.dailyRate)}</span>
                        </div>
                        <p className="setting-description">
                            The default daily rental rate for new contracts (in cents)
                        </p>
                    </div>

                    <div className="setting-item">
                        <label htmlFor="contractDays">
                            <Clock size={16} />
                            Default Contract Duration
                        </label>
                        <div className="input-group">
                            <input
                                id="contractDays"
                                type="number"
                                value={settings.contractDays}
                                onChange={(e) => handleChange('contractDays', parseInt(e.target.value))}
                                step="1"
                                min="1"
                            />
                            <span className="input-hint">{settings.contractDays} days</span>
                        </div>
                        <p className="setting-description">
                            The default duration for new contracts
                        </p>
                    </div>
                </div>

                {/* General Settings */}
                <div className="settings-section">
                    <div className="section-header">
                        <Database size={20} />
                        <h2>General Settings</h2>
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

                {/* Company Branding */}
                <div className="settings-section">
                    <div className="section-header">
                        <ImageIcon size={20} />
                        <h2>Company Branding</h2>
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

                {/* Automatic Cut-Off Settings */}
                <div className="settings-section">
                    <div className="section-header">
                        <Clock size={20} />
                        <h2>Automatic Cut-Off Control</h2>
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

            {/* Save Button */}
            <div className="settings-actions">
                <button
                    className={`btn-save ${saved ? 'btn-saved' : ''}`}
                    onClick={handleSave}
                >
                    <Save />
                    {saved ? 'Settings Saved!' : 'Save Settings'}
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