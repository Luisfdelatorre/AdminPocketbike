import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import { getAllCompanies, createCompany, updateCompany, getAllDevices, assignDevicesToCompany } from '../services/api';
import { Building, Plus, Search, X, Pencil, Link, Settings, ListFilter } from 'lucide-react';
import CompanyDevicesModal from '../components/modals/CompanyDevicesModal';
import PageHeader from '../components/PageHeader';
import SystemJobs from '../components/SystemJobs';
import StatCard from '../components/StatCard';
import SearchAndFilterBar from '../components/SearchAndFilterBar';
import useFilterVisibilityOnScroll from '../hooks/useFilterVisibilityOnScroll';
import './Users.css';

const Companies = () => {
    const { companiesTab, setCompaniesTab } = useOutletContext() || {};
    const [localActiveTab, setLocalActiveTab] = useState('companies');
    const activeTab = companiesTab || localActiveTab;
    const setActiveTab = setCompaniesTab || setLocalActiveTab;

    const [companies, setCompanies] = useState([]);
    const [allDevices, setAllDevices] = useState([]); // Store all devices
    const [loading, setLoading] = useState(true);
    const [showCompanyModal, setShowCompanyModal] = useState(false);
    const [showDeviceModal, setShowDeviceModal] = useState(false); // State for device modal
    const [selectedCompany, setSelectedCompany] = useState(null); // Company being edited for devices
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editCompanyId, setEditCompanyId] = useState(null);
    const [fabPortalElement, setFabPortalElement] = useState(null);
    const [portalElement, setPortalElement] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [invoicingFilter, setInvoicingFilter] = useState('all');

    useFilterVisibilityOnScroll(setShowFilters);

    useEffect(() => {
        setFabPortalElement(document.body);
        setPortalElement(document.getElementById('mobile-header-actions'));
    }, []);
    const [companyForm, setCompanyForm] = useState({
        name: '',
        nit: '',
        phone: '',
        email: '',
        address: '',
        automaticInvoicing: false,
        wompiCommission: -0.01785,
        transactionFixedFee: 0,
        transactionPercentage: 0,
        ivaPercentage: 0.19
    });
    useEffect(() => {
        loadData();
    }, []);
    const loadData = async () => {
        setLoading(true);
        try {
            const [companiesRes, devicesRes] = await Promise.all([
                getAllCompanies(),
                getAllDevices()
            ]);

            if (companiesRes.success) setCompanies(companiesRes.data);
            // Handle devices response structure
            if (devicesRes.success) {
                // Check if it returns { success: true, devices: [...] } or { success: true, data: [...] }
                const deviceList = devicesRes.devices || devicesRes.data || [];
                setAllDevices(deviceList);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            alert('Error loading data');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setCompanyForm({ name: '', nit: '', phone: '', email: '', address: '', automaticInvoicing: false, wompiCommission: -0.01785 });
        setIsEditing(false);
        setEditCompanyId(null);
        setShowCompanyModal(false);
    };

    const handleEditCompany = (company) => {
        setCompanyForm({
            name: company.name,
            nit: company.nit || '',
            phone: company.phone || '',
            email: company.email || '',
            address: company.address || '',
            automaticInvoicing: company.automaticInvoicing || false,
            wompiCommission: company.wompiConfig?.wompiCommission ?? -0.01785,
            transactionFixedFee: company.billingConfig?.transactionFixedFee ?? 0,
            transactionPercentage: company.billingConfig?.transactionPercentage ?? 0,
            ivaPercentage: company.billingConfig?.ivaPercentage ?? 0.19
        });
        setIsEditing(true);
        setEditCompanyId(company._id);
        setShowCompanyModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...companyForm,
                wompiConfig: {
                    ...selectedCompany?.wompiConfig,
                    wompiCommission: parseFloat(companyForm.wompiCommission)
                },
                billingConfig: {
                    ...selectedCompany?.billingConfig,
                    transactionFixedFee: parseFloat(companyForm.transactionFixedFee),
                    transactionPercentage: parseFloat(companyForm.transactionPercentage),
                    ivaPercentage: parseFloat(companyForm.ivaPercentage)
                }
            };

            let res;
            if (isEditing) {
                res = await updateCompany(editCompanyId, payload);
            } else {
                res = await createCompany(payload);
            }

            if (res.success) {
                alert(`Company ${isEditing ? 'updated' : 'created'} successfully`);
                resetForm();
                loadData();
            } else {
                alert(res.error || `Failed to ${isEditing ? 'update' : 'create'} company`);
            }
        } catch (error) {
            console.error(error);
            alert(`Error ${isEditing ? 'updating' : 'creating'} company`);
        }
    };

    const handleManageDevices = (company) => {
        setSelectedCompany(company);
        setShowDeviceModal(true);
    };

    const handleSaveDevices = async (companyId, deviceIds) => {
        try {
            const res = await assignDevicesToCompany(companyId, deviceIds);
            if (res.success) {
                alert('Devices assigned successfully');
                setShowDeviceModal(false);
                loadData(); // Reload to refresh counts if we add them later or refresh device list
            } else {
                alert(res.error || 'Failed to assign devices');
            }
        } catch (error) {
            console.error(error);
            alert('Error assigning devices');
        }
    };

    const filteredCompanies = companies.filter(company => {
        const matchSearch = company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (company.nit && company.nit.includes(searchTerm));
        const matchFilter = invoicingFilter === 'all' ? true : company.automaticInvoicing;
        return matchSearch && matchFilter;
    });

    return (
        <div className="admin-page-container">
            {/* Render filter toggle button in Mobile Top Bar via Portal */}
            {portalElement && activeTab === 'companies' && createPortal(
                <button
                    type="button"
                    className={`p-2 rounded-full transition-colors flex items-center justify-center ${showFilters ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                    onClick={() => setShowFilters(!showFilters)}
                    id="companyFilterToggle"
                >
                    <ListFilter size={20} />
                </button>,
                portalElement
            )}

            {/* Desktop Header (Desktop only - same as Contracts) */}
            <div className="page-header !hidden md:!flex">
                <div>
                    <h1>🏢 {activeTab === 'companies' ? 'Gestión de Empresas' : 'Rutinas Globales'}</h1>
                    <p>{activeTab === 'companies' ? 'Directorio y administración de empresas registradas' : 'Programación y configuración de tareas del sistema'}</p>
                </div>
                {activeTab === 'companies' && (
                    <button className="btn-primary" onClick={() => setShowCompanyModal(true)}>
                        <Plus size={20} />
                        <span className="btn-text">Añadir Empresa</span>
                    </button>
                )}
            </div>

            {/* Sub Tabs (Desktop only) */}
            <div className="tabs-container !hidden md:!flex gap-4 px-4 border-b border-gray-200 mb-4 overflow-x-auto no-scrollbar">
                <button
                    className={`tab-btn py-3 px-2 flex items-center gap-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'companies' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('companies')}
                >
                    <Building size={18} /> Directorio de Empresas
                </button>
                <button
                    className={`tab-btn py-3 px-2 flex items-center gap-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'systemJobs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('systemJobs')}
                >
                    <Settings size={18} /> Rutinas Globales
                </button>
            </div>

            {activeTab === 'systemJobs' ? (
                <SystemJobs />
            ) : (
                <>
                    {/* Expandable Metrics + Search (same global design pattern as DeviceSelector) */}
                    <div className={`expandable-metrics-container ${showFilters ? 'expanded' : 'collapsed'}`}>
                        <div className="devices-stats-ios">
                            <StatCard
                                title="Total"
                                value={companies.length}
                            />
                            <StatCard
                                title="Auto-Invoice"
                                value={companies.filter(c => c.automaticInvoicing).length}
                                valueColor="#00C292"
                            />
                            <StatCard
                                title="Resultados"
                                value={filteredCompanies.length}
                            />
                        </div>
                        <SearchAndFilterBar
                            searchQuery={searchTerm}
                            setSearchQuery={setSearchTerm}
                            searchPlaceholder="Buscar empresas por NIT, nombre..."
                            filter={invoicingFilter}
                            setFilter={setInvoicingFilter}
                            filterOptions={[
                                { value: 'all', label: 'Todas' },
                                { value: 'auto', label: 'Auto-Invoice' }
                            ]}
                        />
                    </div>
                    <div className="users-list hidden md:block">
                        {loading ? (
                            <div className="loading-state">Loading...</div>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>NIT</th>
                                        <th>Phone</th>
                                        <th>Email</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCompanies.map(company => (
                                        <tr key={company._id}>
                                            <td>
                                                <div className="user-name">
                                                    {company.name}
                                                    {company.automaticInvoicing && (
                                                        <span className="badge badge-success" style={{
                                                            fontSize: '0.7rem',
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            background: '#e6fffa',
                                                            color: '#00C292',
                                                            marginLeft: '8px',
                                                            border: '1px solid #00C292'
                                                        }}>
                                                            Auto-Invoice
                                                        </span>
                                                    )}
                                                </div>
                                                <small>{company.address}</small>
                                            </td>
                                            <td>{company.nit || '-'}</td>
                                            <td>{company.phone || '-'}</td>
                                            <td>{company.email || '-'}</td>
                                            <td>
                                                <div className="flex gap-2">
                                                    <button
                                                        className="btn-icon"
                                                        onClick={() => handleManageDevices(company)}
                                                        title="Manage Devices"
                                                    >
                                                        <Link size={16} />
                                                    </button>
                                                    <button
                                                        className="btn-icon"
                                                        onClick={() => handleEditCompany(company)}
                                                        title="Edit Company"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredCompanies.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="text-center">No companies found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Companies Cards (Mobile) */}
                    <div className="md:hidden contracts-list pb-28">
                        {loading ? (
                            <div className="loading-state">Loading...</div>
                        ) : (
                            <div className="w-full flex flex-col gap-3 items-center">
                                {filteredCompanies.map(company => (
                                    <div
                                        key={company._id}
                                        className="admin-card shadow-sm max-w-[380px] w-full flex flex-col cursor-pointer hover:shadow-md transition-shadow relative"
                                        onClick={() => handleEditCompany(company)}
                                    >
                                        <header className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-x-2">
                                                <h1 className="text-[15px] font-bold text-main-dark">{company.name}</h1>
                                                {company.automaticInvoicing && (
                                                    <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase" style={{
                                                        background: '#e6fffa',
                                                        color: '#00C292',
                                                        border: '1px solid #00C292'
                                                    }}>
                                                        Auto-Invoice
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    className="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-gray-50 transition-colors"
                                                    onClick={() => handleManageDevices(company)}
                                                    title="Dispositivos"
                                                >
                                                    <Link size={16} color="#3b82f6" />
                                                </button>
                                                <button
                                                    className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                                    onClick={() => handleEditCompany(company)}
                                                    title="Editar Empresa"
                                                >
                                                    <Pencil size={16} color="#64748b" />
                                                </button>
                                            </div>
                                        </header>

                                        <main className="space-y-2">
                                            <div className="grid grid-cols-2 gap-2 border-b border-gray-100 pb-2">
                                                <div>
                                                    <span className="text-[10px] text-gray-400 font-medium uppercase">NIT</span>
                                                    <p className="text-[13px] font-semibold text-main-dark">{company.nit || '-'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-gray-400 font-medium uppercase">Teléfono</span>
                                                    <p className="text-[13px] font-medium text-gray-700">{company.phone || '-'}</p>
                                                </div>
                                            </div>
                                            <div className="text-[12px] text-gray-600 flex items-center gap-1 pt-1">
                                                <span>✉️ {company.email || '-'}</span>
                                            </div>
                                            {company.address && (
                                                <div className="text-[11px] text-gray-400">
                                                    📍 {company.address}
                                                </div>
                                            )}
                                        </main>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Floating Action Button (FAB) for Mobile - Companies */}
                    {fabPortalElement && activeTab === 'companies' && !showCompanyModal && createPortal(
                        <button
                            type="button"
                            className="contracts-add-fab primary-blue"
                            onClick={() => setShowCompanyModal(true)}
                            aria-label="Añadir Empresa"
                        >
                            <Plus size={32} />
                        </button>,
                        fabPortalElement
                    )}
                </>
            )}

            {/* Add Company Modal */}
            {showCompanyModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>{isEditing ? 'Edit Company' : 'Add New Company'}</h2>
                            <button className="modal-close" onClick={resetForm}><X /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Company Name</label>
                                <input
                                    type="text"
                                    required
                                    value={companyForm.name}
                                    onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>NIT (Optional)</label>
                                <input
                                    type="text"
                                    value={companyForm.nit}
                                    onChange={e => setCompanyForm({ ...companyForm, nit: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Phone (Optional)</label>
                                <input
                                    type="text"
                                    value={companyForm.phone}
                                    onChange={e => setCompanyForm({ ...companyForm, phone: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Email (Optional)</label>
                                <input
                                    type="email"
                                    value={companyForm.email}
                                    onChange={e => setCompanyForm({ ...companyForm, email: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Address (Optional)</label>
                                <input
                                    type="text"
                                    value={companyForm.address}
                                    onChange={e => setCompanyForm({ ...companyForm, address: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Wompi Commission % (e.g. -0.01785)</label>
                                <input
                                    type="number"
                                    step="0.00001"
                                    required
                                    value={companyForm.wompiCommission}
                                    onChange={e => setCompanyForm({ ...companyForm, wompiCommission: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Facturación: Cargo Fijo por Tx (Ej: 1500)</label>
                                <input
                                    type="number"
                                    step="1"
                                    required
                                    value={companyForm.transactionFixedFee}
                                    onChange={e => setCompanyForm({ ...companyForm, transactionFixedFee: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Facturación: Porcentaje por Tx (Ej: 0.015 para 1.5%)</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    required
                                    value={companyForm.transactionPercentage}
                                    onChange={e => setCompanyForm({ ...companyForm, transactionPercentage: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Facturación: IVA (Ej: 0.19 para 19%)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={companyForm.ivaPercentage}
                                    onChange={e => setCompanyForm({ ...companyForm, ivaPercentage: e.target.value })}
                                />
                            </div>
                            <div className="form-group checkbox-group">
                                <label className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={companyForm.automaticInvoicing}
                                        onChange={e => setCompanyForm({ ...companyForm, automaticInvoicing: e.target.checked })}
                                        style={{ width: 'auto', margin: 0 }}
                                    />
                                    <span>Enable Automatic Daily Invoicing</span>
                                </label>
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>
                                <button type="submit" className="btn-primary">{isEditing ? 'Update Company' : 'Create Company'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Device Management Modal */}
            <CompanyDevicesModal
                isOpen={showDeviceModal}
                onClose={() => setShowDeviceModal(false)}
                company={selectedCompany}
                allDevices={allDevices}
                onSave={handleSaveDevices}
            />
        </div>
    );
};

export default Companies;
