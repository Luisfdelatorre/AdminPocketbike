import React, { useEffect } from 'react';
import { ArrowLeft, Printer, CheckCircle } from 'lucide-react';

const CompanyInvoiceTemplate = ({ invoice, onBack }) => {
    const handlePrint = () => {
        window.print();
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(value || 0);
    };

    // Derived values
    const dueDate = new Date(invoice.dueDate).toLocaleDateString('es-CO');
    const invoiceDate = new Date(invoice.issuedAt).toLocaleDateString('es-CO');
    const subtotal = invoice.subtotal || 0;
    const tax = invoice.tax || 0;
    const amountDue = invoice.amountDue || 0;
    const company = invoice.companyId || {};

    useEffect(() => {
        const mobileHeaderH2 = document.querySelector('.mobile-header h2');
        let originalText = '';
        if (mobileHeaderH2) {
            originalText = mobileHeaderH2.innerText;
            mobileHeaderH2.innerText = company.name || 'Factura';
        }
        return () => {
            if (mobileHeaderH2 && originalText) {
                mobileHeaderH2.innerText = originalText;
            }
        };
    }, [company.name]);

    return (
        <div className="invoice-preview-container">
            {/* Non-printable controls */}
            <div className="no-print">
                <button 
                    onClick={onBack} 
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                    <ArrowLeft size={16} /> Volver al listado
                </button>
                <button 
                    onClick={handlePrint} 
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)' }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
                >
                    <Printer size={16} /> Imprimir / PDF
                </button>
            </div>

            {/* Printable Invoice Container */}
            <div className="invoice-print-area">
                
                {/* Header Section */}
                <div className="invoice-header">
                    <div className="invoice-header-title">
                        <h1>RESUMEN DE COMISIÓN</h1>
                        <div className="invoice-number">Factura #: {invoice.invoiceNumber}</div>
                    </div>
                    <div className="invoice-header-company-details">
                        <div className="company-name">Pocketbike S.A.S</div>
                        <div className="company-info-text">NIT: 901366393-9</div>
                        <div className="company-info-text">Turbaco, Colombia</div>
                        <div className="company-email">billing@pocketbike.app</div>
                    </div>
                </div>

                {/* Info Section */}
                <div className="invoice-info-section">
                    <div className="invoice-info-left">
                        <div className="section-title-label">Facturado a</div>
                        <div className="company-name-bold">{company.name || 'COMPANY NAME'}</div>
                        {company.nit && <div className="info-text-row">NIT: {company.nit}</div>}
                        <div className="info-text-row">{company.address || 'Address not provided'}</div>
                    </div>
                    <div className="invoice-info-right">
                        <div className="invoice-dates-wrapper">
                            <div className="invoice-date-col" style={{ marginRight: '16px' }}>
                                <div className="section-title-label" style={{ marginBottom: '4px' }}>Fecha de Emisión</div>
                                <div className="invoice-date-val">{invoiceDate}</div>
                            </div>
                            <div className="invoice-date-col">
                                <div className="section-title-label" style={{ marginBottom: '4px' }}>Periodo</div>
                                <div className="invoice-date-val">{invoice.month.toString().padStart(2, '0')}/{invoice.year}</div>
                            </div>
                        </div>
                        <div className="status-pill">
                            <CheckCircle size={14} />
                            Pre-Retenido
                        </div>
                    </div>
                </div>

                {/* Items Table - Desktop Only */}
                <div className="invoice-table-area desktop-only">
                    <table className="invoice-table">
                        <thead>
                            <tr>
                                <th className="text-left">Descripción</th>
                                <th className="text-center">Transacciones</th>
                                <th className="text-right">Volumen Total</th>
                                <th className="text-right">Retenido</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    <div className="item-desc-title">Comisión por Procesamiento de Pagos</div>
                                    <div className="item-desc-sub">Comisión retenida del volumen total procesado para {invoice.month.toString().padStart(2, '0')}/{invoice.year}</div>
                                </td>
                                <td className="text-center" style={{ color: '#334155' }}>{invoice.totalTransactions}</td>
                                <td className="text-right" style={{ color: '#334155' }}>{formatCurrency(invoice.totalPaymentsAmount)}</td>
                                <td className="text-right" style={{ fontWeight: '600', color: '#0f172a' }}>{formatCurrency(subtotal)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Items List - Mobile Only */}
                <div className="invoice-mobile-details mobile-only">
                    <div className="mobile-detail-row header-row">
                        <span className="mobile-detail-title">Descripción</span>
                        <span className="font-semibold" style={{ fontSize: '15px' }}>Comisión por Procesamiento de Pagos</span>
                        <div className="item-desc-sub" style={{ fontSize: '12px' }}>Comisión retenida del volumen total procesado para {invoice.month.toString().padStart(2, '0')}/{invoice.year}</div>
                    </div>
                    <div className="mobile-detail-row">
                        <span>Transacciones</span>
                        <span className="font-semibold">{invoice.totalTransactions}</span>
                    </div>
                    <div className="mobile-detail-row">
                        <span>Volumen Total</span>
                        <span className="font-semibold">{formatCurrency(invoice.totalPaymentsAmount)} COP</span>
                    </div>
                    <div className="mobile-detail-row">
                        <span>Retenido</span>
                        <span className="font-semibold" style={{ color: '#0f172a' }}>{formatCurrency(subtotal)} COP</span>
                    </div>
                </div>

                {/* Totals Section */}
                <div className="invoice-totals-section">
                    <div className="invoice-note-container">
                        <div className="invoice-note-box">
                            <div className="invoice-note-title">Nota Importante</div>
                            <div className="invoice-note-text">
                                Este es un resumen de las comisiones que <strong>ya han sido pre-retenidas</strong> de sus transacciones diarias. 
                                <span style={{ color: '#dc2626', fontWeight: '600', display: 'block', marginTop: '8px' }}>No realice ninguna transferencia por este valor. No se requiere ninguna acción de su parte.</span>
                            </div>
                        </div>
                    </div>
                    <div className="invoice-totals-container">
                        <div className="invoice-totals-row subtotal-row">
                            <span style={{ color: '#475569', fontWeight: '500' }}>Subtotal</span>
                            <span style={{ color: '#0f172a', fontWeight: '600' }}>{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="invoice-totals-row">
                            <span style={{ color: '#475569', fontWeight: '500' }}>IVA</span>
                            <span style={{ color: '#0f172a', fontWeight: '600' }}>{formatCurrency(tax)}</span>
                        </div>
                        <div className="invoice-totals-row grand-total-row">
                            <span className="total-label">Total Retenido</span>
                            <span className="total-value">{formatCurrency(amountDue)}</span>
                        </div>
                    </div>
                </div>

            </div>

            <style dangerouslySetInnerHTML={{__html: `
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                
                .invoice-preview-container {
                    background-color: #f1f5f9;
                    min-height: 100vh;
                    padding: 40px 20px;
                    font-family: 'Inter', sans-serif;
                    box-sizing: border-box;
                }
                
                .no-print {
                    max-width: 800px;
                    margin: 0 auto 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .invoice-print-area {
                    max-width: 800px;
                    margin: 0 auto;
                    background: #ffffff;
                    border-radius: 16px;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
                    overflow: hidden;
                    color: #1e293b;
                    box-sizing: border-box;
                }
                
                .invoice-header {
                    background: #0f172a;
                    padding: 40px;
                    color: white;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 20px;
                }
                
                .invoice-header-title h1 {
                    font-size: 28px;
                    margin: 0 0 8px 0;
                    font-weight: 700;
                    letter-spacing: -0.5px;
                    line-height: 1.2;
                }
                
                .invoice-header-title .invoice-number {
                    color: #94a3b8;
                    font-size: 14px;
                }
                
                .invoice-header-company-details {
                    text-align: right;
                }
                
                .invoice-header-company-details .company-name {
                    font-weight: 700;
                    font-size: 18px;
                    margin-bottom: 4px;
                }
                
                .invoice-header-company-details .company-info-text {
                    color: #94a3b8;
                    font-size: 14px;
                    margin-bottom: 2px;
                }
                
                .invoice-header-company-details .company-email {
                    color: #38bdf8;
                    font-size: 14px;
                }
                
                .invoice-info-section {
                    display: flex;
                    justify-content: space-between;
                    padding: 40px;
                    border-bottom: 1px solid #e2e8f0;
                    gap: 24px;
                }
                
                .invoice-info-left {
                    flex: 1.2;
                }
                
                .invoice-info-right {
                    flex: 1;
                    text-align: right;
                }
                
                .section-title-label {
                    font-size: 11px;
                    font-weight: 600;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 12px;
                }
                
                .company-name-bold {
                    font-weight: 700;
                    font-size: 18px;
                    color: #0f172a;
                    margin-bottom: 4px;
                }
                
                .info-text-row {
                    color: #475569;
                    font-size: 14px;
                    margin-bottom: 4px;
                }
                
                .invoice-dates-wrapper {
                    display: flex;
                    justify-content: flex-end;
                    margin-bottom: 12px;
                }
                
                .invoice-date-col {
                    text-align: left;
                }
                
                .invoice-date-val {
                    font-size: 14px;
                    font-weight: 500;
                    color: #0f172a;
                }
                
                .status-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: #ecfdf5;
                    color: #059669;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 13px;
                    font-weight: 600;
                }
                
                .invoice-table-area {
                    padding: 40px;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }
                
                .invoice-table {
                    width: 100%;
                    border-collapse: collapse;
                    min-width: 600px;
                }
                
                .invoice-table th {
                    padding: 0 0 16px 0;
                    color: #64748b;
                    font-weight: 600;
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 2px solid #e2e8f0;
                }
                
                .invoice-table th.text-left { text-align: left; }
                .invoice-table th.text-center { text-align: center; }
                .invoice-table th.text-right { text-align: right; }
                
                .invoice-table td {
                    padding: 20px 0;
                    border-bottom: 1px solid #f1f5f9;
                    font-size: 14px;
                }
                
                .invoice-table td.text-center { text-align: center; }
                .invoice-table td.text-right { text-align: right; }
                
                .item-desc-title {
                    font-weight: 600;
                    color: #0f172a;
                    margin-bottom: 4px;
                }
                
                .item-desc-sub {
                    font-size: 13px;
                    color: #64748b;
                }
                
                .invoice-totals-section {
                    display: flex;
                    justify-content: space-between;
                    padding: 0 40px 40px;
                    gap: 40px;
                }
                
                .invoice-note-container {
                    flex: 1.2;
                }
                
                .invoice-note-box {
                    background: #f8fafc;
                    padding: 20px;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                }
                
                .invoice-note-title {
                    font-weight: 600;
                    font-size: 14px;
                    color: #0f172a;
                    margin-bottom: 8px;
                }
                
                .invoice-note-text {
                    font-size: 13px;
                    color: #475569;
                    line-height: 1.5;
                }
                
                .invoice-totals-container {
                    width: 300px;
                    flex-shrink: 0;
                }
                
                .invoice-totals-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 16px 0;
                    border-bottom: 1px solid #e2e8f0;
                }
                
                .invoice-totals-row.subtotal-row {
                    padding-top: 0;
                }
                
                .invoice-totals-row.grand-total-row {
                    border-bottom: none;
                    padding-bottom: 0;
                    padding-top: 20px;
                    align-items: center;
                }
                
                .invoice-totals-row .total-label {
                    color: #0f172a;
                    font-weight: 700;
                    font-size: 18px;
                }
                
                .invoice-totals-row .total-value {
                    color: #2563eb;
                    font-weight: 800;
                    font-size: 24px;
                }
                
                .mobile-only {
                    display: none !important;
                }
                .desktop-only {
                    display: block !important;
                }
                
                .invoice-mobile-details {
                    padding: 24px 20px;
                    display: none;
                    flex-direction: column;
                    gap: 12px;
                    border-bottom: 1px solid #e2e8f0;
                }
                
                .mobile-detail-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 14px;
                    color: #475569;
                }
                
                .mobile-detail-row.header-row {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 4px;
                    border-bottom: 1px dashed #e2e8f0;
                    padding-bottom: 12px;
                    margin-bottom: 4px;
                }
                
                .mobile-detail-title {
                    font-size: 11px;
                    text-transform: uppercase;
                    font-weight: 600;
                    color: #64748b;
                    letter-spacing: 0.5px;
                }
                
                .font-semibold {
                    font-weight: 600;
                    color: #0f172a;
                }
                
                @media (max-width: 768px) {
                    .mobile-only {
                        display: block !important;
                    }
                    .desktop-only {
                        display: none !important;
                    }
                    .invoice-mobile-details {
                        display: flex !important;
                    }
                    
                    .invoice-preview-container {
                        padding: 80px 12px 16px;
                    }
                    .no-print {
                        margin-bottom: 16px;
                    }
                    .invoice-header {
                        flex-direction: column;
                        padding: 24px 20px;
                        gap: 20px;
                        align-items: stretch;
                    }
                    .invoice-header-title h1 {
                        font-size: 22px;
                    }
                    .invoice-header-company-details {
                        text-align: left;
                    }
                    .invoice-info-section {
                        flex-direction: column;
                        padding: 24px 20px;
                        gap: 20px;
                    }
                    .invoice-info-right {
                        text-align: left;
                    }
                    .invoice-dates-wrapper {
                        justify-content: flex-start;
                        gap: 16px;
                    }
                    .invoice-table-area {
                        padding: 20px;
                    }
                    .invoice-totals-section {
                        flex-direction: column-reverse;
                        padding: 0 20px 24px;
                        gap: 24px;
                    }
                    .invoice-totals-container {
                        width: 100%;
                    }
                }
                
                @media print {
                    /* Hide sidebar, dashboard controls, navigation header and print action buttons */
                    .admin-sidebar,
                    .sidebar-toggle,
                    .no-print,
                    .sidebar-icon-btn,
                    #mobile-header-actions,
                    .mobile-header-actions {
                        display: none !important;
                    }
                    
                    /* Reset html, body, main layout wrappers to allow normal print document flow */
                    html, body, #root, .admin-layout, .invoice-preview-container {
                        background: white !important;
                        background-color: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        min-height: auto !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        overflow: visible !important;
                        position: static !important;
                    }
                    
                    .admin-content {
                        margin-left: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        min-height: auto !important;
                        width: 100% !important;
                        position: static !important;
                    }
                    
                    /* Reset the print area card to act as a standard full-width page block */
                    .invoice-print-area {
                        margin: 0 auto !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        width: 100% !important;
                        max-width: 800px !important;
                        background: white !important;
                        position: static !important;
                    }
                }
            `}} />
        </div>
    );
};

export default CompanyInvoiceTemplate;
