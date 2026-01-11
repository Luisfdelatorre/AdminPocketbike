import React from 'react';
import { useTranslation } from 'react-i18next';

const PinDisplayModal = ({ isOpen, onClose, deviceId, pin }) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content pin-modal" onClick={(e) => e.stopPropagation()}>
                <h2>{t('devices.pin.generatedTitle')}</h2>
                <p>{t('devices.pin.saveWarning')}</p>

                <div className="pin-display">
                    <div className="device-info">Device: <strong>{deviceId}</strong></div>
                    <div className="pin-code">{pin}</div>
                </div>

                <div className="pin-instructions">
                    <p>{t('devices.pin.instruction1')}</p>
                    <p>{t('devices.pin.instruction2')}</p>
                    <p>{t('devices.pin.instruction3')}</p>
                </div>

                <button className="btn-primary full-width" onClick={onClose}>
                    {t('common.gotIt')}
                </button>
            </div>
        </div>
    );
};

export default PinDisplayModal;
