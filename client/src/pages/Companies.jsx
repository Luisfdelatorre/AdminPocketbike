import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import { getAllCompanies, createCompany, updateCompany, getAllDevices, assignDevicesToCompany } from '../services/api';
import { Building, Plus, X, ChevronLeft, User, Save, Sliders, Clock } from 'lucide-react';
import CompanyDevicesModal from '../components/modals/CompanyDevicesModal'; // Import the new modal
import AdjustmentTypesModal from '../components/modals/AdjustmentTypesModal';
import SystemJobs from '../components/SystemJobs';
import CompaniesGrid from '../components/CompaniesGrid';
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
    const [isEditing, setIsEditing] = useState(false);
    const [editCompanyId, setEditCompanyId] = useState(null);
    const [isSlidingOut, setIsSlidingOut] = useState(false);
    const systemJobsRef = useRef(null);
    const adjustmentTypesRef = useRef(null);
    const [adjSubTab, setAdjSubTab] = useState('adjustments');
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

    const { companiesTab, setCompaniesTab } = useOutletContext() || {};
    const [localTab, setLocalTab] = useState('companies');
    const currentTab = companiesTab || localTab;
    const handleTabChange = setCompaniesTab || setLocalTab;

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
                    currentTab === 'companies' ? (
                        <button className="btn-primary" onClick={() => setShowCompanyModal(true)}>
                            <Plus size={16} /> Agregar Empresa
                        </button>
                    ) : currentTab === 'adjustmentTypes' && adjSubTab !== 'statuses' ? (
                        <button className="btn-primary" onClick={() => adjustmentTypesRef.current?.triggerAdd()}>
                            <Plus size={16} /> Nuevo Tipo
                        </button>
                    ) : currentTab === 'systemJobs' ? (
                        <button className="btn-primary" onClick={() => systemJobsRef.current?.triggerAdd()}>
                            <Plus size={16} /> Añadir Rutina
                        </button>
                    ) : null
                }
            />

            {/* Desktop Tabs Navigation */}
            <div className="companies-tabs desktop-only">
                <button
                    type="button"
                    className={`companies-tab-btn ${currentTab === 'companies' ? 'active' : ''}`}
                    onClick={() => handleTabChange('companies')}
                >
                    <Building size={16} /> Empresas
                </button>
                <button
                    type="button"
                    className={`companies-tab-btn ${currentTab === 'adjustmentTypes' ? 'active' : ''}`}
                    onClick={() => handleTabChange('adjustmentTypes')}
                >
                    <Sliders size={16} /> Tipos de Ajuste
                </button>
                <button
                    type="button"
                    className={`companies-tab-btn ${currentTab === 'systemJobs' ? 'active' : ''}`}
                    onClick={() => handleTabChange('systemJobs')}
                >
                    <Clock size={16} /> Rutinas Globales
                </button>
            </div>

            {currentTab === 'adjustmentTypes' ? (
                <AdjustmentTypesModal isEmbedded={true} ref={adjustmentTypesRef} onFilterChange={setAdjSubTab} />
            ) : currentTab === 'systemJobs' ? (
                <SystemJobs ref={systemJobsRef} />
            ) : (
                <CompaniesGrid
                    companies={companies}
                    loading={loading}
                    onEditCompany={handleEditCompany}
                    onManageDevices={handleManageDevices}
                />
            )}

            {/* Mobile FAB */}
            {!showCompanyModal && !(currentTab === 'adjustmentTypes' && adjSubTab === 'statuses') && (
                <button
                    className="contracts-add-fab primary-blue"
                    onClick={() => {
                        if (currentTab === 'systemJobs') {
                            systemJobsRef.current?.triggerAdd();
                        } else if (currentTab === 'adjustmentTypes') {
                            adjustmentTypesRef.current?.triggerAdd();
                        } else {
                            setShowCompanyModal(true);
                        }
                    }}
                    title="Agregar"
                >
                    <Plus size={24} />
                </button>
            )}

            {/* Full-Page iOS Sub-View for Add/Edit Company */}
            {showCompanyModal && createPortal(
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
                                        <label className="ios-label">Método de Pago Wompi</label>
                                        <div className="pay-method-badges">
                                            <button
                                                type="button"
                                                className={`pay-method-badge ${(companyForm.paymentMethod || 'NEQUI_PUSH') === 'NEQUI_PUSH' ? 'pay-method-badge--active' : ''}`}
                                                onClick={() => setCompanyForm({ ...companyForm, paymentMethod: 'NEQUI_PUSH' })}
                                            >
                                                <span>🔔</span> Nequi Push
                                            </button>
                                            <button
                                                type="button"
                                                className={`pay-method-badge ${(companyForm.paymentMethod || 'NEQUI_PUSH') === 'BANCOLOMBIA_QR' ? 'pay-method-badge--active' : ''}`}
                                                onClick={() => setCompanyForm({ ...companyForm, paymentMethod: 'BANCOLOMBIA_QR' })}
                                            >
                                                <span>📱</span> Bancolombia QR
                                            </button>
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
                </div>,
                document.body
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
