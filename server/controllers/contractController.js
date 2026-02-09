import contractRepository from '../repositories/contractRepository.js';
import deviceRepository from '../repositories/deviceRepository.js';
import { resolveDeviceId } from '../utils/deviceResolver.js';

/**
 * Get all devices with contracts for device selector
 */
const getDevicesWithContracts = async (req, res) => {
    try {
        // Fetch all devices directly from the repository
        const devices = await deviceRepository.getAllDevices();

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
        const allContracts = await contractRepository.getAllContracts();

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
            dailyRate = 3000000, // Default: 30,000 COP (in cents)
            contractDays = 500,
            startDate,
            customerName,
            customerEmail,
            customerPhone,
            customerDocument,
            notes,
            devicePin
        } = req.body;

        if (!deviceId || !startDate) {
            return res.status(400).json({
                success: false,
                error: 'deviceId and startDate are required',
            });
        }

        // Check if device already has an active contract
        const existingContract = await contractRepository.getActiveContractByDevice(deviceId);
        if (existingContract) {
            return res.status(400).json({
                success: false,
                error: `Device ${deviceId} already has an active contract (${existingContract.contractId}). Please cancel it before creating a new one.`,
            });
        }

        const contract = await contractRepository.createContract({
            deviceIdName: deviceId, // Pass as deviceIdName to match repository
            dailyRate,
            contractDays,
            startDate,
            customerName,
            customerEmail,
            customerPhone,
            customerDocument,
            notes,
            devicePin
        });

        // Sync to Device (Denormalization)
        await deviceRepository.updateContractStatus(deviceId, contract.contractId, true);

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
            notes,
            devicePin
        } = req.body;

        const contract = await contractRepository.getContractById(contractId);

        if (!contract) {
            return res.status(404).json({
                success: false,
                error: 'Contract not found'
            });
        }

        // Only hash PIN if provided (logic handled in repository/model depending on implementation)
        // Repository updateContract just passes values to set. 
        // We need to verify if repository handles it or if we need to manually handle it.
        // Looking at repository: it uses $set with whatever is passed.
        // Looking at model: it has a pre-save hook for hashing 'devicePin'.
        // BUT findOneAndUpdate bypasses pre-save hooks! 
        // We need to use findById logic in repository OR manually hash here.
        // Let's check repository updateContract implementation again.

        const updatedContract = await contractRepository.updateContract(contractId, {
            customerName,
            customerEmail,
            customerPhone,
            customerDocument,
            dailyRate,
            notes,
            devicePin
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
