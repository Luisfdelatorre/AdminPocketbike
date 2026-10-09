import fs from 'node:fs';
import contractRepository from '../repositories/contractRepository.js';
import deviceRepository from '../repositories/deviceRepository.js';
import { resolveDeviceId } from '../utils/deviceResolver.js';
import contractService from '../services/contractService.js';
import contractDocumentService, { generateContractDocx, generateAndSaveContractPdf, findContractPdf } from '../services/contractDocumentService.js';
import documentOcrService from '../services/documentOcrService.js';
import { Device } from '../models/Device.js';

/**
 * Get all devices with contracts for device selector
 */
const getDevicesWithContracts = async (req, res) => {
    try {
        const { isSuperAdmin, companyId, companyName, role } = req.auth || {};
        const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');

        let devices = [];

        if (isSystemAdmin) {
            // Fetch all devices directly from the repository
            devices = await deviceRepository.getAllDevices();
        } else {
            if (!companyId) {
                return res.status(403).json({ success: false, error: 'No company assigned' });
            }
            // Fetch only company devices
            devices = await deviceRepository.findDevicesByCompany(companyId);
        }

        // Map devices to the response format (relying on denormalized fields)
        const mappedDevices = devices.map(device => ({
            deviceId: device._id, // Assuming _id is the deviceId/plate
            deviceName: device.name || `Pocketbike ${device._id}`,
            deviceType: 'pocketbike',
            icon: '🏍️',
            hasActiveContract: device.hasActiveContract || false,
            contractId: device.activeContractId || null,
            name: device.name,
            nequiNumber: device.nequiNumber
        }));

        res.json({
            success: true,
            devices: mappedDevices
        });
    } catch (error) {
        console.error('Error fetching devices:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch devices'
        });
    }
};

/**
 * Get all contracts (for contracts management page)
 */
const getAllContracts = async (req, res) => {
    try {
        const { isSuperAdmin, companyId, companyName, role } = req.auth || {};


        const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');

        let query = {};

        // If not system admin, restrict to own company contracts
        if (!isSystemAdmin) {
            if (!companyId) {
                return res.status(403).json({ success: false, error: 'No company assigned' });
            }
            // Filter by companyId field in Contract model
            query.companyId = companyId;
        }

        const allContracts = await contractRepository.getAllContracts(query);

        // Calculate completion percentage for each contract
        const contractsWithStats = allContracts.map(contract => ({
            ...contract,
            completionPercentage: contract.contractDays > 0
                ? ((contract.paidDays / contract.contractDays) * 100).toFixed(2)
                : 0
        }));

        res.json({
            success: true,
            contracts: contractsWithStats
        });
    } catch (error) {
        console.error('Error fetching all contracts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch contracts'
        });
    }
};

/**
 * Create a new 500-day contract
 */
