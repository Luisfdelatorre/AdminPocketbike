import nodeCron from "node-cron";
import { CRON_JOBS, TIMEZONE } from "../config/config.js";
import log from "../config/logger.js";
import jobs from "../services/cronJobsServices.js";
import companyRepository from "../repositories/companyRepository.js";

class Cron {
  constructor() {
    this.jobsConfig = CRON_JOBS;
    this.scheduledTasks = [];
    this.scheduledMap = new Map();
    this.scheduledDynamicJobs = new Map();  //
  }
  async init() {
    for (const task of this.jobsConfig) {
      // Static jobs schedule

      if (task.flag && jobs[task.job]) {
        const scheduled = this.scheduleTask(task, jobs[task.job]);
        this.scheduledTasks.push({ name: task.name, instance: scheduled });
        log.info(`⏰ Scheduled job: ${task.name} (${task.time})`);
      } else {
        log.warn(`⚠️ Skipping job ${task.name}: disabled or not implemented`);
      }
    }

    // Initialize dynamic Curfew + CutOff jobs per company
    try {
      await this.DynamycJobsSchedule();
    } catch (err) {
      log.error(`❌ Failed to initialize dynamic cron jobs:`, err);
    }

    log.info(`✅ ${this.scheduledTasks.length} total cron jobs initialized`);
  }

  async DynamycJobsSchedule() {
    const companies = await companyRepository.getCompaniesForDynamicCron();
    const newScheduledMap = new Map();
    for (const c of companies) {
      const id = c._id.toString();
      if (c.automaticCutOff && c.cutOffTime) {
        this._addToScheduledMap(newScheduledMap, c.cutOffTime, 'cutOff', id);
      }
      if (c.curfew?.enabled) {
        if (c.curfew.startTime) this._addToScheduledMap(newScheduledMap, c.curfew.startTime, 'curfewStart', id);
        if (c.curfew.endTime) this._addToScheduledMap(newScheduledMap, c.curfew.endTime, 'curfewEnd', id);
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
        log.info(`🛑 Job removido: ${time}`);
      }
    }

    // Create new jobs
    for (const time of newTimes) {
      if (!this.scheduledDynamicJobs.has(time)) {
        this._createScheduledJob(time);
      }
    }
  }

  _addToScheduledMap(map, time, kind, companyId) {
    if (!map.has(time)) {
      map.set(time, { cutOff: new Set(), curfewStart: new Set(), curfewEnd: new Set() });
    }
    map.get(time)[kind].add(companyId);
  }

  _createScheduledJob(time) {
    const [hh, mm] = time.split(':');
    const cronExpr = `${mm} ${hh} * * *`;

    const task = { name: `scheduled_${time}`, time: cronExpr };
    const instance = this.scheduleTask(task, () =>
      jobs.performScheduledTasks(time, () => this.scheduledMap.get(time))
    );

    this.scheduledDynamicJobs.set(time, instance);
    log.info(`⏰ Job creado: ${time}`);
  }

  async execute(jobName) {
    console.log("🚀 Executing job:", jobName);
    const task = this.jobsConfig.find((t) => t.name === jobName);
    if (task && jobs[task.job]) {
      await jobs[task.job]();
      log.info(`✅ Job executed: ${task.name}`);
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
