import React, { useState } from 'react';
import { Settings as SettingsIcon, DollarSign, Clock, Database, Save } from 'lucide-react';
import './Settings.css';

const Settings = () => {
    const [settings, setSettings] = useState({
        dailyRate: 3000000, // 30,000 COP in cents
        contractDays: 500,
        currency: 'COP',
        timezone: 'America/Bogota'
    });

    const [saved, setSaved] = useState(false);

    const handleChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            [field]: value
        }));
        setSaved(false);
    };

    const handleSave = () => {
        // Here you would typically save to backend/localStorage
        console.log('Saving settings:', settings);
        localStorage.setItem('appSettings', JSON.stringify(settings));
        setSaved(true);

        setTimeout(() => setSaved(false), 3000);
    };

    const formatCurrency = (amount) => {
        return `$${(amount / 100).toLocaleString()} COP`;
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
                                step="100000"
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
        </div>
    );
};

export default Settings;
