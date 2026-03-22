import contractRepository from '../repositories/contractRepository.js';
import invoiceRepository from '../repositories/invoiceRepository.js';
import paymentRepository from '../repositories/paymentRepository.js';
import deviceRepository from '../repositories/deviceRepository.js';

/**
 * Get dashboard statistics including revenue, contracts, payments, devices
 */
const getDashboardStats = async (req, res) => {
    try {
        const { companyId } = req.auth;

        // Get all contracts for this company
        const allContracts = await contractRepository.getAllContracts({ companyId });

        // Get all devices for this company
        const allDevices = await deviceRepository.findDevicesByCompany(companyId);
        const totalDevices = allDevices.length;
        const devicesWithContract = allDevices.filter(d => d.hasActiveContract).length;
        // Get active contracts
        const activeContracts = allContracts.filter(c => c.status === 'ACTIVE');

        // Calculate total revenue from APPROVED payments AND invoice comparison
        const now2 = new Date();
        const scopeMonth = req.query.month ? Number(req.query.month) : undefined;
        const scopeYear = req.query.year ? Number(req.query.year) : now2.getFullYear();
        const periodScope = scopeMonth ? { month: scopeMonth, year: scopeYear } : { year: scopeYear };

        const [totalRevenue, invoiceStats] = await Promise.all([
            paymentRepository.getTotalRevenueByCompany(companyId, periodScope),
            invoiceRepository.getTotalInvoicedByCompany(companyId, periodScope)
        ]);
        const collectionGap = invoiceStats.totalInvoiced - totalRevenue;


        // Get pending payments count directly by company
        const pendingPayments = await invoiceRepository.countPendingInvoicesByCompany(companyId);

        // Get recent payments filtered by companyId
        // paymentRepository.getAllPaymentsPaginated supports filter
        const recentPaymentsResult = await paymentRepository.getAllPaymentsPaginated({
            page: 1,
            limit: 10,
            filter: { companyId }
        });

        const sortedPayments = recentPaymentsResult.payments.map(payment => ({
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

        // Calculate dynamic changes
        let revenueChange = 0;
        let contractsChange = 0;
        let pendingPaymentsChange = 0;

        // Revenue data for the last 6 months
        const rawRevenueData = await invoiceRepository.getMonthlyRevenueByCompany(companyId);
        const revenueData = formatMonthlyRevenue(rawRevenueData);

        const currentMonthStats = await invoiceRepository.getInvoiceStatsThisMonthByCompany(companyId);

        if (currentMonthStats.totalInvoices > 0) {
            revenueChange = (currentMonthStats.paidInvoices / currentMonthStats.totalInvoices) * 100;
        } else {
            revenueChange = 0;
        }

        // Active contracts change based on createdAt
        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        let contractsThisMonth = 0;
        let contractsLastMonth = 0;

        allContracts.forEach(contract => {
            const created = new Date(contract.createdAt);
            if (created >= startOfThisMonth) {
                contractsThisMonth++;
            } else if (created >= startOfLastMonth && created < startOfThisMonth) {
                contractsLastMonth++;
            }
        });

        if (contractsLastMonth > 0) {
            contractsChange = ((contractsThisMonth - contractsLastMonth) / contractsLastMonth) * 100;
        } else if (contractsThisMonth > 0) {
            contractsChange = 100; // 100% increase if there were none last month
        }

        // Device status data
        const deviceData = calculateDeviceStatus(allContracts);

        res.json({
            success: true,
            data: {
                stats: {
                    totalRevenue,
                    activeDevices: devicesWithContract,
                    pendingPayments,
                    // Invoice vs Payment comparison
                    totalInvoiced: invoiceStats.totalInvoiced,
                    totalPaidInvoices: invoiceStats.totalPaid,
                    collectionGap,           // totalInvoiced - totalRevenue
                    collectionRate: invoiceStats.totalInvoiced > 0
                        ? parseFloat(((totalRevenue / invoiceStats.totalInvoiced) * 100).toFixed(1))
                        : 100,
                    changes: {
                        totalRevenue: parseFloat(revenueChange.toFixed(1)),
                        activeDevices: parseFloat(((devicesWithContract / totalDevices) * 100).toFixed(1)),
                        pendingPayments: 0
                    }
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
/**
 * Format monthly revenue for the chart
 */
function formatMonthlyRevenue(revenueData) {
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedData = [];

    // Initialize last 6 months map
    const revenueMap = {};
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${monthNames[date.getMonth()]}`;
        revenueMap[monthKey] = 0;
    }

    // Fill with actual data
    if (revenueData && Array.isArray(revenueData)) {
        revenueData.forEach(item => {
            // MongoDB aggregation returns month/year numbers
            // month is 1-based in aggregation result
            const monthIndex = item._id.month - 1;
            const monthName = monthNames[monthIndex];

            // Only add if it's within our 6-month window (map has the keys)
            if (revenueMap.hasOwnProperty(monthName)) {
                revenueMap[monthName] = item.totalRevenue;
            }
        });
    }

    // Convert to array format for charts
    return Object.entries(revenueMap).map(([month, revenue]) => ({
        month,
        revenue: revenue / 100, // Convert to currency units
        expenses: revenue * 0.6 / 100 // Estimated expenses (60% of revenue)
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
