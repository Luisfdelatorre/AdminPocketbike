import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getAllCompanies, createCompany, updateCompany, getAllDevices, assignDevicesToCompany } from '../services/api';
import { Building, Plus, Search, X, Pencil, Link, ChevronLeft, User, Save, Sliders } from 'lucide-react';
import CompanyDevicesModal from '../components/modals/CompanyDevicesModal'; // Import the new modal
import AdjustmentTypesModal from '../components/modals/AdjustmentTypesModal';
import SystemJobs from '../components/SystemJobs';
import PageHeader from '../components/PageHeader';
import './Users.css'; // Reusing Users CSS for consistency
import './Companies.css';

const Companies = () => {
    const [companies, setCompanies] = useState([]);
    const [allDevices, setAllDevices] = useState([]); // Store all devices
    const [loading, setLoading] = useState(true);
    const [showCompanyModal, setShowCompanyModal] = useState(false);
    const [showDeviceModal, setShowDeviceModal] = useState(false); // State for device modal
    const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState(null); // Company being edited for devices
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editCompanyId, setEditCompanyId] = useState(null);
    const [isSlidingOut, setIsSlidingOut] = useState(false);
    const [companyForm, setCompanyForm] = useState({
        name: '',
        nit: '',
        phone: '',
        email: '',
        address: '',
        automaticInvoicing: false,
        wompiCommission: -0.01785,
        paymentMethod: 'NEQUI_PUSH',
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
        setCompanyForm({ name: '', nit: '', phone: '', email: '', address: '', automaticInvoicing: false, wompiCommission: -0.01785, paymentMethod: 'NEQUI_PUSH', transactionFixedFee: 0, transactionPercentage: 0, ivaPercentage: 0.19 });
        setIsEditing(false);
        setEditCompanyId(null);
        setShowCompanyModal(false);
    };

    const handleCloseDetail = () => {
        setIsSlidingOut(true);
        setTimeout(() => {
            setIsSlidingOut(false);
            resetForm();
        }, 250);
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
            paymentMethod: company.wompiConfig?.paymentMethod ?? 'NEQUI_PUSH',
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
                    wompiCommission: companyForm.wompiCommission,
                    paymentMethod: companyForm.paymentMethod
                },
                billingConfig: {
                    transactionFixedFee: companyForm.transactionFixedFee,
                    transactionPercentage: companyForm.transactionPercentage,
                    ivaPercentage: companyForm.ivaPercentage
                }
            };
            delete payload.wompiCommission;
            delete payload.paymentMethod;
            delete payload.transactionFixedFee;
            delete payload.transactionPercentage;
            delete payload.ivaPercentage;

            if (isEditing) {
                await updateCompany(editCompanyId, payload);
            } else {
                await createCompany(payload);
            }
            handleCloseDetail();
            loadData();
        } catch (error) {
            console.error('Error saving company:', error);
            alert('Error saving company');
        }
    };

    const handleManageDevices = (company) => {
        setSelectedCompany(company);
        setShowDeviceModal(true);
    };

    const handleSaveDeviceAssignment = async (assignedDeviceIds) => {
        try {
            await assignDevicesToCompany(selectedCompany._id, assignedDeviceIds);
            setShowDeviceModal(false);
            loadData(); // Refresh data to show updated counts
        } catch (error) {
            console.error(error);
            alert('Error assigning devices');
        }
    };

    const outletContext = useOutletContext() || {};
    const currentTab = outletContext.companiesTab || 'companies';

    const filteredCompanies = companies.filter(company =>
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (company.nit && company.nit.includes(searchTerm))
    );

    return (
        <div className="users-page">
            <PageHeader
                title={
                    <div>
                        <h1><Building className="inline-icon" /> Gestión de Empresas</h1>
                    </div>
                }
                onRefresh={loadData}
                loading={loading}
                refreshText="Actualizar"
                desktopActions={
                    currentTab === 'companies' && (
                        <button className="btn-primary" onClick={() => setShowCompanyModal(true)}>
                            <Plus size={16} /> Agregar Empresa
                        </button>
                    )
                }
            />

            {currentTab === 'adjustmentTypes' ? (
                <AdjustmentTypesModal isEmbedded={true} />
            ) : currentTab === 'systemJobs' ? (
                <SystemJobs />
            ) : (
                <>
                    {/* Search */}
                    <div className="users-search">
                        <div className="search-box">
                            <Search className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search companies..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Companies Cards Grid */}
                    {loading ? (
                        <div className="loading-state">Loading...</div>
                    ) : filteredCompanies.length === 0 ? (
                        <div className="empty-state text-center py-8 text-gray-500">No companies found</div>
                    ) : (
                        <div className="companies-grid">
                            {filteredCompanies.map(company => {
                        const isQr = company.wompiConfig?.paymentMethod === 'BANCOLOMBIA_QR';
                        return (
                            <div key={company._id} className="glass-panel rounded-[24px] overflow-hidden p-5 flex flex-col gap-5 relative group">
                                {/* Header */}
                                <div className="flex items-start gap-4">
                                    <div className="flex-1 min-w-0 flex flex-col gap-1.5 pt-0.5">
                                        <h3 className="font-semibold text-xl text-slate-900 truncate tracking-wide">{company.name}</h3>
                                        <p className="text-xs text-slate-500 truncate tracking-wide">{company.address || 'Sin dirección registrada'}</p>
                                    </div>
                                    <div className="flex gap-2 opacity-100 transition-opacity">
                                        <button
                                            className="w-9 h-9 rounded-full glass-panel flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-colors border border-black/5"
                                            onClick={() => handleManageDevices(company)}
                                            title="Manage Devices"
                                        >
                                            <Link size={18} />
                                        </button>
                                        <button
                                            className="w-9 h-9 rounded-full glass-panel flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-colors border border-black/5"
                                            onClick={() => handleEditCompany(company)}
                                            title="Edit Company"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Bento Grid Details */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2 bg-slate-50/50 rounded-2xl p-4 border border-black/5 flex justify-between items-center backdrop-blur-sm">
                                        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Payment Method</span>
                                        <div className="flex items-center gap-2">
                                            {company.automaticInvoicing && (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-white border border-black/5 text-[10px] text-slate-600 uppercase tracking-widest shadow-sm font-semibold">
                                                    Auto-Invoice
                                                </span>
                                            )}
                                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest ${isQr ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-indigo-50 border border-indigo-200 text-indigo-700'}`}>
                                                <span>{isQr ? '📱' : '🔔'}</span>
                                                <span className="uppercase">{isQr ? 'BANCOLOMBIA QR' : 'NEQUI PUSH'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50/50 rounded-2xl p-4 border border-black/5 backdrop-blur-sm flex flex-col gap-1">
                                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">NIT</span>
                                        <span className="text-sm font-medium text-slate-800">{company.nit || 'N/A'}</span>
                                    </div>
                                    <div className="bg-slate-50/50 rounded-2xl p-4 border border-black/5 backdrop-blur-sm flex flex-col gap-1">
                                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Phone</span>
                                        <span className="text-sm font-medium text-slate-800">{company.phone || 'N/A'}</span>
                                    </div>
                                    <div className="col-span-2 bg-slate-50/50 rounded-2xl p-4 border border-black/5 backdrop-blur-sm flex flex-col gap-1">
                                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Email</span>
                                        <span className="text-sm font-medium text-slate-800 truncate">{company.email || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            </>
            )}

            {/* Full-Page iOS Sub-View for Add/Edit Company */}
            {showCompanyModal && (
                <div className={`company-detail-page ${isSlidingOut ? 'sliding-out' : ''}`}>
                    {/* Header Bar with Back Chevron & Title */}
                    <header className="ios-detail-header">
                        <div className="ios-detail-nav">
                            <button type="button" className="ios-back-btn" onClick={handleCloseDetail}>
                                <ChevronLeft size={22} />
                                <span>Company Detail</span>
                            </button>
                            <div className="ios-user-badge">
                                <User size={18} />
                            </div>
                        </div>
                    </header>

                    {/* Form Container */}
                    <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div className="ios-detail-body">
                            {/* General Information Section */}
                            <section>
                                <h3 className="ios-section-title">General Information</h3>
                                <div className="ios-grouped-container">
                                    <div className="ios-input-row">
                                        <label className="ios-label" htmlFor="compName">Company Name</label>
                                        <input
                                            id="compName"
                                            className="ios-input"
                                            type="text"
                                            required
                                            placeholder="Enter company name"
                                            value={companyForm.name}
                                            onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="ios-input-row">
                                        <label className="ios-label" htmlFor="compNit">
                                            NIT <span className="ios-label-optional">(Optional)</span>
                                        </label>
                                        <input
                                            id="compNit"
                                            className="ios-input"
                                            type="text"
                                            placeholder="Enter NIT"
                                            value={companyForm.nit}
                                            onChange={e => setCompanyForm({ ...companyForm, nit: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Contact Details Section */}
                            <section>
                                <h3 className="ios-section-title">Contact Details</h3>
                                <div className="ios-grouped-container">
                                    <div className="ios-input-row">
                                        <label className="ios-label" htmlFor="compPhone">
                                            Phone <span className="ios-label-optional">(Optional)</span>
                                        </label>
                                        <input
                                            id="compPhone"
                                            className="ios-input"
                                            type="text"
                                            placeholder="Enter phone number"
                                            value={companyForm.phone}
                                            onChange={e => setCompanyForm({ ...companyForm, phone: e.target.value })}
                                        />
                                    </div>
                                    <div className="ios-input-row">
                                        <label className="ios-label" htmlFor="compEmail">
                                            Email <span className="ios-label-optional">(Optional)</span>
                                        </label>
                                        <input
                                            id="compEmail"
                                            className="ios-input"
                                            type="email"
                                            placeholder="Enter email address"
                                            value={companyForm.email}
                                            onChange={e => setCompanyForm({ ...companyForm, email: e.target.value })}
                                        />
                                    </div>
                                    <div className="ios-input-row">
                                        <label className="ios-label" htmlFor="compAddress">
                                            Address <span className="ios-label-optional">(Optional)</span>
                                        </label>
                                        <input
                                            id="compAddress"
                                            className="ios-input"
                                            type="text"
                                            placeholder="Enter physical address"
                                            value={companyForm.address}
                                            onChange={e => setCompanyForm({ ...companyForm, address: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Financial & Billing Section */}
                            <section>
                                <h3 className="ios-section-title">Financial & Billing</h3>
                                <div className="ios-grouped-container">
                                    <div className="ios-input-row">
                                        <label className="ios-label" htmlFor="wompiCommission">
                                            Wompi Commission % <span className="ios-label-optional">(e.g. -0.01785)</span>
                                        </label>
                                        <input
                                            id="wompiCommission"
                                            className="ios-input"
                                            type="number"
                                            step="0.00001"
                                            required
                                            placeholder="-0.01785"
                                            value={companyForm.wompiCommission}
                                            onChange={e => setCompanyForm({ ...companyForm, wompiCommission: e.target.value })}
                                        />
                                    </div>
                                    <div className="ios-input-row">
                                        <label className="ios-label" htmlFor="payMethod">Método de Pago Wompi</label>
                                        <div className="ios-select-wrapper">
                                            <select
                                                id="payMethod"
                                                className="ios-select"
                                                value={companyForm.paymentMethod || 'NEQUI_PUSH'}
                                                onChange={e => setCompanyForm({ ...companyForm, paymentMethod: e.target.value })}
                                            >
                                                <option value="NEQUI_PUSH">🔔 Notificación Push (Nequi)</option>
                                                <option value="BANCOLOMBIA_QR">📱 Código QR (Bancolombia / Nequi)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="ios-input-row">
                                        <label className="ios-label" htmlFor="cargoFijo">
                                            Facturación: Cargo Fijo por Tx <span className="ios-label-optional">(Ej: 1500)</span>
                                        </label>
                                        <input
                                            id="cargoFijo"
                                            className="ios-input"
                                            type="number"
                                            step="1"
                                            required
                                            placeholder="0"
                                            value={companyForm.transactionFixedFee}
                                            onChange={e => setCompanyForm({ ...companyForm, transactionFixedFee: e.target.value })}
                                        />
                                    </div>
                                    <div className="ios-input-row">
                                        <label className="ios-label" htmlFor="txPct">
                                            Facturación: Porcentaje por Tx <span className="ios-label-optional">(Ej: 0.015 para 1.5%)</span>
                                        </label>
                                        <input
                                            id="txPct"
                                            className="ios-input"
                                            type="number"
                                            step="0.0001"
                                            required
                                            placeholder="0.00"
                                            value={companyForm.transactionPercentage}
                                            onChange={e => setCompanyForm({ ...companyForm, transactionPercentage: e.target.value })}
                                        />
                                    </div>
                                    <div className="ios-input-row">
                                        <label className="ios-label" htmlFor="ivaPct">
                                            Facturación: IVA <span className="ios-label-optional">(Ej: 0.19 para 19%)</span>
                                        </label>
                                        <input
                                            id="ivaPct"
                                            className="ios-input"
                                            type="number"
                                            step="0.01"
                                            required
                                            placeholder="0.19"
                                            value={companyForm.ivaPercentage}
                                            onChange={e => setCompanyForm({ ...companyForm, ivaPercentage: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Automation Section */}
                            <section>
                                <h3 className="ios-section-title">Automation</h3>
                                <div className="ios-grouped-container">
                                    <label className="ios-toggle-row">
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1a1b1f' }}>
                                            Enable Automatic Daily Invoicing
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={companyForm.automaticInvoicing}
                                            onChange={e => setCompanyForm({ ...companyForm, automaticInvoicing: e.target.checked })}
                                            style={{ width: '18px', height: '18px', accentColor: '#6366f1', cursor: 'pointer' }}
                                        />
                                    </label>
                                </div>
                            </section>
                        </div>

                        {/* Sticky Bottom Actions */}
                        <div className="ios-sticky-actions">
                            <button type="button" className="ios-btn-cancel" onClick={handleCloseDetail}>
                                Cancel
                            </button>
                            <button type="submit" className="ios-btn-submit">
                                <Save size={18} />
                                <span>{isEditing ? 'Save Changes' : 'Create Company'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            )}
            {/* Device Management Modal */}
            <CompanyDevicesModal
                isOpen={showDeviceModal}
                onClose={() => setShowDeviceModal(false)}
                company={selectedCompany}
                allDevices={allDevices}
                onSave={(companyId, deviceIds) => handleSaveDeviceAssignment(deviceIds)}
            />
            {/* Adjustment Types Settings Modal */}
            <AdjustmentTypesModal
                isOpen={showAdjustmentModal}
                onClose={() => setShowAdjustmentModal(false)}
            />
        </div>
    );
};

export default Companies;
