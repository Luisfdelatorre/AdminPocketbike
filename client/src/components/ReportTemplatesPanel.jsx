import React, { useEffect, useMemo, useState } from 'react';
import { FileText, ArrowUp, ArrowDown, Trash2, Plus, Save, RotateCcw, Loader2 } from 'lucide-react';
import { getReportTemplates, saveReportTemplate, resetReportTemplate } from '../services/api';
import { showToast } from '../utils/toast';
import './ReportTemplatesPanel.css';

const FORMAT_LABELS = {
    currency: 'Moneda (COP)',
    number: 'Número',
    text: 'Texto',
    date: 'Fecha',
};

const cloneTemplate = (tpl) => JSON.parse(JSON.stringify(tpl));

/**
 * Per-company editor for the report templates catalog.
 * Fields can be relabeled, reordered, reformatted, removed or re-added from
 * the server whitelist (section.allowedFields); the server validates again.
 */
const ReportTemplatesPanel = ({ canEdit }) => {
    const [templates, setTemplates] = useState([]);
    const [selectedKey, setSelectedKey] = useState(null);
    const [draft, setDraft] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [confirmReset, setConfirmReset] = useState(false);

    useEffect(() => {
        let mounted = true;
        getReportTemplates()
            .then((res) => {
                if (!mounted) return;
                const list = res?.success && Array.isArray(res.data) ? res.data : [];
                setTemplates(list);
                if (list[0]) {
                    setSelectedKey(list[0].key);
                    setDraft(cloneTemplate(list[0]));
                }
            })
            .catch(() => showToast('error', 'Plantillas', 'No se pudieron cargar las plantillas de reporte'))
            .finally(() => mounted && setLoading(false));
        return () => { mounted = false; };
    }, []);

    const original = useMemo(() => templates.find((t) => t.key === selectedKey), [templates, selectedKey]);
    const isDirty = useMemo(
        () => Boolean(draft && original && JSON.stringify(draft) !== JSON.stringify(original)),
        [draft, original]
    );

    const selectTemplate = (key) => {
        const tpl = templates.find((t) => t.key === key);
        setSelectedKey(key);
        setDraft(tpl ? cloneTemplate(tpl) : null);
        setConfirmReset(false);
    };

    const updateSection = (sectionIdx, updater) => {
        setDraft((prev) => {
            const next = cloneTemplate(prev);
            next.sections[sectionIdx] = updater(next.sections[sectionIdx]);
            return next;
        });
    };

    const updateField = (sectionIdx, fieldIdx, patch) => updateSection(sectionIdx, (section) => {
        section.fields[fieldIdx] = { ...section.fields[fieldIdx], ...patch };
        return section;
    });

    const moveField = (sectionIdx, fieldIdx, delta) => updateSection(sectionIdx, (section) => {
        const target = fieldIdx + delta;
        if (target < 0 || target >= section.fields.length) return section;
        const [item] = section.fields.splice(fieldIdx, 1);
        section.fields.splice(target, 0, item);
        return section;
    });

    const removeField = (sectionIdx, fieldIdx) => updateSection(sectionIdx, (section) => {
        if (section.fields.length > 1) section.fields.splice(fieldIdx, 1);
        return section;
    });

    const addField = (sectionIdx, dataKey) => updateSection(sectionIdx, (section) => {
        if (!dataKey || section.fields.some((f) => f.dataKey === dataKey)) return section;
        section.fields.push({ label: dataKey.split('.').pop(), dataKey, format: section.allowedFields[dataKey] || 'text' });
        return section;
    });

    const replaceTemplate = (saved) => {
        setTemplates((prev) => prev.map((t) => (t.key === saved.key ? saved : t)));
        setDraft(cloneTemplate(saved));
    };

    const handleSave = async () => {
        if (!draft || saving) return;
        setSaving(true);
        try {
            const payload = {
                name: draft.name,
                sections: draft.sections.map(({ id, sectionTitle, fields }) => ({ id, sectionTitle, fields })),
            };
            const res = await saveReportTemplate(draft.key, payload);
            if (!res?.success) throw new Error(res?.error);
            replaceTemplate(res.data);
            showToast('success', 'Plantilla guardada', 'Los próximos reportes usarán esta configuración');
        } catch (error) {
            const message = error?.response?.data?.error || error?.message || 'Error guardando la plantilla';
            showToast('error', 'Plantilla', message);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!confirmReset) { setConfirmReset(true); return; }
        setSaving(true);
        try {
            const res = await resetReportTemplate(draft.key);
            if (!res?.success) throw new Error(res?.error);
            replaceTemplate(res.data);
            showToast('success', 'Plantilla restaurada', 'Se restauraron los valores por defecto');
        } catch (error) {
            showToast('error', 'Plantilla', error?.response?.data?.error || 'No se pudo restaurar la plantilla');
        } finally {
            setSaving(false);
            setConfirmReset(false);
        }
    };

    if (loading) {
        return <div className="rtp-empty"><Loader2 size={18} className="spin" /> Cargando plantillas…</div>;
    }
    if (!draft) {
        return <div className="rtp-empty">No hay plantillas de reporte disponibles.</div>;
    }

    return (
        <div className="rtp-panel">
            <div className="rtp-header">
                <div>
                    <h3 className="rtp-title"><FileText size={18} /> Plantillas de reportes</h3>
                    <p className="rtp-subtitle">
                        Define qué columnas, etiquetas y formatos incluye cada exportación CSV de esta empresa.
                    </p>
                </div>
                {templates.length > 1 && (
                    <select className="rtp-select" value={selectedKey} onChange={(e) => selectTemplate(e.target.value)}>
                        {templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
                    </select>
                )}
            </div>

            <div className="rtp-meta">
                <span className={`rtp-badge ${draft.isCustom ? 'custom' : ''}`}>
                    {draft.isCustom ? 'Personalizada' : 'Por defecto'}
                </span>
                {draft.description && <span className="rtp-description">{draft.description}</span>}
            </div>

            <label className="rtp-label" htmlFor="rtp-name">Nombre del reporte</label>
            <input
                id="rtp-name"
                className="rtp-input"
                value={draft.name}
                maxLength={80}
                disabled={!canEdit}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            />

            {draft.sections.map((section, sIdx) => {
                const available = Object.keys(section.allowedFields)
                    .filter((key) => !section.fields.some((f) => f.dataKey === key));
                return (
                    <section key={section.id} className="rtp-section">
                        <div className="rtp-section-head">
                            <input
                                className="rtp-input rtp-section-title"
                                value={section.sectionTitle}
                                maxLength={60}
                                disabled={!canEdit}
                                aria-label="Título de la sección"
                                onChange={(e) => updateSection(sIdx, (s) => ({ ...s, sectionTitle: e.target.value }))}
                            />
                            <span className="rtp-section-type">{section.type === 'stats' ? 'Indicadores' : 'Tabla'}</span>
                        </div>

                        <div className="rtp-fields">
                            {section.fields.map((field, fIdx) => (
                                <div key={field.dataKey} className="rtp-field-row">
                                    <input
                                        className="rtp-input"
                                        value={field.label}
                                        maxLength={60}
                                        disabled={!canEdit}
                                        aria-label={`Etiqueta de ${field.dataKey}`}
                                        onChange={(e) => updateField(sIdx, fIdx, { label: e.target.value })}
                                    />
                                    <code className="rtp-datakey">{field.dataKey}</code>
                                    <select
                                        className="rtp-select"
                                        value={field.format}
                                        disabled={!canEdit}
                                        aria-label={`Formato de ${field.dataKey}`}
                                        onChange={(e) => updateField(sIdx, fIdx, { format: e.target.value })}
                                    >
                                        {Object.entries(FORMAT_LABELS).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                    {canEdit && (
                                        <div className="rtp-row-actions">
                                            <button type="button" className="rtp-icon-btn" title="Subir" disabled={fIdx === 0} onClick={() => moveField(sIdx, fIdx, -1)}><ArrowUp size={14} /></button>
                                            <button type="button" className="rtp-icon-btn" title="Bajar" disabled={fIdx === section.fields.length - 1} onClick={() => moveField(sIdx, fIdx, 1)}><ArrowDown size={14} /></button>
                                            <button type="button" className="rtp-icon-btn danger" title="Quitar" disabled={section.fields.length === 1} onClick={() => removeField(sIdx, fIdx)}><Trash2 size={14} /></button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {canEdit && available.length > 0 && (
                            <div className="rtp-add">
                                <Plus size={14} />
                                <select
                                    className="rtp-select"
                                    value=""
                                    aria-label="Agregar campo"
                                    onChange={(e) => addField(sIdx, e.target.value)}
                                >
                                    <option value="">Agregar campo…</option>
                                    {available.map((key) => <option key={key} value={key}>{key}</option>)}
                                </select>
                            </div>
                        )}
                    </section>
                );
            })}

            {canEdit ? (
                <div className="rtp-actions">
                    {draft.isCustom && (
                        <button type="button" className="btn-secondary" onClick={handleReset} disabled={saving}>
                            <RotateCcw size={16} /> {confirmReset ? 'Confirmar restauración' : 'Restaurar por defecto'}
                        </button>
                    )}
                    <button type="button" className="btn-primary" onClick={handleSave} disabled={saving || !isDirty}>
                        {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Guardar plantilla
                    </button>
                </div>
            ) : (
                <p className="rtp-readonly">Solo administradores y managers pueden modificar las plantillas.</p>
            )}
        </div>
    );
};

export default ReportTemplatesPanel;
