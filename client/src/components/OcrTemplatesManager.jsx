import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
    FileText,
    Plus,
    Save,
    RotateCcw,
    Search,
    Trash2,
    Edit2,
    X,
    Calendar,
    Check,
    AlertCircle,
    Layers,
    ShieldCheck,
    CreditCard,
    Car,
    FileSpreadsheet
} from 'lucide-react';
import { getOcrTemplates, updateOcrTemplates, resetOcrTemplates } from '../services/api';
import './OcrTemplatesManager.css';

const CATEGORY_DEFINITIONS = {
    all: { label: 'Todos' },
    soat: { label: 'SOAT', badgeClass: 'soat' },
    tarjeta_propiedad: { label: 'Tarjeta', badgeClass: 'tarjeta_propiedad' },
    cedula: { label: 'C.C./ PPT', badgeClass: 'cedula' },
    licencia: { label: 'Licencia', badgeClass: 'licencia' }
};

const OcrTemplatesManager = forwardRef((props, ref) => {
    const [templates, setTemplates] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeCategory, setActiveCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusMessage, setStatusMessage] = useState(null);

    // Editor State
    const [editingTemplateId, setEditingTemplateId] = useState(null);
    const [editFormData, setEditFormData] = useState(null);
    const [showNewModal, setShowNewModal] = useState(false);
    const [newForm, setNewForm] = useState({ id: '', name: '', category: 'soat', cloneFrom: 'standard' });
    const [newAliasInputs, setNewAliasInputs] = useState({});

    useImperativeHandle(ref, () => ({
        triggerAdd() {
            setShowNewModal(true);
        }
    }));

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoading(true);
        setStatusMessage(null);
        try {
            const res = await getOcrTemplates();
            if (res?.success && res?.data) {
                setTemplates(res.data);
            }
        } catch (error) {
            console.error('Error loading OCR templates:', error);
            setStatusMessage({ type: 'error', text: 'Error al cargar las plantillas OCR' });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveTemplates = async (updatedTemplates) => {
        setSaving(true);
        setStatusMessage(null);
        try {
            const res = await updateOcrTemplates(updatedTemplates);
            if (res?.success) {
                setTemplates(updatedTemplates);
                setStatusMessage({ type: 'success', text: 'Plantillas OCR sincronizadas exitosamente' });
                setTimeout(() => setStatusMessage(null), 3500);
                setEditingTemplateId(null);
                setEditFormData(null);
            } else {
                setStatusMessage({ type: 'error', text: res?.error || 'Error al guardar plantillas' });
            }
        } catch (error) {
            console.error('Error saving templates:', error);
            setStatusMessage({ type: 'error', text: 'Error al guardar cambios en las plantillas' });
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!window.confirm('¿Deseas restablecer todas las plantillas a los valores oficiales de fábrica? Esta acción sobrescribirá cambios personalizados.')) {
            return;
        }
        setSaving(true);
        try {
            const res = await resetOcrTemplates();
            if (res?.success && res?.data) {
                setTemplates(res.data);
                setEditingTemplateId(null);
                setEditFormData(null);
                setStatusMessage({ type: 'success', text: 'Plantillas restauradas a los valores por defecto' });
                setTimeout(() => setStatusMessage(null), 3500);
            }
        } catch (error) {
            console.error('Error resetting templates:', error);
            setStatusMessage({ type: 'error', text: 'Error al restablecer las plantillas' });
        } finally {
            setSaving(false);
        }
    };

    // Iniciar edición de una plantilla
    const handleStartEdit = (templateId) => {
        const tpl = templates[templateId];
        if (!tpl) return;
        setEditingTemplateId(templateId);
        setEditFormData(JSON.parse(JSON.stringify(tpl)));
        setNewAliasInputs({});
    };

    // Guardar cambios de la plantilla en edición
    const handleSaveCurrentEdit = () => {
        if (!editingTemplateId || !editFormData) return;
        const updated = {
            ...templates,
            [editingTemplateId]: editFormData
        };
        handleSaveTemplates(updated);
    };

    // Eliminar plantilla
    const handleDeleteTemplate = (templateId) => {
        if (templateId === 'standard') {
            alert('La plantilla oficial estándar de SOAT no se puede eliminar.');
            return;
        }
        const tplName = templates[templateId]?.name || templateId;
        if (!window.confirm(`¿Estás seguro de eliminar la plantilla "${tplName}"?`)) {
            return;
        }
        const updated = { ...templates };
        delete updated[templateId];
        handleSaveTemplates(updated);
    };

    // Crear nueva plantilla
    const handleCreateTemplate = (e) => {
        e.preventDefault();
        const safeId = newForm.id.toLowerCase().replace(/[^a-z0-9_]/g, '_').trim();
        if (!safeId || templates[safeId]) {
            alert('El identificador de plantilla es inválido o ya existe.');
            return;
        }

        const sourceTemplate = templates[newForm.cloneFrom] || Object.values(templates)[0];
        const newTpl = JSON.parse(JSON.stringify(sourceTemplate || { fields: {} }));
        newTpl.id = safeId;
        newTpl.name = newForm.name || safeId;
        newTpl.category = newForm.category;

        const updated = {
            ...templates,
            [safeId]: newTpl
        };

        setTemplates(updated);
        setShowNewModal(false);
        setNewForm({ id: '', name: '', category: 'soat', cloneFrom: 'standard' });
        handleStartEdit(safeId);
    };

    // Helpers para edición de campos dentro del modal de edición
    const handleFieldMainKeyChange = (field, newKey) => {
        setEditFormData(prev => {
            const currentDef = prev.fields[field] || [newKey, false];
            return {
                ...prev,
                fields: {
                    ...prev.fields,
                    [field]: [newKey, currentDef[1], ...currentDef.slice(2)]
                }
            };
        });
    };

    const handleFieldUppercaseToggle = (field) => {
        setEditFormData(prev => {
            const currentDef = prev.fields[field] || ['', false];
            return {
                ...prev,
                fields: {
                    ...prev.fields,
                    [field]: [currentDef[0], !currentDef[1], ...currentDef.slice(2)]
                }
            };
        });
    };

    const handleAddAlias = (field) => {
        const text = (newAliasInputs[field] || '').trim();
        if (!text) return;
        setEditFormData(prev => {
            const currentDef = prev.fields[field] || ['', false];
            const aliases = currentDef.slice(2);
            if (!aliases.includes(text)) {
                return {
                    ...prev,
                    fields: {
                        ...prev.fields,
                        [field]: [currentDef[0], currentDef[1], ...aliases, text]
                    }
                };
            }
            return prev;
        });
        setNewAliasInputs(prev => ({ ...prev, [field]: '' }));
    };

    const handleRemoveAlias = (field, idx) => {
        setEditFormData(prev => {
            const currentDef = prev.fields[field] || ['', false];
            const aliases = currentDef.slice(2).filter((_, i) => i !== idx);
            return {
                ...prev,
                fields: {
                    ...prev.fields,
                    [field]: [currentDef[0], currentDef[1], ...aliases]
                }
            };
        });
    };

    const handleAddDateKey = (dateType) => {
        const text = (newAliasInputs[`date_${dateType}`] || '').trim();
        if (!text) return;
        setEditFormData(prev => {
            const dates = { ...(prev.dates || {}) };
            const list = dates[dateType] || [];
            if (!list.includes(text)) {
                dates[dateType] = [...list, text];
            }
            return { ...prev, dates };
        });
        setNewAliasInputs(prev => ({ ...prev, [`date_${dateType}`]: '' }));
    };

    const handleRemoveDateKey = (dateType, idx) => {
        setEditFormData(prev => {
            const dates = { ...(prev.dates || {}) };
            const list = (dates[dateType] || []).filter((_, i) => i !== idx);
            dates[dateType] = list;
            return { ...prev, dates };
        });
    };

    if (loading) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <p>Cargando lista de plantillas OCR...</p>
            </div>
        );
    }

    const templateList = Object.entries(templates).map(([key, data]) => ({
        id: key,
        ...data,
        category: data.category || 'soat'
    }));

    const filteredTemplates = templateList.filter(tpl => {
        const matchesCategory = activeCategory === 'all' || tpl.category === activeCategory;
        if (!matchesCategory) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (tpl.name && tpl.name.toLowerCase().includes(q)) ||
            (tpl.id && tpl.id.toLowerCase().includes(q)) ||
            (tpl.category && tpl.category.toLowerCase().includes(q))
        );
    });

    const getCategoryBadge = (cat) => {
        const def = CATEGORY_DEFINITIONS[cat] || { label: cat.toUpperCase(), badgeClass: 'soat' };
        return <span className={`ocr-type-badge ${def.badgeClass}`}>{def.label}</span>;
    };

    return (
        <div className="ocr-manager-container">
            {/* Category Filter Tabs */}
            <div className="ocr-category-tabs">
                {Object.entries(CATEGORY_DEFINITIONS).map(([catKey, def]) => (
                    <button
                        key={catKey}
                        type="button"
                        className={`ocr-cat-tab-btn ${activeCategory === catKey ? 'active' : ''}`}
                        onClick={() => setActiveCategory(catKey)}
                    >
                        <Layers size={14} />
                        {def.label}
                    </button>
                ))}
            </div>

            {/* List Toolbar: Search & Global Actions
            <div className="ocr-list-toolbar">
                <div className="ocr-search-box">
                    <Search size={15} />
                    <input
                        type="text"
                        placeholder="Buscar plantilla o tipo de documento..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                        type="button"
                        className="btn-ocr-reset"
                        onClick={handleReset}
                        disabled={saving}
                        title="Restablecer plantillas al estado de fábrica"
                    >
                        <RotateCcw size={14} /> Restaurar Fábrica
                    </button>
                    <button
                        type="button"
                        className="btn-ocr-save"
                        onClick={() => setShowNewModal(true)}
                    >
                        <Plus size={15} /> Nueva Plantilla
                    </button>
                </div>
            </div> */}

            {/* Status Message */}
            {statusMessage && (
                <div
                    style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        backgroundColor: statusMessage.type === 'success' ? '#ecfdf5' : '#fef2f2',
                        color: statusMessage.type === 'success' ? '#065f46' : '#991b1b',
                        border: `1px solid ${statusMessage.type === 'success' ? '#a7f3d0' : '#fecaca'}`
                    }}
                >
                    {statusMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                    {statusMessage.text}
                </div>
            )}

            {/* ── DESKTOP TABLE VIEW ── */}
            <div className="ocr-table-container">
                <table className="ocr-table">
                    <thead>
                        <tr>
                            <th>Título de Plantilla</th>
                            <th>Tipo de Documento</th>
                            <th>Campos Extraídos</th>
                            <th>Origen</th>
                            <th style={{ textAlign: 'right' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTemplates.map(tpl => {
                            const fieldCount = Object.keys(tpl.fields || {}).length;
                            const isSystem = ['standard', 'tarjeta_propiedad_runt', 'cedula_ciudadania', 'licencia_conduccion'].includes(tpl.id);

                            return (
                                <tr key={tpl.id}>
                                    <td>
                                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{tpl.name || tpl.id}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>ID: {tpl.id}</div>
                                    </td>
                                    <td>{getCategoryBadge(tpl.category)}</td>
                                    <td>
                                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                                            {fieldCount} campos configurados
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`ocr-source-badge ${isSystem ? '' : 'custom'}`}>
                                            {isSystem ? 'SISTEMA' : 'PERSONALIZADA'}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <button
                                                type="button"
                                                className="ocr-btn-edit"
                                                onClick={() => handleStartEdit(tpl.id)}
                                                title="Configurar etiquetas y campos"
                                            >
                                                <Edit2 size={14} /> Configurar
                                            </button>
                                            {!isSystem && (
                                                <button
                                                    type="button"
                                                    className="ocr-btn-delete"
                                                    onClick={() => handleDeleteTemplate(tpl.id)}
                                                    title="Eliminar plantilla"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredTemplates.length === 0 && (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                                    No se encontraron plantillas para el filtro seleccionado.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── MOBILE CARDS VIEW ── */}
            <div className="ocr-mobile-cards">
                {filteredTemplates.map(tpl => {
                    const fieldCount = Object.keys(tpl.fields || {}).length;
                    const isSystem = ['standard', 'tarjeta_propiedad_runt', 'cedula_ciudadania', 'licencia_conduccion'].includes(tpl.id);

                    return (
                        <div key={tpl.id} className="ocr-card">
                            <div className="ocr-card-header">
                                <div>
                                    <h4 className="ocr-card-title">{tpl.name || tpl.id}</h4>
                                    <span className="ocr-card-id">ID: {tpl.id}</span>
                                </div>
                                {getCategoryBadge(tpl.category)}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem', color: '#64748b' }}>
                                <span>{fieldCount} campos configurados</span>
                                <span className={`ocr-source-badge ${isSystem ? '' : 'custom'}`}>
                                    {isSystem ? 'SISTEMA' : 'PERSONALIZADA'}
                                </span>
                            </div>

                            <div className="ocr-card-footer">
                                <button
                                    type="button"
                                    className="ocr-btn-edit"
                                    onClick={() => handleStartEdit(tpl.id)}
                                    style={{ width: '100%', justifyContent: 'center' }}
                                >
                                    <Edit2 size={14} /> Configurar Etiquetas & Campos
                                </button>
                                {!isSystem && (
                                    <button
                                        type="button"
                                        className="ocr-btn-delete"
                                        onClick={() => handleDeleteTemplate(tpl.id)}
                                        style={{ marginLeft: '0.5rem' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── DETAIL / FIELD EDITOR MODAL ── */}
            {editingTemplateId && editFormData && (
                <div className="ocr-editor-modal-overlay" onClick={() => setEditingTemplateId(null)}>
                    <div className="ocr-editor-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="ocr-editor-header">
                            <div className="ocr-editor-title-group">
                                <FileText size={20} style={{ color: '#0d9488' }} />
                                <div>
                                    <h3 className="ocr-editor-title">{editFormData.name || editingTemplateId}</h3>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                        Tipo: {CATEGORY_DEFINITIONS[editFormData.category]?.label || editFormData.category} | ID: {editingTemplateId}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingTemplateId(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                            >
                                <X size={22} />
                            </button>
                        </div>

                        <div className="ocr-editor-body">
                            {/* General Template Info */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                                <div>
                                    <label className="ocr-input-label">Título Descriptivo:</label>
                                    <input
                                        type="text"
                                        className="ocr-main-key-input"
                                        value={editFormData.name || ''}
                                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="ocr-input-label">Tipo de Documento:</label>
                                    <select
                                        className="ocr-main-key-input"
                                        value={editFormData.category || 'soat'}
                                        onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                                    >
                                        <option value="soat">SOAT</option>
                                        <option value="tarjeta_propiedad">Tarjeta de Propiedad</option>
                                        <option value="cedula">Cédula / PPT</option>
                                        <option value="licencia">Licencia de Conducción</option>
                                    </select>
                                </div>
                            </div>

                            {/* Fields List */}
                            <div>
                                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9375rem', color: '#0f172a', fontWeight: 700 }}>
                                    Etiquetas y Campos Mapeados ({Object.keys(editFormData.fields || {}).length})
                                </h4>

                                <div className="ocr-editor-fields-grid">
                                    {Object.entries(editFormData.fields || {}).map(([field, fieldDef]) => {
                                        const mainKey = fieldDef[0] || '';
                                        const uppercase = Boolean(fieldDef[1]);
                                        const aliases = fieldDef.slice(2) || [];

                                        return (
                                            <div key={field} className="ocr-field-card">
                                                <div className="ocr-field-header">
                                                    <span className="ocr-field-name">{field}</span>
                                                    <label className="ocr-field-toggle">
                                                        <input
                                                            type="checkbox"
                                                            checked={uppercase}
                                                            onChange={() => handleFieldUppercaseToggle(field)}
                                                        />
                                                        MAYÚSCULAS
                                                    </label>
                                                </div>

                                                <div>
                                                    <span className="ocr-input-label">Etiqueta Principal en Documento:</span>
                                                    <input
                                                        type="text"
                                                        className="ocr-main-key-input"
                                                        value={mainKey}
                                                        onChange={(e) => handleFieldMainKeyChange(field, e.target.value)}
                                                    />
                                                </div>

                                                <div>
                                                    <span className="ocr-input-label">Etiquetas Alternativas (Aliases):</span>
                                                    <div className="ocr-chips-list">
                                                        {aliases.map((alias, idx) => (
                                                            <span key={idx} className="ocr-chip">
                                                                {alias}
                                                                <button
                                                                    type="button"
                                                                    className="ocr-chip-delete"
                                                                    onClick={() => handleRemoveAlias(field, idx)}
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>

                                                    <div className="ocr-add-alias-row">
                                                        <input
                                                            type="text"
                                                            className="ocr-add-alias-input"
                                                            placeholder="Añadir alias..."
                                                            value={newAliasInputs[field] || ''}
                                                            onChange={(e) => setNewAliasInputs({ ...newAliasInputs, [field]: e.target.value })}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleAddAlias(field);
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="ocr-btn-add-alias"
                                                            onClick={() => handleAddAlias(field)}
                                                        >
                                                            + Añadir
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Dates configuration if present */}
                            {editFormData.dates && (
                                <div>
                                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9375rem', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <Calendar size={16} style={{ color: '#0d9488' }} />
                                        Reglas para Búsqueda de Fechas
                                    </h4>

                                    <div className="ocr-editor-fields-grid">
                                        {Object.entries(editFormData.dates).filter(([k]) => k !== 'vigenciaGroup').map(([dateType, keysList]) => {
                                            const list = Array.isArray(keysList) ? keysList : [keysList];
                                            return (
                                                <div key={dateType} className="ocr-field-card">
                                                    <span className="ocr-field-name">{dateType}</span>
                                                    <div className="ocr-chips-list">
                                                        {list.map((keyStr, idx) => (
                                                            <span key={idx} className="ocr-chip">
                                                                {keyStr}
                                                                <button
                                                                    type="button"
                                                                    className="ocr-chip-delete"
                                                                    onClick={() => handleRemoveDateKey(dateType, idx)}
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <div className="ocr-add-alias-row">
                                                        <input
                                                            type="text"
                                                            className="ocr-add-alias-input"
                                                            placeholder={`Nueva clave para ${dateType}...`}
                                                            value={newAliasInputs[`date_${dateType}`] || ''}
                                                            onChange={(e) => setNewAliasInputs({ ...newAliasInputs, [`date_${dateType}`]: e.target.value })}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleAddDateKey(dateType);
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="ocr-btn-add-alias"
                                                            onClick={() => handleAddDateKey(dateType)}
                                                        >
                                                            + Añadir
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="ocr-editor-footer">
                            <button
                                type="button"
                                className="btn-ocr-reset"
                                onClick={() => setEditingTemplateId(null)}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="btn-ocr-save"
                                onClick={handleSaveCurrentEdit}
                                disabled={saving}
                            >
                                <Save size={15} /> {saving ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Crear Nueva Plantilla */}
            {showNewModal && (
                <div className="ocr-editor-modal-overlay" onClick={() => setShowNewModal(false)}>
                    <div className="ocr-editor-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="ocr-editor-header">
                            <h3 className="ocr-editor-title">Nueva Plantilla OCR</h3>
                            <button
                                type="button"
                                onClick={() => setShowNewModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateTemplate} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label className="ocr-input-label">Identificador Único (ID):</label>
                                <input
                                    type="text"
                                    className="ocr-main-key-input"
                                    placeholder="ej: soat_sura_2027"
                                    required
                                    value={newForm.id}
                                    onChange={(e) => setNewForm({ ...newForm, id: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="ocr-input-label">Título Descriptivo:</label>
                                <input
                                    type="text"
                                    className="ocr-main-key-input"
                                    placeholder="ej: SOAT Digital Sura v2"
                                    required
                                    value={newForm.name}
                                    onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="ocr-input-label">Tipo de Documento:</label>
                                <select
                                    className="ocr-main-key-input"
                                    value={newForm.category}
                                    onChange={(e) => setNewForm({ ...newForm, category: e.target.value })}
                                >
                                    <option value="soat">SOAT</option>
                                    <option value="tarjeta_propiedad">Tarjeta de Propiedad</option>
                                    <option value="cedula">Cédula / PPT</option>
                                    <option value="licencia">Licencia de Conducción</option>
                                </select>
                            </div>

                            <div>
                                <label className="ocr-input-label">Clonar Campos Iniciales Desde:</label>
                                <select
                                    className="ocr-main-key-input"
                                    value={newForm.cloneFrom}
                                    onChange={(e) => setNewForm({ ...newForm, cloneFrom: e.target.value })}
                                >
                                    {templateList.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.name} ({CATEGORY_DEFINITIONS[t.category]?.label || t.category})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    className="btn-ocr-reset"
                                    onClick={() => setShowNewModal(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn-ocr-save"
                                >
                                    Crear y Configurar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
});

export default OcrTemplatesManager;
