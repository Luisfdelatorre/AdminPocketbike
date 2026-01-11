import React from 'react';
import { useTranslation } from 'react-i18next';

const PinInputModal = ({
    isOpen,
    onClose,
    deviceId,
    customPin,
    setCustomPin,
    onSubmit
}) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>{t('devices.pin.modalTitle')}</h2>
                <p>{t('devices.pin.modalSubtitle')} <strong>{deviceId}</strong></p>

                <div className="pin-input-section">
                    <label>{t('devices.pin.customLabel')}</label>
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength="4"
                        value={customPin}
                        onChange={(e) => {
                            const value = e.target.value;
                            if (/^\d*$/.test(value)) {
                                setCustomPin(value);
                            }
                        }}
                        placeholder={t('devices.pin.customPlaceholder')}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #D1D5DB',
                            borderRadius: '0.5rem',
                            fontSize: '1.5rem',
                            textAlign: 'center',
                            letterSpacing: '0.5rem',
                            marginTop: '0.5rem'
                        }}
                    />
                    <p style={{ color: '#6B7280', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                        {t('devices.pin.autoHelper')}
                    </p>
                </div>

                <div className="modal-actions">
                    <button
                        className="btn-secondary"
                        onClick={onClose}
                    >
                        {t('common.cancel')}
                    </button>
                    {customPin.length === 4 ? (
                        <button
                            className="btn-primary"
                            onClick={() => onSubmit(true)}
                        >
                            {t('devices.pin.useCustom')}
                        </button>
                    ) : (
                        <button
                            className="btn-primary"
                            onClick={() => onSubmit(false)}
                        >
                            {t('devices.pin.autoGenerate')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PinInputModal;
