import { Contract } from '../models/Contract.js';
import { nanoid } from 'nanoid';

export class ContractRepository {
    /**
     * Create a new contract
     */
    async createContract({
        deviceIdName,
        dailyRate,
        contractDays = 500,
        startDate,
        customerName,
        customerEmail,
        customerPhone,
        customerDocument,
        notes,
        devicePin
    }) {
        // Create contract ID with device and start date for easy searching
        // Format: CONTRACT-BIKE001-2026-01-06-abc123
        const contractId = `C${deviceIdName}${nanoid(2).toUpperCase()}`;

        // Calculate end date
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + contractDays);
        const endDate = end.toISOString().split('T')[0];

        // Calculate total amount
        const totalAmount = dailyRate * contractDays;

        const contract = await Contract.create({
            contractId,
            deviceIdName,
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
            devicePin,
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
    async getActiveContractByDevice(deviceIdName) {
        return await Contract.findOne({
            deviceIdName,
            status: 'ACTIVE',
        }).lean();
    }

    /**
     * Get all contracts for a device
     */
    async getContractsByDevice(deviceIdName) {
        return await Contract.find({ deviceIdName })
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
    async getContractStats(deviceIdName) {
        const contract = await this.getActiveContractByDevice(deviceIdName);

        if (!contract) {
            return null;
        }

        return {
            contractId: contract.contractId,
            deviceId: contract.deviceIdName,
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
        const contract = await Contract.findOne({ contractId });

        if (!contract) {
            throw new Error('Contract not found');
        }

        if (updates.customerName !== undefined) contract.customerName = updates.customerName;
        if (updates.customerEmail !== undefined) contract.customerEmail = updates.customerEmail;
        if (updates.customerPhone !== undefined) contract.customerPhone = updates.customerPhone;
        if (updates.customerDocument !== undefined) contract.customerDocument = updates.customerDocument;
        if (updates.dailyRate !== undefined) contract.dailyRate = updates.dailyRate;
        if (updates.notes !== undefined) contract.notes = updates.notes;

        // Handle PIN update - pre-save hook will hash it
        if (updates.devicePin !== undefined && updates.devicePin) {
            contract.devicePin = updates.devicePin;
        }

        await contract.save();
        return contract.toObject();
    }

    async validateDevicePin(deviceIdName, pin) {
        const contract = await this.getActiveContractByDevice(deviceIdName);

        if (!contract) {
            return { valid: false, error: 'No active contract found for this device' };
        }

        if (!contract.devicePin) {
            return { valid: false, error: 'This contract does not have a PIN set. Please contact admin to set a PIN.' };
        }

        const bcrypt = require('bcryptjs');
        const isValid = await bcrypt.compare(pin, contract.devicePin);

        if (!isValid) {
            return { valid: false, error: 'Invalid PIN' };
        }

        return { valid: true, contract };
    }



}

export default new ContractRepository();
