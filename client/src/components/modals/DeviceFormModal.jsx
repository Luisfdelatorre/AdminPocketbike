import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const DeviceFormModal = ({
    isOpen,
    onClose,
    onSubmit,
    formData,
    setFormData,
    isEditing
}) => {
    const { t } = useTranslation();

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                <h2>{isEditing ? t('devices.form.editTitle') : t('devices.form.addTitle')}</h2>

                <form onSubmit={onSubmit}>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>{t('devices.form.deviceId')}</label>
                            <input
                                type="text"
                                value={formData._id}
                                onChange={(e) => setFormData({ ...formData, _id: e.target.value })}
                                disabled={isEditing}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>{t('devices.form.name')}</label>
                            <input
                                type="text"
                                value={formData.deviceName}
                                onChange={(e) => setFormData({ ...formData, deviceName: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>{t('devices.form.nequi')}</label>
                            <input
                                type="text"
                                value={formData.nequiNumber}
                                onChange={(e) => setFormData({ ...formData, nequiNumber: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label>{t('devices.form.sim')}</label>
                            <input
                                type="text"
                                value={formData.simCardNumber}
                                onChange={(e) => setFormData({ ...formData, simCardNumber: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>{t('devices.form.notes')}</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows="3"
                        />
                    </div>

                    <div className="form-group checkbox-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                            />
                            {t('devices.form.active')}
                        </label>
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>
                            {t('common.cancel')}
                        </button>
                        <button type="submit" className="btn-primary">
                            {isEditing ? t('common.update') : t('common.create')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DeviceFormModal;
