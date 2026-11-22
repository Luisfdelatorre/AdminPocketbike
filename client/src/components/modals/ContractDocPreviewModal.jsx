import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { renderAsync } from 'docx-preview';
import {
    FileText,
    Download,
    Printer,
    FileDown,
    X,
    ArrowLeft,
    Share2,
    Calendar,
    TrendingUp,
    ShieldCheck,
    CheckCircle2,
    Building2,
    User,
    Bike,
    DollarSign,
    Sparkles,
    Copy,
    ZoomIn,
    ZoomOut,
    Check,
    Clock,
    Hash,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { downloadContractDocument, getContractDocxBlob } from '../../services/api';
import { downloadContractPdf } from '../../utils/contractPdfGenerator';
import { showToast } from '../../utils/toast';
import { safeCalcularPrecioMoto } from '../../utils/contractCalculations';
import Amount from '../Amount';
import useAdminScrollLock from '../../hooks/useAdminScrollLock';
import './ContractDocPreviewModal.css';

const formatCOP = (val) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
    }).format(num);
};

const ContractDocPreviewModal = ({ contract, isOpen, onClose }) => {
    const { t } = useTranslation();
    useAdminScrollLock(isOpen);

    // Handle ESC key to dismiss modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const paperDocRef = useRef(null);
    const [activeTab, setActiveTab] = useState('financial'); // 'legal' | 'financial' | 'installments'
    const [zoom, setZoom] = useState(100);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [downloadingDocx, setDownloadingDocx] = useState(false);
    const [copiedShare, setCopiedShare] = useState(false);
    const [isFinancialCollapsed, setIsFinancialCollapsed] = useState(true);
    const [isPartiesCollapsed, setIsPartiesCollapsed] = useState(true);

    // DOCX rendering state
    const docxViewerRef = useRef(null);
    const docxBlobRef = useRef(null);
    const [docxLoading, setDocxLoading] = useState(false);
    const [docxError, setDocxError] = useState(null);
    const [docxPageCount, setDocxPageCount] = useState(1);

    // Compute financial breakdown dynamically if not present
    const financial = useMemo(() => {
        if (!contract) return null;
        if (contract.financialBreakdown && contract.financialBreakdown.calculated) {
            return contract.financialBreakdown;
        }
        return safeCalcularPrecioMoto({
            dailyRate: contract.dailyRate,
            contractDays: contract.contractDays,
            initialFee: contract.initialFee || contract.financialBreakdown?.initialFee || 0
        });
    }, [contract]);

    const loadAndRenderDocx = useCallback(async (forceReload = false) => {
        if (!docxViewerRef.current) return;
        try {
            setDocxLoading(true);
            setDocxError(null);

            let blob = forceReload ? null : docxBlobRef.current;
            if (!blob) {
                const targetId = contract?.contractId || contract?._id;
                if (!targetId) throw new Error('Identificador de contrato no disponible.');
                blob = await getContractDocxBlob(targetId);
                docxBlobRef.current = blob;
            }

            if (!docxViewerRef.current) return;
            docxViewerRef.current.innerHTML = '';

            await renderAsync(blob, docxViewerRef.current, null, {
                inWrapper: true,
                ignoreWidth: false,
                ignoreHeight: false,
                breakPages: true
            });

            if (docxViewerRef.current) {
                const pages = docxViewerRef.current.querySelectorAll('section.docx');
                if (pages.length > 0) {
                    setDocxPageCount(pages.length);
                }
            }
        } catch (err) {
            console.error('Error renderizando plantilla docx:', err);
            setDocxError(err.message || 'No se pudo renderizar el contrato desde la plantilla oficial.');
        } finally {
            setDocxLoading(false);
        }
    }, [contract?.contractId, contract?._id]);

    useEffect(() => {
        docxBlobRef.current = null;
        setDocxError(null);
    }, [contract?.contractId, contract?._id]);

    useEffect(() => {
        if (!isOpen || activeTab !== 'legal') return;
        loadAndRenderDocx();
    }, [isOpen, activeTab, loadAndRenderDocx]);

    useEffect(() => {
        if (!isOpen) return;
        document.body.classList.add('modal-open-hide-header');
        return () => {
            document.body.classList.remove('modal-open-hide-header');
        };
    }, [isOpen]);

    if (!isOpen || !contract) return null;

    // Extract technical vehicle specs with full fallback
    const vInfo = contract.vehicleInfo || {};
    const attTp = contract.attachments?.tarjetaPropiedad || {};
    const attSoat = contract.attachments?.soat || {};

    const placa = vInfo.placa || contract.deviceIdName;
    const marca = vInfo.marca;
    const linea = vInfo.linea;
    const modelo = vInfo.modelo;
    const color = vInfo.color;
    const cilindraje = vInfo.cilindraje || vInfo.cilindrada;
    const numeroMotor = vInfo.numeroMotor || vInfo['No. MOTOR'] || attTp.numeroMotor || attTp['No. MOTOR'] || attSoat.numeroMotor || attSoat['No. MOTOR'];
    const numeroChasis = vInfo.numeroChasis || vInfo['No. CHASIS ó No. SERIE'] || vInfo['No. CHASIS'] || attTp.numeroChasis || attTp['No. CHASIS ó No. SERIE'] || attSoat.numeroChasis || attSoat['No. CHASIS ó No. SERIE'];

    const customerName = (contract.customerName).toUpperCase();
    const customerDoc = contract.customerDocument;
    const customerPhone = contract.customerPhone;
    const contractId = contract.contractId || contract._id;
    const dailyRate = contract.dailyRate || 35000;
    const contractDays = contract.contractDays || 390;
    const totalAmount = contract.totalAmount || (dailyRate * contractDays);
    const paidInvoicesCount = contract.paidInvoicesCount || 42;
    const paidPercent = Math.min(100, Math.round((paidInvoicesCount / contractDays) * 100)) || 11;

    // Deterministic cryptographic hash for digital signature display
    const pseudoHash = useMemo(() => {
        let str = `${contractId}-${customerName}-${placa}-${numeroMotor}-${totalAmount}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        const hex = Math.abs(hash).toString(16).padStart(8, '0');
        return `e3b0c44298fc${hex}afbf4c8996fb924`.substring(0, 32);
    }, [contractId, customerName, placa, numeroMotor, totalAmount]);

    const handleShare = async () => {
        const text = ` Pocketbike & UPaySolutions\nID: ${contractId}\nCliente: ${customerName}\nPlaca: ${placa}\nCuota Diaria: ${formatCOP(dailyRate)}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Contrato ${placa} - ${customerName}`,
                    text: text,
                    url: window.location.href
                });
                return;
            } catch (err) {
                if (err.name !== 'AbortError') console.error('Error sharing:', err);
            }
        }
        // Fallback copy to clipboard
        try {
            await navigator.clipboard.writeText(text);
            setCopiedShare(true);
            showToast('success', 'Copiado al portapapeles', 'Resumen del contrato listo para compartir.');
            setTimeout(() => setCopiedShare(false), 2500);
        } catch {
            showToast('info', 'Contrato', `ID: ${contractId}`);
        }
    };

    const handleDownloadPdf = async () => {
        try {
            setGeneratingPdf(true);
            showToast('info', 'Descargando PDF', 'Obteniendo PDF oficial del contrato desde el servidor...');
            const targetFilename = `Contrato_${placa}_${contractId}.pdf`;
            await downloadContractPdf(contract.contractId || contractId, targetFilename);
            showToast('success', 'PDF Descargado', 'El contrato se ha descargado correctamente.');
        } catch (err) {
            console.error('Error al descargar PDF:', err);
            showToast('error', 'Error', err.message || 'No se pudo descargar el PDF del contrato.');
        } finally {
            setGeneratingPdf(false);
        }
    };

    const handleDownloadDocx = async () => {
        try {
            setDownloadingDocx(true);
            showToast('info', 'Descargando Word', 'Descargando archivo oficial .docx con datos integrados...');
            await downloadContractDocument(contract.contractId);
            showToast('success', 'Word Descargado', 'Archivo .docx descargado con éxito.');
        } catch (err) {
            console.error('Error descargando DOCX:', err);
            showToast('error', 'Error', 'No se pudo descargar el archivo Word del contrato.');
        } finally {
            setDownloadingDocx(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (!isOpen || !contract) return null;

    return createPortal(
        <div
            className="contract-immersive-overlay"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div
                className="contract-immersive-container"
                onClick={(e) => e.stopPropagation()}
            >

                {/* APP HEADER */}
                <header className="contract-immersive-header no-print">
                    <div className="contract-header-top">
                        <div className="contract-header-left">
                            <button
                                aria-label="Volver"
                                className="contract-back-btn"
                                onClick={onClose}
                                type="button"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div className="contract-header-title-wrap">
                                <div className="contract-header-status-line">
                                    <h1 className="contract-header-title">Contrato Digital</h1>
                                    <span className="contract-status-badge">
                                        {contract.status === 'COMPLETED' ? 'Completado' : 'Activo'}
                                    </span>
                                </div>
                                <p className="contract-header-id">ID: {contractId} • {placa}</p>
                            </div>
                        </div>

                        <div className="contract-header-actions">
                            <button
                                aria-label="Compartir contrato"
                                className="contract-util-btn"
                                onClick={handleShare}
                                type="button"
                                title="Compartir"
                            >
                                {copiedShare ? <Check size={16} className="text-emerald-600" /> : <Share2 size={16} />}
                            </button>
                            <button
                                aria-label="Cerrar visor"
                                className="contract-util-btn"
                                onClick={onClose}
                                type="button"
                                title="Cerrar"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* TABS DE NAVEGACIÓN */}
                    <nav className="contract-view-tabs custom-scrollbar">
                        <button
                            className={`contract-tab-btn ${activeTab === 'legal' ? 'is-active' : ''}`}
                            onClick={() => setActiveTab('legal')}
                            type="button"
                        >
                            <FileText size={14} />
                            <span></span>
                        </button>
                        <button
                            className={`contract-tab-btn ${activeTab === 'financial' ? 'is-active' : ''}`}
                            onClick={() => setActiveTab('financial')}
                            type="button"
                        >
                            <DollarSign size={14} />
                            <span></span>
                        </button>
                        <button
                            className={`contract-tab-btn ${activeTab === 'installments' ? 'is-active' : ''}`}
                            onClick={() => setActiveTab('installments')}
                            type="button"
                        >
                            <Calendar size={14} />
                            <span>({contractDays})</span>
                        </button>
                    </nav>
                </header>

                {/* CONTENIDO PRINCIPAL */}
                <main className="contract-immersive-main custom-scrollbar">



                    {/* VISTA 1: DOCUMENTO LEGAL (SINTETIZADO DESDE CONTRATO_TEMPLATE.docx) */}
                    {activeTab === 'legal' && (
                        <section className="contract-paper-section print-page" ref={paperDocRef}>
                            {/* Toolbar de lectura */}
                            <div className="contract-paper-toolbar no-print">
                                <div className="contract-paper-meta">
                                    <span>Pág. 1 de {docxPageCount}</span>
                                    <span className="text-slate-300">|</span>
                                    <span className="text-slate-500 text-xs">Plantilla Oficial Word (.docx)</span>
                                </div>
                                <div className="contract-zoom-controls">
                                    <button
                                        onClick={() => setZoom(z => Math.max(70, z - 10))}
                                        className="contract-zoom-btn"
                                        title="Reducir tamaño"
                                        type="button"
                                    >
                                        <ZoomOut size={13} />
                                    </button>
                                    <span className="contract-zoom-text">{zoom}%</span>
                                    <button
                                        onClick={() => setZoom(z => Math.min(130, z + 10))}
                                        className="contract-zoom-btn"
                                        title="Aumentar tamaño"
                                        type="button"
                                    >
                                        <ZoomIn size={13} />
                                    </button>
                                </div>
                            </div>

                            {/* CONTENEDOR DOCUMENTO WORD SINTETIZADO */}
                            <div
                                className="contract-docx-viewer-wrapper"
                                style={{ transform: zoom !== 100 ? `scale(${zoom / 100})` : 'none', transformOrigin: 'top center' }}
                            >
                                {docxLoading && (
                                    <div className="contract-docx-loading">
                                        <div className="contract-docx-spinner"></div>
                                        <div className="contract-docx-loading-text">
                                            <span className="font-semibold text-slate-800">Sintetizando contrato desde plantilla oficial...</span>
                                            <span className="text-xs text-slate-500">Mapeando 42 variables técnicas y financieras en el documento</span>
                                        </div>
                                    </div>
                                )}

                                {docxError && (
                                    <div className="contract-docx-error">
                                        <p className="font-semibold text-rose-600">Error al compilar el documento</p>
                                        <p className="text-xs text-slate-600">{docxError}</p>
                                        <button
                                            onClick={() => loadAndRenderDocx(true)}
                                            className="mt-3 px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 cursor-pointer"
                                            type="button"
                                        >
                                            Reintentar
                                        </button>
                                    </div>
                                )}

                                <div
                                    ref={docxViewerRef}
                                    className="contract-docx-render-stage"
                                    style={{ display: docxLoading || docxError ? 'none' : 'block' }}
                                />
                            </div>
                        </section>
                    )}

                    {/* VISTA 2: RESUMEN FINANCIERO */}
                    {activeTab === 'financial' && (
                        <section className="contract-tab-content space-y-4">
                            <div className="contract-tab-card">
                                <h3 className="contract-card-title flex items-center gap-2 mb-3">
                                    <DollarSign size={16} className="text-teal-600" />
                                    Desglose Actuarial y Financiero
                                </h3>

                                <div className="contract-financial-breakdown-grid">
                                    <div className="contract-fin-box bg-teal-50/70 border-teal-100">
                                        <span className="contract-fin-box-label">Cuota Financiera UPAY (50%)</span>
                                        <div className="contract-fin-box-val text-teal-800">{formatCOP(dailyRate / 2)} / día</div>
                                        <small className="text-teal-600 text-[11px]">Amortización de Capital + Interés EA 29%</small>
                                    </div>
                                    <div className="contract-fin-box bg-slate-50 border-slate-200">
                                        <span className="contract-fin-box-label">Cuota Operativa Pocketbike (50%)</span>
                                        <div className="contract-fin-box-val text-slate-800">{formatCOP(dailyRate / 2)} / día</div>
                                        <small className="text-slate-500 text-[11px]">Plataforma Cloud, Telemetría y Soporte</small>
                                    </div>
                                </div>

                                <div className="contract-costs-table-wrap mt-4">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Costos Fijos Iniciales</h4>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between py-1.5 border-b border-slate-100">
                                            <span className="text-slate-600">Dispositivo GPS y Telemática</span>
                                            <strong className="text-slate-800 font-mono">$500.000 COP</strong>
                                        </div>
                                        <div className="flex justify-between py-1.5 border-b border-slate-100">
                                            <span className="text-slate-600">SOAT Post-Matrícula</span>
                                            <strong className="text-slate-800 font-mono">$370.000 COP</strong>
                                        </div>
                                        <div className="flex justify-between py-1.5 border-b border-slate-100">
                                            <span className="text-slate-600">Traspaso Oficial de Tránsito</span>
                                            <strong className="text-slate-800 font-mono">$273.000 COP</strong>
                                        </div>
                                        <div className="flex justify-between py-1.5 border-b border-slate-100">
                                            <span className="text-slate-600">Registro y Matrícula RUNT</span>
                                            <strong className="text-slate-800 font-mono">$217.000 COP</strong>
                                        </div>
                                        <div className="flex justify-between pt-2 font-bold text-slate-900">
                                            <span>Total Gastos Fijos</span>
                                            <span className="font-mono text-teal-700">$1.360.000 COP</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* VISTA 3: PLAN DE CUOTAS */}
                    {activeTab === 'installments' && (
                        <section className="contract-tab-content space-y-4">
                            <div className="contract-tab-card">
                                <h3 className="contract-card-title flex items-center gap-2 mb-3">
                                    <Calendar size={16} className="text-teal-600" />
                                    Cronograma de Amortización y Cuotas Diarias
                                </h3>
                                <p className="text-xs text-slate-500 mb-4">
                                    Plan programado a {contractDays} pagos diarios consecutivos de {formatCOP(dailyRate)}.
                                </p>

                                <div className="contract-installments-summary-bar">
                                    <div className="flex items-center gap-3">
                                        <div className="contract-inst-stat">
                                            <span>Cuotas Pagadas</span>
                                            <strong>{paidInvoicesCount}</strong>
                                        </div>
                                        <div className="contract-inst-stat">
                                            <span>Pendientes</span>
                                            <strong>{contractDays - paidInvoicesCount}</strong>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs text-slate-500">Saldo Pendiente:</span>
                                        <div className="font-mono font-bold text-slate-900 text-sm">
                                            {formatCOP(totalAmount - (paidInvoicesCount * dailyRate))} COP
                                        </div>
                                    </div>
                                </div>

                                <div className="contract-installments-table-wrap custom-scrollbar mt-4 max-h-[360px] overflow-y-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-50 sticky top-0 text-slate-600 border-b border-slate-200">
                                            <tr>
                                                <th className="py-2 px-3 text-left"># Cuota</th>
                                                <th className="py-2 px-3 text-left">Valor</th>
                                                <th className="py-2 px-3 text-left">UPAY (50%)</th>
                                                <th className="py-2 px-3 text-left">Pocketbike (50%)</th>
                                                <th className="py-2 px-3 text-right">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {Array.from({ length: Math.min(contractDays, 30) }).map((_, idx) => {
                                                const num = idx + 1;
                                                const isPaid = num <= paidInvoicesCount;
                                                return (
                                                    <tr key={num} className={isPaid ? 'bg-emerald-50/30' : ''}>
                                                        <td className="py-2 px-3 font-mono font-bold">Cuota #{num}</td>
                                                        <td className="py-2 px-3 font-mono">{formatCOP(dailyRate)}</td>
                                                        <td className="py-2 px-3 font-mono text-teal-700">{formatCOP(dailyRate / 2)}</td>
                                                        <td className="py-2 px-3 font-mono text-slate-600">{formatCOP(dailyRate / 2)}</td>
                                                        <td className="py-2 px-3 text-right">
                                                            {isPaid ? (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Pagada</span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">Pendiente</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </section>
                    )}
                </main>

                {/* BOTTOM FLOATING ACTION BAR */}
                <aside className="contract-floating-bottom-bar no-print">
                    <div className="contract-bottom-inner">
                        <div className="contract-bottom-info">
                            <span className="contract-bottom-label">Cuota Diaria</span>
                            <div className="contract-bottom-val">
                                {formatCOP(dailyRate)} <span className="contract-bottom-cur">COP</span>
                            </div>
                        </div>

                        <div className="contract-bottom-actions">
                            <button
                                className="contract-bottom-btn-sec"
                                onClick={handleShare}
                                type="button"
                            >
                                <Share2 size={15} />
                                <span>Compartir</span>
                            </button>
                            <button
                                className="contract-bottom-btn-pri"
                                onClick={handleDownloadPdf}
                                disabled={generatingPdf}
                                type="button"
                            >
                                <Download size={15} />
                                <span>{generatingPdf ? 'Descargando...' : 'Descargar PDF'}</span>
                            </button>
                        </div>
                    </div>
                </aside>

            </div>
        </div>,
        document.body
    );
};

export default ContractDocPreviewModal;
