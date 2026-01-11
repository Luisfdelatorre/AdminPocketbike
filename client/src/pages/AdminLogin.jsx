import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import { showToast } from '../utils/toast';
import './Login.css';

const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { loginAdmin } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const result = await loginAdmin(email, password);

        if (result.success) {
            showToast('success', t('login.welcome'), t('login.loginSuccess'));
            navigate('/');
        } else {
            showToast('error', t('login.loginFailed'), result.error || 'Invalid credentials');
        }

        setLoading(false);
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h1>{t('login.adminTitle')}</h1>
                    <p>{t('login.adminSubtitle')}</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label htmlFor="email">{t('login.email')}</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@pocketbike.com"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">{t('login.password')}</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-block"
                        disabled={loading}
                    >
                        {loading ? '🔄 ' + t('login.loggingIn') : '🚀 ' + t('login.loginBtn')}
                    </button>

                    <LanguageSelector />
                </form>

                <div className="login-footer">
                    <p>
                        <a href="#/">{t('login.customerLink')}</a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;
