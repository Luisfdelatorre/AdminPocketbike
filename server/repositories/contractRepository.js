import { Contract } from '../models/Contract.js';
import { nanoid } from 'nanoid';

export class ContractRepository {
    /**
     * Create a new contract
     */
    async createContract({
        deviceId,
        dailyRate,
        contractDays = 500,
        startDate,
        customerName,
        customerEmail,
        customerPhone,
        customerDocument,
        notes
    }) {
        // Create contract ID with device and start date for easy searching
        // Format: CONTRACT-BIKE001-2026-01-06-abc123
        const contractId = `C${deviceId}${nanoid(2).toUpperCase()}`;

        // Calculate end date
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + contractDays);
        const endDate = end.toISOString().split('T')[0];

        // Calculate total amount
        const totalAmount = dailyRate * contractDays;

        const contract = await Contract.create({
            contractId,
            deviceId,
            dailyRate,
            contractDays,
            startDate,
            endDate,
            totalAmount,
            remainingDays: contractDays,
            customerName,
            customerEmail,
            customerPhone,
            customerDocument,
            notes,
            status: 'ACTIVE',
        });

        return contract.toObject();
    }

    /**
     * Get contract by ID
     */
    async getContractById(contractId) {
        return await Contract.findOne({ contractId }).lean();
    }

    /**
     * Get active contract for a device
     */
    async getActiveContractByDevice(deviceId) {
        return await Contract.findOne({
            deviceId,
            status: 'ACTIVE',
        }).lean();
    }

    /**
     * Get all contracts for a device
     */
    async getContractsByDevice(deviceId) {
        return await Contract.find({ deviceId })
            .sort({ createdAt: -1 })
            .lean();
    }

    /**
     * Get all contracts (for dashboard stats)
     */
    async getAllContracts() {
        return await Contract.find({})
            .sort({ createdAt: -1 })
            .lean();
    }

    /**
     * Update contract payment progress
     */
    async updateContractProgress(contractId, paidAmount, paidDays) {
        const contract = await Contract.findOne({ contractId });

        if (!contract) {
            throw new Error('Contract not found');
        }

        contract.paidAmount += paidAmount;
        contract.paidDays += paidDays;
        contract.remainingDays = contract.contractDays - contract.paidDays;

        // Check if contract is completed
        if (contract.paidDays >= contract.contractDays) {
            contract.status = 'COMPLETED';
            contract.remainingDays = 0;
        }

        await contract.save();
        return contract.toObject();
    }

    /**
     * Update contract status
     */
    async updateContractStatus(contractId, status) {
        return await Contract.findOneAndUpdate(
            { contractId },
            { status },
            { new: true }
        ).lean();
    }

    /**
     * Get contracts expiring soon
     */
    async getExpiringContracts(daysThreshold = 30) {
        const today = new Date().toISOString().split('T')[0];
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
        const thresholdDateStr = thresholdDate.toISOString().split('T')[0];

        return await Contract.find({
            status: 'ACTIVE',
            endDate: {
                $gte: today,
                $lte: thresholdDateStr,
            },
        }).lean();
    }

    /**
     * Get contract statistics
     */
    async getContractStats(deviceId) {
        const contract = await this.getActiveContractByDevice(deviceId);

        if (!contract) {
            return null;
        }

        return {
            contractId: contract.contractId,
            deviceId: contract.deviceId,
            totalDays: contract.contractDays,
            paidDays: contract.paidDays,
            remainingDays: contract.remainingDays,
            dailyRate: contract.dailyRate,
            totalAmount: contract.totalAmount,
            paidAmount: contract.paidAmount,
            remainingAmount: contract.totalAmount - contract.paidAmount,
            completionPercentage: ((contract.paidDays / contract.contractDays) * 100).toFixed(2),
            startDate: contract.startDate,
            endDate: contract.endDate,
            status: contract.status,
        };
    }

    /**
     * Update contract details (customer info, daily rate, notes)
     */
    async updateContract(contractId, updates) {
        const contract = await Contract.findOneAndUpdate(
            { contractId },
            {
                $set: {
                    ...(updates.customerName !== undefined && { customerName: updates.customerName }),
                    ...(updates.customerEmail !== undefined && { customerEmail: updates.customerEmail }),
                    ...(updates.customerPhone !== undefined && { customerPhone: updates.customerPhone }),
                    ...(updates.customerDocument !== undefined && { customerDocument: updates.customerDocument }),
                    ...(updates.dailyRate !== undefined && { dailyRate: updates.dailyRate }),
                    ...(updates.notes !== undefined && { notes: updates.notes }),
                }
            },
            { new: true }
        );

        return contract;
    }
}

export default new ContractRepository();
