import contractRepository from '../repositories/contractRepository.js';
import invoiceRepository from '../repositories/invoiceRepository.js';
import paymentRepository from '../repositories/paymentRepository.js';
import deviceRepository from '../repositories/deviceRepository.js';
import dashboardService from '../services/dashboardService.js';

/**
 * Get dashboard statistics including revenue, contracts, payments, devices
 */
const getDashboardStats = async (req, res) => {
  try {
    const { companyId } = req.auth;
    const scopeMonth = req.query.month ? Number(req.query.month) : undefined;
    const scopeYear = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const periodScope = scopeMonth ? { month: scopeMonth, year: scopeYear } : { year: scopeYear };

    const data = await dashboardService.getDashboardData(companyId, periodScope);
    res.json({ success: true, data });
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
