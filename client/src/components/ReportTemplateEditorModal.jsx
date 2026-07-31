import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, FileText, CheckCircle, RefreshCw } from 'lucide-react';
import { getReportTemplateByKey, updateReportTemplate } from '../services/api';
import { showToast } from '../utils/toast';

const FORMAT_OPTIONS = [
    { value: 'currency', label: 'Moneda (COP)' },
    { value: 'number', label: 'Número' },
    { value: 'text', label: 'Texto' },
    { value: 'date', label: 'Fecha' }
];

const DEFAULT_FALLBACK_TEMPLATE = {
    key: 'dashboard-summary',
    name: 'Reporte Resumen del Panel Principal',
    module: 'dashboard',
    sections: [
        {
            sectionTitle: 'RESUMEN DEL PERIODO',
            type: 'stats',
            fields: [
                { label: 'Ingresos Totales', dataKey: 'stats.totalRevenue', format: 'currency' },
                { label: 'Dispositivos Activos', dataKey: 'stats.activeDevices', format: 'number' },
                { label: 'Pagos Pendientes', dataKey: 'stats.pendingPayments', format: 'number' },
                { label: 'Facturado (año)', dataKey: 'stats.totalInvoiced', format: 'currency' },
                { label: 'Cartera Pendiente', dataKey: 'stats.collectionGap', format: 'currency' }
            ]
        },
        {
            sectionTitle: 'PAGOS RECIENTES',
            type: 'table',
            fields: [
                { label: 'Dispositivo', dataKey: 'device', format: 'text' },
                { label: 'Monto (COP)', dataKey: 'amount', format: 'currency' },
                { label: 'Estado', dataKey: 'status', format: 'text' },
                { label: 'Fecha', dataKey: 'date', format: 'date' }
            ]
        }
    ]
};

