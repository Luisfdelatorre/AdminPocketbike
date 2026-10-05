import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { exec, execFile } from 'node:child_process';
import tmp from 'tmp';
import libre from 'libreoffice-convert';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import dayjs from 'dayjs';
import { safeCalcularPrecioMoto } from '../utils/contractCalculations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Template oficial con etiquetas {etiqueta}
const TEMPLATE_PATH = path.resolve(__dirname, '../templates/CONTRATO_TEMPLATE.docx');
const UPLOADS_CONTRACT_PDF_DIR = path.resolve(__dirname, '../../uploads/contract_pdf');
const WINDOWS_WORD_PY_SCRIPT = path.resolve(__dirname, '../utils/docxToPdfWindows.py');
const convertAsync = promisify(libre.convert);

const MONTHS_ES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/**
 * Format currency in Colombian Pesos (e.g., $35.000)
 */
function formatCOP(val) {
    const num = Math.round(Number(val) || 0);
    return '$' + num.toLocaleString('es-CO');
}

/**
 * Parse date into Spanish parts (day, monthName, year)
 */
function parseDateParts(dateInput) {
    if (!dateInput) return null;
    const dj = dayjs(dateInput);
    if (!dj.isValid()) return null;

    const day = dj.date();
    const month = dj.month();
    const year = dj.year();
    const monthName = MONTHS_ES[month] || '';

    return {
        day,
        monthName,
        year,
        fullLower: `${day} de ${monthName} de ${year}`,
        fullUpper: `${day} DE ${monthName.toUpperCase()} DE ${year}`,
        signatureFormat: `a los ${day} días del mes de ${monthName} de ${year}`,
    };
}

/**
 * Format customer identification document (e.g. PPT 5.406.528 or C.C. 1.020.450.123)
 */
function formatCustomerDoc(rawDoc) {
    if (!rawDoc || !rawDoc.trim()) return '____________________';
    const trimmed = rawDoc.trim();
    if (/^(CC|C\.C\.|PPT|TI|CE|NIT|PASAPORTE)/i.test(trimmed)) {
        return trimmed.toUpperCase();
    }
    // If numbers only, format with dots
    if (/^\d+$/.test(trimmed)) {
        return 'C.C. ' + Number(trimmed).toLocaleString('es-CO');
    }
    return 'C.C. ' + trimmed;
}

/**
 * Maps a MongoDB Contract and optional Device into the exact 42 template fields of CONTRATO_TEMPLATE.docx
 * 
 * @param {Object} contract - Contract model from MongoDB
 * @param {Object} [device] - Device fallback
 * @returns {Object} Plain object matching all Word template tags
 */
