import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getCompanyInvoices, generateCompanyInvoice, getAllCompanies } from '../services/api';
import { Building, Plus, FileText, Printer, FileSpreadsheet, Search, X, Check, RefreshCw, ListFilter, TrendingDown, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CompanyInvoiceTemplate from '../components/CompanyInvoiceTemplate';
import './Payments.css';
import './Users.css';

const CompanyInvoices = () => {
    const [invoices, setInvoices] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null); // For printing preview

    // Filters and search states
    const [filter, setFilter] = useState('all'); // all, completed, pending
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('date'); // date, amount, company

    // Form state
    const today = new Date();
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [year, setYear] = useState(today.getFullYear());
    const [companyId, setCompanyId] = useState('');

    const navigate = useNavigate();

    const [showFilters, setShowFilters] = useState(false);
    const [portalElement, setPortalElement] = useState(null);

    useEffect(() => {
        setPortalElement(document.getElementById('mobile-header-actions'));
        loadData();
    }, []);

    useEffect(() => {
        let lastScrollY = window.scrollY;
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            const diff = currentScrollY - lastScrollY;
            if (diff > 10) {
                if (showFilters) setShowFilters(false);
            } else if (diff < -15) {
                if (!showFilters) setShowFilters(true);
            }
            lastScrollY = currentScrollY;
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [showFilters]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [invRes, compRes] = await Promise.all([
                getCompanyInvoices(),
                getAllCompanies()
            ]);

            if (invRes.success) setInvoices(invRes.data);
            if (compRes.success) {
                setCompanies(compRes.data);
                if (compRes.data.length > 0) setCompanyId(compRes.data[0]._id);
            }
        } catch (error) {
            console.error('Error loading company invoices:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async (e) => {
        e.preventDefault();
        try {
            const res = await generateCompanyInvoice({ companyId, month, year });
            if (res.success) {
                alert('Factura generada con éxito');
                setShowGenerateModal(false);
                loadData();
            } else {
                alert(res.error || 'No se pudo generar la factura');
            }
        } catch (error) {
            console.error(error);
            alert('Error al generar la factura');
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(value || 0);
    };

    const formatCompact = (value) => {
        if (!value) return '$0';
        if (value >= 1000000) {
            return `$${Math.round(value / 1000000)}M`;
        }
        if (value >= 1000) {
            return `$${Math.round(value / 1000)}k`;
        }
        return `$${value}`;
    };

    // Filter, search and sort logic
    const filteredInvoices = invoices.filter(inv => {
        if (filter !== 'all') {
            const mappedStatus = filter === 'completed' ? 'PAID' : 'PENDING';
            if (inv.status !== mappedStatus) return false;
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (
                inv.invoiceNumber.toLowerCase().includes(q) ||
                (inv.companyId?.name || '').toLowerCase().includes(q)
            );
        }
        return true;
    });

    const sortedInvoices = [...filteredInvoices].sort((a, b) => {
        if (sortBy === 'date') {
            if (b.year !== a.year) return b.year - a.year;
            return b.month - a.month;
        }
        if (sortBy === 'amount') {
            return b.amountDue - a.amountDue;
        }
        if (sortBy === 'company') {
            return (a.companyId?.name || '').localeCompare(b.companyId?.name || '');
        }
        return 0;
    });

    // Metrics calculations
    const totalBilled = filteredInvoices.reduce((sum, inv) => sum + (inv.totalPaymentsAmount || 0), 0);
    const totalAmountDue = filteredInvoices.reduce((sum, inv) => sum + (inv.amountDue || 0), 0);
    const paidCount = filteredInvoices.filter(inv => inv.status === 'PAID').length;
    const totalCount = filteredInvoices.length;

    if (selectedInvoice) {
        return (
            <CompanyInvoiceTemplate
                invoice={selectedInvoice}
                onBack={() => setSelectedInvoice(null)}
            />
        );
    }

    return (
        <div className="payments-page">
            <style>{`
                @media (max-width: 768px) {
                    .payments-page .page-header {
                        display: none !important;
                    }
                }
            `}</style>
            {portalElement && createPortal(
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        type="button"
                        className={`p-2 rounded-full transition-colors flex items-center justify-center ${showFilters ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                        onClick={() => setShowFilters(!showFilters)}
                        id="filterToggle"
                        style={{ border: 'none', background: 'none', padding: '8px' }}
                    >
                        <ListFilter size={20} />
                    </button>
                </div>,
                portalElement
            )}

            <div className="page-header">
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a', margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
                        <Building size={28} color="#2563eb" />
                        Facturas de Empresas
                    </h1>
                    <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '14px' }}>Historial de facturación para sus clientes</p>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={loadData} className="btn-secondary">
                        <RefreshCw size={16} /> Actualizar
                    </button>
                    <button onClick={() => setShowGenerateModal(true)} className="btn-primary">
                        <Plus size={16} /> Generar Factura Mensual
                    </button>
                </div>
            </div>

            {/* Mobile Collapsible Filter Section (Mobile only) */}
            <div className={`collapsible-content max-w-[380px] mx-auto md:hidden ${showFilters ? 'expanded' : ''}`} id="filterSection">
                <div className="pt-2 pb-1">
                    {/* Search Box */}
                    <div className="search-box" style={{ maxWidth: 'none', marginBottom: '.5rem' }}>
                        <Search className="search-icon" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por factura o empresa..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button type="button" className="clear-search" onClick={() => setSearchQuery('')}>
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* Filter Badges */}
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', }}>
                        <button
                            type="button"
                            style={{
                                padding: '4px 12px',
                                borderRadius: '9999px',
                                fontSize: '12px',
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                                border: filter === 'all' ? '1px solid #2563eb' : '1px solid #e5e7eb',
                                backgroundColor: filter === 'all' ? '#2563eb' : 'white',
                                color: filter === 'all' ? 'white' : '#4b5563'
                            }}
                            onClick={() => { setFilter('all'); }}
                        >
                            Todos
                        </button>
                        <button
                            type="button"
                            style={{
                                padding: '4px 12px',
                                borderRadius: '9999px',
                                fontSize: '12px',
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                                border: filter === 'completed' ? '1px solid #2563eb' : '1px solid #e5e7eb',
                                backgroundColor: filter === 'completed' ? '#2563eb' : 'white',
                                color: filter === 'completed' ? 'white' : '#4b5563'
                            }}
                            onClick={() => { setFilter('completed'); }}
                        >
                            Pagadas
                        </button>
                        <button
                            type="button"
                            style={{
                                padding: '4px 12px',
                                borderRadius: '9999px',
                                fontSize: '12px',
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                                border: filter === 'pending' ? '1px solid #2563eb' : '1px solid #e5e7eb',
                                backgroundColor: filter === 'pending' ? '#2563eb' : 'white',
                                color: filter === 'pending' ? 'white' : '#4b5563'
                            }}
                            onClick={() => { setFilter('pending'); }}
                        >
                            Pendientes
                        </button>
                    </div>

                    {/* Sort & Action Items */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select
                            className="sort-select"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            style={{ flexGrow: 1, padding: '8px 12px' }}
                        >
                            <option value="date">Ordenar por Fecha</option>
                            <option value="amount">Ordenar por Monto</option>
                            <option value="company">Ordenar por Empresa</option>
                        </select>
                        <button className="filter-action-btn" onClick={loadData} style={{ height: '38px', width: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Actualizar">
                            <RefreshCw size={18} />
                        </button>
                        <button className="filter-action-btn filter-action-btn--primary" onClick={() => setShowGenerateModal(true)} style={{ height: '38px', width: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Generar Factura">
                            <Plus size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="payment-stats">
                <div className="payment-stat-card">
                    <div className="stat-icon" style={{ background: '#00C292' }}>
                        <DollarSign size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Total Recaudado</div>
                        <div className="stat-value-container">
                            <span className="stat-number">
                                <span className="desktop-only">{formatCurrency(totalBilled)}</span>
                                <span className="mobile-only">{formatCompact(totalBilled)}</span>
                            </span>
                        </div>
                    </div>
                </div>
                <div className="payment-stat-card">
                    <div className="stat-icon" style={{ background: '#EF4444' }}>
                        <TrendingDown size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Monto a Pagar</div>
                        <div className="stat-value-container">
                            <span className="stat-number">
                                <span className="desktop-only">{formatCurrency(totalAmountDue)}</span>
                                <span className="mobile-only">{formatCompact(totalAmountDue)}</span>
                            </span>
                        </div>
                    </div>
                </div>
                <div className="payment-stat-card">
                    <div className="stat-icon" style={{ background: 'var(--brand-teal)' }}>
                        <Check size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Pagadas</div>
                        <div className="stat-number">{paidCount}</div>
                    </div>
                </div>
                <div className="payment-stat-card">
                    <div className="stat-icon" style={{ background: '#7460EE' }}>
                        <FileText size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Total Facturas</div>
                        <div className="stat-number">{totalCount}</div>
                    </div>
                </div>
            </div>

            {/* Desktop Filters (Desktop only) */}
            <div className="payment-controls hidden md:flex">
                <div className="payment-filters">
                    <button
                        className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        Todos
                    </button>
                    <button
                        className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
                        onClick={() => setFilter('completed')}
                    >
                        Pagadas
                    </button>
                    <button
                        className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
                        onClick={() => setFilter('pending')}
                    >
                        Pendientes
                    </button>

                    <div className="search-box">
                        <Search className="search-icon" />
                        <input
                            type="text"
                            placeholder="Buscar por factura o empresa..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button className="clear-search" onClick={() => setSearchQuery('')}>
                                <X />
                            </button>
                        )}
                    </div>
                </div>
                <select
                    className="sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                >
                    <option value="date">Ordenar por Fecha</option>
                    <option value="amount">Ordenar por Monto</option>
                    <option value="company">Ordenar por Empresa</option>
                </select>
            </div>

            {/* Desktop Table View */}
            <div className="payments-table-container desktop-only">
                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Cargando facturas...</p>
                    </div>
                ) : (
                    <table className="payments-table">
                        <thead>
                            <tr>
                                <th>Factura #</th>
                                <th>Empresa</th>
                                <th>Periodo</th>
                                <th>Transacciones</th>
                                <th>Total Recaudado</th>
                                <th>Monto a Pagar</th>
                                <th>Estado</th>
                                <th style={{ textAlign: 'center' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedInvoices.map((inv) => (
                                <tr key={inv._id}>
                                    <td className="payment-id">
                                        <code>{inv.invoiceNumber}</code>
                                    </td>
                                    <td><strong>{inv.companyId?.name || 'Unknown'}</strong></td>
                                    <td className="date">{inv.month.toString().padStart(2, '0')}/{inv.year}</td>
                                    <td>{inv.totalTransactions}</td>
                                    <td className="amount" style={{ color: '#00C292' }}>{formatCurrency(inv.totalPaymentsAmount)}</td>
                                    <td className="amount" style={{ color: '#EF4444' }}>{formatCurrency(inv.amountDue)}</td>
                                    <td>
                                        <span className={`status-badge ${inv.status === 'PAID' ? 'completed' : 'pending'}`}>
                                            {inv.status === 'PAID' ? 'PAGADO' : 'PENDIENTE'}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                            <button
                                                onClick={() => setSelectedInvoice(inv)}
                                                title="Ver / Imprimir Factura"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb' }}
                                            >
                                                <Printer size={18} />
                                            </button>
                                            <button
                                                onClick={() => navigate(`/reports`)}
                                                title="Ver Detalles (Reconciliación)"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981' }}
                                            >
                                                <FileSpreadsheet size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {sortedInvoices.length === 0 && (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', color: '#6B7280', padding: '24px' }}>
                                        No se encontraron facturas de empresas.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Mobile Cards View */}
            <div className="invoice-cards-container mobile-only">
                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Cargando facturas...</p>
                    </div>
                ) : (
                    sortedInvoices.map((inv) => (
                        <div key={inv._id} className="invoice-card">
                            <div className="invoice-card-row1">
                                <span className="invoice-card-number">{inv.invoiceNumber}</span>
                                <span className={`invoice-card-badge status-${inv.status.toLowerCase()}`}>
                                    {inv.status === 'PAID' ? 'PAGADO' : 'PENDIENTE'}
                                </span>
                                <div className="invoice-card-options">
                                    <button
                                        onClick={() => setSelectedInvoice(inv)}
                                        title="Ver / Imprimir Factura"
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8e8e93' }}
                                    >
                                        <Printer size={18} />
                                    </button>
                                    <button
                                        onClick={() => navigate(`/reports`)}
                                        title="Ver Detalles (Reconciliación)"
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#10b981', marginLeft: '12px' }}
                                    >
                                        <FileSpreadsheet size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="invoice-card-row2">
                                <span className="invoice-card-amount-due">{formatCurrency(inv.amountDue)} COP</span>
                                <span className="invoice-card-tx-count">{inv.totalTransactions} transacciones</span>
                            </div>

                            <div className="invoice-card-row3">
                                <span className="invoice-card-company-name">{inv.companyId?.name || 'Unknown'}</span>
                                <span className="invoice-card-total-payments">{formatCurrency(inv.totalPaymentsAmount)} COP</span>
                            </div>

                            <div className="invoice-card-divider"></div>

                            <div className="invoice-card-footer">
                                <span className="invoice-card-footer-payments">
                                    <span style={{ color: '#10b981', marginRight: '6px', fontWeight: 'bold' }}>✓</span>
                                    {formatCurrency(inv.totalPaymentsAmount)} COP
                                </span>
                                <span className="invoice-card-footer-period">
                                    <span style={{ marginRight: '6px' }}>📅</span>
                                    {inv.month.toString().padStart(2, '0')}/{inv.year}
                                </span>
                            </div>
                        </div>
                    ))
                )}
                {!loading && sortedInvoices.length === 0 && (
                    <div className="empty-state" style={{ padding: '40px 20px', background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                        <Building size={48} style={{ color: '#9CA3AF', marginBottom: '12px' }} />
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#374151' }}>No se encontraron facturas</h3>
                        <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>No hay registros de facturas que coincidan con los filtros.</p>
                    </div>
                )}
            </div>

            {/* Generate Modal */}
            {showGenerateModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '400px', maxWidth: '90%', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#1F2937', fontWeight: '600' }}>Generar Factura Mensual</h2>
                        <form onSubmit={handleGenerate}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#4B5563', fontWeight: '500' }}>Empresa</label>
                                <select
                                    required
                                    value={companyId}
                                    onChange={e => setCompanyId(e.target.value)}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', color: '#1F2937', background: 'white', fontSize: '14px' }}
                                >
                                    <option value="">Seleccione una empresa</option>
                                    {companies.map(c => (
                                        <option key={c._id} value={c._id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#4B5563', fontWeight: '500' }}>Mes</label>
                                    <select
                                        value={month}
                                        onChange={(e) => setMonth(Number(e.target.value))}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', color: '#1F2937', background: 'white', fontSize: '14px' }}
                                    >
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                            <option key={`m-${m}`} value={m}>{new Date(2000, m - 1).toLocaleString('es', { month: 'long' }).replace(/^\w/, (c) => c.toUpperCase())}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#4B5563', fontWeight: '500' }}>Año</label>
                                    <select
                                        value={year}
                                        onChange={(e) => setYear(Number(e.target.value))}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', color: '#1F2937', background: 'white', fontSize: '14px' }}
                                    >
                                        {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
                                            <option key={`y-${y}`} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button type="button" onClick={() => setShowGenerateModal(false)} style={{ padding: '8px 16px', border: '1px solid #D1D5DB', background: 'white', color: '#4B5563', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>Cancelar</button>
                                <button type="submit" className="btn-primary">Generar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompanyInvoices;
