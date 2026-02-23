import { Contract } from '../models/Contract.js';
import helpers from '../utils/helpers.js';
import daysjs from 'dayjs';

export class ContractRepository {
    /**
     * Create a new contract
     */
    async createContract(data, device) {

        ;        // User requested format: CI + DeviceName + 2 nanoid (e.g. CIBIKE001AB)
        const contractId = helpers.generateContractId(device.name);

        // Calculate end date
        const start = daysjs(data.startDate);
        const end = daysjs(start).add(data.contractDays, 'days');
        const endDate = end.format('YYYY-MM-DD');

        // Calculate total amount
        const totalAmount = data.dailyRate * data.contractDays;
        const remainingDays = data.contractDays;

        const contractData = {
            ...data,
            contractId,
            deviceId: device.deviceId,     // webdeviceid
            deviceIdName: device.name, // Human readable name
            companyId: device.companyId,
            companyName: device.companyName,
            startDate: start.toDate(),
            endDate,
            totalAmount,
            remainingDays,
            status: 'ACTIVE'
        }

        const contract = await Contract.create(contractData);

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
     * @param {Object} query - Optional query filter
     */
    async getAllContracts(query = {}) {
        return await Contract.find(query)
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
        if (updates.notes !== undefined) contract.notes = updates.notes;
        if (updates.freeDaysLimit !== undefined) contract.freeDaysLimit = updates.freeDaysLimit;
        if (updates.freeDayPolicy !== undefined) contract.freeDayPolicy = updates.freeDayPolicy;
        if (updates.fixedFreeDayOfWeek !== undefined) contract.fixedFreeDayOfWeek = updates.fixedFreeDayOfWeek;
        if (updates.exemptFromCutOff !== undefined) contract.exemptFromCutOff = updates.exemptFromCutOff;

        // Handle updates that affect calculations (dailyRate, contractDays)
        let recalculate = false;
        if (updates.dailyRate !== undefined && updates.dailyRate !== contract.dailyRate) {
            contract.dailyRate = updates.dailyRate;
            recalculate = true;
        }

        if (updates.contractDays !== undefined && updates.contractDays !== contract.contractDays) {
            contract.contractDays = updates.contractDays;
            recalculate = true;
        }

        if (recalculate) {
            // Recalculate total amount
            contract.totalAmount = contract.dailyRate * contract.contractDays;

            // Recalculate end date
            const start = new Date(contract.startDate);
            const end = new Date(start);
            end.setDate(end.getDate() + contract.contractDays);
            contract.endDate = end.toISOString().split('T')[0];

            // Recalculate remaining days
            contract.remainingDays = contract.contractDays - contract.paidDays;

            // Re-check completion status
            if (contract.paidDays >= contract.contractDays) {
                contract.status = 'COMPLETED';
                contract.remainingDays = 0;
            } else if (contract.status === 'COMPLETED') {
                // If it was completed but we added more days, it might be active again
                contract.status = 'ACTIVE';
            }
        }

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
