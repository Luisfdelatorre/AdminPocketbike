import React, { useState, useEffect } from 'react';
import { Sliders, Plus, Trash2, Save, X, RefreshCw, CheckCircle, AlertCircle, Pencil } from 'lucide-react';
import { getAdjustmentTypes, updateAdjustmentTypes } from '../../services/api';

const AdjustmentTypesModal = ({ isOpen = true, isEmbedded = false, onClose }) => {
    const [types, setTypes] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [editingKey, setEditingKey] = useState(null);
    const [editForm, setEditForm] = useState({
        label: '',
        badgeLabel: '',
        color: '#FB9678',
        bg: '#FFF4EF',
        description: '',
        isFree: true,
        hidden: false
    });

    const [showAddForm, setShowAddForm] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [newForm, setNewForm] = useState({
        label: 'Ajuste - Novedad ($0)',
        badgeLabel: 'NOVEDAD',
        color: '#6366F1',
        bg: '#EEF2FF',
        description: 'Día ajustado por novedad — día sin cobro al cliente.',
        isFree: true
    });

    useEffect(() => {
        if (isOpen || isEmbedded) {
            loadTypes();
        }
    }, [isOpen, isEmbedded]);

    const loadTypes = async () => {
        setLoading(true);
        setMessage(null);
        try {
            const res = await getAdjustmentTypes();
            if (res && res.success && res.data) {
                setTypes(res.data);
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Error al cargar tipos de ajuste desde el servidor.' });
        } finally {
            setLoading(false);
        }
    };

    const handleStartEdit = (key, item) => {
        setEditingKey(key);
        setEditForm({
            label: item.label || '',
            badgeLabel: item.badgeLabel || key,
            color: item.color || '#3b82f6',
            bg: item.bg || '#eff6ff',
            description: item.description || '',
            isFree: item.isFree !== undefined ? item.isFree : (item.autoAmount === 0 || !item.isRealPayment),
            hidden: !!item.hidden
        });
    };

    const handleSaveEdit = async () => {
        if (!editingKey) return;
        setSaving(true);
        setMessage(null);

        const updatedTypes = {
            ...types,
            [editingKey]: {
                ...types[editingKey],
                label: editForm.label,
                badgeLabel: editForm.badgeLabel.toUpperCase().trim(),
                color: editForm.color,
                bg: editForm.bg,
                description: editForm.description,
                isFree: editForm.isFree,
                autoAmount: editForm.isFree ? 0 : null,
                autoReference: `${editForm.badgeLabel.toUpperCase().trim()} - Día ajustado automáticamente`,
                hidden: editForm.hidden
            }
        };

        try {
            const res = await updateAdjustmentTypes(updatedTypes);
            if (res && res.success) {
                setTypes(res.data || updatedTypes);
                setEditingKey(null);
                setMessage({ type: 'success', text: 'Tipo de ajuste actualizado exitosamente.' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Error al guardar los cambios en el servidor.' });
        } finally {
            setSaving(false);
        }
    };

    const handleAddType = async (e) => {
        e.preventDefault();
        const formattedKey = newKey.toUpperCase().trim().replace(/[^A_Z0-9_]/g, '_');
        if (!formattedKey) {
            setMessage({ type: 'error', text: 'El código / clave del tipo de ajuste es requerido.' });
            return;
        }

        setSaving(true);
        setMessage(null);

        const updatedTypes = {
            ...types,
            [formattedKey]: {
                label: newForm.label,
                badgeLabel: newForm.badgeLabel.toUpperCase().trim(),
                color: newForm.color,
                bg: newForm.bg,
                description: newForm.description,
                autoAmount: newForm.isFree ? 0 : null,
                autoReference: `${newForm.badgeLabel.toUpperCase().trim()} - Día ajustado automáticamente`,
                isRealPayment: !newForm.isFree,
                isFree: newForm.isFree,
                hidden: false
            }
        };

        try {
            const res = await updateAdjustmentTypes(updatedTypes);
            if (res && res.success) {
                setTypes(res.data || updatedTypes);
                setShowAddForm(false);
                setNewKey('');
                setMessage({ type: 'success', text: `Nuevo tipo de ajuste (${formattedKey}) creado exitosamente.` });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Error al crear el nuevo tipo de ajuste.' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteType = async (key) => {
        if (!window.confirm(`¿Estás seguro de eliminar el tipo de ajuste "${key}"?`)) return;

        setSaving(true);
        setMessage(null);
        const updatedTypes = { ...types };
        delete updatedTypes[key];

        try {
            const res = await updateAdjustmentTypes(updatedTypes);
            if (res && res.success) {
                setTypes(res.data || updatedTypes);
                setMessage({ type: 'success', text: `Tipo de ajuste ${key} eliminado.` });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Error al eliminar el tipo de ajuste.' });
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen && !isEmbedded) return null;

    const content = (
        <div
            className={isEmbedded ? "bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4" : "modal-card"}
            style={isEmbedded ? {} : { maxWidth: '850px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
        >
            <div className="modal-header flex items-center justify-between">
                <div className="modal-header-left flex items-center gap-2">
                    <Sliders size={20} />
                    <span className="font-bold text-slate-800">Tipos de Ajuste y Pagos</span>
                </div>
                {!isEmbedded && onClose && (
                    <button className="modal-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                )}
            </div>

            <div className={isEmbedded ? "flex flex-col gap-4" : "p-5 flex flex-col gap-4"}>
                {message && (
                    <div className={`p-3 rounded-xl flex items-center gap-2 text-sm font-semibold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                        <span>{message.text}</span>
                    </div>
                )}

                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="flex gap-2">
                        <button
                            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
                            onClick={loadTypes}
                            disabled={loading}
                        >
                            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                            Recargar
                        </button>
                        <button
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1.5"
                            onClick={() => setShowAddForm(true)}
                        >
                            <Plus size={13} />
                            Agregar Tipo
                        </button>
                    </div>
                </div>

                {/* Add Form Collapsible */}
                {showAddForm && (
                    <form onSubmit={handleAddType} className="bg-indigo-50/60 border border-indigo-200 p-4 rounded-xl flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-sm text-indigo-900 flex items-center gap-2">
                                <Plus size={15} /> Nuevo Tipo de Ajuste
                            </h4>
                            <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-semibold text-slate-700">Código / Clave (ej: NOVEDAD)</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="CLAVE_UNICA"
                                    value={newKey}
                                    onChange={e => setNewKey(e.target.value.toUpperCase())}
                                    className="w-full text-xs p-2 rounded-lg border border-slate-300 font-mono"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-700">Etiqueta Larga (Dropdown)</label>
                                <input
                                    type="text"
                                    required
                                    value={newForm.label}
                                    onChange={e => setNewForm({ ...newForm, label: e.target.value })}
                                    className="w-full text-xs p-2 rounded-lg border border-slate-300"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-700">Insignia Corta (Badge en Tabla)</label>
                                <input
                                    type="text"
                                    required
                                    value={newForm.badgeLabel}
                                    onChange={e => setNewForm({ ...newForm, badgeLabel: e.target.value })}
                                    className="w-full text-xs p-2 rounded-lg border border-slate-300 font-mono"
                                />
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="text-xs font-semibold text-slate-700">Color Texto</label>
                                    <input
                                        type="color"
                                        value={newForm.color}
                                        onChange={e => setNewForm({ ...newForm, color: e.target.value })}
                                        className="w-full h-8 p-1 rounded-lg border border-slate-300 cursor-pointer"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-semibold text-slate-700">Color Fondo</label>
                                    <input
                                        type="color"
                                        value={newForm.bg}
                                        onChange={e => setNewForm({ ...newForm, bg: e.target.value })}
                                        className="w-full h-8 p-1 rounded-lg border border-slate-300 cursor-pointer"
                                    />
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs font-semibold text-slate-700">Descripción explicativa</label>
                                <input
                                    type="text"
                                    value={newForm.description}
                                    onChange={e => setNewForm({ ...newForm, description: e.target.value })}
                                    className="w-full text-xs p-2 rounded-lg border border-slate-300"
                                />
                            </div>
                            <div className="md:col-span-2 flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="newIsFree"
                                    checked={newForm.isFree}
                                    onChange={e => setNewForm({ ...newForm, isFree: e.target.checked })}
                                />
                                <label htmlFor="newIsFree" className="text-xs font-semibold text-slate-700 cursor-pointer">
                                    Es un día sin cobro ($0 para el cliente)
                                </label>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setShowAddForm(false)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600">
                                Cancelar
                            </button>
                            <button type="submit" disabled={saving} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold flex items-center gap-1">
                                <Save size={13} /> Crear Tipo
                            </button>
                        </div>
                    </form>
                )}

                {/* Adjustment Types List */}
                {loading ? (
                    <div className="text-center py-8 text-slate-500 text-sm">Cargando tipos de ajuste...</div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {Object.entries(types).map(([key, item]) => {
                            const isEditingThis = editingKey === key;

                            if (isEditingThis) {
                                return (
                                    <div key={key} className="bg-slate-100 p-4 rounded-xl border border-indigo-300 flex flex-col gap-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-indigo-900 font-mono">Editando: {key}</span>
                                            <button onClick={() => setEditingKey(null)} className="text-slate-400 hover:text-slate-600">
                                                <X size={16} />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs font-semibold text-slate-700">Etiqueta Larga</label>
                                                <input
                                                    type="text"
                                                    value={editForm.label}
                                                    onChange={e => setEditForm({ ...editForm, label: e.target.value })}
                                                    className="w-full text-xs p-2 rounded-lg border border-slate-300"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-700">Insignia Corta</label>
                                                <input
                                                    type="text"
                                                    value={editForm.badgeLabel}
                                                    onChange={e => setEditForm({ ...editForm, badgeLabel: e.target.value })}
                                                    className="w-full text-xs p-2 rounded-lg border border-slate-300 font-mono"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <label className="text-xs font-semibold text-slate-700">Color Texto</label>
                                                    <input
                                                        type="color"
                                                        value={editForm.color}
                                                        onChange={e => setEditForm({ ...editForm, color: e.target.value })}
                                                        className="w-full h-8 p-1 rounded-lg border border-slate-300 cursor-pointer"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-xs font-semibold text-slate-700">Color Fondo</label>
                                                    <input
                                                        type="color"
                                                        value={editForm.bg}
                                                        onChange={e => setEditForm({ ...editForm, bg: e.target.value })}
                                                        className="w-full h-8 p-1 rounded-lg border border-slate-300 cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-xs font-semibold text-slate-700">Descripción</label>
                                                <input
                                                    type="text"
                                                    value={editForm.description}
                                                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                                    className="w-full text-xs p-2 rounded-lg border border-slate-300"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id={`editIsFree_${key}`}
                                                    checked={editForm.isFree}
                                                    onChange={e => setEditForm({ ...editForm, isFree: e.target.checked })}
                                                />
                                                <label htmlFor={`editIsFree_${key}`} className="text-xs font-semibold text-slate-700 cursor-pointer">
                                                    Día sin cobro ($0)
                                                </label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id={`editHidden_${key}`}
                                                    checked={editForm.hidden}
                                                    onChange={e => setEditForm({ ...editForm, hidden: e.target.checked })}
                                                />
                                                <label htmlFor={`editHidden_${key}`} className="text-xs font-semibold text-slate-700 cursor-pointer">
                                                    Ocultar del menú de selección
                                                </label>
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setEditingKey(null)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600">
                                                Cancelar
                                            </button>
                                            <button onClick={handleSaveEdit} disabled={saving} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold flex items-center gap-1">
                                                <Save size={13} /> Guardar
                                            </button>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div key={key} className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3 hover:border-slate-300 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span
                                            className="px-2.5 py-1 rounded-full text-xs font-bold font-mono tracking-wide flex-shrink-0"
                                            style={{ color: item.color, backgroundColor: item.bg }}
                                        >
                                            {item.badgeLabel || key}
                                        </span>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-800 truncate">{item.label}</span>
                                                {item.hidden && <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-semibold">Oculto</span>}
                                                {item.isFree ? (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-semibold border border-emerald-200">$0 Gratis</span>
                                                ) : (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold border border-blue-200">Pago Real</span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-slate-500 truncate">{item.description}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
                                            onClick={() => handleStartEdit(key, item)}
                                            title="Editar tipo"
                                        >
                                            <Pencil size={15} />
                                        </button>
                                        <button
                                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors"
                                            onClick={() => handleDeleteType(key)}
                                            title="Eliminar tipo"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );

    if (isEmbedded) return content;

    return (
        <div className="modal-overlay" onClick={onClose}>
            {content}
        </div>
    );
};

export default AdjustmentTypesModal;