const ReportTemplateEditorModal = ({ isOpen, onClose, templateKey, onSaved }) => {
    const [template, setTemplate] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen && templateKey) {
            loadTemplate();
        }
    }, [isOpen, templateKey]);

    const loadTemplate = async () => {
        try {
            setLoading(true);
            const res = await getReportTemplateByKey(templateKey);
            const fetchedData = res.data?.data || res.data;
            if (fetchedData && fetchedData.sections) {
                setTemplate(fetchedData);
            } else {
                setTemplate({ ...DEFAULT_FALLBACK_TEMPLATE, key: templateKey });
            }
        } catch (err) {
            console.error('Error loading template from API:', err);
            setTemplate({ ...DEFAULT_FALLBACK_TEMPLATE, key: templateKey });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const handleFieldChange = (sectionIdx, fieldIdx, key, val) => {
        setTemplate(prev => {
            const updatedSections = [...prev.sections];
            const updatedFields = [...updatedSections[sectionIdx].fields];
            updatedFields[fieldIdx] = { ...updatedFields[fieldIdx], [key]: val };
            updatedSections[sectionIdx] = { ...updatedSections[sectionIdx], fields: updatedFields };
            return { ...prev, sections: updatedSections };
        });
    };

    const handleSectionTitleChange = (sectionIdx, val) => {
        setTemplate(prev => {
            const updatedSections = [...prev.sections];
            updatedSections[sectionIdx] = { ...updatedSections[sectionIdx], sectionTitle: val };
            return { ...prev, sections: updatedSections };
        });
    };

    const handleAddField = (sectionIdx) => {
        setTemplate(prev => {
            const updatedSections = [...prev.sections];
            const updatedFields = [...updatedSections[sectionIdx].fields, { label: 'Nuevo Campo', dataKey: 'nuevoCampo', format: 'text' }];
            updatedSections[sectionIdx] = { ...updatedSections[sectionIdx], fields: updatedFields };
            return { ...prev, sections: updatedSections };
        });
    };

    const handleRemoveField = (sectionIdx, fieldIdx) => {
        setTemplate(prev => {
            const updatedSections = [...prev.sections];
            const updatedFields = updatedSections[sectionIdx].fields.filter((_, idx) => idx !== fieldIdx);
            updatedSections[sectionIdx] = { ...updatedSections[sectionIdx], fields: updatedFields };
            return { ...prev, sections: updatedSections };
        });
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await updateReportTemplate(templateKey, template);
            showToast('Plantilla de reporte guardada en BD exitosamente', 'success');
            if (onSaved) onSaved(template);
            onClose();
        } catch (err) {
            showToast('Error guardando plantilla: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1rem'
        }}>
            <div style={{
                background: '#ffffff',
                borderRadius: '0.75rem',
                width: '100%',
                maxWidth: '680px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}>
                {/* Modal Header */}
                <div style={{
                    padding: '1rem 1.25rem',
                    borderBottom: '1px solid #E5E7EB',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileText size={20} style={{ color: '#0070eb' }} />
                        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: '#111827' }}>
                            Plantilla de Reporte ({templateKey})
                        </h2>
                    </div>
                    <button onClick={onClose} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#6B7280' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Body */}
                <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <RefreshCw size={24} className="spin" style={{ color: '#0070eb' }} />
                            <p style={{ marginTop: '0.5rem', color: '#6B7280' }}>Cargando plantilla...</p>
                        </div>
                    ) : template ? (
                        <div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ fontSize: '0.813rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                                    Nombre de la Plantilla
                                </label>
                                <input
                                    type="text"
                                    value={template.name || ''}
                                    onChange={e => setTemplate({ ...template, name: e.target.value })}
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #D1D5DB' }}
                                />
                            </div>

                            {template.sections?.map((section, sIdx) => (
                                <div key={sIdx} style={{
                                    marginBottom: '1.25rem',
                                    border: '1px solid #E5E7EB',
                                    borderRadius: '0.5rem',
                                    padding: '1rem',
                                    background: '#F9FAFB'
                                }}>
                                    <div style={{ marginBottom: '0.75rem' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4B5563' }}>
                                            Sección {sIdx + 1} ({section.type})
                                        </label>
                                        <input
                                            type="text"
                                            value={section.sectionTitle || ''}
                                            onChange={e => handleSectionTitleChange(sIdx, e.target.value)}
                                            style={{ width: '100%', padding: '0.375rem', marginTop: '0.25rem', borderRadius: '0.375rem', border: '1px solid #D1D5DB' }}
                                            placeholder="Título de la sección"
                                        />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {section.fields?.map((field, fIdx) => (
                                            <div key={fIdx} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                background: '#FFFFFF',
                                                padding: '0.375rem 0.5rem',
                                                borderRadius: '0.375rem',
                                                border: '1px solid #E5E7EB'
                                            }}>
                                                <input
                                                    type="text"
                                                    value={field.label}
                                                    onChange={e => handleFieldChange(sIdx, fIdx, 'label', e.target.value)}
                                                    placeholder="Etiqueta / Nombre"
                                                    style={{ flex: 1, padding: '0.25rem 0.5rem', borderRadius: '0.25rem', border: '1px solid #D1D5DB', fontSize: '0.813rem' }}
                                                />
                                                <input
                                                    type="text"
                                                    value={field.dataKey}
                                                    onChange={e => handleFieldChange(sIdx, fIdx, 'dataKey', e.target.value)}
                                                    placeholder="dataKey (ej: stats.totalRevenue)"
                                                    style={{ flex: 1, padding: '0.25rem 0.5rem', borderRadius: '0.25rem', border: '1px solid #D1D5DB', fontSize: '0.813rem', fontFamily: 'monospace' }}
                                                />
                                                <select
                                                    value={field.format}
                                                    onChange={e => handleFieldChange(sIdx, fIdx, 'format', e.target.value)}
                                                    style={{ padding: '0.25rem 0.5rem', borderRadius: '0.25rem', border: '1px solid #D1D5DB', fontSize: '0.813rem' }}
                                                >
                                                    {FORMAT_OPTIONS.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveField(sIdx, fIdx)}
                                                    style={{ border: 0, background: 'transparent', color: '#EF4444', cursor: 'pointer', padding: '0.25rem' }}
                                                    title="Eliminar campo"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleAddField(sIdx)}
                                        style={{
                                            marginTop: '0.75rem',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            color: '#0070eb',
                                            border: 0,
                                            background: 'transparent',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Plus size={14} /> Añadir campo
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>

                {/* Modal Footer */}
                <div style={{
                    padding: '0.875rem 1.25rem',
                    borderTop: '1px solid #E5E7EB',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.5rem'
                }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '0.375rem',
                            border: '1px solid #D1D5DB',
                            background: '#FFFFFF',
                            color: '#374151',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            cursor: 'pointer'
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '0.375rem',
                            border: 0,
                            background: '#0070eb',
                            color: '#FFFFFF',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            cursor: 'pointer'
                        }}
                    >
                        <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Plantilla'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportTemplateEditorModal;
