import nodeCron from "node-cron";
import { CRON_JOBS, TIMEZONE } from "../config/config.js";
import log from "../config/logger.js";
import companyRepository from "../repositories/companyRepository.js";
import systemJobRepository from "../repositories/systemJobRepository.js";
import jobRegistry from "./jobRegistry.js";

const formatHumanCron = (cronExpr) => {
  if (!cronExpr) return '';
  if (cronExpr === '*/5 * * * *') return 'Cada 5 minutos';
  if (cronExpr === '*/15 * * * *') return 'Cada 15 minutos';
  if (cronExpr === '0,30 * * * *' || cronExpr === '*/30 * * * *') return 'Cada 30 minutos';
  if (cronExpr === '0 * * * *') return 'Cada hora';
  
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length === 5 && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
    const mm = parts[0].padStart(2, '0');
    const hh = parseInt(parts[1], 10);
    if (!isNaN(hh)) {
      const ampm = hh >= 12 ? 'PM' : 'AM';
      const displayHh = (hh % 12 || 12).toString().padStart(2, '0');
      return `Todos los días a las ${displayHh}:${mm} ${ampm}`;
    }
  }
  return cronExpr;
};

class Cron {
  constructor() {
    this.jobsConfig = CRON_JOBS;
    this.scheduledTasks = [];
    this.scheduledMap = new Map();
    this.scheduledDynamicJobs = new Map();  //
  }
  async init() {
    try {
      await jobRegistry.loadJobs();
      await this.reloadAllJobs();
    } catch (err) {
      log.error(`❌ Failed to initialize dynamic cron jobs:`, err);
    }
  }

  async reloadAllJobs() {
    log.info("🔄 Reloading all dynamic cron jobs...");
    await jobRegistry.loadJobs();
    const companies = await companyRepository.getCompaniesForDynamicCron();
    const systemJobs = await systemJobRepository.getActiveSystemJobs();

    const newScheduledMap = new Map();

    // Add global system jobs
    for (const sysJob of systemJobs) {
      this._addToScheduledMap(newScheduledMap, sysJob.time, 'system', sysJob);
    }
    for (const c of companies) {
      const id = c._id.toString();
      
      // Legacy schedules
      if (c.automaticCutOff && c.cutOffTime) {
        this._addToScheduledMap(newScheduledMap, c.cutOffTime, 'performScheduledCutOff', id);
      }
      if (c.curfew?.enabled) {
        if (c.curfew.startTime) this._addToScheduledMap(newScheduledMap, c.curfew.startTime, 'performCurfewStart', id);
        if (c.curfew.endTime) this._addToScheduledMap(newScheduledMap, c.curfew.endTime, 'performCurfewEnd', id);
      }
      
      // New unified schedules
      if (c.schedules && Array.isArray(c.schedules)) {
        for (const s of c.schedules) {
          if (s.enabled && s.time && s.action) {
            this._addToScheduledMap(newScheduledMap, s.time, s.action, id);
          }
        }
      }
    }

    const oldTimes = new Set(this.scheduledMap.keys());
    const newTimes = new Set(newScheduledMap.keys());

    // Atomic replacement to prevent race conditions
    this.scheduledMap = newScheduledMap;

    // Remove obsolete jobs
    for (const time of oldTimes) {
      if (!newTimes.has(time)) {
        this.scheduledDynamicJobs.get(time)?.stop();
        this.scheduledDynamicJobs.delete(time);
        const humanTime = formatHumanCron(time);
        log.info(`🛑 Job removido: ${time} (${humanTime})`);
      }
    }

    // Create new jobs
    for (const time of newTimes) {
      if (!this.scheduledDynamicJobs.has(time)) {
        this._createScheduledJob(time);
      }
    }

    log.info(`✅ Dynamic cron jobs reloaded (${this.scheduledDynamicJobs.size} active schedules)`);
  }

  _timeToCronExpr(timeStr) {
    if (timeStr.includes(':')) {
      const [hh, mm] = timeStr.split(':');
      return `${mm} ${hh} * * *`;
    }
    return timeStr; // Already a cron expression
  }

