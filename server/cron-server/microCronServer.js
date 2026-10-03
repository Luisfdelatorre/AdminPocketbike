import express from "express";
import { cronLogger as log } from "../config/logger.js";
import cron from "./cron.js";
import { connectDatabase } from "../database/connection.js";

import { performScheduledCutOff } from "./jobs/performScheduledCutOff.js";
import dayjs from "../config/dayjs.js";

const PORT = process.env.CRON_PORT || 8082;

const initServer = async () => {
  try {
    log.info("🔄 Connecting to MongoDB...");
    await connectDatabase();

    await cron.init();
    log.info("✅ Cron jobs initialized");

    const app = express();
    app.use(express.json());

    // Health check endpoint
    app.get("/health", (req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // Real-time reload endpoint called by API server when settings/jobs change
    app.post("/reload", async (req, res) => {
      try {
        log.info("🔔 Real-time HTTP reload request received on microCronServer");
        await cron.reloadAllJobs();
        res.json({ success: true, message: "Cron jobs reloaded" });
      } catch (err) {
        log.error("❌ Error reloading cron jobs via HTTP endpoint:", err);
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // Endpoint for on-demand/manual debtor engine cutoff
    app.post("/cutoff-debtors", async (req, res) => {
      try {
        const { companyId, time, forceAllDebtors = true } = req.body;
        if (!companyId) {
          return res.status(400).json({ success: false, error: "companyId is required" });
        }
        log.info(`[microCronServer] 🚫 Manual cutoff debtors request received for company: ${companyId}`);
        const result = await performScheduledCutOff(
          time || dayjs().format("HH:mm"),
          [companyId],
          { forceAllDebtors }
        );
        res.json({ success: true, ...result });
      } catch (err) {
        log.error("❌ Error executing cutoff-debtors in microCronServer:", err);
        res.status(500).json({ success: false, error: err.message });
      }
    });

    const server = app.listen(PORT, () => {
      log.info(`🚀 microCronServer HTTP listener running on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      log.info(`🛑 Received ${signal}. Shutting down gracefully...`);
      server.close();
      try {
        await cron.stopAll();
        log.info("🧹 All cron jobs stopped cleanly.");
      } catch (err) {
        log.error("❌ Error stopping cron jobs:", err.stack || err);
      }
      setTimeout(() => process.exit(0), 500);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    process.on("unhandledRejection", (reason) => {
      log.error("⚠️ Unhandled Promise Rejection:", reason);
    });

    process.on("uncaughtException", (err) => {
      log.error("💥 Uncaught Exception:", err);
      process.exit(1);
    });
  } catch (error) {
    log.error("❌ Error initializing cron server:", error.stack || error);
  }
};

initServer();
