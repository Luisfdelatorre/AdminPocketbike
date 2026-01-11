import contractRepository from '../repositories/contractRepository.js';
import invoiceRepository from '../repositories/invoiceRepository.js';
import paymentRepository from '../repositories/paymentRepository.js';

/**
 * Get dashboard statistics including revenue, contracts, payments, devices
 */
const getDashboardStats = async (req, res) => {
    try {
        console.log('📊 Fetching dashboard stats...');

        // Get all contracts
        const allContracts = await contractRepository.getAllContracts();
        console.log(`Found ${allContracts.length} contracts`);

        // Get active contracts
        const activeContracts = allContracts.filter(c => c.status === 'ACTIVE');

        // Calculate total revenue (sum of all paid amounts)
        const totalRevenue = allContracts.reduce((sum, contract) => {
            return sum + (contract.paidAmount || 0);
        }, 0);

        // Get unique devices
        const uniqueDevices = [...new Set(allContracts.map(c => c.deviceId))];
        console.log(`Found ${uniqueDevices.length} unique devices`);

        // Get all invoices for pending payments count
        let pendingPayments = 0;
        const allInvoices = [];

        for (const deviceId of uniqueDevices) {
            try {
                const deviceInvoices = await invoiceRepository.getInvoicesByDevice(deviceId);
                if (deviceInvoices && Array.isArray(deviceInvoices)) {
                    allInvoices.push(...deviceInvoices);
                }
            } catch (err) {
                console.error(`Error fetching invoices for ${deviceId}:`, err.message);
            }
        }

        pendingPayments = allInvoices.filter(inv => inv.status === 'PENDING').length;
        console.log(`Found ${pendingPayments} pending payments`);

        // Get recent payments
        const recentPayments = [];
        for (const deviceId of uniqueDevices) {
            try {
                const payments = await paymentRepository.getPaymentHistory(deviceId);
                if (payments && Array.isArray(payments)) {
                    recentPayments.push(...payments);
                }
            } catch (err) {
                console.error(`Error fetching payments for ${deviceId}:`, err.message);
            }
        }

        // Sort by date and take last 10
        const sortedPayments = recentPayments
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 10)
            .map(payment => ({
                id: payment.paymentId,
                device: payment.deviceId,
                amount: payment.amount,
                status: payment.status,
                date: payment.createdAt
                    ? (payment.createdAt instanceof Date
                        ? payment.createdAt.toISOString().split('T')[0]
                        : payment.createdAt.split('T')[0])
                    : 'N/A'
            }));

        // Revenue data for the last 6 months
        const revenueData = calculateMonthlyRevenue(allInvoices);

        // Device status data
        const deviceData = calculateDeviceStatus(allContracts);

        console.log('✅ Dashboard stats compiled successfully');

        res.json({
            success: true,
            data: {
                stats: {
                    totalRevenue,
                    activeContracts: activeContracts.length,
                    pendingPayments,
                    totalDevices: uniqueDevices.length
                },
                recentPayments: sortedPayments,
                revenueData,
                deviceData
            }
        });
    } catch (error) {
        console.error('❌ Error fetching dashboard stats:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dashboard statistics',
            details: error.message
        });
    }
};

/**
 * Calculate monthly revenue for the last 6 months
 */
function calculateMonthlyRevenue(invoices) {
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const revenueByMonth = {};

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${monthNames[date.getMonth()]}`;
        revenueByMonth[monthKey] = { revenue: 0, expenses: 0 };
    }

    // Aggregate paid invoices by month
    if (invoices && Array.isArray(invoices)) {
        invoices.forEach(invoice => {
            if (invoice.status === 'PAID' && invoice.paidAt) {
                try {
                    const date = new Date(invoice.paidAt);
                    const monthKey = monthNames[date.getMonth()];

                    if (revenueByMonth[monthKey]) {
                        revenueByMonth[monthKey].revenue += invoice.amount || 0;
                    }
                } catch (err) {
                    console.error('Error processing invoice date:', err);
                }
            }
        });
    }

    // Convert to array format for charts
    return Object.entries(revenueByMonth).map(([month, data]) => ({
        month,
        revenue: data.revenue / 100, // Convert to currency units
        expenses: data.revenue * 0.6 / 100 // Estimated expenses (60% of revenue)
    }));
}

/**
 * Calculate device status distribution
 */
function calculateDeviceStatus(contracts) {
    const deviceStatus = {
        active: 0,
        maintenance: 0,
        available: 0
    };

    // Group contracts by device
    const deviceContracts = {};
    contracts.forEach(contract => {
        if (!deviceContracts[contract.deviceId]) {
            deviceContracts[contract.deviceId] = [];
        }
        deviceContracts[contract.deviceId].push(contract);
    });

    // Determine status for each device
    Object.entries(deviceContracts).forEach(([deviceId, contracts]) => {
        const hasActiveContract = contracts.some(c => c.status === 'ACTIVE');

        if (hasActiveContract) {
            deviceStatus.active++;
        } else {
            deviceStatus.available++;
        }
    });

    // Return in format for pie chart
    return [
        { name: 'Active', value: deviceStatus.active, color: '#03C9D7' },
        { name: 'Maintenance', value: deviceStatus.maintenance, color: '#FB9678' },
        { name: 'Available', value: deviceStatus.available, color: '#00C292' }
    ].filter(item => item.value > 0); // Only include non-zero values
}

export default {
    getDashboardStats
};
