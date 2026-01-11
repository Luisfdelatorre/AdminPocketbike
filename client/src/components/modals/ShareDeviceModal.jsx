import React from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { Copy } from 'lucide-react';

const ShareDeviceModal = ({ isOpen, onClose, shareUrl, onCopy }) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>{t('devices.share.title')}</h2>
                <p>{t('devices.share.subtitle')}</p>

                <div className="qr-code-display" style={{
                    display: 'flex',
                    justifyContent: 'center',
                    margin: '1.5rem 0',
                    padding: '1rem',
                    background: 'white',
                    borderRadius: '0.5rem'
                }}>
                    <QRCodeSVG value={shareUrl} size={200} />
                </div>

                <div className="share-link-box" style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginBottom: '1.5rem',
                    background: '#F3F4F6',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #E5E7EB'
                }}>
                    <input
                        type="text"
                        value={shareUrl}
                        readOnly
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            fontSize: '0.875rem',
                            color: '#4B5563',
                            outline: 'none'
                        }}
                    />
                    <button
                        onClick={onCopy}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#03C9D7',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                        }}
                    >
                        <Copy /> {t('devices.share.copy')}
                    </button>
                </div>

                <div className="pin-warning" style={{
                    background: '#FEF3C7',
                    color: '#92400E',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    marginBottom: '1.5rem'
                }}>
                    <strong>{t('devices.share.note')}</strong> {t('devices.share.noteText')}
                </div>

                <button className="btn-primary full-width" onClick={onClose}>
                    {t('common.done')}
                </button>
            </div>
        </div>
    );
};

export default ShareDeviceModal;
