import React from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import './ShareDeviceModal.css';

const ShareDeviceModal = ({ isOpen, onClose, shareUrl, onCopy }) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="ios-share-overlay" onClick={onClose}>
            <div className="ios-share-container" onClick={(e) => e.stopPropagation()}>
                {/* Top Navigation Bar */}
                <header className="ios-share-header">
                    <h1 className="ios-share-title">{t('devices.share.title', 'Compartir Link')}</h1>
                </header>

                {/* Main Content */}
                <main className="ios-share-main">
                    <p className="ios-share-subtitle">
                        {t('devices.share.subtitle', 'Comparte este link para acceder a la página de pago.')}
                    </p>

                    {/* QR Code Section */}
                    <section className="ios-share-qr-section">
                        <QRCodeSVG value={shareUrl} size={256} style={{ width: '100%', height: 'auto', maxWidth: '256px' }} />
                    </section>

                    {/* Link Row */}
                    <section className="ios-share-link-row">
                        <span className="ios-share-link-text">{shareUrl}</span>
                        <button className="ios-share-copy-btn" onClick={onCopy}>
                            <svg className="ios-share-copy-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                            </svg>
                            {t('devices.share.copy', 'Copiar')}
                        </button>
                    </section>

                    {/* Warning Note */}
                    <section className="ios-share-warning-box">
                        <p className="ios-share-warning-text">
                            <strong>{t('devices.share.note', 'Nota:')}</strong> {t('devices.share.noteText', 'El usuario necesitará su PIN de 4 dígitos.')}
                        </p>
                    </section>
                </main>

                {/* Primary Action Footer */}
                <footer className="ios-share-footer">
                    <button className="ios-share-submit" onClick={onClose}>
                        {t('common.done', 'Listo')}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default ShareDeviceModal;
