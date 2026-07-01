import { CompanyInvoice } from '../models/CompanyInvoice.js';
import { Company } from '../models/Company.js';
import { Payment } from '../models/Payment.js';
import logger from '../config/logger.js';
import mongoose from 'mongoose';

class CompanyBillingService {
    /**
     * Obtains the list of company invoices with optional filters
     */
    async getCompanyInvoices(query = {}) {
        try {
            return await CompanyInvoice.find(query).populate('companyId', 'name nit').sort({ year: -1, month: -1, createdAt: -1 });
        } catch (error) {
            logger.error('Error in getCompanyInvoices:', error);
            throw error;
        }
    }

    /**
     * Generates the monthly invoice for a specific company based on the billingConfig
     */
    async generateMonthlyCompanyInvoice(companyId, month, year) {
        try {
            // 1. Get Company and config
            const company = await Company.findById(companyId);
            if (!company) throw new Error('Company not found');

            const billingConfig = company.billingConfig || {};
            const fixedFee = billingConfig.transactionFixedFee || 0;
            let pctFee = billingConfig.transactionPercentage || 0;
            if (company.wompiConfig && company.wompiConfig.wompiCommission !== undefined) {
                pctFee = Math.abs(company.wompiConfig.wompiCommission);
            }
            const ivaPct = billingConfig.ivaPercentage !== undefined ? billingConfig.ivaPercentage : 0.19;

            // 2. Fetch all APPROVED payments for this company in the given month
            const fromDate = new Date(year, month - 1, 1);
            const toDate = new Date(year, month, 1);

            const payments = await Payment.find({
                companyId: new mongoose.Types.ObjectId(companyId),
                status: 'APPROVED',
                finalized_at: { $gte: fromDate, $lt: toDate }
            });

            // 3. Calculate metrics
            const totalTransactions = payments.length;
            let totalPaymentsAmount = 0;
            let totalCommissionBase = 0;

            for (const p of payments) {
                totalPaymentsAmount += p.amount;
                const txFee = (p.amount * pctFee) + fixedFee;
                totalCommissionBase += txFee;
            }

            const tax = totalCommissionBase * ivaPct;
            const amountDue = totalCommissionBase + tax;

            // 4. Generate next Invoice Number (e.g. IN-000-01)
            // Simplified sequential logic: Find the latest invoice to increment number
            const lastInvoice = await CompanyInvoice.findOne().sort({ createdAt: -1 });
            let nextNum = 1;
            if (lastInvoice && lastInvoice.invoiceNumber.startsWith('IN-000-')) {
                const parts = lastInvoice.invoiceNumber.split('-');
                nextNum = parseInt(parts[2], 10) + 1;
            }
            const invoiceNumber = `IN-000-${nextNum.toString().padStart(2, '0')}`;

            // 5. Calculate due date (e.g., 5 days after generation)
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 5);

            // 6. Check if an invoice already exists for this month/year/company to avoid duplicates
            // Alternatively, we allow re-generating it by overriding or voiding the old one.
            const existing = await CompanyInvoice.findOne({ companyId, month, year });
            if (existing) {
                existing.invoiceNumber = invoiceNumber;
                existing.totalTransactions = totalTransactions;
                existing.totalPaymentsAmount = totalPaymentsAmount;
                existing.subtotal = totalCommissionBase;
                existing.tax = tax;
                existing.amountDue = amountDue;
                existing.dueDate = dueDate;
                existing.status = 'PENDING';
                await existing.save();
                return existing;
            }

            // 7. Create new invoice
            const newInvoice = new CompanyInvoice({
                invoiceNumber,
                companyId,
                month,
                year,
                totalTransactions,
                totalPaymentsAmount,
                subtotal: totalCommissionBase,
                tax,
                amountDue,
                dueDate,
                status: 'PENDING'
            });

            await newInvoice.save();
            return newInvoice;

        } catch (error) {
            logger.error('Error generating company invoice:', error);
            throw error;
        }
    }
}

export default new CompanyBillingService();
