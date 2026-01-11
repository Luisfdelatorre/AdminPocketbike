import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import { showToast } from '../utils/toast';
import './Login.css';

const DevicePinLogin = () => {
    const [deviceId, setDeviceId] = useState('');
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const { loginDevice } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const result = await loginDevice(deviceId, pin);

        if (result.success) {
            showToast('success', t('login.accessGranted'), `Welcome to ${result.deviceId}`);
            navigate(`/#/Id/${result.deviceId}`);
        } else {
            showToast('error', t('login.accessDenied'), result.error || t('login.invalidPin'));
        }

        setLoading(false);
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h1>{t('login.deviceTitle')}</h1>
                    <p>{t('login.deviceSubtitle')}</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label htmlFor="deviceId">{t('login.deviceId')}</label>
                        <input
                            type="text"
                            id="deviceId"
                            value={deviceId}
                            onChange={(e) => setDeviceId(e.target.value.toUpperCase())}
                            placeholder="BIKE001"
                            required
                            autoComplete="off"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="pin">{t('login.pinCode')}</label>
                        <input
                            type="password"
                            id="pin"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            placeholder="••••"
                            required
                            autoComplete="off"
                            maxLength="6"
                            pattern="[0-9]*"
                            inputMode="numeric"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-block"
                        disabled={loading}
                    >
                        {loading ? '🔄 ' + t('login.verifying') : '🔓 ' + t('login.accessBtn')}
                    </button>

                    <LanguageSelector />
                </form>

                <div className="login-footer">
                    <p>
                        <a href="#/admin/login">{t('login.adminLink')}</a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DevicePinLogin;
