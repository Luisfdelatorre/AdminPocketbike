import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { getSystemJobs, createSystemJob, updateSystemJob, deleteSystemJob, getAvailableCronJobs } from '../services/api';
import { Clock, Plus, Trash2, Edit2, PlayCircle, ToggleRight, ToggleLeft, Power, X, Save } from 'lucide-react';
import './modals/AdjustmentTypesModal.css';

const formatJobName = (name) => {
    const names = {
        dailyInvoicesCreation: 'Generación Diaria de Facturas',
        dailyPaymentValidation: 'Validación Diaria de Pagos',
        periodicDeviceStatusReview: 'Revisión de Estado de Dispositivos',
        textMessage: 'Envío de Mensajes SMS'
    };
    if (names[name]) return names[name];
    // Fallback: Convert camelCase to Title Case
    const result = name.replace(/([A-Z])/g, " $1");
    return result.charAt(0).toUpperCase() + result.slice(1);
};

const formatJobTime = (time) => {
    if (!time) return '-';
    if (time === '*/5 * * * *') return 'Cada 5 minutos';
    if (time === '*/15 * * * *') return 'Cada 15 minutos';
    if (time === '0,30 * * * *' || time === '*/30 * * * *') return 'Cada 30 minutos';
    if (time === '0 * * * *') return 'Cada hora';
    if (time.includes(':')) {
        const [hhStr, mmStr] = time.split(':');
        const hh = parseInt(hhStr, 10);
        if (!isNaN(hh)) {
            const ampm = hh >= 12 ? 'PM' : 'AM';
            const displayHh = (hh % 12 || 12).toString().padStart(2, '0');
            return `Todos los días a las ${displayHh}:${mmStr || '00'} ${ampm}`;
        }
        return `Todos los días a las ${time}`;
    }

    const parts = time.trim().split(/\s+/);
    if (parts.length === 5 && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
        const mm = parts[0].padStart(2, '0');
        const hh = parseInt(parts[1], 10);
        if (!isNaN(hh)) {
            const ampm = hh >= 12 ? 'PM' : 'AM';
            const displayHh = (hh % 12 || 12).toString().padStart(2, '0');
            return `Todos los días a las ${displayHh}:${mm} ${ampm}`;
        }
    }
    return time;
};

