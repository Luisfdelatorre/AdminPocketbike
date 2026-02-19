
import contractRepository from '../repositories/contractRepository.js';
import deviceRepository from '../repositories/deviceRepository.js';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
import { Transaction } from '../config/config.js';
import helpers from '../utils/helpers.js';
import paymentServices from './paymentService.js';


class ContractService {

    /**
     * Create a new contract with associated device assignment and initial fee processing
     */
    async createContract(data) {
        // 1. Validate device
        console.log('Device ID:', data);
        const device = await deviceRepository.getDeviceById(data.deviceId * 1);
        if (!device) {
            throw new Error('Device not found');
        }

        // 2. Validate existing contract
        const existingContract = await contractRepository.getActiveContractByDevice(device.name); // Check by name usually
        // Fallback or double check logic depending on repo implementation, repo uses deviceIdName
        if (existingContract) {
            throw new Error(`Device ${device.name} already has an active contract (${existingContract.contractId}). Please cancel it before creating a new one.`);
        }

        // 3. Prepare Contract Data
        const contractData = {
            ...data,
            deviceId: device.deviceId, // Ensure correct ID mapping
            deviceIdName: device.name,
            companyId: device.companyId,
            companyName: device.companyName,
            dailyRate: data.dailyRate || 30000,
            contractDays: data.contractDays || 500,
            startDate: data.startDate || new Date(),
            freeDaysLimit: data.freeDaysLimit || 4
        };

        // 4. Create Contract
        const contract = await contractRepository.createContract(contractData);

        // 5. Sync to Device (Denormalization)
        // Map contract/form data to device fields expectations
        await deviceRepository.assignContractToDevice(data.deviceId, {
            contractId: contract.contractId,
            driverName: data.customerName,
            nequiNumber: data.customerPhone,
            companyId: device.companyId,
            companyName: device.companyName,
            dailyRate: contractData.dailyRate
        });

        // 6. Handle Initial Fee
        if (data.initialFee > 0) {
            await paymentServices.processInitialFee(contract, device, data.initialFee, contractData.startDate);
        }

        return contract;
    }

}

export default new ContractService();