export function mapContractToTemplateData(contract, device = null) {
    if (!contract) return {};

    const cuotas = Number(contract.contractDays || 485);
    const daily = Number(contract.dailyRate || 35000);

    // Dynamic financial breakdown resolution
    let fb = contract.financialBreakdown;
    if (!fb || !fb.precioAntesIVA) {
        fb = safeCalcularPrecioMoto({
            dailyRate: daily,
            contractDays: cuotas,
            initialFee: contract.initialFee || 500000
        }) || {};
    }

    const vInfo = contract.vehicleInfo || {};
    const attTp = contract.attachments?.tarjetaPropiedad?.extractedData || {};
    const attSoat = contract.attachments?.soat?.extractedData || {};

    const motoPlaca = (vInfo.placa || contract.deviceIdName || device?.name || '______').trim().toUpperCase();
    const motoMarca = vInfo.marca || attTp.marca || 'BERA';
    const motoLinea = vInfo.linea || attTp.linea || 'BR 150CC SBR';
    const motoModelo = String(vInfo.modelo || attTp.modelo || '2025');
    const motoColor = vInfo.color || attTp.color || 'NEGRO';
    const motoCilindraje = vInfo.cilindraje || attTp.cilindraje || '149 cc';
    const motoMotor = vInfo.numeroMotor || vInfo['No. MOTOR'] || attTp.numeroMotor || attTp['No. MOTOR'] || attSoat.numeroMotor || 'Z16ZFMJ250018938';
    const motoChasis = vInfo.numeroChasis || vInfo['No. CHASIS ó No. SERIE'] || attTp.numeroChasis || attTp['No. CHASIS ó No. SERIE'] || attSoat.numeroChasis || 'LB7GKC5AXSF009188';

    const startDateInfo = parseDateParts(contract.startDate);
    const endDateInfo = parseDateParts(contract.endDate);

    const initialFeeVal = fb.initialFee ?? 500000;
    const totalOperacionVal = fb.totalOperacion ?? 7334000;
    const porcion95Val = totalOperacionVal * 0.95;
    const capitalNetoVal = fb.capitalUPAY ?? Math.max(0, porcion95Val - initialFeeVal);
    const saldoPocket5Val = fb.saldoPocketBike ?? (totalOperacionVal - initialFeeVal) * 0.05;
    const cuotaFinancieraVal = fb.cuotaFinanciera ?? (daily / 2);
    const cuotaCloudVal = fb.cuotaCloud ?? (daily / 2);
    const totalNetoUpayVal = fb.totalNetoUPAY ?? ((cuotaFinancieraVal * cuotas) - saldoPocket5Val);
    const totalCloudVal = fb.totalCloud ?? (cuotaCloudVal * cuotas);
    const totalCuotasVal = daily * cuotas;

    let tasaEaStr = '27,157 % EA';
    if (fb.eaCalculada) {
        tasaEaStr = (fb.eaCalculada * 100).toFixed(3).replace('.', ',') + ' % EA';
    } else if (fb.objetivoEA) {
        tasaEaStr = (fb.objetivoEA * 100).toFixed(3).replace('.', ',') + ' % EA';
    }

    return {
        // Vendedor & Prestamista
        vendedorNombre: contract.companyName || 'POCKETBIKE S.A.S.',
        vendedorNit: '901366393-9',
        vendedorTelefono: '316 907 8211',
        prestamistaNombre: 'UPAYSOLUTIONS S.A.S.',
        prestamistaNit: '902068285',

        // Cliente
        clienteNombre: (contract.customerName || '____________________').trim().toUpperCase(),
        clienteDocumento: formatCustomerDoc(contract.customerDocument),
        clienteTelefono: contract.customerPhone || device?.phone || '[COMPLETAR]',
        clienteEmail: contract.customerEmail || '[COMPLETAR]',
        clienteDireccion: (contract.customerAddress && contract.customerAddress.trim()) ? contract.customerAddress.trim() : '[COMPLETAR]',

        // Motocicleta
        motoPlaca,
        motoMarca,
        motoLinea,
        motoModelo,
        motoColor,
        motoCilindraje,
        motoMotor,
        motoChasis,

        // Valores de Contado y Gastos
        precioContadoAntesIva: formatCOP(fb.precioAntesIVA ?? 5000000),
        valorIva: formatCOP(fb.valorIVA ?? 950000),
        valorGastos: formatCOP(fb.gastos ?? 1384000),
        valorTotalOperacion: formatCOP(totalOperacionVal),

        // Estructura de Crédito UPAY y Saldo Pocketbike
        porcion95: formatCOP(porcion95Val),
        cuotaInicial: formatCOP(initialFeeVal),
        capitalNetoPrestado: formatCOP(capitalNetoVal),
        saldoPocketBike5: formatCOP(saldoPocket5Val),
        tasaRemuneratoriaEA: tasaEaStr,

        // Plan de Pagos a Plazos
        plazoDias: String(cuotas),
        cuotaDiaria: formatCOP(daily),
        cuotaFinancieraUpay: formatCOP(cuotaFinancieraVal),
        cuotaCloudPocketbike: formatCOP(cuotaCloudVal),
        totalNetoUpay: formatCOP(totalNetoUpayVal),
        totalCloudPocketbike: formatCOP(totalCloudVal),
        totalCuotasPactadas: formatCOP(totalCuotasVal),

        // Codeudor
        codeudorNombre: contract.guarantor?.name || contract.guarantorName || '__________________________',
        codeudorDocumento: contract.guarantor?.document || contract.guarantorDocument || '_________________________',
        codeudorTelefono: contract.guarantor?.phone || contract.guarantorPhone || '[COMPLETAR]',
        codeudorEmail: contract.guarantor?.email || contract.guarantorEmail || '[COMPLETAR]',
        codeudorDireccion: contract.guarantor?.address || contract.guarantorAddress || '[COMPLETAR]',

        // Identificación y Fechas
        contratoId: contract.contractId || contract._id || 'CIYIE41HUA',
        fechaInicio: startDateInfo ? startDateInfo.fullUpper : (contract.startDate || '19 DE SEPTIEMBRE DE 2026'),
        fechaFin: endDateInfo ? endDateInfo.fullUpper : (contract.endDate || '6 DE ABRIL DE 2028'),
        textoFechaFirma: startDateInfo ? startDateInfo.signatureFormat : 'a los 19 días del mes de septiembre de 2026'
    };
}

/**
 * Generate a populated DOCX contract buffer from Word template using docxtemplater + pizzip.
 * Supports both:
 *  - direct metadata object (keys equal to Word tags)
 *  - MongoDB contract instance (auto-mapped via mapContractToTemplateData)
 * 
 * @param {Object} dataOrContract - Object with template tags or MongoDB contract
 * @param {Object} [device] - Optional device object if contract needs plate/phone fallback
 * @returns {Buffer} - Compiled docx buffer
 */
export function generateContractDocx(dataOrContract, device = null) {
    if (!fs.existsSync(TEMPLATE_PATH)) {
        throw new Error(`Template not found at: ${TEMPLATE_PATH}`);
    }

    // Si nos pasan un contrato de MongoDB, mapeamos automáticamente a las etiquetas
    let data = dataOrContract;
    if (dataOrContract && (dataOrContract.contractId || dataOrContract._id || dataOrContract.dailyRate)) {
        // Es un modelo de contrato
        if (!dataOrContract.vendedorNombre) {
            data = mapContractToTemplateData(dataOrContract, device);
        }
    }

    const content = fs.readFileSync(TEMPLATE_PATH);
    const zip = new PizZip(content);

    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
    });

    doc.render(data);

    return doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
    });
}

