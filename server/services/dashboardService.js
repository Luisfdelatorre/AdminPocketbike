import invoiceRepository from '../repositories/invoiceRepository.js';
import paymentRepository from '../repositories/paymentRepository.js';
import deviceRepository from '../repositories/deviceRepository.js';
import logger from '../config/logger.js';

/**
 * Service that gathers all data required by the admin dashboard.
 * Returns an object matching the shape required by the UI, fetching only active metrics in parallel.
 */
export const getDashboardData = async (companyId, periodScope) => {
  try {
    const [
      deviceStats,
      totalRevenue,
      invoiceStats,
      pendingPayments,
      recentPaymentsResult
    ] = await Promise.all([
      deviceRepository.getDeviceStatsByCompany(companyId),
      paymentRepository.getTotalRevenueByCompany(companyId, periodScope),
      invoiceRepository.getTotalInvoicedByCompany(companyId, periodScope),
      invoiceRepository.countPendingInvoicesByCompany(companyId),
      paymentRepository.getAllPaymentsPaginated({
        page: 1,
        limit: 10,
        filter: { companyId }
      })
    ]);

    const { totalDevices, activeDevices } = deviceStats;
    const collectionGap = invoiceStats.totalUnpaid;

    const recentPayments = (recentPaymentsResult.payments || []).map(p => ({
      id: p.paymentId,
      device: p.deviceId,
      amount: p.amount,
      status: p.status,
      date: p.createdAt
        ? (p.createdAt instanceof Date
          ? p.createdAt.toISOString().split('T')[0]
          : p.createdAt.split('T')[0])
        : 'N/A'
    }));

    return {
      stats: {
        totalRevenue,
        activeDevices,
        pendingPayments,
        totalInvoiced: invoiceStats.totalInvoiced,
        totalPaidInvoices: invoiceStats.totalPaid,
        collectionGap,
        collectionRate: invoiceStats.totalInvoiced > 0
          ? parseFloat(((invoiceStats.totalPaid / invoiceStats.totalInvoiced) * 100).toFixed(1))
          : 100,
        changes: {
          totalRevenue: 0,
          activeDevices: totalDevices > 0 ? parseFloat(((activeDevices / totalDevices) * 100).toFixed(1)) : 0,
          pendingPayments: 0
        }
      },
      recentPayments,
      revenueData: [],
      deviceData: []
    };
  } catch (error) {
    logger.error('Dashboard service error:', error);
    throw error;
  }
};

/**
 * Format monthly revenue data for chart consumption.
 */
function formatMonthlyRevenue(revenueData) {
  const now = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const revenueMap = {};
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${monthNames[date.getMonth()]}`;
    revenueMap[monthKey] = 0;
  }
  if (revenueData && Array.isArray(revenueData)) {
    revenueData.forEach(item => {
      const monthIndex = item._id.month - 1;
      const monthName = monthNames[monthIndex];
      if (revenueMap.hasOwnProperty(monthName)) {
        revenueMap[monthName] = item.totalRevenue;
      }
    });
  }
  return Object.entries(revenueMap).map(([month, revenue]) => ({
    month,
    revenue: revenue / 100,
    expenses: revenue * 0.6 / 100
  }));
}

/**
 * Calculate device status distribution for the pie chart.
 */
function calculateDeviceStatus(contracts) {
  const deviceStatus = { active: 0, maintenance: 0, available: 0 };
  const deviceContracts = {};
  contracts.forEach(contract => {
    if (!deviceContracts[contract.deviceId]) {
      deviceContracts[contract.deviceId] = [];
    }
    deviceContracts[contract.deviceId].push(contract);
  });
  Object.entries(deviceContracts).forEach(([_, contracts]) => {
    const hasActive = contracts.some(c => c.status === 'ACTIVE');
    if (hasActive) deviceStatus.active++; else deviceStatus.available++;
  });
  return [
    { name: 'Active', value: deviceStatus.active, color: '#03C9D7' },
    { name: 'Maintenance', value: deviceStatus.maintenance, color: '#FB9678' },
    { name: 'Available', value: deviceStatus.available, color: '#00C292' }
  ].filter(item => item.value > 0);
}

export default { getDashboardData };