const createContract = async (req, res) => {
    try {
        const {
            deviceId,
            startDate
        } = req.body;

        if (!deviceId || !startDate) {
            return res.status(400).json({
                success: false,
                error: 'deviceId and startDate are required',
            });
        }
        const contract = await contractService.createContract(req.body);

        // Generar y almacenar el PDF oficial en background
        generateAndSaveContractPdf(contract).catch(err => {
            console.error(`[ContractPdf] Error generando PDF para nuevo contrato ${contract.contractId}:`, err);
        });

        res.json({
            success: true,
            data: contract,
        });
    } catch (error) {
        console.error('Create contract error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Get active contract for a device
 */
const getActiveContract = async (req, res) => {
    try {
        const identifier = req.params.deviceId;
        const deviceId = await resolveDeviceId(identifier);

        const contract = await contractRepository.getActiveContractByDevice(deviceId);

        if (!contract) {
            return res.status(404).json({
                success: false,
                error: 'No active contract found for this device',
            });
        }

        res.json({
            success: true,
            data: contract,
        });
    } catch (error) {
        console.error('Get contract error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Get contract statistics
 */
const getContractStats = async (req, res) => {
    try {
        const identifier = req.params.deviceId;
        const deviceId = await resolveDeviceId(identifier);

        const stats = await contractRepository.getContractStats(deviceId);

        if (!stats) {
            return res.status(404).json({
                success: false,
                error: 'No active contract found for this device',
            });
        }

        res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        console.error('Get contract stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Get all contracts for a device (including completed/cancelled)
 */
const getAllContractsForDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;

        const contracts = await contractRepository.getContractsByDevice(deviceId);

        res.json({
            success: true,
            data: contracts,
        });
    } catch (error) {
        console.error('Get all contracts error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Update contract status
 */
const updateContractStatus = async (req, res) => {
    try {
        const { contractId } = req.params;
        const { status } = req.body;

        if (!['ACTIVE', 'COMPLETED', 'CANCELLED', 'SUSPENDED'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status value',
            });
        }

        const contract = await contractRepository.updateContractStatus(contractId, status);

        // Sync to Device (Denormalization)
        // If status is NOT active (i.e. COMPLETED, CANCELLED), clear the device's contract
        // If status is ACTIVE, set it (though usually set on creation)
        const hasActiveContract = status === 'ACTIVE';
        const activeContractId = hasActiveContract ? contractId : null;
        const customerName = hasActiveContract && contract ? (contract.customerName || null) : null;

        if (contract && contract.deviceIdName) {
            await deviceRepository.updateContractStatus(contract.deviceIdName, activeContractId, hasActiveContract, { customerName });
        } else if (contract && contract.deviceId) {
            // Fallback if field is named deviceId
            await deviceRepository.updateContractStatus(contract.deviceId, activeContractId, hasActiveContract, { customerName });
        }


        res.json({
            success: true,
            data: contract,
        });
    } catch (error) {
        console.error('Update contract status error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Get contracts expiring within N days
 */
const getExpiringContracts = async (req, res) => {
    try {
        const daysThreshold = parseInt(req.params.daysThreshold) || 30;

        const contracts = await contractRepository.getExpiringContracts(daysThreshold);

        res.json({
            success: true,
            data: contracts,
        });
    } catch (error) {
        console.error('Get expiring contracts error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Update contract details (customer info, notes, etc.)
 */
const updateContract = async (req, res) => {
    try {
        const { contractId } = req.params;
        const { exemptFromCutOff, exemptFromCurfew } = req.body;

        const contract = await contractRepository.getContractById(contractId);

        if (!contract) {
            return res.status(404).json({
                success: false,
                error: 'Contract not found'
            });
        }

        const updatedContract = await contractRepository.updateContract(contractId, req.body);
        console.log('Update contract:', updatedContract);
        const hasActiveContract = updatedContract.status === 'ACTIVE';
        const activeContractId = hasActiveContract ? contractId : null;
        const customerName = hasActiveContract ? (updatedContract.customerName || null) : null;
        const targetDevice = updatedContract.deviceIdName || updatedContract.deviceId || contract.deviceId;
        const result = await deviceRepository.updateContractStatus(targetDevice, activeContractId, hasActiveContract, { customerName });

        // Denormalize exempt flags to Device
        if (exemptFromCutOff !== undefined || exemptFromCurfew !== undefined) {
            await deviceRepository.updateDeviceExemption(
                contract.deviceIdName || contract.deviceId,
                exemptFromCutOff,
                exemptFromCurfew
            );
        }

        console.log('Update contract status result:', result);

        // Generar y guardar el PDF del contrato actualizado en disco
        generateAndSaveContractPdf(updatedContract).catch(err => {
            console.error(`[ContractPdf] Error generando PDF para contrato actualizado ${contractId}:`, err);
        });

        res.json({
            success: true,
            data: updatedContract
        });
    } catch (error) {
        console.error('Update contract error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * GET /api/contracts/:contractId/pdf
 * Download contract PDF. If it already exists in uploads/contract_pdf/, it serves it immediately.
 * Otherwise, generates it on the fly, saves it to disk, and serves it.
 */
const downloadContractPdf = async (req, res) => {
    try {
        const { contractId } = req.params;
        const { isSuperAdmin, companyId, companyName, role } = req.auth || {};
        const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');

        const contract = await contractRepository.getContractById(contractId);
        if (!contract) {
            return res.status(404).json({ success: false, error: 'Contract not found' });
        }

        // Authorization check
        if (!isSystemAdmin && contract.companyId && String(contract.companyId) !== String(companyId)) {
            return res.status(403).json({ success: false, error: 'Access denied to this contract' });
        }

        const vInfo = contract.vehicleInfo || {};
        const placa = vInfo.placa || contract.deviceIdName || 'SIN_PLACA';
        let pdfInfo = findContractPdf(contract.contractId || contract._id, placa);

        if (!pdfInfo || !fs.existsSync(pdfInfo.filePath)) {
            console.log(`[ContractPdf] PDF no encontrado en disco para ${contractId}, generando ahora...`);
            let device = null;
            if (contract.deviceIdName) {
                device = await Device.findOne({ name: contract.deviceIdName }).lean();
            }
            pdfInfo = await generateAndSaveContractPdf(contract, device);
        }

        return res.download(pdfInfo.filePath, pdfInfo.filename);
    } catch (error) {
        console.error('Error descargando PDF del contrato:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error al descargar o generar el PDF del contrato'
        });
    }
};

/**
 * GET /api/contracts/:contractId/document
 * Generate and download populated Word contract (.docx)
 */
const generateContractDocument = async (req, res) => {
    try {
        const { contractId } = req.params;
        const { isSuperAdmin, companyId, companyName, role } = req.auth || {};
        const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');

        const contract = await contractRepository.getContractById(contractId);
        if (!contract) {
            return res.status(404).json({ success: false, error: 'Contract not found' });
        }

        // Authorization check
        if (!isSystemAdmin && contract.companyId && String(contract.companyId) !== String(companyId)) {
            return res.status(403).json({ success: false, error: 'Access denied to this contract' });
        }

        // Optional device lookup for fallback data
        let device = null;
        if (contract.deviceIdName) {
            device = await Device.findOne({ name: contract.deviceIdName }).lean();
        }

        const docxBuffer = generateContractDocx(contract, device);
        console.log('Docx buffer:', docxBuffer);

        const safePlate = (contract.deviceIdName || contract.contractId || 'Contrato').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `Contrato_${safePlate}_${contract.contractId}.docx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', docxBuffer.length);

        return res.send(docxBuffer);
    } catch (error) {
        console.error('Error generating contract document:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate contract document'
        });
    }
};

/**
 * POST /api/contracts/extract-document
 * Extract information from uploaded/captured document using OpenAI Vision / PDF parsing
 */
const extractDocumentData = async (req, res) => {
    try {
        const { category, base64, mimeType = 'image/jpeg', filename = 'document' } = req.body;

        if (!category) {
            return res.status(400).json({ success: false, error: 'La categoría del documento es requerida.' });
        }

        if (!base64 || typeof base64 !== 'string') {
            return res.status(400).json({ success: false, error: 'No se recibió el contenido del archivo (base64).' });
        }

        // Clean base64 string
        const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
        if (!cleanBase64 || cleanBase64.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'El archivo recibido está vacío o contiene un base64 inválido.' });
        }

        const fileBuffer = Buffer.from(cleanBase64, 'base64');
        if (fileBuffer.length === 0) {
            return res.status(400).json({ success: false, error: 'El archivo recibido tiene tamaño 0 bytes.' });
        }

        // Normalize mimeType (e.g. image/jpg -> image/jpeg)
        let normalizedMime = mimeType;
        if (mimeType === 'image/jpg') normalizedMime = 'image/jpeg';

        const result = await documentOcrService.processDocument(
            fileBuffer,
            normalizedMime,
            category,
            filename
        );

        res.json(result);
    } catch (error) {
        console.error('Error in extractDocumentData:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error al procesar y extraer información del documento.'
        });
    }
};

export default {
    getDevicesWithContracts,
    getAllContracts,
    createContract,
    getActiveContract,
    getContractStats,
    getAllContractsForDevice,
    updateContractStatus,
    getExpiringContracts,
    updateContract,
    generateContractDocument,
    downloadContractPdf,
    extractDocumentData
};
