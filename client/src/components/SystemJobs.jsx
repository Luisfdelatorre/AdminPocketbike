import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getSystemJobs, createSystemJob, updateSystemJob, deleteSystemJob, getAvailableCronJobs } from '../services/api';
import { Clock, Plus, Trash2, Edit2, PlayCircle, ToggleRight, ToggleLeft, Power } from 'lucide-react';
import PageHeader from './PageHeader';

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
    return time;
};

const SystemJobs = () => {
    const [jobs, setJobs] = useState([]);
    const [availablePlugins, setAvailablePlugins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ name: '', job: '', time: '', flag: true });
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [fabPortalElement, setFabPortalElement] = useState(null);

    useEffect(() => {
        setFabPortalElement(document.body);
    }, []);

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

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await updateSystemJob(editId, form);
            } else {
                await createSystemJob(form);
            }
            setShowModal(false);
            setForm({ name: '', job: '', time: '', flag: true });
            setIsEditing(false);
            loadData();
        } catch (error) {
            console.error('Error saving job:', error);
            alert('Error guardando la rutina global');
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
                    setShowModal(true);
                }}>
                    <Plus size={16} /> Añadir Rutina
                </button>
            </div>

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
                                            <button className="btn-icon" onClick={() => {
                                                setForm({ name: job.name, job: job.job, time: job.time, flag: job.flag });
                                                setIsEditing(true);
                                                setEditId(job._id);
                                                setShowModal(true);
                                            }}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button className="btn-icon" style={{ color: '#ef4444' }} onClick={() => handleDelete(job._id)}>
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
                                            onClick={() => {
                                                setForm({ name: job.name, job: job.job, time: job.time, flag: job.flag });
                                                setIsEditing(true);
                                                setEditId(job._id);
                                                setShowModal(true);
                                            }}
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

            {/* Floating Action Button (FAB) for Mobile - SystemJobs */}
            {fabPortalElement && !showModal && createPortal(
                <button
                    type="button"
                    className="contracts-add-fab primary-blue"
                    onClick={() => {
                        setForm({ name: '', job: '', time: '', flag: true });
                        setIsEditing(false);
                        setShowModal(true);
                    }}
                    aria-label="Añadir Rutina"
                >
                    <Plus size={32} />
                </button>,
                fabPortalElement
            )}

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>{isEditing ? 'Editar Rutina' : 'Nueva Rutina Global'}</h2>
                            <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSave} className="modal-body">
                            <div className="form-group">
                                <label>Nombre Descriptivo</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={form.name} 
                                    onChange={e => setForm({...form, name: e.target.value})}
                                    placeholder="Ej. Generar Facturas Diarias"
                                />
                            </div>
                            <div className="form-group">
                                <label>Plugin a Ejecutar</label>
                                <select 
                                    required 
                                    value={form.job} 
                                    onChange={e => setForm({...form, job: e.target.value})}
                                >
                                    <option value="">Seleccione un plugin...</option>
                                    {availablePlugins.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Programación / Hora de Ejecución</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={form.time} 
                                    onChange={e => setForm({...form, time: e.target.value})}
                                    placeholder="HH:mm (ej. 00:01) o Cron (ej. */5 * * * *)"
                                />
                                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', alignSelf: 'center' }}>Frecuencias rápidas:</span>
                                    <button 
                                        type="button" 
                                        onClick={() => setForm({...form, time: '*/5 * * * *'})}
                                        style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: form.time === '*/5 * * * *' ? '#e0f2fe' : '#f8fafc', color: '#0369a1', cursor: 'pointer' }}
                                    >
                                        Cada 5 min
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setForm({...form, time: '*/15 * * * *'})}
                                        style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: form.time === '*/15 * * * *' ? '#e0f2fe' : '#f8fafc', color: '#0369a1', cursor: 'pointer' }}
                                    >
                                        Cada 15 min
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setForm({...form, time: '0,30 * * * *'})}
                                        style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: (form.time === '0,30 * * * *' || form.time === '*/30 * * * *') ? '#e0f2fe' : '#f8fafc', color: '#0369a1', cursor: 'pointer' }}
                                    >
                                        Cada 30 min
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setForm({...form, time: '00:01'})}
                                        style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: form.time === '00:01' ? '#e0f2fe' : '#f8fafc', color: '#0369a1', cursor: 'pointer' }}
                                    >
                                        Diario 00:01
                                    </button>
                                </div>
                            </div>
                            <div className="modal-footer" style={{ marginTop: '2rem' }}>
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn-primary">Guardar Rutina</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SystemJobs;
