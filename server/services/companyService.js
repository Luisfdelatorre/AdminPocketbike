import companyRepository from '../repositories/companyRepository.js';
import WompiAdapter from '../adapters/wompiAdapter/wompiAdapter.js';
import MegaRastreo from '../adapters/megaRastreo/megaRastreoAdapter.js';
import logger from '../config/logger.js';
import { GPS_SERVICES } from '../config/components/constants.js';
import GpsService from './gpsServices.js';
import dayjs from '../config/dayjs.js';
import { triggerCronReload } from '../utils/cronClient.js';

class CompanyService {
    constructor() {
        this.wompiAdapters = new Map();
        this.gpsAdapters = new Map(); // keyed by companyId
    }

    clearCache(companyId) {
        const key = String(companyId);
        this.wompiAdapters.delete(key);
        this.gpsAdapters.delete(key);
        logger.debug(`[CompanyService] Cleared cached adapters for company: ${companyId}`);
    }

    async validateTraccarCredentials({ host, user, password, companyId }) {
        let finalHost = host;
        let finalUser = user;
        let finalPassword = password;

        if (companyId && (!finalPassword || finalPassword === '********')) {
            const company = await companyRepository.findById(companyId);
            if (company?.gpsConfig) {
                if (!finalHost) finalHost = company.gpsConfig.host;
                if (!finalUser) finalUser = company.gpsConfig.user;
                finalPassword = company.gpsConfig.password;
            }
        }

        if (!finalHost || !finalUser || !finalPassword) {
            const err = new Error('Host, usuario y contraseña de Traccar son requeridos');
            err.statusCode = 400;
            throw err;
        }

        const TraccarApi = (await import('../adapters/traccar/traccarApi.js')).default;
        const traccarApi = new TraccarApi({
            host: finalHost,
            user: finalUser,
            password: finalPassword
        });

        const tStart = Date.now();
        // 1. Session Login
        const tSession = Date.now();
        const sessionRes = await traccarApi.createSession();
        const sessionMs = Date.now() - tSession;
        const trUser = sessionRes?.data || {};

        // 2. Fetch accessible groups
        let groups = [];
        const tGroups = Date.now();
        try {
            const res = await traccarApi.getGroups();
            if (res.data && Array.isArray(res.data)) {
                groups = res.data;
            }
        } catch (gErr) {
            logger.warn('[CompanyService] Error fetching groups during Traccar validation:', gErr.message);
        }
        const groupsMs = Date.now() - tGroups;

        // 3. Fallback: inspect devices only if no group was found
        let devices = [];
        let selectedGroup = groups[0] || null;
        let devicesMs = 0;

        if (!selectedGroup) {
            const tDevices = Date.now();
            try {
                const devRes = await traccarApi.getDeviceList();
                if (devRes.data && Array.isArray(devRes.data)) {
                    devices = devRes.data;
                    const devWithGroup = devices.find(d => d.groupId != null);
                    if (devWithGroup) {
                        selectedGroup = { id: devWithGroup.groupId, name: `Grupo ${devWithGroup.groupId}` };
                    }
                }
            } catch (dErr) {
                logger.warn('[CompanyService] Error fetching device list during Traccar validation:', dErr.message);
            }
            devicesMs = Date.now() - tDevices;
        }

        // If companyId is provided, persist the auto-discovered group directly
        let dbMs = 0;
        if (companyId && selectedGroup?.id) {
            const tDb = Date.now();
            const company = await companyRepository.findById(companyId);
            if (company) {
                if (!company.gpsConfig) company.gpsConfig = {};
                company.gpsConfig.groupId = selectedGroup.id;
                company.traccarGroupId = selectedGroup.id;
                await companyRepository.save(company);
                this.clearCache(companyId);
            }
            dbMs = Date.now() - tDb;
        }

        const totalMs = Date.now() - tStart;
        console.log(`⏱️ [Traccar Validation Timers] Total: ${totalMs}ms | Sesión: ${sessionMs}ms | Grupos: ${groupsMs}ms | Dispositivos (fallback): ${devicesMs}ms | MongoDB: ${dbMs}ms`);
        logger.info(`[CompanyService] Traccar validation timings - Total: ${totalMs}ms, Session: ${sessionMs}ms, Groups: ${groupsMs}ms, Devices: ${devicesMs}ms, DB: ${dbMs}ms`);

        return {
            valid: true,
            user: {
                id: trUser.id,
                name: trUser.name,
                email: trUser.email,
                administrator: trUser.administrator
            },
            groups,
            selectedGroup,
            devicesCount: devices.length,
            timing: {
                totalMs,
                sessionMs,
                groupsMs,
                devicesMs,
                dbMs
            }
        };
    }

