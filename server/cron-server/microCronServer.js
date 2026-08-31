// microcronserver.js
import dotenv from "dotenv";
dotenv.config();
import log from "../config/logger.js";
import cron from "./cron.js";
import { connectDatabase } from "../database/connection.js";
import { SystemJob } from "../models/SystemJob.js";
import { Company } from "../models/Company.js";

const initServer = async () => {
  try {
    log.info("🔄 Connecting to MongoDB...");
    await connectDatabase();

    await cron.init();
    log.info("✅ Cron jobs initialized");

    // Watch DB changes to reactively reload cron schedules across separate processes
    try {
      SystemJob.watch().on('change', () => {
        log.info("🔔 SystemJob change detected in DB. Reloading dynamic cron jobs...");
        cron.reloadAllJobs();
      });
      Company.watch().on('change', () => {
        log.info("🔔 Company schedule change detected in DB. Reloading dynamic cron jobs...");
        cron.reloadAllJobs();
      });
    } catch (csErr) {
      log.warn("⚠️ ChangeStreams not active on standalone Mongo. Using periodic sync interval.");
    }

    // Periodic sync every 30 seconds to catch changes across processes
    setInterval(() => {
      cron.reloadAllJobs();
    }, 30000);
  } catch (error) {
    // 3️⃣ Incluye stack trace para debug más útil
    log.error("❌ Error initializing cron jobs:", error.stack || error);
    // Opcionalmente: process.exit(1);
  }

  // 4️⃣ Graceful shutdown
  const shutdown = async (signal) => {
    log.info(`🛑 Received ${signal}. Shutting down gracefully...`);
    try {
      await cron.stopAll(); // 👌 correcto si implementaste stopAll() dentro de cron.js
      log.info("🧹 All cron jobs stopped cleanly.");
    } catch (err) {
      log.error("❌ Error stopping cron jobs:", err.stack || err);
    }

    // 5️⃣ Dale un poco más de margen (p. ej., 500ms) para flush de logs
    setTimeout(() => process.exit(0), 500);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // 6️⃣ (Opcional pero recomendado)
  // Captura errores no manejados para evitar que el proceso se congele o cierre sin log
  process.on("unhandledRejection", (reason) => {
    log.error("⚠️ Unhandled Promise Rejection:", reason);
  });

  process.on("uncaughtException", (err) => {
    log.error("💥 Uncaught Exception:", err);
    process.exit(1);
  });
};

initServer();

