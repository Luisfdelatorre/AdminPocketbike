import React, { useState } from 'react';
import { Search, Link, Pencil, IdCard, Phone, Mail } from 'lucide-react';

const CompaniesGrid = ({
    companies = [],
    loading = false,
    onEditCompany,
    onManageDevices
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredCompanies = companies.filter(company =>
        company.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (company.nit && company.nit.includes(searchTerm))
    );

    return (
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
                <div className="companies-empty-state">No companies found</div>
            ) : (
                <div className="companies-grid">
                    {filteredCompanies.map(company => {
                        const isQr = company.wompiConfig?.paymentMethod === 'BANCOLOMBIA_QR';
                        return (
                            <div key={company._id} className="company-card">
                                {/* Header */}
                                <div className="company-card-header">
                                    <div className="company-card-info">
                                        <h3 className="company-card-title">{company.name}</h3>
                                        <p className="company-card-address">{company.address || 'Sin dirección registrada'}</p>
                                    </div>
                                    <div className="company-card-actions">
                                        <button
                                            className="company-action-btn"
                                            onClick={() => onManageDevices?.(company)}
                                            title="Manage Devices"
                                        >
                                            <Link size={18} />
                                        </button>
                                        <button
                                            className="company-action-btn"
                                            onClick={() => onEditCompany?.(company)}
                                            title="Edit Company"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Bento Grid Details */}
                                <div className="company-bento-grid">
                                    <div className="company-bento-payment">
                                        <div className="company-payment-badges">
                                            {company.automaticInvoicing && (
                                                <span className="company-autoinvoice-badge">
                                                    Auto-Invoice
                                                </span>
                                            )}
                                            <div className={`company-method-badge ${isQr ? 'is-qr' : 'is-nequi'}`}>
                                                <span>{isQr ? '📱' : '🔔'}</span>
                                                <span>{isQr ? 'BANCOLOMBIA QR' : 'NEQUI PUSH'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="company-bento-item">
                                        <span className="company-bento-label" title="NIT">
                                            <IdCard size={14} strokeWidth={2} />
                                        </span>
                                        <span className="company-bento-value">{company.nit || 'N/A'}</span>
                                    </div>
                                    <div className="company-bento-item">
                                        <span className="company-bento-label" title="Teléfono">
                                            <Phone size={14} strokeWidth={2} />
                                        </span>
                                        <span className="company-bento-value">{company.phone || 'N/A'}</span>
                                    </div>
                                    <div className="company-bento-item company-bento-item--full">
                                        <span className="company-bento-label" title="Correo Electrónico">
                                            <Mail size={14} strokeWidth={2} />
                                        </span>
                                        <span className="company-bento-value">{company.email || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
};

export default CompaniesGrid;