    async autoFetchTraccarGroupId(gpsConfig) {
        if (!gpsConfig || !gpsConfig.user || !gpsConfig.password || gpsConfig.password === '********') return null;
        try {
            const TraccarApi = (await import('../adapters/traccar/traccarApi.js')).default;
            const traccarApi = new TraccarApi({
                host: gpsConfig.host,
                user: gpsConfig.user,
                password: gpsConfig.password
            });

            const res = await traccarApi.getGroups();
            if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                return res.data[0].id;
            }

            const devRes = await traccarApi.getDeviceList();
            if (devRes.data && Array.isArray(devRes.data) && devRes.data.length > 0) {
                const groupFromDev = devRes.data.find(d => d.groupId != null)?.groupId;
                if (groupFromDev != null) return groupFromDev;
            }
        } catch (err) {
            logger.error('[CompanyService] Failed to auto-fetch Traccar groupId via API:', err.message);
        }
        return null;
    }

    async createCompany(data) {
        if (data.nit) {
            const existing = await companyRepository.findByNit(data.nit);
            if (existing) {
                const error = new Error('Company with this NIT already exists');
                error.statusCode = 400;
                throw error;
            }
        }

        const companyData = { ...data };

        if (companyData.gpsService === 'traccar' && companyData.gpsConfig) {
            const autoGroupId = await this.autoFetchTraccarGroupId(companyData.gpsConfig);
            if (autoGroupId) {
                if (!companyData.gpsConfig) companyData.gpsConfig = {};
                companyData.gpsConfig.groupId = autoGroupId;
                companyData.traccarGroupId = autoGroupId;
            }
        }

        return await companyRepository.create(companyData);
    }

    async updateCompanySettings(companyId, updates) {
        const company = await companyRepository.findById(companyId);
        if (!company) {
            const error = new Error('Company not found');
            error.statusCode = 404;
            throw error;
        }

        // Since frontend only sends dirty fields, check if any cron-related keys are present
        const cronChanged = Boolean(
            'automaticCutOff' in updates ||
            'cutOffTime' in updates ||
            'curfew' in updates ||
            'schedules' in updates
        );

        const { gpsConfig, wompiConfig, billingConfig, contractDefaults, ...topLevelUpdates } = updates;

        Object.assign(company, topLevelUpdates);

        if (gpsConfig) {
            if (!company.gpsConfig) company.gpsConfig = {};
            Object.entries(gpsConfig).forEach(([key, val]) => {
                if (val !== undefined && val !== '********') {
                    company.gpsConfig[key] = val;
                }
            });
        }

        if (wompiConfig) {
            if (!company.wompiConfig) company.wompiConfig = {};
            Object.entries(wompiConfig).forEach(([key, val]) => {
                if (val !== undefined && val !== '********') {
                    company.wompiConfig[key] = val;
                }
            });
        }

        if (billingConfig) {
            company.billingConfig = { ...company.billingConfig, ...billingConfig };
        }

        if (contractDefaults) {
            const currentDefaults = company.contractDefaults ? company.contractDefaults.toObject?.() || company.contractDefaults : {};
            company.contractDefaults = {
                ...currentDefaults,
                ...contractDefaults,
                fixedCosts: {
                    ...(currentDefaults.fixedCosts || {}),
                    ...(contractDefaults.fixedCosts || {})
                }
            };
        }

        if (company.gpsService === 'traccar' && company.gpsConfig) {
            const autoGroupId = await this.autoFetchTraccarGroupId(company.gpsConfig);
            if (autoGroupId) {
                company.gpsConfig.groupId = autoGroupId;
                company.traccarGroupId = autoGroupId;
            } else if (company.gpsConfig.groupId) {
                company.traccarGroupId = company.gpsConfig.groupId;
            }
        }

        await companyRepository.save(company);
        this.clearCache(companyId);

        // Side effect: Notify microCronServer only if scheduled cron jobs changed
        if (cronChanged) {
            try {
                await triggerCronReload();
            } catch (cronErr) {
                logger.error(`[CompanyService] Error triggering cron reload for company ${companyId}:`, cronErr);
            }
        }

        return company;
    }

    async updateCompany(id, data, authInfo = {}) {
        const { isSuperAdmin, companyId, role, companyName } = authInfo;
        const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');

        if (!isSystemAdmin && companyId !== id) {
            const error = new Error('Not authorized to update this company');
            error.statusCode = 403;
            throw error;
        }

        const company = await companyRepository.findById(id);
        if (!company) {
            const error = new Error('Company not found');
            error.statusCode = 404;
            throw error;
        }

        if (data.nit && data.nit !== company.nit) {
            const existing = await companyRepository.findByNit(data.nit);
            if (existing) {
                const error = new Error('Company with this NIT already exists');
                error.statusCode = 400;
                throw error;
            }
        }

        if (data.name) company.name = data.name;
        if (data.nit !== undefined) company.nit = data.nit;
        if (data.address !== undefined) company.address = data.address;
        if (data.phone !== undefined) company.phone = data.phone;
        if (data.email !== undefined) company.email = data.email;
        if (typeof data.automaticInvoicing !== 'undefined') company.automaticInvoicing = data.automaticInvoicing;

        if (data.wompiConfig) {
            if (!company.wompiConfig) company.wompiConfig = {};
            if (data.wompiConfig.wompiCommission !== undefined) company.wompiConfig.wompiCommission = data.wompiConfig.wompiCommission;
            if (data.wompiConfig.paymentMethod !== undefined) company.wompiConfig.paymentMethod = data.wompiConfig.paymentMethod;
        }

        if (data.billingConfig) {
            if (!company.billingConfig) company.billingConfig = {};
            if (data.billingConfig.transactionFixedFee !== undefined) company.billingConfig.transactionFixedFee = data.billingConfig.transactionFixedFee;
            if (data.billingConfig.transactionPercentage !== undefined) company.billingConfig.transactionPercentage = data.billingConfig.transactionPercentage;
            if (data.billingConfig.ivaPercentage !== undefined) company.billingConfig.ivaPercentage = data.billingConfig.ivaPercentage;
        }

        await companyRepository.save(company);
        this.clearCache(id);
        return company;
    }

    async getAllCompanies(authInfo = {}) {
        const { isSuperAdmin, companyId, companyName, role } = authInfo;
        const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');

        let query = { isActive: true };
        if (!isSystemAdmin && companyId) {
            query._id = companyId;
        }

        return await companyRepository.find(query, 'name nit address phone email automaticInvoicing wompiConfig billingConfig _id', { name: 1 });
    }

    async getBranding(companyId = null) {
        let company;
        if (companyId) {
            company = await companyRepository.findByIdLean(companyId, 'displayName logo automaticCutOff cutOffStrategy');
        }

        if (!company) {
            company = await companyRepository.findOne({ isActive: true }, 'displayName logo automaticCutOff cutOffStrategy');
        }

        if (!company) {
            return {
                displayName: 'PocketBike',
                logo: '/pocketbike_60x60.jpg'
            };
        }

        return {
            displayName: company.displayName || 'PocketBike',
            logo: company.logo || '/pocketbike_60x60.jpg',
            automaticCutOff: company.automaticCutOff || false,
            cutOffStrategy: company.cutOffStrategy || 1
        };
    }

    async updateBranding(companyId, data) {
        const company = await companyRepository.findById(companyId);
        if (!company) {
            const error = new Error('Company not found');
            error.statusCode = 404;
            throw error;
        }

        const { displayName, logo, automaticCutOff, cutOffStrategy } = data;
        if (displayName !== undefined) company.displayName = displayName;
        if (logo !== undefined) company.logo = logo;
        if (automaticCutOff !== undefined) company.automaticCutOff = automaticCutOff;
        if (cutOffStrategy !== undefined) company.cutOffStrategy = Boolean(automaticCutOff) ? cutOffStrategy : 3;

        await companyRepository.save(company);
        this.clearCache(companyId);

        return {
            displayName: company.displayName,
            logo: company.logo,
            automaticCutOff: company.automaticCutOff,
            cutOffStrategy: company.cutOffStrategy
        };
    }

    async getCompanySettings(companyId) {
        const company = await companyRepository.findById(companyId);
        if (!company) {
            const error = new Error('Company not found');
            error.statusCode = 404;
            throw error;
        }

        const maskedData = company.toObject();
        if (maskedData.gpsConfig) {
            if (maskedData.gpsConfig.password) maskedData.gpsConfig.password = '********';
            if (maskedData.gpsConfig.token) maskedData.gpsConfig.token = '********';
        }
        if (maskedData.wompiConfig) {
            if (maskedData.wompiConfig.privateKey) maskedData.wompiConfig.privateKey = '********';
            if (maskedData.wompiConfig.integritySecret) maskedData.wompiConfig.integritySecret = '********';
            if (maskedData.wompiConfig.eventsSecret) maskedData.wompiConfig.eventsSecret = '********';
        }

        if (!maskedData.contractDefaults) {
            maskedData.contractDefaults = {};
        }
        maskedData.contractDefaults.fixedCosts = {
            gps: 500000,
            soatPosterior: 370000,
            traspasoPosterior: 273000,
            registro: 217000,
            ...(maskedData.contractDefaults.fixedCosts || {})
        };

        return {
            ...maskedData,
            availableGpsServices: Object.values(GPS_SERVICES)
        };
    }

    async getCompanyById(companyId) {
        return await companyRepository.findByIdLean(companyId);
    }

    async getCompanyPaymentMethod(companyId) {
        const company = await companyRepository.findByIdLean(companyId, 'wompiConfig.paymentMethod');
        return company?.wompiConfig?.paymentMethod ?? 'NEQUI_PUSH';
    }

    isCurfewActive(curfew, now = dayjs()) {
        if (!curfew?.enabled || !curfew.startTime || !curfew.endTime) {
            return false;
        }
        const currentTimeStr = now.format('HH:mm');
        return curfew.startTime < curfew.endTime
            ? (currentTimeStr >= curfew.startTime && currentTimeStr < curfew.endTime)
            : (currentTimeStr >= curfew.startTime || currentTimeStr < curfew.endTime);
    }

    getCutOffTargetDate(strategy, cutOffTimeStr = '23:59', now = dayjs()) {
        if (strategy === 3) {
            return null;
        }
        const currentTimeStr = now.format('HH:mm');
        if (strategy === 1) {
            return currentTimeStr < cutOffTimeStr
                ? now.subtract(1, 'day').startOf('day').toDate()
                : now.startOf('day').toDate();
        }
        return now.subtract(1, 'day').startOf('day').toDate();
    }

    isDeviceUpToDate(company, latestPaid, now = dayjs()) {
        const strategy = company?.cutOffStrategy || 1;
        if (strategy === 3) {
            return true;
        }
        if (!latestPaid) {
            return false;
        }
        const cutOffTimeStr = company?.cutOffTime || '23:59';
        const targetDate = this.getCutOffTargetDate(strategy, cutOffTimeStr, now);

        const latestPaidDate = latestPaid.date ? latestPaid.date : latestPaid;
        return dayjs(latestPaidDate).startOf('day').isSameOrAfter(dayjs(targetDate).startOf('day'));
    }

    isInvoiceDue(company, invoiceDate, now = dayjs()) {
        const strategy = company?.cutOffStrategy || 1;

        if (strategy === 3) return false;

        const invoiceDay = dayjs(invoiceDate).startOf('day');
        const todayStart = now.clone().startOf('day');

        const isBeforeToday = invoiceDay.isBefore(todayStart);
        const isToday = invoiceDay.isSame(todayStart, 'day');

        if (isBeforeToday) return true;
        if (!isToday) return false;

        if (strategy === 1) {
            const cutOffTimeStr = company?.cutOffTime || '23:59';
            const currentTimeStr = now.format('HH:mm');
            return currentTimeStr >= cutOffTimeStr;
        }

        return false;
    }

    async getWompiAdapter(companyId) {
        if (!companyId) {
            return new WompiAdapter(null);
        }

        const key = String(companyId);
        if (this.wompiAdapters.has(key)) {
            return this.wompiAdapters.get(key);
        }

        try {
            const company = await companyRepository.findByIdLean(companyId);
            const adapter = new WompiAdapter(null, company?.wompiConfig);
            this.wompiAdapters.set(key, adapter);
            logger.debug(`[CompanyService] Wompi adapter created for company: ${company?.name}`);
            return adapter;
        } catch (error) {
            logger.error(`[CompanyService] Error getting Wompi adapter for company ${companyId}:`, error);
            return new WompiAdapter(null);
        }
    }

    async getGpsAdapter(companyId) {
        if (!companyId) {
            return new GpsService({ gpsService: 'traccar' });
        }

        const key = String(companyId);
        if (this.gpsAdapters.has(key)) {
            return this.gpsAdapters.get(key);
        }

        try {
            const company = await companyRepository.findByIdLean(companyId);
            const adapter = new GpsService(company);
            const serviceType = company?.gpsService || GPS_SERVICES.TRACCAR;
            this.gpsAdapters.set(key, adapter);
            logger.debug(`[CompanyService] GPS adapter created for company ${company?.name} (${serviceType})`);
            return adapter;
        } catch (error) {
            logger.error(`[CompanyService] Error getting GPS adapter for company ${companyId}:`, error);
            return new GpsService({ gpsService: 'traccar' });
        }
    }

    async getGpsAdapterByCompany(companyId) {
        return this.getGpsAdapter(companyId);
    }

    async getGpsAdapterByCompanyId(companyId) {
        return this.getGpsAdapter(companyId);
    }
}

export default new CompanyService();
