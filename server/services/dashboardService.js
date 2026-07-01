import contractRepository from '../repositories/contractRepository.js';
import invoiceRepository from '../repositories/invoiceRepository.js';
import paymentRepository from '../repositories/paymentRepository.js';
import deviceRepository from '../repositories/deviceRepository.js';
import logger from '../config/logger.js';

/**
 * Service that gathers all data required by the admin dashboard.
 * Returns an object matching the shape previously sent directly from the controller.
 */
export const getDashboardData = async (companyId, periodScope) => {
  try {
    // 1️⃣ Contracts and devices
    const [allContracts, allDevices] = await Promise.all([
      contractRepository.getAllContracts({ companyId }),
      deviceRepository.findDevicesByCompany(companyId)
    ]);

    const totalDevices = allDevices.length;
    const devicesWithContract = allDevices.filter(d => d.hasActiveContract).length;

    // 2️⃣ Revenue and invoicing stats
    const [totalRevenue, invoiceStats] = await Promise.all([
      paymentRepository.getTotalRevenueByCompany(companyId, periodScope),
      invoiceRepository.getTotalInvoicedByCompany(companyId, periodScope)
    ]);
    const collectionGap = invoiceStats.totalInvoiced - totalRevenue;

    // 3️⃣ Pending invoices count
    const pendingPayments = await invoiceRepository.countPendingInvoicesByCompany(companyId);

    // 4️⃣ Recent payments (paginated, first page, 10 items)
    const recentPaymentsResult = await paymentRepository.getAllPaymentsPaginated({
      page: 1,
      limit: 10,
      filter: { companyId }
    });
    const recentPayments = recentPaymentsResult.payments.map(p => ({
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

    // 5️⃣ Revenue data for chart (last 6 months)
    const rawRevenueData = await invoiceRepository.getMonthlyRevenueByCompany(companyId);
    const revenueData = formatMonthlyRevenue(rawRevenueData);

    // 6️⃣ Device status distribution for pie chart
    const deviceData = calculateDeviceStatus(allContracts);

    // 7️⃣ Dynamic changes (e.g., revenueChange)
    const currentMonthStats = await invoiceRepository.getInvoiceStatsThisMonthByCompany(companyId);
    let revenueChange = 0;
    if (currentMonthStats.totalInvoices > 0) {
      revenueChange = (currentMonthStats.paidInvoices / currentMonthStats.totalInvoices) * 100;
    }

    return {
      stats: {
        totalRevenue,
        activeDevices: devicesWithContract,
        pendingPayments,
        totalInvoiced: invoiceStats.totalInvoiced,
        totalPaidInvoices: invoiceStats.totalPaid,
        collectionGap,
        collectionRate: invoiceStats.totalInvoiced > 0
          ? parseFloat(((totalRevenue / invoiceStats.totalInvoiced) * 100).toFixed(1))
          : 100,
        changes: {
          totalRevenue: parseFloat(revenueChange.toFixed(1)),
          activeDevices: parseFloat(((devicesWithContract / totalDevices) * 100).toFixed(1)),
          pendingPayments: 0
        }
      },
      recentPayments,
      revenueData,
      deviceData
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
