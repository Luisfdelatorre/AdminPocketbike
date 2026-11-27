/**
 * Dynamic imports for the admin pages, shared by App.jsx (React.lazy) and
 * AdminLayout (background prefetch). Vite dedupes the import, so prefetching
 * here means the lazy() call resolves instantly and the tab never suspends.
 */
export const pageLoaders = {
    AdminDashboard: () => import('../pages/AdminDashboard'),
    DeviceSelector: () => import('../pages/DeviceSelector'),
    Contracts: () => import('../pages/Contracts'),
    Payments: () => import('../pages/Payments'),
    PaymentSummary: () => import('../pages/PaymentSummary'),
    Invoices: () => import('../pages/Invoices'),
    Users: () => import('../pages/Users'),
    Companies: () => import('../pages/Companies'),
    Settings: () => import('../pages/Settings'),
    Reports: () => import('../pages/Reports'),
    CompanyInvoices: () => import('../pages/CompanyInvoices'),
    CommandHistory: () => import('../pages/CommandHistory'),
    Alerts: () => import('../pages/Alerts'),
    AiTelemetry: () => import('../pages/AiTelemetry'),
};

// Bottom-nav tabs first, the rest afterwards.
const PREFETCH_ORDER = [
    'PaymentSummary', 'Contracts', 'Payments', 'Invoices', 'AdminDashboard',
    'DeviceSelector', 'Alerts', 'Reports', 'Companies', 'Settings', 'Users',
    'CompanyInvoices', 'CommandHistory', 'AiTelemetry',
];

let prefetched = false;

/** Downloads every admin page chunk while the browser is idle (once per session). */
export const prefetchAdminPages = () => {
    if (prefetched) return () => {};
    prefetched = true;

    let cancelled = false;
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
    const queue = [...PREFETCH_ORDER];

    const next = () => {
        if (cancelled || queue.length === 0) return;
        const name = queue.shift();
        pageLoaders[name]().catch(() => { /* retried by lazy() on navigation */ }).finally(() => idle(next));
    };
    idle(next);

    return () => { cancelled = true; prefetched = false; };
};
