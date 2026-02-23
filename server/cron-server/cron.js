import nodeCron from "node-cron";
import { CRON_JOBS, TIMEZONE } from "../config/config.js";
import log from "../config/logger.js";
import jobs from "../services/cronJobsServices.js";


class Cron {
  constructor() {
    this.jobsConfig = CRON_JOBS;
    this.scheduledTasks = [];
  }
  async init() {
    for (const task of this.jobsConfig) {
      if (task.flag && jobs[task.job]) {
        const scheduled = this.scheduleTask(task, jobs[task.job]);
        this.scheduledTasks.push({ name: task.name, instance: scheduled });
        log.info(`⏰ Scheduled job: ${task.name} (${task.time})`);
      } else {
        log.warn(`⚠️ Skipping job ${task.name}: disabled or not implemented`);
      }
    }

    // Initialize dynamic Curfew jobs
    try {
      const { Company } = await import('../models/Company.js');
      const companiesWithCurfew = await Company.find({ 'curfew.enabled': true }).lean();
      for (const company of companiesWithCurfew) {
        this.scheduleCompanyCurfew(company);
      }
      log.info(`✅ Initialized curfews for ${companiesWithCurfew.length} companies`);
    } catch (err) {
      log.error(`❌ Failed to initialize dynamic curfews:`, err);
    }

    log.info(`✅ ${this.scheduledTasks.length} total cron jobs initialized`);
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

  // Dynamically schedule or remove a company's curfew jobs
  scheduleCompanyCurfew(company) {
    const startJobName = `curfewStart_${company._id}`;
    const endJobName = `curfewEnd_${company._id}`;

    // 1. Remove existing jobs for this company if they exist
    this.scheduledTasks = this.scheduledTasks.filter(job => {
      if (job.name === startJobName || job.name === endJobName) {
        job.instance.stop();
        log.info(`🛑 Stopped existing curfew job: ${job.name}`);
        return false;
      }
      return true;
    });

    // 2. Schedule new jobs if curfew is enabled
    if (company.curfew?.enabled) {
      const { startTime, endTime } = company.curfew;

      // Parse HH:mm to cron syntax "mm HH * * *"
      const [startHH, startMM] = startTime.split(':');
      const startCronOpts = `${startMM} ${startHH} * * *`;

      const [endHH, endMM] = endTime.split(':');
      const endCronOpts = `${endMM} ${endHH} * * *`;

      const startTask = { name: startJobName, time: startCronOpts };
      const endTask = { name: endJobName, time: endCronOpts };

      if (jobs.performCurfewStart && jobs.performCurfewEnd) {
        const startJobInstance = this.scheduleTask(startTask, () => jobs.performCurfewStart(company._id));
        this.scheduledTasks.push({ name: startJobName, instance: startJobInstance });
        log.info(`⏰ Scheduled dynamic job: ${startJobName} (${startCronOpts})`);

        const endJobInstance = this.scheduleTask(endTask, () => jobs.performCurfewEnd(company._id));
        this.scheduledTasks.push({ name: endJobName, instance: endJobInstance });
        log.info(`⏰ Scheduled dynamic job: ${endJobName} (${endCronOpts})`);
      } else {
        log.error(`❌ Curfew functions missing in jobs service`);
      }
    }
  }
}

export default new Cron();
