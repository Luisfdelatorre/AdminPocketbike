/**
 * Utility to render PDF files to images directly in the browser using PDF.js.
 * This guarantees that scanned PDFs, mobile exports, and flat PDFs are converted
 * to clean JPEG images before being processed by OCR/Vision models.
 */

let pdfJsPromise = null;

export const loadPdfJs = () => {
    if (window.pdfjsLib) {
        return Promise.resolve(window.pdfjsLib);
    }
    if (pdfJsPromise) {
        return pdfJsPromise;
    }

    pdfJsPromise = new Promise((resolve, reject) => {
        // Try local static vendor copy first
        const script = document.createElement('script');
        script.src = '/vendor/pdfjs/pdf.min.js';
        script.async = true;

        script.onload = () => {
            if (window.pdfjsLib) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.js';
                resolve(window.pdfjsLib);
            } else {
                reject(new Error('PDF.js no se cargó correctamente desde el origen local.'));
            }
        };

        script.onerror = () => {
            console.warn('[pdfToImage] Error cargando PDF.js local, intentando CDN de respaldo...');
            // Fallback to CDN
            const cdnScript = document.createElement('script');
            cdnScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            cdnScript.async = true;

            cdnScript.onload = () => {
                if (window.pdfjsLib) {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                    resolve(window.pdfjsLib);
                } else {
                    reject(new Error('No se pudo inicializar PDF.js ni localmente ni desde CDN.'));
                }
            };
            cdnScript.onerror = (e) => reject(new Error('Fallo al cargar librería PDF.js: ' + (e?.message || 'Error de red')));
            document.head.appendChild(cdnScript);
        };

        document.head.appendChild(script);
    });

    return pdfJsPromise;
};

/**
 * Check if a file or blob is a PDF document
 */
export const isPdfDocument = (file) => {
    if (!file) return false;
    if (file.type === 'application/pdf') return true;
    if (typeof file.name === 'string' && file.name.toLowerCase().endsWith('.pdf')) return true;
    return false;
};

/**
 * Convert the first page (or specified page) of a PDF to an image/jpeg data URL.
 * 
 * @param {File|Blob|ArrayBuffer|string} input - PDF file, blob, arrayBuffer or data URL
 * @param {Object} options - Configuration options
 * @param {number} [options.pageNumber=1] - 1-based page index to render
 * @param {number} [options.scale=2.0] - Render scale factor (2.0 = crisp 2x resolution)
 * @param {number} [options.quality=0.92] - JPEG quality (0 to 1)
 * @returns {Promise<{ dataUrl: string, width: number, height: number, numPages: number, hasDigitalText: boolean }>}
 */
export const convertPdfToImage = async (input, options = {}) => {
    const {
        pageNumber = 1,
        scale = 2.0,
        quality = 0.92
    } = options;

    const pdfjsLib = await loadPdfJs();

    let data;
    if (input instanceof ArrayBuffer) {
        data = input;
    } else if (input instanceof Uint8Array) {
        data = input.buffer;
    } else if (typeof input === 'string') {
        if (input.startsWith('data:')) {
            const base64 = input.split(',')[1];
            const binaryStr = atob(base64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            data = bytes.buffer;
        } else {
            // URL string
            data = input;
        }
    } else if (input instanceof Blob) {
        data = await input.arrayBuffer();
    } else {
        throw new Error('Formato de entrada PDF no soportado para conversión a imagen.');
    }

    const loadingTask = pdfjsLib.getDocument(typeof data === 'string' ? data : { data });
    const pdfDoc = await loadingTask.promise;

    const actualPageNum = Math.min(Math.max(1, pageNumber), pdfDoc.numPages);
    const page = await pdfDoc.getPage(actualPageNum);

    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    const ctx = canvas.getContext('2d', { alpha: false });
    // Fill white background for documents with transparent backgrounds
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
        canvasContext: ctx,
        viewport
    }).promise;

    // Check if the page has selectable digital text
    let hasDigitalText = false;
    try {
        const textContent = await page.getTextContent();
        hasDigitalText = Boolean(textContent.items && textContent.items.length > 5);
    } catch {
        hasDigitalText = false;
    }

    const dataUrl = canvas.toDataURL('image/jpeg', quality);

    return {
        dataUrl,
        width: canvas.width,
        height: canvas.height,
        numPages: pdfDoc.numPages,
        hasDigitalText
    };
};
