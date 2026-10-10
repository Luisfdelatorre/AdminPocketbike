import { renderAsync } from 'docx-preview';
import html2pdf from 'html2pdf.js';
import { getContractDocxBlob } from '../services/api';

/**
 * Downloads a contract as PDF by:
 * 1. Requesting the populated Word (.docx) from backend based on CONTRATO_TEMPLATE.docx
 * 2. Rendering the docx into a clean DOM container with docx-preview
 * 3. Converting that container into a multi-page PDF using html2pdf.js
 * 4. Saving the file on the user's device
 * 
 * @param {string} contractId - The contract ID to generate
 * @param {string} [filename] - Custom output filename (e.g. Contrato_QVM55H_CIYIE41HUA.pdf)
 */
export async function downloadContractPdf(contractId, filename) {
    if (!contractId) {
        throw new Error('ID de contrato no especificado.');
    }

    const blob = await getContractDocxBlob(contractId);
    if (!blob || blob.size === 0) {
        throw new Error('No se pudo obtener el documento del contrato desde el servidor.');
    }

    // If the server returned an error serialized as JSON in the blob
    if (blob.type && blob.type.includes('application/json')) {
        const errorText = await blob.text();
        let errorMsg = 'Error en el servidor al generar el documento.';
        try {
            const parsed = JSON.parse(errorText);
            errorMsg = parsed.error || errorMsg;
        } catch {
            // keep default
        }
        throw new Error(errorMsg);
    }

    // 1. Overlay to give visual feedback and hide rendering layout behind it
    const overlay = document.createElement('div');
    overlay.id = 'docx-pdf-generator-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.90)';
    overlay.style.backdropFilter = 'blur(6px)';
    overlay.style.zIndex = '999999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.color = '#ffffff';
    overlay.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <div style="width: 44px; height: 44px; border: 3px solid rgba(45, 212, 191, 0.25); border-top-color: #2dd4bf; border-radius: 50%; animation: docxPdfSpin 0.75s linear infinite;"></div>
            <div style="font-size: 16px; font-weight: 700; color: #ffffff; letter-spacing: -0.01em;">Generando PDF Oficial...</div>
            <div style="font-size: 13px; color: #94a3b8;">Compilando plantilla Word y generando documento PDF</div>
        </div>
        <style>@keyframes docxPdfSpin { to { transform: rotate(360deg); } }</style>
    `;

    // 2. Container for docx-preview positioned in active coordinate space (top: 0, left: 0)
    // but placed below the overlay (z-index: 999990) so html2canvas captures valid pixels
    const container = document.createElement('div');
    container.id = 'docx-pdf-render-target';
    container.className = 'docx-pdf-render-container';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '816px'; // 8.5in at 96 DPI (Letter width)
    container.style.background = '#ffffff';
    container.style.color = '#000000';
    container.style.zIndex = '999990';
    container.style.boxSizing = 'border-box';
    container.style.overflow = 'visible';
    container.style.pointerEvents = 'none';

    // Inject temporary print styling for docx pages
    const styleTag = document.createElement('style');
    styleTag.id = 'docx-pdf-custom-styles';
    styleTag.innerHTML = `
        #docx-pdf-render-target .docx-wrapper {
            background: transparent !important;
            padding: 0 !important;
        }
        #docx-pdf-render-target .docx-wrapper > section.docx {
            box-shadow: none !important;
            margin: 0 auto !important;
            margin-bottom: 0 !important;
            page-break-after: always !important;
            break-after: page !important;
            background: #ffffff !important;
        }
    `;

    document.body.appendChild(container);
    document.body.appendChild(overlay);
    document.head.appendChild(styleTag);

    try {
        await renderAsync(blob, container, null, {
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            breakPages: true
        });

        // Allow fonts, images and computed styles to settle
        await new Promise(resolve => setTimeout(resolve, 350));

        const opt = {
            margin: [0, 0, 0, 0],
            filename: filename || `Contrato_${contractId}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                scrollX: 0,
                scrollY: 0,
                x: 0,
                y: 0,
                windowWidth: 816
            },
            jsPDF: {
                unit: 'mm',
                format: 'letter',
                orientation: 'portrait'
            },
            pagebreak: {
                mode: ['css', 'legacy'],
                after: 'section.docx'
            }
        };

        await html2pdf().set(opt).from(container).save();
    } finally {
        if (container.parentNode) {
            document.body.removeChild(container);
        }
        if (overlay.parentNode) {
            document.body.removeChild(overlay);
        }
        if (styleTag.parentNode) {
            document.head.removeChild(styleTag);
        }
    }
}

export default {
    downloadContractPdf
};
