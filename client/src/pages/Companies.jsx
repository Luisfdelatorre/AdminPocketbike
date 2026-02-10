import React, { useState, useEffect } from 'react';
import { getAllCompanies, createCompany, updateCompany, getAllDevices, assignDevicesToCompany } from '../services/api';
import { Building, Plus, Search, X, Pencil, Link } from 'lucide-react';
import CompanyDevicesModal from '../components/modals/CompanyDevicesModal'; // Import the new modal
import './Users.css'; // Reusing Users CSS for consistency

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
    const [companyForm, setCompanyForm] = useState({
        name: '',
        nit: '',
        phone: '',
        email: '',
        address: ''
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
        setCompanyForm({ name: '', nit: '', phone: '', email: '', address: '' });
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
            address: company.address || ''
        });
        setIsEditing(true);
        setEditCompanyId(company._id);
        setShowCompanyModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            let res;
            if (isEditing) {
                res = await updateCompany(editCompanyId, companyForm);
            } else {
                res = await createCompany(companyForm);
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

            {/* Companies Table */}
            <div className="users-list">
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
                                        <div className="user-name">{company.name}</div>
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
