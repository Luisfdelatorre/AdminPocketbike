import React from 'react';
import { Camera, Image, FileText } from 'lucide-react';
import './WhatsAppAttachmentModal.css';

const WhatsAppAttachmentModal = ({
    isOpen,
    title = 'Adjuntar Documento',
    onSelect,
    onClose,
    allowDocument = true
}) => {
    if (!isOpen) return null;

    return (
        <div className="wa-sheet-backdrop" onClick={onClose}>
            <div
                className="wa-sheet-container"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={title}
            >
                <div className="wa-sheet-drag-handle" onClick={onClose} />

                <div className="wa-sheet-grid">
                    <button type="button" className="wa-sheet-option" onClick={() => onSelect('photos')}>
                        <div className="wa-sheet-icon-pill wa-icon-photos">
                            <Image size={30} strokeWidth={1.8} />
                        </div>
                        <span className="wa-sheet-label">Fotos</span>
                    </button>

                    <button type="button" className="wa-sheet-option" onClick={() => onSelect('camera')}>
                        <div className="wa-sheet-icon-pill wa-icon-camera">
                            <Camera size={30} strokeWidth={1.8} />
                        </div>
                        <span className="wa-sheet-label">Cámara</span>
                    </button>

                    {allowDocument && (
                        <button type="button" className="wa-sheet-option" onClick={() => onSelect('document')}>
                            <div className="wa-sheet-icon-pill wa-icon-document">
                                <FileText size={30} strokeWidth={1.8} />
                            </div>
                            <span className="wa-sheet-label">Documento</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WhatsAppAttachmentModal;
