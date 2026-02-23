import contractRepository from '../repositories/contractRepository.js';
import deviceRepository from '../repositories/deviceRepository.js';
import { resolveDeviceId } from '../utils/deviceResolver.js';
import contractService from '../services/contractService.js';

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

        if (contract && contract.deviceIdName) {
            await deviceRepository.updateContractStatus(contract.deviceIdName, activeContractId, hasActiveContract);
        } else if (contract && contract.deviceId) {
            // Fallback if field is named deviceId
            await deviceRepository.updateContractStatus(contract.deviceId, activeContractId, hasActiveContract);
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
        const {
            customerName,
            customerEmail,
            customerPhone,
            customerDocument,
            dailyRate,
            contractDays, // Added contractDays
            notes,
            devicePin,
            freeDaysLimit, // Added freeDaysLimit
            freeDayPolicy,
            fixedFreeDayOfWeek,
            exemptFromCutOff
        } = req.body;

        const contract = await contractRepository.getContractById(contractId);

        if (!contract) {
            return res.status(404).json({
                success: false,
                error: 'Contract not found'
            });
        }

        const updatedContract = await contractRepository.updateContract(contractId, {
            customerName,
            customerEmail,
            customerPhone,
            customerDocument,
            dailyRate,
            contractDays, // Added contractDays
            notes,
            devicePin,
            freeDaysLimit, // Added freeDaysLimit
            freeDayPolicy,
            fixedFreeDayOfWeek,
            exemptFromCutOff
        });
        console.log('Update contract:', updatedContract);
        const result = await deviceRepository.updateContractStatus(contract.deviceId, contractId, true);

        // Denormalize exempt flag to Device
        if (exemptFromCutOff !== undefined) {
            await deviceRepository.updateDeviceExemption(contract.deviceIdName || contract.deviceId, exemptFromCutOff);
        }

        console.log('Update contract status result:', result);

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

export default {
    getDevicesWithContracts,
    getAllContracts,
    createContract,
    getActiveContract,
    getContractStats,
    getAllContractsForDevice,
    updateContractStatus,
    getExpiringContracts,
    updateContract
};
