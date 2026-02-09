import React, { useState, useEffect } from 'react';
import { getAllContracts, getDevicesWithContracts, createContract, updateContract, updateContractStatus } from '../services/api';
import { FileText, Calendar, DollarSign, TrendingUp, Check, X, Edit, Plus, Search } from 'lucide-react';
import './Contracts.css';

const Contracts = () => {
    const [contracts, setContracts] = useState([]);
    const [availableDevices, setAvailableDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, active, completed, cancelled
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingContract, setEditingContract] = useState(null);
    const [formData, setFormData] = useState({
        deviceId: '',
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        customerDocument: '',
        dailyRate: 3000000, // 30,000 COP in cents
        contractDays: 500,
        startDate: new Date().toISOString().split('T')[0],
        notes: '',
        devicePin: ''
    });

    useEffect(() => {
        loadContracts();
        loadAvailableDevices();
    }, [filter]);

    const loadContracts = async () => {
        setLoading(true);
        try {
            const result = await getAllContracts();

            if (result.success) {
                setContracts(result.contracts || []);
            } else {
                console.error('Failed to fetch contracts:', result.error);
            }
        } catch (error) {
            console.error('Error loading contracts:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadAvailableDevices = async () => {
        try {
            const result = await getDevicesWithContracts();

            if (result.success) {
                setAvailableDevices(result.devices || []);
            }
        } catch (error) {
            console.error('Error loading devices:', error);
        }
    };

    const handleNewContract = () => {
        setEditingContract(null);
        setFormData({
            deviceId: '',
            customerName: '',
            customerEmail: '',
            customerPhone: '',
            customerDocument: '',
            dailyRate: 3000000,
            contractDays: 500,
            startDate: new Date().toISOString().split('T')[0],
            notes: '',
            devicePin: Math.floor(1000 + Math.random() * 9000).toString()
        });
        setShowModal(true);
    };

    const handleEdit = (contract) => {
        setEditingContract(contract);
        setFormData({
            deviceId: contract.deviceId,
            customerName: contract.customerName || '',
            customerEmail: contract.customerEmail || '',
            customerPhone: contract.customerPhone || '',
            customerDocument: contract.customerDocument || '',
            dailyRate: contract.dailyRate,
            contractDays: contract.contractDays,
            startDate: contract.startDate,
            notes: contract.notes || '',
            devicePin: '' // Keep empty to not change unless user enters new one
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const result = editingContract
                ? await updateContract(editingContract.contractId, formData)
                : await createContract(formData);

            if (result.success) {
                setShowModal(false);
                loadContracts();
                alert(editingContract ? '¡Contrato actualizado exitosamente!' : '¡Contrato creado exitosamente!');
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (error) {
            console.error('Error saving contract:', error);
            alert('Error al guardar contrato');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (contractId, newStatus) => {
        if (!confirm(`¿Está seguro de cambiar el estado a ${newStatus}?`)) {
            return;
        }

        try {
            const result = await updateContractStatus(contractId, newStatus);

            if (result.success) {
                loadContracts();
                alert('¡Estado actualizado exitosamente!');
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Error al actualizar estado');
        }
    };

    const formatCurrency = (amount) => {
        return `$${(amount / 100).toLocaleString()} COP`;
    };

    const getStatusColor = (status) => {
        const colors = {
            'ACTIVE': '#00C292',
            'COMPLETED': '#03C9D7',
            'CANCELLED': '#EF4444',
            'SUSPENDED': '#FB9678'
        };
        return colors[status] || '#6B7280';
    };

    const filteredContracts = contracts.filter(contract => {
        // Status filter
        if (filter !== 'all' && contract.status.toLowerCase() !== filter.toLowerCase()) {
            return false;
        }

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                contract.deviceId.toLowerCase().includes(query) ||
                contract.contractId.toLowerCase().includes(query) ||
                contract.customerName?.toLowerCase().includes(query) ||
                contract.customerEmail?.toLowerCase().includes(query)
            );
        }

        return true;
    });

    const StatCard = ({ title, value, icon: Icon, color }) => (
        <div className="contract-stat-card">
            <div className="stat-icon" style={{ background: color }}>
                <Icon size={20} />
            </div>
            <div className="stat-info">
                <div className="stat-label">{title}</div>
                <div className="stat-number">{value}</div>
            </div>
        </div>
    );

    return (
        <div className="contracts-page">
            <div className="page-header">
                <div>
                    <h1>📋 Gestión de Contratos</h1>
                    <p>Gestionar contratos de alquiler de 500 días para todos los dispositivos</p>
                </div>
                <button className="btn-primary" onClick={handleNewContract}>
                    <Plus /> Nuevo Contrato
                </button>
            </div>

            {/* Summary Stats */}
            <div className="contracts-stats">
                <StatCard
                    title="Total Contratos"
                    value={contracts.length}
                    icon={FileText}
                    color="#03C9D7"
                />
                <StatCard
                    title="Activos"
                    value={contracts.filter(c => c.status === 'ACTIVE').length}
                    icon={TrendingUp}
                    color="#00C292"
                />
                <StatCard
                    title="Completados"
                    value={contracts.filter(c => c.status === 'COMPLETED').length}
                    icon={Check}
                    color="#7460EE"
                />
                <StatCard
                    title="Valor Total"
                    value={formatCurrency(contracts.reduce((sum, c) => sum + c.totalAmount, 0))}
                    icon={DollarSign}
                    color="#FB9678"
                />
            </div>

            {/* Search Bar */}
            <div className="contracts-search">
                <div className="search-box">
                    <Search className="search-icon" />
                    <input
                        type="text"
                        placeholder="Buscar por ID, nombre o email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            className="clear-search"
                            onClick={() => setSearchQuery('')}
                            aria-label="Clear search"
                        >
                            <X />
                        </button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="contracts-filters">
                <button
                    className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    Todos
                </button>
                <button
                    className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
                    onClick={() => setFilter('active')}
                >
                    Activos
                </button>
                <button
                    className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
                    onClick={() => setFilter('completed')}
                >
                    Completados
                </button>
                <button
                    className={`filter-btn ${filter === 'cancelled' ? 'active' : ''}`}
                    onClick={() => setFilter('cancelled')}
                >
                    Cancelados
                </button>
            </div>

            {/* Contracts List */}
            <div className="contracts-list">
                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Cargando contratos...</p>
                    </div>
                ) : filteredContracts.length === 0 ? (
                    <div className="empty-state">
                        <FileText size={48} />
                        <h3>No se encontraron contratos</h3>
                        <p>Cree un nuevo contrato para comenzar</p>
                    </div>
                ) : (
                    filteredContracts.map(contract => (
                        <div key={contract.contractId} className="contract-card">
                            <div className="contract-header">
                                <div className="contract-title">
                                    <h3>
                                        <a
                                            href={`/pagos/${contract.deviceIdName || contract.deviceId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-gray-900 hover:text-indigo-600 transition-colors"
                                            title="Open Payment Page"
                                        >
                                            {contract.deviceIdName || contract.deviceId}
                                        </a>
                                    </h3>
                                    <span
                                        className="status-badge"
                                        style={{
                                            background: `${getStatusColor(contract.status)}20`,
                                            color: getStatusColor(contract.status)
                                        }}
                                    >
                                        {contract.status}
                                    </span>
                                </div>
                                <div className="contract-id">
                                    <small>{contract.contractId}</small>
                                </div>
                            </div>

                            <div className="contract-body">
                                <div className="contract-info-grid">
                                    <div className="info-item">
                                        <span className="info-label">Cliente</span>
                                        <span className="info-value">{contract.customerName || 'N/A'}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Tarifa Diaria</span>
                                        <span className="info-value">{formatCurrency(contract.dailyRate)}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Días Totales</span>
                                        <span className="info-value">{contract.contractDays} días</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Monto Total</span>
                                        <span className="info-value">{formatCurrency(contract.totalAmount)}</span>
                                    </div>

                                </div>

                                <div className="contract-progress">
                                    <div className="progress-header">
                                        <span>Progreso: {contract.paidDays} / {contract.contractDays} días</span>
                                        <span className="progress-percent">
                                            {((contract.paidDays / contract.contractDays) * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{
                                                width: `${(contract.paidDays / contract.contractDays) * 100}%`,
                                                background: getStatusColor(contract.status)
                                            }}
                                        ></div>
                                    </div>
                                    <div className="progress-details">
                                        <div>
                                            <Check size={14} />
                                            Pagado: {formatCurrency(contract.paidAmount)}
                                        </div>
                                        <div>
                                            <Calendar size={14} />
                                            {contract.startDate} → {contract.endDate}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="contract-actions">
                                <button className="btn-text btn-complete" onClick={() => handleEdit(contract)}>
                                    <Edit /> Editar
                                </button>
                                {contract.status === 'ACTIVE' && (
                                    <>
                                        <button
                                            className="btn-text btn-complete"
                                            onClick={() => handleStatusChange(contract.contractId, 'COMPLETED')}
                                        >
                                            <Check /> Completar
                                        </button>
                                        <button
                                            className="btn-text btn-cancel"
                                            onClick={() => handleStatusChange(contract.contractId, 'CANCELLED')}
                                        >
                                            <X /> Cancelar
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Contract Form Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingContract ? 'Editar Contrato' : 'Nuevo Contrato'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="contract-form">
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>ID Dispositivo *</label>
                                    {editingContract ? (
                                        <input
                                            type="text"
                                            value={formData.deviceId}
                                            disabled
                                        />
                                    ) : (
                                        <>
                                            <select
                                                value={formData.deviceId}
                                                onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                                                required
                                            >
                                                <option value="">Seleccionar dispositivo...</option>
                                                {availableDevices.filter(d => !d.hasActiveContract).map(device => (
                                                    <option
                                                        key={device.deviceId}
                                                        value={device.deviceId}
                                                    >
                                                        {device.name || ''}
                                                    </option>
                                                ))}
                                            </select>
                                            <small style={{ color: '#6B7280', fontSize: '0.813rem', marginTop: '0.25rem', display: 'block' }}>
                                                Cada dispositivo solo puede tener un contrato activo. Cancele los contratos existentes antes de crear uno nuevo.
                                            </small>
                                        </>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Fecha Inicio *</label>
                                    <input
                                        type="date"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                        required
                                        disabled={editingContract}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>PIN del Dispositivo {editingContract ? '(Dejar vacío para mantener el actual)' : '*'}</label>
                                    <input
                                        type="text"
                                        value={formData.devicePin}
                                        onChange={(e) => setFormData({ ...formData, devicePin: e.target.value })}
                                        placeholder="PIN de 4 dígitos"
                                        maxLength="4"
                                        className="font-mono"
                                        required={!editingContract}
                                    />
                                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            id="usePhonePin"
                                            style={{ marginRight: '0.5rem', width: 'auto' }}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    const phone = formData.customerPhone || '';
                                                    const digits = phone.replace(/\D/g, '');
                                                    if (digits.length >= 4) {
                                                        setFormData(prev => ({ ...prev, devicePin: digits.slice(-4) }));
                                                    } else {
                                                        alert('Ingrese un número de celular válido primero');
                                                        e.target.checked = false;
                                                    }
                                                }
                                            }}
                                        />
                                        <label htmlFor="usePhonePin" style={{ fontSize: '0.9rem', color: '#4B5563', cursor: 'pointer' }}>
                                            Usa los últimos 4 del celular
                                        </label>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Nombre del Cliente</label>
                                    <input
                                        type="text"
                                        value={formData.customerName}
                                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Email del Cliente</label>
                                    <input
                                        type="email"
                                        value={formData.customerEmail}
                                        onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                                        placeholder="cliente@email.com"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Teléfono del Cliente</label>
                                    <input
                                        type="tel"
                                        value={formData.customerPhone}
                                        onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                                        placeholder="+57 300 123 4567"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Documento del Cliente</label>
                                    <input
                                        type="text"
                                        value={formData.customerDocument}
                                        onChange={(e) => setFormData({ ...formData, customerDocument: e.target.value })}
                                        placeholder="Cédula/NIT"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Tarifa Diaria (COP)</label>
                                    <input
                                        type="number"
                                        value={formData.dailyRate / 100}
                                        onChange={(e) => setFormData({ ...formData, dailyRate: parseInt(e.target.value) * 100 })}
                                        min="0"
                                        step="1000"
                                        placeholder="30000"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Días de Contrato</label>
                                    <input
                                        type="number"
                                        value={formData.contractDays}
                                        onChange={(e) => setFormData({ ...formData, contractDays: parseInt(e.target.value) })}
                                        min="1"
                                        max="1000"
                                        disabled={editingContract}
                                    />
                                </div>
                            </div>
                            <div className="form-group full-width">
                                <label>Notas</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows="3"
                                    placeholder="Notas adicionales..."
                                />
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary" disabled={loading}>
                                    {loading ? 'Guardando...' : editingContract ? 'Actualizar Contrato' : 'Crear Contrato'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Contracts;
