import contractRepository from '../repositories/contractRepository.js';

/**
 * Get all devices with contracts for device selector
 */
const getDevicesWithContracts = async (req, res) => {
    try {
        const allContracts = await contractRepository.getAllContracts();

        // Get unique devices with their most recent contract
        const deviceMap = new Map();

        allContracts.forEach(contract => {
            if (!deviceMap.has(contract.deviceId)) {
                deviceMap.set(contract.deviceId, {
                    deviceId: contract.deviceId,
                    deviceName: `Pocketbike ${contract.deviceId}`,
                    deviceType: 'pocketbike',
                    icon: '🏍️',
                    hasActiveContract: contract.status === 'ACTIVE',
                    contractId: contract.contractId
                });
            }
        });

        const devices = Array.from(deviceMap.values());

        res.json({
            success: true,
            devices
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
            notes
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
            deviceId,
            dailyRate,
            contractDays,
            startDate,
            customerName,
            customerEmail,
            customerPhone,
            customerDocument,
            notes,
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
        const { deviceId } = req.params;

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
        const { deviceId } = req.params;

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
            notes
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
            notes
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
