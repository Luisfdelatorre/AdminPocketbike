import React from 'react';
import { useTranslation } from 'react-i18next';

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, deviceId }) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <h2>{t('common.confirmDelete')}</h2>
                <p>{t('devices.deleteConfirmText')} <strong>{deviceId}</strong>?</p>
                <p style={{ color: '#6B7280', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    {t('devices.deleteNote')}
                </p>

                <div className="modal-actions">
                    <button
                        className="btn-secondary"
                        onClick={onClose}
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        className="btn-primary"
                        style={{ background: '#EF4444' }}
                        onClick={onConfirm}
                    >
                        {t('common.delete')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteConfirmationModal;
