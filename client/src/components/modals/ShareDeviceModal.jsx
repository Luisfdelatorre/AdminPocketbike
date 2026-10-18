import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { Home, ChevronRight } from 'lucide-react';
import {
    ArrowLeft,
    Share2,
    Copy,
    Check,
    ShieldCheck,
    AlertTriangle,
    Link2,
    X,
    ExternalLink
} from 'lucide-react';
import useAdminScrollLock from '../../hooks/useAdminScrollLock';
import './ShareDeviceModal.css';

const ShareDeviceModal = ({ isOpen, onClose, shareUrl, device, onCopy }) => {
    const { t } = useTranslation();
    const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);

    // Standardized body and layout scroll lock
    useAdminScrollLock(isOpen);

    // Handle ESC key to dismiss sheet or modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (isShareSheetOpen) {
                    setIsShareSheetOpen(false);
                } else {
                    onClose();
                }
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isShareSheetOpen, onClose]);

    // Reset internal states when modal closes or opens
    useEffect(() => {
        if (!isOpen) {
            setIsShareSheetOpen(false);
            setCopied(false);
            setToastMessage(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => {
            setToastMessage((current) => (current === msg ? null : current));
        }, 2500);
    };

    // Copy payment link with clipboard API & fallback
    const copyPaymentLink = async () => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(shareUrl);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = shareUrl;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
            }

            setCopied(true);
            showToast(t('devices.share.linkCopied', '¡Enlace copiado al portapapeles!'));
            if (onCopy) onCopy();

            setTimeout(() => {
                setCopied(false);
            }, 2200);
        } catch (err) {
            console.error('Copy error:', err);
            showToast(t('devices.share.linkCopiedFallback', '¡Enlace copiado!'));
        }
    };

    // Copy & dismiss from the action sheet
    const copyAndDismiss = () => {
        copyPaymentLink();
        setTimeout(() => setIsShareSheetOpen(false), 250);
    };

    // App routing actions
    const triggerAppAction = async (appName) => {
        const encodedText = encodeURIComponent(`Link de pago seguro: ${shareUrl}`);

        if (appName === 'AirDrop') {
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: t('devices.share.title', 'Link de pago seguro'),
                        text: `Link de pago seguro: ${shareUrl}`,
                        url: shareUrl,
                    });
                    setIsShareSheetOpen(false);
                    return;
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.error('Navigator share error:', err);
                    }
                }
            } else {
                copyPaymentLink();
                setIsShareSheetOpen(false);
                return;
            }
        } else if (appName === 'WhatsApp') {
            window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
        } else if (appName === 'Messages') {
            window.open(`sms:?&body=${encodedText}`, '_blank');
        } else if (appName === 'Mail') {
            window.open(`mailto:?subject=${encodeURIComponent(t('devices.share.mailSubject', 'Link de Pago'))}&body=${encodedText}`, '_blank');
        } else {
            showToast(`${appName}...`);
        }
        setIsShareSheetOpen(false);
    };

    const handleOpenInBrowser = () => {
        window.open(shareUrl, '_blank');
        setIsShareSheetOpen(false);
    };

    const devicePlate = device?.name || device?.deviceName || '';
    const deviceIdentifier = device?.deviceName
        ? `${device.deviceName} • ${device.name || ''}`
        : device?.name || 'Enlace de Pago';

    return createPortal(
        <div
            className="device-share-immersive-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="device-share-title"
            onClick={onClose}
        >
            <div
                className="device-share-immersive-container"
                onClick={(e) => e.stopPropagation()}
            >
                {/* STANDARDIZED IMMERSIVE HEADER */}
                <header className="device-share-immersive-header no-print">
                    <div className="device-share-header-top">
                        <div className="device-share-header-left">
                            <button
                                aria-label={t('common.back', 'Volver')}
                                className="device-share-back-btn"
                                onClick={onClose}
                                type="button"
                                title={t('common.back', 'Volver')}
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div className="device-share-header-inline">
                                <span id="device-share-title" className="device-share-header-title">
                                    {t('devices.share.title', 'Link')}
                                </span>
                                <span className="device-share-separator" aria-hidden="true">
                                    <ChevronRight size={13} strokeWidth={2.5} />
                                </span>
                                {devicePlate && (
                                    <span className="device-share-header-plate">
                                        {devicePlate}
                                    </span>
                                )}
                                <span className="device-share-status-badge">
                                    <span className="device-share-status-dot"></span>
                                    {t('devices.share.statusActive', 'ACTIVO')}
                                </span>
                            </div>
                        </div>

                        <div className="device-share-header-actions">
                            <button
                                aria-label={t('devices.share.action', 'Compartir')}
                                className="device-share-util-btn"
                                onClick={() => setIsShareSheetOpen(true)}
                                type="button"
                                title={t('devices.share.action', 'Compartir')}
                            >
                                <Share2 size={18} />
                            </button>
                            <button
                                aria-label={t('common.close', 'Cerrar')}
                                className="device-share-util-btn"
                                onClick={onClose}
                                type="button"
                                title={t('common.close', 'Cerrar')}
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                </header>

                {/* SCROLLABLE CONTENT */}
                <div className="flex-1 overflow-y-auto px-5 pt-3 pb-4 space-y-4 no-scrollbar" data-purpose="main-screen-content">
                    {/* Instructional Subheader */}
                    <section className="text-center px-4" data-purpose="header-description">
                        <p className="text-[14px] text-slate-500 leading-relaxed font-normal">
                            {t('devices.share.subtitle', 'Comparte este link para acceder a la página de pago rápido y seguro.')}
                        </p>
                    </section>

                    {/* BEGIN: QRCodeCard */}
                    <section className="bg-white rounded-3xl p-5 shadow-ios-card border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden" data-purpose="qr-code-section">
                        {/* Subtle Top Badge */}
                        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-100 mb-3">
                            <span className="w-2 h-2 rounded-full bg-[#34C759] animate-pulse"></span>
                            <span className="text-[12px] font-medium text-slate-600">
                                {t('devices.share.scanToPay', 'Escanear para pagar')}
                            </span>
                        </div>

                        {/* High-contrast crisp vector QR Code frame */}
                        <div className="relative p-3 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center">
                            <QRCodeSVG
                                value={shareUrl}
                                size={198}
                                level="M"
                                includeMargin={false}
                                className="w-[198px] h-[198px]"
                            />
                            {/* Modern corner bracket accents */}
                            <span className="absolute top-1 left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-[#00C7BE] rounded-tl-md pointer-events-none"></span>
                            <span className="absolute top-1 right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-[#00C7BE] rounded-tr-md pointer-events-none"></span>
                            <span className="absolute bottom-1 left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-[#00C7BE] rounded-bl-md pointer-events-none"></span>
                            <span className="absolute bottom-1 right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-[#00C7BE] rounded-br-md pointer-events-none"></span>
                        </div>

                        {/* Security / validity notice */}
                        <p className="text-[12px] text-slate-400 font-medium tracking-wide mt-3 flex items-center space-x-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-slate-400 stroke-2" />
                            <span>{t('devices.share.securityNotice', 'Código seguro • Válido por 24 horas')}</span>
                        </p>
                    </section>
                    {/* END: QRCodeCard */}

                    {/* BEGIN: LinkCopyContainer */}
                    <section className="bg-white rounded-2xl p-2.5 pl-3.5 border border-slate-200/80 shadow-ios-sm flex items-center justify-between gap-2" data-purpose="link-copy-container">
                        {/* URL string representation */}
                        <div className="flex items-center space-x-2.5 overflow-hidden flex-1">
                            <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                                <Link2 className="w-4 h-4 text-teal-600 stroke-2" />
                            </div>
                            <span className="text-[13px] font-mono text-slate-700 truncate tracking-tight select-all">
                                {shareUrl}
                            </span>
                        </div>
                        {/* Copy Trigger Button */}
                        <button
                            className="ios-press shrink-0 flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-teal-500/10 text-teal-700 hover:bg-teal-500/20 active:bg-teal-500/30 font-medium text-[13px] transition duration-150"
                            data-purpose="copy-action-button"
                            onClick={copyPaymentLink}
                            type="button"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-3.5 h-3.5 text-teal-600 stroke-2" />
                                    <span>{t('devices.share.copied', '¡Copiado!')}</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5 stroke-2" />
                                    <span>{t('devices.share.copy', 'Copiar')}</span>
                                </>
                            )}
                        </button>
                    </section>
                    {/* END: LinkCopyContainer */}

                    {/* BEGIN: NoticeCard */}
                    <section className="bg-[#FFF8E6] border border-[#FEE3A2] rounded-2xl px-3.5 py-2.5 shadow-sm flex items-start space-x-2.5" data-purpose="security-pin-notice">
                        <div className="mt-0.5 text-amber-600 shrink-0">
                            <AlertTriangle className="w-4 h-4 fill-amber-500 text-amber-100" />
                        </div>
                        <div className="text-[12.5px] text-amber-950 font-normal leading-snug">
                            <span className="font-semibold text-amber-900">{t('devices.share.note', 'Nota:')}</span> {t('devices.share.pinNotice', 'El usuario necesitará su PIN de 4 dígitos para autorizar el cobro.')}
                        </div>
                    </section>
                    {/* END: NoticeCard */}

                    {/* Secondary explicit Share Link trigger button */}
                    <button
                        className="w-full h-11 rounded-2xl bg-white border border-slate-200/80 hover:bg-slate-50 text-[#007AFF] font-medium text-[15px] flex items-center justify-center space-x-2 ios-press shadow-ios-sm transition"
                        onClick={() => triggerAppAction('AirDrop')}
                        type="button"
                    >
                        <Share2 className="w-4 h-4 stroke-[2.2]" />
                        <span>{t('devices.share.shareLink', 'Compartir Link')}</span>
                    </button>
                </div>
                {/* END: SCROLLABLE CONTENT */}

                {/* BEGIN: BottomActionBar */}
                <footer className="p-4 pt-2 bg-[#F2F2F7]/95 backdrop-blur-md border-t border-slate-200/50 flex flex-col items-center space-y-2 shrink-0 z-10 device-share-footer" data-purpose="footer-actions">
                    <button
                        className="w-full h-12 rounded-2xl bg-[#00C7BE] hover:bg-[#00B3AB] active:brightness-95 text-white font-semibold text-[16px] tracking-tight shadow-sm flex items-center justify-center ios-press transition duration-150"
                        onClick={onClose}
                        type="button"
                    >
                        {t('common.done', 'Listo')}
                    </button>
                </footer>
                {/* END: BottomActionBar */}

                {/* ========================================================================= */}
                {/* BEGIN: Native iOS Share Sheet Overlay (Authentic iOS System Sheet) */}
                {/* ========================================================================= */}
                <div
                    className={`absolute inset-0 z-40 transition-all duration-300 ease-out ${isShareSheetOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                        }`}
                >
                    {/* Dimmed Blurred Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                        onClick={() => setIsShareSheetOpen(false)}
                    ></div>

                    {/* Bottom Sheet Container */}
                    <div
                        className={`absolute bottom-0 inset-x-0 bg-[#F2F2F7] rounded-t-[32px] shadow-ios-sheet pt-2.5 pb-6 px-4 flex flex-col max-h-[88%] transform transition-transform duration-300 ease-out z-50 overflow-hidden ${isShareSheetOpen ? 'translate-y-0' : 'translate-y-full'
                            }`}
                    >
                        {/* Top Grab Handle & Header */}
                        <div
                            className="flex flex-col items-center pb-2 cursor-pointer"
                            onClick={() => setIsShareSheetOpen(false)}
                        >
                            <div className="w-9 h-1.5 bg-slate-300 rounded-full"></div>
                        </div>

                        {/* Preview Header Card */}
                        <div className="bg-white rounded-2xl p-3 flex items-center justify-between shadow-ios-sm border border-slate-200/60 mb-3.5">
                            <div className="flex items-center space-x-3 overflow-hidden">
                                {/* Square Link/App Icon */}
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-white font-bold text-[16px] shadow-sm shrink-0">
                                    <Link2 className="w-6 h-6 stroke-2" />
                                </div>
                                <div className="flex flex-col truncate">
                                    <span className="text-[14px] font-semibold text-slate-900 tracking-tight truncate">
                                        {deviceIdentifier}
                                    </span>
                                    <span className="text-[12px] text-slate-500 truncate font-mono">
                                        {shareUrl}
                                    </span>
                                </div>
                            </div>
                            {/* Close round cross button */}
                            <button
                                aria-label="Cerrar compartir"
                                className="w-7 h-7 rounded-full bg-slate-100 active:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 shrink-0 ml-2"
                                onClick={() => setIsShareSheetOpen(false)}
                                type="button"
                            >
                                <X className="w-4 h-4 stroke-[2.5]" />
                            </button>
                        </div>

                        {/* Scrollable Content of the Sheet */}
                        <div className="overflow-y-auto space-y-3.5 pr-0.5 no-scrollbar max-h-[calc(70vh-80px)]">
                            {/* Horizontal App Row (Authentic iOS App Sharing Row) */}
                            <div className="bg-white rounded-2xl p-3 border border-slate-200/60 shadow-ios-sm">
                                <div className="flex items-center space-x-4 overflow-x-auto pb-1 pt-0.5 px-1 no-scrollbar">
                                    {/* AirDrop */}
                                    <button
                                        className="ios-press flex flex-col items-center shrink-0 space-y-1.5 focus:outline-none"
                                        onClick={() => triggerAppAction('AirDrop')}
                                        type="button"
                                    >
                                        <div className="w-[58px] h-[58px] rounded-2xl bg-[#007AFF] flex items-center justify-center text-white shadow-sm">
                                            <svg className="w-8 h-8 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                <path d="M12 2a10 10 0 0 1 10 10c0 4.41-2.87 8.16-6.84 9.47M2 12a10 10 0 0 1 6.84-9.47"></path>
                                                <path d="M12 6a6 6 0 0 1 6 6c0 2.65-1.72 4.9-4.1 5.68M6 12a6 6 0 0 1 4.1-5.68"></path>
                                                <circle cx="12" cy="12" fill="white" r="2"></circle>
                                            </svg>
                                        </div>
                                        <span className="text-[11px] font-medium text-slate-800 tracking-tight">AirDrop</span>
                                    </button>

                                    {/* Messages */}
                                    <button
                                        className="ios-press flex flex-col items-center shrink-0 space-y-1.5 focus:outline-none"
                                        onClick={() => triggerAppAction('Messages')}
                                        type="button"
                                    >
                                        <div className="w-[58px] h-[58px] rounded-2xl bg-[#34C759] flex items-center justify-center text-white shadow-sm">
                                            <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                                                <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"></path>
                                            </svg>
                                        </div>
                                        <span className="text-[11px] font-medium text-slate-800 tracking-tight">Messages</span>
                                    </button>

                                    {/* Mail */}
                                    <button
                                        className="ios-press flex flex-col items-center shrink-0 space-y-1.5 focus:outline-none"
                                        onClick={() => triggerAppAction('Mail')}
                                        type="button"
                                    >
                                        <div className="w-[58px] h-[58px] rounded-2xl bg-[#007AFF] flex items-center justify-center text-white shadow-sm">
                                            <svg className="w-7 h-7 stroke-current fill-none stroke-[2.2]" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                                <polyline points="22,6 12,13 2,6"></polyline>
                                            </svg>
                                        </div>
                                        <span className="text-[11px] font-medium text-slate-800 tracking-tight">Mail</span>
                                    </button>

                                    {/* WhatsApp */}
                                    <button
                                        className="ios-press flex flex-col items-center shrink-0 space-y-1.5 focus:outline-none"
                                        onClick={() => triggerAppAction('WhatsApp')}
                                        type="button"
                                    >
                                        <div className="w-[58px] h-[58px] rounded-2xl bg-[#25D366] flex items-center justify-center text-white shadow-sm">
                                            <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24">
                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"></path>
                                            </svg>
                                        </div>
                                        <span className="text-[11px] font-medium text-slate-800 tracking-tight">WhatsApp</span>
                                    </button>
                                </div>
                            </div>

                            {/* Action Rows (iOS Grouped Actions Table) */}
                            <div className="bg-white rounded-2xl overflow-hidden border border-slate-200/60 shadow-ios-sm divide-y divide-slate-100">
                                {/* Copy Action */}
                                <button
                                    className="w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-slate-50 transition ios-press"
                                    onClick={copyAndDismiss}
                                    type="button"
                                >
                                    <span className="text-[15px] font-normal text-slate-900">
                                        {t('devices.share.copyLink', 'Copiar enlace')}
                                    </span>
                                    <Copy className="w-5 h-5 text-slate-700 stroke-[1.8]" />
                                </button>

                                {/* Open in Browser */}
                                <button
                                    className="w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-slate-50 transition ios-press"
                                    onClick={handleOpenInBrowser}
                                    type="button"
                                >
                                    <span className="text-[15px] font-normal text-slate-900">
                                        {t('devices.share.openInBrowser', 'Abrir en navegador')}
                                    </span>
                                    <ExternalLink className="w-5 h-5 text-slate-700 stroke-[1.8]" />
                                </button>
                            </div>
                        </div>

                        {/* Home pill inside bottom sheet */}
                        <div className="w-32 h-1 bg-slate-300 rounded-full select-none pointer-events-none mx-auto mt-4"></div>
                    </div>
                </div>
                {/* END: Native iOS Share Sheet Overlay */}

                {/* BEGIN: FeedbackToast */}
                <div
                    className={`absolute bottom-24 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[13px] font-medium px-4 py-2.5 rounded-full shadow-lg backdrop-blur-sm z-50 flex items-center space-x-2 transition-all duration-300 pointer-events-none ${toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
                        }`}
                >
                    <Check className="w-4 h-4 text-emerald-400 stroke-2 shrink-0" />
                    <span>{toastMessage}</span>
                </div>
                {/* END: FeedbackToast */}
            </div>
        </div>,
        document.body
    );
};

export default ShareDeviceModal;
