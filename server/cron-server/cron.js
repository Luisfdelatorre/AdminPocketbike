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
        this.scheduledTasks.push(scheduled);
        log.info(`⏰ Scheduled job: ${task.name} (${task.time})`);
      } else {
        log.warn(`⚠️ Skipping job ${task.name}: disabled or not implemented`);
      }
    }
    log.info(`✅ ${this.scheduledTasks.length} cron jobs initialized`);
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
        job.stop();
      } catch (err) {
        log.error("Error stopping job:", err);
      }
    }
    this.scheduledTasks = [];
    log.info("✅ All cron jobs stopped");
  }
}

export default new Cron();
