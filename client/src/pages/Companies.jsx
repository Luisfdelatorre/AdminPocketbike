import React, { useState, useEffect } from 'react';
import { getAllCompanies, createCompany, updateCompany, getAllDevices, assignDevicesToCompany } from '../services/api';
import { Building, Plus, Search, X, Pencil, Link, ChevronLeft, User, Save } from 'lucide-react';
import CompanyDevicesModal from '../components/modals/CompanyDevicesModal'; // Import the new modal
import './Users.css'; // Reusing Users CSS for consistency
import './Companies.css';

const Companies = () => {
    const [companies, setCompanies] = useState([]);
    const [allDevices, setAllDevices] = useState([]); // Store all devices
    const [loading, setLoading] = useState(true);
    const [showCompanyModal, setShowCompanyModal] = useState(false);
    const [showDeviceModal, setShowDeviceModal] = useState(false); // State for device modal
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
                    ...selectedCompany?.wompiConfig,
                    paymentMethod: companyForm.paymentMethod || 'NEQUI_PUSH',
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

    const filteredCompanies = companies.filter(company =>
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (company.nit && company.nit.includes(searchTerm))
    );

    return (
        <div className="users-page">
            <div className="page-header">
                <div>
                    <h1><Building className="inline-icon" /> Companies Management</h1>
                    <p>Manage system companies</p>
                </div>
                <div className="header-actions">
                    <button className="btn-primary" onClick={() => setShowCompanyModal(true)}>
                        <Plus size={16} /> Add Company
                    </button>
                </div>
            </div>

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
                            <div key={company._id} className="company-card">
                                <div className="company-card-header">
                                    <div className="company-avatar">
                                        <Building size={22} />
                                    </div>
                                    <div className="company-title-area">
                                        <h3 className="company-name">
                                            {company.name}
                                            {company.automaticInvoicing && (
                                                <span className="auto-invoice-badge">Auto-Invoice</span>
                                            )}
                                        </h3>
                                        {company.address && <p className="company-address">{company.address}</p>}
                                    </div>
                                    <div className="company-card-actions">
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
                                </div>

                                <div className="company-card-body">
                                    <div className="company-info-row">
                                        <span className="company-info-label">Método Wompi:</span>
                                        <span className={`payment-method-badge ${isQr ? 'qr' : 'nequi'}`}>
                                            {isQr ? '📱 BANCOLOMBIA QR' : '🔔 NEQUI PUSH'}
                                        </span>
                                    </div>
                                    {company.nit && (
                                        <div className="company-info-row">
                                            <span className="company-info-label">NIT:</span>
                                            <span className="company-info-value">{company.nit}</span>
                                        </div>
                                    )}
                                    {company.phone && (
                                        <div className="company-info-row">
                                            <span className="company-info-label">Teléfono:</span>
                                            <span className="company-info-value">{company.phone}</span>
                                        </div>
                                    )}
                                    {company.email && (
                                        <div className="company-info-row">
                                            <span className="company-info-label">Email:</span>
                                            <span className="company-info-value">{company.email}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
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
                    <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="ios-detail-body">
                            <h1 className="ios-page-title">{isEditing ? 'Company Profile' : 'New Company'}</h1>

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
                onSave={handleSaveDevices}
            />
        </div>
    );
};

export default Companies;
