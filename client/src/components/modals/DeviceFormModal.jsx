import React from 'react';
import { useTranslation } from 'react-i18next';
import useAdminScrollLock from '../../hooks/useAdminScrollLock';
import './DeviceFormModal.css';

const DeviceFormModal = ({
    isOpen,
    onClose,
    onSubmit,
    formData,
    setFormData,
    isEditing
}) => {
    const { t } = useTranslation();
    useAdminScrollLock(isOpen);

    if (!isOpen) return null;

    return (
        <div className="ios-modal-overlay" onClick={onClose}>
            <div className="ios-modal-container" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                {/* Header */}
                <header className="ios-modal-header">
                    <button className="ios-modal-cancel" type="button" onClick={onClose}>
                        {t('common.cancel')}
                    </button>
                    <h1 className="ios-modal-title">
                        {isEditing ? t('devices.form.editTitle') : t('devices.form.addTitle')}
                    </h1>
                </header>

                {/* Main Form Content */}
                <main className="ios-modal-main">
                    <form onSubmit={onSubmit} className="ios-modal-form">
                        <div className="ios-modal-card">
                            <div className="ios-modal-card-body">
                                <div>
                                    <label className="ios-modal-label" htmlFor="dispositivo">
                                        {t('devices.form.deviceId')} *
                                    </label>
                                    <input className="ios-modal-input" disabled id="dispositivo" type="text" value={formData._id} onChange={(e) => setFormData({ ...formData, _id: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="ios-modal-label" htmlFor="nombre">
                                        {t('devices.form.name')} *
                                    </label>
                                    <input className="ios-modal-input" disabled={isEditing} id="nombre" type="text" value={formData.deviceName} onChange={(e) => setFormData({ ...formData, deviceName: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="ios-modal-label" htmlFor="cuenta">
                                        {t('devices.form.nequi', 'Cuenta Tigo / Nequi')}
                                    </label>
                                    <input className="ios-modal-input editable" id="cuenta" type="text" value={formData.nequiNumber} onChange={(e) => setFormData({ ...formData, nequiNumber: e.target.value })} />
                                </div>
                                <div>
                                    <label className="ios-modal-label" htmlFor="sim_card">
                                        {t('devices.form.sim', 'SIMCard/M2M')}
                                    </label>
                                    <input className="ios-modal-input editable" id="sim_card" type="text" value={formData.simCardNumber} onChange={(e) => setFormData({ ...formData, simCardNumber: e.target.value })} />
                                </div>
                            </div>
                            <hr className="ios-modal-divider" />
                            {/* Cobro Diario Toggle */}
                            <div className="ios-modal-toggle-row">
                                <label className="ios-modal-toggle-label" htmlFor="cobro_diario">
                                    {t('devices.form.dailyPayment', 'Cobro Diario (Daily Payment)')}
                                </label>
                                <div className="ios-modal-toggle-container">
                                    <input className="ios-modal-toggle-checkbox" id="cobro_diario" type="checkbox" checked={formData.DailyPayment} onChange={(e) => setFormData({ ...formData, DailyPayment: e.target.checked })} />
                                    <label className="ios-modal-toggle-track" htmlFor="cobro_diario"></label>
                                </div>
                            </div>
                        </div>

                        <div className="ios-modal-footer">
                            <button className="ios-modal-submit" type="submit">
                                {isEditing ? t('common.update') : t('common.create')}
                            </button>
                        </div>
                    </form>
                </main>
            </div>
        </div>
    );
};

export default DeviceFormModal;