  _addToScheduledMap(map, timeStr, kind, entity) {
    const cronExpr = this._timeToCronExpr(timeStr);

    if (!map.has(cronExpr)) {
      map.set(cronExpr, { systemJobs: new Set(), companyActions: new Map() });
    }
    
    if (kind === 'system') {
      map.get(cronExpr).systemJobs.add(entity);
    } else {
      const companyActions = map.get(cronExpr).companyActions;
      if (!companyActions.has(kind)) {
        companyActions.set(kind, new Set());
      }
      companyActions.get(kind).add(entity);
    }
  }

  _createScheduledJob(cronExpr) {
    const entry = this.scheduledMap.get(cronExpr);
    const jobNames = [];
    if (entry) {
      if (entry.systemJobs && entry.systemJobs.size > 0) {
        for (const sysJob of entry.systemJobs) {
          jobNames.push(`Sistema: ${sysJob.name || sysJob.job}`);
        }
      }
      if (entry.companyActions && entry.companyActions.size > 0) {
        for (const [action, idsSet] of entry.companyActions.entries()) {
          jobNames.push(`Empresas (${idsSet.size}): ${action}`);
        }
      }
    }
    const description = jobNames.length > 0 ? ` [${jobNames.join(', ')}]` : '';
    const task = { name: `scheduled_${cronExpr}`, time: cronExpr };
    const instance = this.scheduleTask(task, async () => {
      const entry = this.scheduledMap.get(cronExpr);
      if (!entry) return;

      // Execute system jobs
      if (entry.systemJobs && entry.systemJobs.size > 0) {
        for (const sysJob of entry.systemJobs) {
          log.info(`⚙️ Executing system job: ${sysJob.name}`);
          try {
            const plugin = jobRegistry.get(sysJob.job);
            if (plugin && typeof plugin.run === 'function') {
               await plugin.run(cronExpr, []);
            } else {
               log.warn(`⚠️ System job handler not found for: ${sysJob.job}`);
            }
          } catch (err) {
            log.error(`❌ Error executing system job ${sysJob.name}:`, err);
          }
        }
      }

      // Execute company actions
      if (entry.companyActions && entry.companyActions.size > 0) {
        for (const [action, idsSet] of entry.companyActions.entries()) {
          const ids = [...idsSet];
          if (!ids.length) continue;
          try {
            const plugin = jobRegistry.get(action);
            if (plugin && typeof plugin.run === 'function') {
              await plugin.run(cronExpr, ids);
            } else {
              log.warn(`⚠️ No handler found for company action: ${action}`);
            }
          } catch (err) {
            log.error(`❌ Error executing company action ${action} at ${cronExpr}:`, err);
          }
        }
      }
    });

    const humanTime = formatHumanCron(cronExpr);
    this.scheduledDynamicJobs.set(cronExpr, instance);
    log.info(`⏰ Job creado: ${cronExpr} (${humanTime})${description}`);
  }

  async execute(jobName) {
    console.log("🚀 Executing job:", jobName);
    const plugin = jobRegistry.get(jobName);
    if (plugin && typeof plugin.run === 'function') {
      await plugin.run(new Date().toISOString(), []);
      log.info(`✅ Job executed: ${jobName}`);
    } else {
      log.warn(`⚠️ Job not found or not implemented: ${jobName}`);
    }
  }
  scheduleTask(task, callback) {
    const job = nodeCron.schedule(
      task.time,
      async () => {
        try {
          log.info(`▶️ Running job: ${task.name}`);
          await callback();
          log.info(`✅ Job completed: ${task.name}`);
        } catch (err) {
          log.error(`❌ Error running job ${task.name}:`, err);
        }
      },
      {
        scheduled: true,
        timezone: TIMEZONE,
      }
    );

    return job;
  }

  async stopAll() {
    log.info("🛑 Stopping all cron jobs...");
    for (const job of this.scheduledTasks) {
      try {
        job.instance.stop();
      } catch (err) {
        log.error("Error stopping job:", err);
      }
    }
    this.scheduledTasks = [];
    log.info("✅ All cron jobs stopped");
  }
}

export default new Cron();
