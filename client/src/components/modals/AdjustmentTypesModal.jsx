import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Sliders, Plus, Trash2, Save, X, RefreshCw, CheckCircle, AlertCircle, Pencil, ShieldAlert } from 'lucide-react';
import { getAdjustmentTypes, updateAdjustmentTypes, getPaymentStatuses, updatePaymentStatuses } from '../../services/api';
import { useStatusConfig } from '../../context/StatusConfigContext';
import './AdjustmentTypesModal.css';

const SYSTEM_STATUS_KEYS = ['PAID', 'FREE', 'PENDING', 'DEBT', 'FREEPASS', 'VERIFYING', 'CONFIRMING', 'LOAN', 'DECLINED', 'ERROR', 'VOIDED', 'INITIAL_FEE'];

const AdjustmentTypesModal = forwardRef(({ isOpen = true, isEmbedded = false, onClose, onFilterChange }, ref) => {
    const { t } = useTranslation();
    const { refreshStatusConfig, updateLocalStatus } = useStatusConfig();
    const [types, setTypes] = useState({});
    const [filterCategory, setFilterCategory] = useState('adjustments'); // 'statuses' | 'adjustments'

    // Notify parent when sub-tab changes
    const handleFilterChange = (category) => {
        setFilterCategory(category);
        onFilterChange?.(category);
    };
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [editingKey, setEditingKey] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [showAddForm, setShowAddForm] = useState(false);

    useImperativeHandle(ref, () => ({
        triggerAdd() {
            if (filterCategory !== 'statuses') {
                setShowAddForm(true);
            }
        },
        get filterCategory() {
            return filterCategory;
        }
    }), [filterCategory]);
    const [newKey, setNewKey] = useState('');
    const [newForm, setNewForm] = useState({});

    useEffect(() => {
        if (isOpen || isEmbedded) {
            loadTypes();
        }
    }, [isOpen, isEmbedded]);

    const loadTypes = async () => {
        setLoading(true);
        setMessage(null);
        try {
            const [adjRes, payRes] = await Promise.all([
                getAdjustmentTypes(),
                getPaymentStatuses()
            ]);
            const combined = {
                ...(payRes?.data || {}),
                ...(adjRes?.data || {})
            };
            setTypes(combined);
        } catch (err) {
            setMessage({ type: 'error', text: t('adjustments.errorLoading') });
        } finally {
            setLoading(false);
        }
    };

    const handleStartEdit = (key, item) => {
        setEditingKey(key);
        setEditForm({ ...item });
    };

    const handleSaveEdit = async () => {
        if (!editingKey) return;

        setSaving(true);
        setMessage(null);

        const isStatus = SYSTEM_STATUS_KEYS.includes(editingKey);
        const updatedItem = {
            ...types[editingKey],
            ...editForm,
            autoAmount: editForm.isFree ? 0 : null,
            autoReference: `${editForm.badgeLabel} - {deviceName} ({date})`
        };

        const updatedTypes = {
            ...types,
            [editingKey]: updatedItem
        };

        try {
            if (isStatus) {
                const statusesOnly = {};
                Object.keys(updatedTypes).forEach(k => {
                    if (SYSTEM_STATUS_KEYS.includes(k)) {
                        statusesOnly[k] = updatedTypes[k];
                    }
                });
                const res = await updatePaymentStatuses(statusesOnly);
                if (res && res.success) {
                    setTypes(prev => ({ ...prev, [editingKey]: updatedItem }));
                    updateLocalStatus(editingKey, updatedItem);
                    refreshStatusConfig();
                    setEditingKey(null);
                    setMessage({ type: 'success', text: t('adjustments.updatedSuccess') });
                }
            } else {
                const adjustmentsOnly = {};
                Object.keys(updatedTypes).forEach(k => {
                    if (!SYSTEM_STATUS_KEYS.includes(k)) {
                        adjustmentsOnly[k] = updatedTypes[k];
                    }
                });
                const res = await updateAdjustmentTypes(adjustmentsOnly);
                if (res && res.success) {
                    setTypes(prev => ({ ...prev, [editingKey]: updatedItem }));
                    updateLocalStatus(editingKey, updatedItem);
                    refreshStatusConfig();
                    setEditingKey(null);
                    setMessage({ type: 'success', text: t('adjustments.updatedSuccess') });
                }
            }
        } catch (err) {
            setMessage({ type: 'error', text: t('adjustments.errorSaving') });
        } finally {
            setSaving(false);
        }
    };

    const handleAddType = async (e) => {
        e.preventDefault();
        const formattedKey = newKey.toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_');
        if (!formattedKey) {
            setMessage({ type: 'error', text: t('adjustments.keyRequired') });
            return;
        }

        if (SYSTEM_STATUS_KEYS.includes(formattedKey)) {
            setMessage({ type: 'error', text: t('adjustments.systemKeyReserved', { key: formattedKey }) });
            return;
        }

        setSaving(true);
        setMessage(null);

        const newItem = {
            ...newForm,
            autoAmount: newForm.isFree ? 0 : null,
            autoReference: `${newForm.badgeLabel}-{deviceName}({date})`,
            isRealPayment: !newForm.isFree,
            hidden: false
        };

        const adjustmentsOnly = {};
        Object.keys(types).forEach(k => {
            if (!SYSTEM_STATUS_KEYS.includes(k)) {
                adjustmentsOnly[k] = types[k];
            }
        });
        adjustmentsOnly[formattedKey] = newItem;

        try {
            const res = await updateAdjustmentTypes(adjustmentsOnly);
            if (res && res.success) {
                setTypes(prev => ({ ...prev, [formattedKey]: newItem }));
                refreshStatusConfig();
                setShowAddForm(false);
                setNewKey('');
                setMessage({ type: 'success', text: t('adjustments.createdSuccess', { key: formattedKey }) });
            }
        } catch (err) {
            setMessage({ type: 'error', text: t('adjustments.errorCreating') });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteType = async (key) => {
        if (SYSTEM_STATUS_KEYS.includes(key)) {
            setMessage({ type: 'error', text: t('adjustments.cannotDeleteSystem', { key }) });
            return;
        }

        if (!window.confirm(t('adjustments.confirmDelete', { key }))) return;

        setSaving(true);
        setMessage(null);

        const adjustmentsOnly = {};
        Object.keys(types).forEach(k => {
            if (!SYSTEM_STATUS_KEYS.includes(k) && k !== key) {
                adjustmentsOnly[k] = types[k];
            }
        });

        try {
            const res = await updateAdjustmentTypes(adjustmentsOnly);
            if (res && res.success) {
                setTypes(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
                refreshStatusConfig();
                setMessage({ type: 'success', text: t('adjustments.deletedSuccess', { key }) });
            }
        } catch (err) {
            setMessage({ type: 'error', text: t('adjustments.errorDeleting') });
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen && !isEmbedded) return null;

    const content = (
        <div
            className={isEmbedded ? "adj-modal-embedded" : "modal-card modal-surface--adjustment-types"}
            onClick={e => e.stopPropagation()}
        >
            <div className="modal-header">
                {!isEmbedded && onClose && (
                    <button className="modal-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                )}
            </div>

            <div className={isEmbedded ? "adj-modal-body--embedded" : "adj-modal-body"}>
                {message && (
                    <div className={`adj-modal-alert ${message.type === 'success' ? 'adj-modal-alert--success' : 'adj-modal-alert--error'}`}>
                        {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                        <span>{message.text}</span>
                    </div>
                )}

                {(() => {
                    const visibleKeys = Object.keys(types).filter(k => !types[k]?.hidden);
                    const adjustmentKeys = visibleKeys.filter(k => types[k]?.category === 'ADJUSTMENT' || (!types[k]?.category && !SYSTEM_STATUS_KEYS.includes(k)));
                    const statusKeys = visibleKeys.filter(k => types[k]?.category === 'STATUS' || (!types[k]?.category && SYSTEM_STATUS_KEYS.includes(k)));
                    return (
                        <>
                            {/* Category Filter Tabs */}
                            <div className="adj-modal-tabs">
                                <button
                                    className={`adj-modal-tab-btn ${filterCategory === 'adjustments' ? 'adj-modal-tab-btn--active' : ''}`}
                                    onClick={() => handleFilterChange('adjustments')}
                                >
                                    Ajustes ({adjustmentKeys.length})
                                </button>
                                <button
                                    className={`adj-modal-tab-btn ${filterCategory === 'statuses' ? 'adj-modal-tab-btn--active' : ''}`}
                                    onClick={() => handleFilterChange('statuses')}
                                >
                                    Estados ({statusKeys.length})
                                </button>
                            </div>
                        </>
                    );
                })()}

                {/* Add Form Collapsible */}
                {showAddForm && (
                    <form onSubmit={handleAddType} className="adj-modal-add-card">
                        <div className="adj-modal-card-header">
                            <h4 className="adj-modal-card-title">
                                <Plus size={15} /> Nuevo Tipo de Ajuste
                            </h4>
                            <button type="button" onClick={() => setShowAddForm(false)} className="adj-modal-close-icon-btn">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="adj-modal-form-grid">
                            <div className="adj-modal-form-group">
                                <label className="adj-modal-label">Código / Clave (ej: NOVEDAD)</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="CLAVE_UNICA"
                                    value={newKey}
                                    onChange={e => setNewKey(e.target.value.toUpperCase())}
                                    className="adj-modal-input adj-modal-input-mono"
                                />
                            </div>
                            <div className="adj-modal-form-group">
                                <label className="adj-modal-label">Etiqueta Larga (Dropdown)</label>
                                <input
                                    type="text"
                                    required
                                    value={newForm.label}
                                    onChange={e => setNewForm({ ...newForm, label: e.target.value })}
                                    className="adj-modal-input"
                                />
                            </div>
                            <div className="adj-modal-form-group">
                                <label className="adj-modal-label">Insignia Corta (Badge en Tabla)</label>
                                <input
                                    type="text"
                                    required
                                    value={newForm.badgeLabel || ''}
                                    onChange={e => setNewForm({ ...newForm, badgeLabel: e.target.value.toUpperCase() })}
                                    className="adj-modal-input adj-modal-input-mono adj-modal-input-uppercase"
                                />
                            </div>
                            <div className="adj-modal-color-row">
                                <div className="adj-modal-form-group flex-1">
                                    <label className="adj-modal-label">Color Texto</label>
                                    <input
                                        type="color"
                                        value={newForm.color}
                                        onChange={e => setNewForm({ ...newForm, color: e.target.value })}
                                        className="adj-modal-color-picker"
                                    />
                                </div>
                                <div className="adj-modal-form-group flex-1">
                                    <label className="adj-modal-label">Color Fondo</label>
                                    <input
                                        type="color"
                                        value={newForm.bg}
                                        onChange={e => setNewForm({ ...newForm, bg: e.target.value })}
                                        className="adj-modal-color-picker"
                                    />
                                </div>
                            </div>
                            <div className="adj-modal-col-span-2 adj-modal-form-group">
                                <label className="adj-modal-label">Descripción explicativa</label>
                                <input
                                    type="text"
                                    value={newForm.description}
                                    onChange={e => setNewForm({ ...newForm, description: e.target.value })}
                                    className="adj-modal-input"
                                />
                            </div>
                            <div className="adj-modal-col-span-2 adj-modal-checkbox-row">
                                <input
                                    type="checkbox"
                                    id="newIsFree"
                                    checked={newForm.isFree}
                                    onChange={e => setNewForm({ ...newForm, isFree: e.target.checked })}
                                />
                                <label htmlFor="newIsFree" className="adj-modal-checkbox-label">
                                    Es un día sin cobro ($0 para el cliente)
                                </label>
                            </div>
                        </div>
                        <div className="adj-modal-actions">
                            <button type="button" onClick={() => setShowAddForm(false)} className="adj-modal-btn-cancel">
                                Cancelar
                            </button>
                            <button type="submit" disabled={saving} className="adj-modal-btn-save">
                                <Save size={13} /> Crear Tipo
                            </button>
                        </div>
                    </form>
                )}

                {/* Adjustment Types List */}
                {loading ? (
                    <div className="text-center py-8 text-slate-500 text-sm">Cargando tipos de ajuste...</div>
                ) : (
                    <div className="adj-modal-list">
                        {Object.entries(types)
                            .filter(([key, item]) => {
                                if (item?.hidden) return false; // Hide internal backward-compatibility alias keys
                                const isSystemStatus = SYSTEM_STATUS_KEYS.includes(key);
                                if (filterCategory === 'statuses') return isSystemStatus;
                                if (filterCategory === 'adjustments') return !isSystemStatus;
                                return true;
                            })
                            .map(([key, item]) => {
                                const isEditingThis = editingKey === key;
                                const isSystemStatus = SYSTEM_STATUS_KEYS.includes(key);

                                if (isEditingThis) {
                                    return (
                                        <div key={key} className="adj-modal-edit-card">
                                            <div className="adj-modal-card-header">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-indigo-900 font-mono">Editando: {key}</span>
                                                    {isSystemStatus && (
                                                        <span className="adj-modal-system-badge">
                                                            Estado Base Sistema
                                                        </span>
                                                    )}
                                                </div>
                                                <button onClick={() => setEditingKey(null)} className="adj-modal-close-icon-btn">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                            <div className="adj-modal-form-grid">
                                                <div className="adj-modal-form-group">
                                                    <label className="adj-modal-label">Etiqueta Larga</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.label}
                                                        onChange={e => setEditForm({ ...editForm, label: e.target.value })}
                                                        className="adj-modal-input"
                                                    />
                                                </div>
                                                <div className="adj-modal-form-group">
                                                    <label className="adj-modal-label">Insignia Corta (Badge)</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={editForm.badgeLabel || ''}
                                                        onChange={e => setEditForm({ ...editForm, badgeLabel: e.target.value.toUpperCase() })}
                                                        className="adj-modal-input adj-modal-input-mono adj-modal-input-uppercase"
                                                    />
                                                </div>
                                                <div className="adj-modal-color-row">
                                                    <div className="adj-modal-form-group flex-1">
                                                        <label className="adj-modal-label">Color Texto</label>
                                                        <input
                                                            type="color"
                                                            value={editForm.color}
                                                            onChange={e => setEditForm({ ...editForm, color: e.target.value })}
                                                            className="adj-modal-color-picker"
                                                        />
                                                    </div>
                                                    <div className="adj-modal-form-group flex-1">
                                                        <label className="adj-modal-label">Color Fondo</label>
                                                        <input
                                                            type="color"
                                                            value={editForm.bg}
                                                            onChange={e => setEditForm({ ...editForm, bg: e.target.value })}
                                                            className="adj-modal-color-picker"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="adj-modal-col-span-2 adj-modal-form-group">
                                                    <label className="adj-modal-label">Descripción</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.description}
                                                        onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                                        className="adj-modal-input"
                                                    />
                                                </div>
                                                <div className="adj-modal-checkbox-row">
                                                    <input
                                                        type="checkbox"
                                                        id={`editIsFree_${key}`}
                                                        checked={editForm.isFree}
                                                        onChange={e => setEditForm({ ...editForm, isFree: e.target.checked })}
                                                    />
                                                    <label htmlFor={`editIsFree_${key}`} className="adj-modal-checkbox-label">
                                                        Día sin cobro ($0)
                                                    </label>
                                                </div>
                                                {!isSystemStatus && (
                                                    <div className="adj-modal-checkbox-row">
                                                        <input
                                                            type="checkbox"
                                                            id={`editHidden_${key}`}
                                                            checked={editForm.hidden}
                                                            onChange={e => setEditForm({ ...editForm, hidden: e.target.checked })}
                                                        />
                                                        <label htmlFor={`editHidden_${key}`} className="adj-modal-checkbox-label">
                                                            Ocultar del menú de selección
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="adj-modal-actions">
                                                <button onClick={() => setEditingKey(null)} className="adj-modal-btn-cancel">
                                                    Cancelar
                                                </button>
                                                <button onClick={handleSaveEdit} disabled={saving} className="adj-modal-btn-save">
                                                    <Save size={13} /> Guardar
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={key} className="adj-modal-item-row">
                                        <div className="adj-modal-item-left">
                                            <span
                                                className="adj-modal-badge"
                                                style={{ color: item.color, backgroundColor: item.bg }}
                                            >
                                                {(item.badgeLabel || key).toUpperCase()}
                                            </span>
                                            <div className="adj-modal-item-details">
                                                <div className="adj-modal-item-title-row">
                                                    <span className="adj-modal-item-label">{item.label}</span>
                                                    {item.hidden && <span className="adj-modal-badge-hidden">Oculto</span>}
                                                </div>
                                                <p className="adj-modal-item-desc">{item.description}</p>
                                            </div>
                                        </div>

                                        <div className="adj-modal-item-actions">
                                            <button
                                                className="adj-modal-icon-btn"
                                                onClick={() => handleStartEdit(key, item)}
                                                title="Editar etiquetas y colores"
                                            >
                                                <Pencil size={15} />
                                            </button>
                                            {isSystemStatus ? (
                                                <span className="adj-modal-icon-disabled" title="Los estados base del sistema no se pueden eliminar">
                                                    <ShieldAlert size={15} />
                                                </span>
                                            ) : (
                                                <button
                                                    className="adj-modal-icon-btn adj-modal-icon-btn--delete"
                                                    onClick={() => handleDeleteType(key)}
                                                    title="Eliminar tipo"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                )}
            </div>
        </div>
    );


    if (isEmbedded) return (
        <>
            {content}
        </>
    );

    return (
        <div className="modal-overlay" onClick={onClose}>
            {content}
        </div>
    );
});

export default AdjustmentTypesModal;