function hasSoffice() {
    if (process.platform !== 'win32') return true;
    const paths = [
        path.join(process.env['PROGRAMFILES(X86)'] || '', 'LibreOffice/program/soffice.exe'),
        path.join(process.env.PROGRAMFILES || '', 'LibreOffice/program/soffice.exe'),
        'C:/Program Files/LibreOffice/program/soffice.exe',
        process.env.LIBRE_OFFICE_EXE || ''
    ];
    return paths.some(p => p && fs.existsSync(p));
}

function convertDocxToPdfWindowsWord(docxBuffer) {
    return new Promise((resolve, reject) => {
        const tmpDocx = tmp.fileSync({ postfix: '.docx', keep: false });
        const tmpPdf = tmp.fileSync({ postfix: '.pdf', keep: false });

        fs.writeSync(tmpDocx.fd, docxBuffer);
        fs.closeSync(tmpDocx.fd);
        fs.closeSync(tmpPdf.fd);

        execFile('python', [WINDOWS_WORD_PY_SCRIPT, tmpDocx.name, tmpPdf.name], { timeout: 30000 }, (error, stdout, stderr) => {
            if (error) {
                try { tmpDocx.removeCallback(); } catch (_) {}
                try { tmpPdf.removeCallback(); } catch (_) {}
                return reject(new Error(`Error en conversión de Word en Windows: ${stderr || error.message}`));
            }

            try {
                const pdfBuffer = fs.readFileSync(tmpPdf.name);
                try { tmpDocx.removeCallback(); } catch (_) {}
                try { tmpPdf.removeCallback(); } catch (_) {}
                resolve(pdfBuffer);
            } catch (readErr) {
                try { tmpDocx.removeCallback(); } catch (_) {}
                try { tmpPdf.removeCallback(); } catch (_) {}
                reject(readErr);
            }
        });
    });
}

/**
 * Converts a DOCX buffer to a PDF buffer using libreoffice-convert.
 * In Windows local dev without LibreOffice, falls back to Word COM automation.
 */
export async function convertDocxToPdf(docxBuffer) {
    if (process.platform === 'win32' && !hasSoffice()) {
        return await convertDocxToPdfWindowsWord(docxBuffer);
    }
    return await convertAsync(docxBuffer, '.pdf', undefined);
}

/**
 * Generates the contract DOCX from CONTRATO_TEMPLATE.docx, converts it to PDF,
 * and saves it into uploads/contract_pdf/Contrato_{placa}_{contractId}.pdf
 * 
 * @param {Object} contract - MongoDB contract or contract-like object
 * @param {Object} [device] - Optional device details
 * @returns {Promise<{ filename: string, filePath: string, size: number }>}
 */
export async function generateAndSaveContractPdf(contract, device = null) {
    if (!fs.existsSync(UPLOADS_CONTRACT_PDF_DIR)) {
        fs.mkdirSync(UPLOADS_CONTRACT_PDF_DIR, { recursive: true });
    }

    const docxBuffer = generateContractDocx(contract, device);
    const pdfBuffer = await convertDocxToPdf(docxBuffer);

    const vInfo = contract.vehicleInfo || {};
    const placa = (vInfo.placa || contract.deviceIdName || 'SIN_PLACA').replace(/[^a-zA-Z0-9_-]/g, '');
    const contractId = (contract.contractId || contract._id || 'CONTRATO').toString().replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `Contrato_${placa}_${contractId}.pdf`;
    const targetFilePath = path.join(UPLOADS_CONTRACT_PDF_DIR, filename);

    fs.writeFileSync(targetFilePath, pdfBuffer);

    return {
        filename,
        filePath: targetFilePath,
        size: pdfBuffer.length
    };
}

/**
 * Locates an existing generated contract PDF in uploads/contract_pdf/
 */
export function findContractPdf(contractId, placa = null) {
    if (!fs.existsSync(UPLOADS_CONTRACT_PDF_DIR)) {
        return null;
    }
    const cleanId = String(contractId).replace(/[^a-zA-Z0-9_-]/g, '');
    if (placa) {
        const cleanPlaca = String(placa).replace(/[^a-zA-Z0-9_-]/g, '');
        const directFile = path.join(UPLOADS_CONTRACT_PDF_DIR, `Contrato_${cleanPlaca}_${cleanId}.pdf`);
        if (fs.existsSync(directFile)) {
            return {
                filename: `Contrato_${cleanPlaca}_${cleanId}.pdf`,
                filePath: directFile
            };
        }
    }
    const files = fs.readdirSync(UPLOADS_CONTRACT_PDF_DIR);
    const match = files.find(f => f.endsWith(`_${cleanId}.pdf`) || f.includes(cleanId));
    if (match) {
        return {
            filename: match,
            filePath: path.join(UPLOADS_CONTRACT_PDF_DIR, match)
        };
    }
    return null;
}

export default {
    generateContractDocx,
    mapContractToTemplateData,
    convertDocxToPdf,
    generateAndSaveContractPdf,
    findContractPdf
};
