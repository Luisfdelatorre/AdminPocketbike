import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getAllContracts, getAllPayments, getPaymentSummary, getDashboardStats, getAllDevices, getAllInvoices } from '../services/api';
import { calculateFleetElectricalSummary } from '../utils/batteryHealthHelper';

/**
 * Cached data for the admin tabs (Contratos, Pagos, Resumen).
 *
 * Coming back to a tab paints the cached data immediately; once it is older than
 * `staleTime` (see services/queryClient.js) it is refreshed in the background
 * without showing "Cargando…" again. `keepPreviousData` keeps the current list on
 * screen while a new month/year is being fetched.
 *
 * Keys include the active company so data never leaks across a company switch.
 */

const unwrap = (result, fallbackMessage) => {
    if (!result?.success) {
        throw new Error(result?.error || fallbackMessage);
    }
    return result;
};

const useCompanyKey = () => {
    const { user } = useAuth();
    return user?.companyId || 'default';
};

export const screenQueryKeys = {
    contracts: (companyKey) => ['contracts', companyKey],
    paymentsFirstPage: (companyKey, month, year) => ['payments', companyKey, month, year, 'page-1'],
    paymentSummary: (companyKey, month, year) => ['payment-summary', companyKey, month, year],
    dashboard: (companyKey, month, year) => ['dashboard', companyKey, month, year],
    devices: (companyKey) => ['devices', companyKey],
    invoicesFirstPage: (companyKey, filters) => ['invoices', companyKey, filters, 'page-1'],
};

export const useContractsQuery = () => {
    const companyKey = useCompanyKey();
    return useQuery({
        queryKey: screenQueryKeys.contracts(companyKey),
        queryFn: async () => {
            const result = unwrap(await getAllContracts(), 'Failed to fetch contracts');
            return {
                contracts: result.contracts || [],
                availableDevices: result.availableDevices || [],
                settings: result.settings || null,
            };
        },
    });
};

export const PAYMENTS_PAGE_SIZE = 50;

/** First page of the payments list; later pages (infinite scroll) stay local to the screen. */
export const usePaymentsFirstPageQuery = ({ month, year }) => {
    const companyKey = useCompanyKey();
    return useQuery({
        queryKey: screenQueryKeys.paymentsFirstPage(companyKey, month, year),
        queryFn: async () => {
            const params = { page: 1, limit: PAYMENTS_PAGE_SIZE };
            if (month) params.month = month;
            if (year) params.year = year;
            const result = unwrap(await getAllPayments(params), 'Failed to load payments');
            return {
                payments: result.payments || [],
                pagination: result.pagination || {},
            };
        },
        placeholderData: keepPreviousData,
    });
};

export const usePaymentSummaryQuery = ({ month, year }) => {
    const companyKey = useCompanyKey();
    return useQuery({
        queryKey: screenQueryKeys.paymentSummary(companyKey, month, year),
        queryFn: async () => {
            const result = unwrap(await getPaymentSummary({ month, year }), 'Failed to fetch summary');
            return {
                data: Array.isArray(result.data) ? result.data : [],
                dayTypesConfig: result.dayTypesConfig,
            };
        },
        placeholderData: keepPreviousData,
    });
};

/** Inicio: dashboard stats + fleet electrical summary. */
export const useDashboardQuery = ({ month, year }) => {
    const companyKey = useCompanyKey();
    return useQuery({
        queryKey: screenQueryKeys.dashboard(companyKey, month, year),
        queryFn: async () => {
            const params = { year };
            if (month) params.month = month;
            const [dashResult, devResult] = await Promise.all([
                getDashboardStats(params),
                getAllDevices().catch(() => ({ success: false, devices: [] })),
            ]);
            const dash = unwrap(dashResult, 'Failed to fetch dashboard data').data || {};
            return {
                stats: dash.stats || {},
                revenueData: dash.revenueData || [],
                deviceData: dash.deviceData || [],
                recentPayments: dash.recentPayments || [],
                electricalSummary: devResult?.success && devResult.devices
                    ? calculateFleetElectricalSummary(devResult.devices)
                    : null,
            };
        },
        placeholderData: keepPreviousData,
    });
};

/** Dispositivos: map gpsId -> device. Realtime (SSE) changes are written into this entry. */
const fetchDevicesMap = async () => {
    const result = unwrap(await getAllDevices(), 'Failed to load devices');
    const deviceMap = {};
    (result.devices || []).forEach((d) => {
        if (d.gpsId) deviceMap[String(d.gpsId)] = d;
    });
    return deviceMap;
};

export const useDevicesQuery = () => {
    const companyKey = useCompanyKey();
    return useQuery({
        queryKey: screenQueryKeys.devices(companyKey),
        queryFn: fetchDevicesMap,
        // Device status changes constantly: paint the cache instantly but always
        // refresh in the background when the tab is opened.
        staleTime: 0,
    });
};

/** Facturas: request params for one page of the list. */
export const buildInvoiceParams = ({ month, year, search, filter, isMobile }, page = 1) => {
    const params = {};
    if (page > 1) params.page = page;
    if (search) {
        params.search = search.trim();
        params.limit = isMobile ? 30 : 500;
    } else {
        if (month) params.month = month;
        if (year) params.year = year;
        if (isMobile) params.limit = 30;
    }
    if (filter && filter !== 'all') params.status = filter;
    return params;
};

export const fetchInvoicesPage = async (filters, page = 1) => {
    const result = unwrap(await getAllInvoices(buildInvoiceParams(filters, page)), 'Failed to load invoices');
    return {
        invoices: result.invoices || [],
        stats: result.stats || null,
        pagination: result.pagination || {},
    };
};

/** Query options for the first page, shared by the hook and by manual refreshes. */
export const invoicesFirstPageOptions = (companyKey, filters) => ({
    queryKey: screenQueryKeys.invoicesFirstPage(companyKey, filters),
    queryFn: () => fetchInvoicesPage(filters, 1),
});

/** First page of the invoices list; later pages (infinite scroll / pagination) stay local. */
export const useInvoicesFirstPageQuery = (filters) => {
    const companyKey = useCompanyKey();
    return useQuery({
        ...invoicesFirstPageOptions(companyKey, filters),
        placeholderData: keepPreviousData,
    });
};

/** Lets a screen write realtime (SSE) changes into its cached entry. */
export const useScreenQueryClient = () => {
    const queryClient = useQueryClient();
    const companyKey = useCompanyKey();
    return { queryClient, companyKey };
};
