import { downloadContractPdf as downloadPdfApi } from '../services/api';

/**
 * Downloads a contract as PDF directly compiled by the backend, displaying a clean progress bar overlay
 * 
 * @param {string} contractId - The contract ID to generate
 * @param {string} [filename] - Custom output filename (e.g. Contrato_QVM55H_CIYIE41HUA.pdf)
 */
export async function downloadContractPdf(contractId, filename) {
    if (!contractId) {
        throw new Error('ID de contrato no especificado.');
    }

    // 1. Crear el overlay visual con barra de progreso
    const overlay = document.createElement('div');
    overlay.id = 'backend-pdf-progress-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.85)';
    overlay.style.backdropFilter = 'blur(8px)';
    overlay.style.zIndex = '999999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.color = '#ffffff';

    overlay.innerHTML = `
        <div style="
            background: rgba(30, 41, 59, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 16px;
            padding: 32px 36px;
            width: 360px;
            max-width: 90vw;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 18px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            text-align: center;
        ">
            <div style="
                width: 52px;
                height: 52px;
                border-radius: 50%;
                background: rgba(45, 212, 191, 0.15);
                border: 1px solid rgba(45, 212, 191, 0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                color: #2dd4bf;
            ">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <path d="M12 18v-6"/>
                    <path d="m9 15 3 3 3-3"/>
                </svg>
            </div>
            
            <div>
                <div style="font-size: 17px; font-weight: 700; color: #f8fafc; margin-bottom: 4px;">Generando PDF Oficial</div>
                <div style="font-size: 13px; color: #94a3b8;" id="pdf-progress-status">Compilando plantilla Word en servidor...</div>
            </div>

            <div style="width: 100%; background: rgba(255, 255, 255, 0.08); height: 8px; border-radius: 9999px; overflow: hidden; position: relative;">
                <div id="pdf-progress-bar-inner" style="
                    width: 15%;
                    height: 100%;
                    background: linear-gradient(90deg, #2dd4bf, #3b82f6);
                    border-radius: 9999px;
                    transition: width 0.35s ease;
                "></div>
            </div>

            <div style="font-size: 12px; font-weight: 600; color: #2dd4bf;" id="pdf-progress-percent">15%</div>
        </div>
    `;

    document.body.appendChild(overlay);

    let progressInterval = null;
    let currentPercent = 15;
    const barInner = overlay.querySelector('#pdf-progress-bar-inner');
    const percentTxt = overlay.querySelector('#pdf-progress-percent');
    const statusTxt = overlay.querySelector('#pdf-progress-status');

    progressInterval = setInterval(() => {
        if (currentPercent < 88) {
            currentPercent += Math.floor(Math.random() * 10) + 6;
            if (currentPercent > 88) currentPercent = 88;
            if (barInner) barInner.style.width = `${currentPercent}%`;
            if (percentTxt) percentTxt.textContent = `${currentPercent}%`;
            if (currentPercent > 50 && statusTxt) {
                statusTxt.textContent = 'Generando archivo PDF e iniciando descarga...';
            }
        }
    }, 350);

    try {
        const result = await downloadPdfApi(contractId, filename);
        if (barInner) barInner.style.width = '100%';
        if (percentTxt) percentTxt.textContent = '100%';
        if (statusTxt) statusTxt.textContent = '¡Descarga completada!';
        await new Promise(res => setTimeout(res, 350));
        return result;
    } finally {
        if (progressInterval) clearInterval(progressInterval);
        if (overlay && overlay.parentNode) {
            document.body.removeChild(overlay);
        }
    }
}

export default {
    downloadContractPdf
};