const SystemJobs = forwardRef((props, ref) => {
    const [jobs, setJobs] = useState([]);
    const [availablePlugins, setAvailablePlugins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: '', job: '', time: '', flag: true });
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);

    useImperativeHandle(ref, () => ({
        triggerAdd() {
            setForm({ name: '', job: '', time: '', flag: true });
            setIsEditing(false);
            setEditId(null);
            setShowForm(true);
        }
    }));

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [jobsRes, pluginsRes] = await Promise.all([
                getSystemJobs(),
                getAvailableCronJobs()
            ]);
            if (jobsRes.success) setJobs(jobsRes.data);
            if (pluginsRes.success) {
                // Filter out company-specific plugins (like curfew and cutoff)
                setAvailablePlugins(pluginsRes.data.filter(p => p.type !== 'company'));
            }
        } catch (error) {
            console.error('Error loading system jobs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleStartEdit = (job) => {
        setForm({ name: job.name, job: job.job, time: job.time, flag: job.flag });
        setIsEditing(true);
        setEditId(job._id);
        setShowForm(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (isEditing) {
                await updateSystemJob(editId, form);
            } else {
                await createSystemJob(form);
            }
            setShowForm(false);
            setForm({ name: '', job: '', time: '', flag: true });
            setIsEditing(false);
            setEditId(null);
            loadData();
        } catch (error) {
            console.error('Error saving job:', error);
            alert('Error guardando la rutina global');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar esta rutina global?')) return;
        try {
            await deleteSystemJob(id);
            loadData();
        } catch (error) {
            console.error('Error deleting job:', error);
        }
    };

    const toggleStatus = async (jobRecord) => {
        try {
            await updateSystemJob(jobRecord._id, { flag: !jobRecord.flag });
            loadData();
        } catch (error) {
            console.error('Error toggling job:', error);
        }
    };

    return (
        <div className="system-jobs-container">
            <div className="hidden md:flex justify-end mb-4">
                <button className="btn-primary" onClick={() => {
                    setForm({ name: '', job: '', time: '', flag: true });
                    setIsEditing(false);
                    setEditId(null);
                    setShowForm(true);
                }}>
                    <Plus size={16} /> Añadir Rutina
                </button>
            </div>

            {/* Add / Edit Form Embedded */}
            {showForm && (
                <form onSubmit={handleSave} className="adj-modal-add-card" style={{ marginBottom: '1.5rem' }}>
                    <div className="adj-modal-card-header">
                        <h4 className="adj-modal-card-title">
                            {isEditing ? <Edit2 size={15} /> : <Plus size={15} />}
                            {isEditing ? 'Editar Rutina Global' : 'Nueva Rutina Global'}
                        </h4>
                        <button 
                            type="button" 
                            onClick={() => { setShowForm(false); setIsEditing(false); }} 
                            className="adj-modal-close-icon-btn"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="adj-modal-form-grid">
                        <div className="adj-modal-form-group">
                            <label className="adj-modal-label">Nombre Descriptivo</label>
                            <input 
                                type="text" 
                                required 
                                value={form.name} 
                                onChange={e => setForm({...form, name: e.target.value})}
                                placeholder="Ej. Generar Facturas Diarias"
                                className="adj-modal-input"
                            />
                        </div>

                        <div className="adj-modal-form-group">
                            <label className="adj-modal-label">Plugin a Ejecutar</label>
                            <select 
                                required 
                                value={form.job} 
                                onChange={e => setForm({...form, job: e.target.value})}
                                className="adj-modal-input"
                                style={{ background: '#fff' }}
                            >
                                <option value="">Seleccione un plugin...</option>
                                {availablePlugins.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                                ))}
                            </select>
                        </div>

                        <div className="adj-modal-col-span-2 adj-modal-form-group">
                            <label className="adj-modal-label">Programación / Hora de Ejecución</label>
                            <input 
                                type="text" 
                                required 
                                value={form.time} 
                                onChange={e => setForm({...form, time: e.target.value})}
                                placeholder="HH:mm (ej. 00:01) o Cron (ej. */5 * * * *)"
                                className="adj-modal-input adj-modal-input-mono"
                            />
                            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Frecuencias rápidas:</span>
                                <button 
                                    type="button" 
                                    onClick={() => setForm({...form, time: '*/5 * * * *'})}
                                    style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: form.time === '*/5 * * * *' ? '#e0f2fe' : '#f8fafc', color: '#0369a1', cursor: 'pointer' }}
                                >
                                    Cada 5 min
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setForm({...form, time: '*/15 * * * *'})}
                                    style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: form.time === '*/15 * * * *' ? '#e0f2fe' : '#f8fafc', color: '#0369a1', cursor: 'pointer' }}
                                >
                                    Cada 15 min
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setForm({...form, time: '0,30 * * * *'})}
                                    style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: (form.time === '0,30 * * * *' || form.time === '*/30 * * * *') ? '#e0f2fe' : '#f8fafc', color: '#0369a1', cursor: 'pointer' }}
                                >
                                    Cada 30 min
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setForm({...form, time: '00:01'})}
                                    style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: form.time === '00:01' ? '#e0f2fe' : '#f8fafc', color: '#0369a1', cursor: 'pointer' }}
                                >
                                    Diario 00:01
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="adj-modal-actions">
                        <button 
                            type="button" 
                            onClick={() => { setShowForm(false); setIsEditing(false); }} 
                            className="adj-modal-btn-cancel"
                        >
                            Cancelar
                        </button>
                        <button type="submit" disabled={saving} className="adj-modal-btn-save">
                            <Save size={13} /> {isEditing ? 'Guardar Cambios' : 'Crear Rutina'}
                        </button>
                    </div>
                </form>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando rutinas...</div>
            ) : (
                <>
                {/* Desktop Table */}
                <div className="table-responsive hidden md:block" style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Plugin</th>
                                <th>Hora</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobs.map(job => (
                                <tr key={job._id}>
                                    <td>
                                        <div style={{ fontWeight: 500, color: '#1e293b' }}>{formatJobName(job.name)}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>{job.log}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', display: 'inline-block' }}>
                                            {job.job}
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                                            <Clock size={14} /> {formatJobTime(job.time)}
                                        </span>
                                    </td>
                                    <td>
                                        <button 
                                            className={`engine-toggle-slider ${!job.flag ? 'deactivated' : 'active'}`}
                                            onClick={() => toggleStatus(job)}
                                            title={job.flag ? "Desactivar Rutina" : "Activar Rutina"}
                                        >
                                            <div className="slider-knob">
                                                <Power size={12} />
                                            </div>
                                        </button>
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <button className="btn-icon" onClick={() => handleStartEdit(job)} title="Editar">
                                                <Edit2 size={16} />
                                            </button>
                                            <button className="btn-icon" style={{ color: '#ef4444' }} onClick={() => handleDelete(job._id)} title="Eliminar">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {jobs.length === 0 && (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                        No hay rutinas globales configuradas.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden contracts-list pb-28">
                    {jobs.map(job => (
                        <div
                            key={job._id}
                            className="admin-card shadow-sm max-w-[380px] w-full flex flex-col hover:shadow-md transition-shadow relative"
                        >
                            <header className="flex items-center justify-between mb-2">
                                <div className="flex flex-col">
                                    <h1 className="text-[15px] font-bold text-main-dark">{formatJobName(job.name)}</h1>
                                    <span className="text-[11px] text-gray-400">{job.log}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        className={`engine-toggle-slider ${!job.flag ? 'deactivated' : 'active'}`}
                                        onClick={() => toggleStatus(job)}
                                        title={job.flag ? "Desactivar Rutina" : "Activar Rutina"}
                                    >
                                        <div className="slider-knob">
                                            <Power size={12} />
                                        </div>
                                    </button>
                                </div>
                            </header>

                            <main className="space-y-2 pt-2 border-t border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-700">
                                        <Clock size={14} className="text-blue-500" />
                                        <span>{formatJobTime(job.time)}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            onClick={() => handleStartEdit(job)}
                                            title="Editar"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            onClick={() => handleDelete(job._id)}
                                            title="Eliminar"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="inline-block bg-gray-100 px-2 py-0.5 rounded text-[10px] font-mono text-gray-600">
                                    Plugin: {job.job}
                                </div>
                            </main>
                        </div>
                    ))}
                    {jobs.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                            No hay rutinas globales configuradas.
                        </div>
                    )}
                </div>
                </>
            )}
        </div>
    );
});

export default SystemJobs;
