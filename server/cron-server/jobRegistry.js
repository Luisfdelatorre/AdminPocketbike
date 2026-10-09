import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cronLogger as logger } from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jobsDir = path.join(__dirname, 'jobs');

class JobRegistry {
  constructor() {
    this.jobs = new Map();
  }

  async loadJobs() {
    try {
      if (!fs.existsSync(jobsDir)) {
        fs.mkdirSync(jobsDir, { recursive: true });
      }

      const files = fs.readdirSync(jobsDir).filter(file => file.endsWith('.js'));
      this.jobs.clear();

      for (const file of files) {
        const filePath = path.join(jobsDir, file);
        const mtime = fs.statSync(filePath).mtimeMs;
        // Using file:// URL with mtime query for dynamic import hot-reloading in ES Modules
        const moduleURL = new URL(`file://${filePath}?v=${mtime}`).href;
        try {
          const module = await import(moduleURL);
          const job = module.default;
          if (job && job.id && typeof job.run === 'function') {
            this.jobs.set(job.id, job);
            if (Array.isArray(job.aliases)) {
              for (const alias of job.aliases) {
                this.jobs.set(alias, job);
              }
            }
            logger.info(`🔌 Plugin cargado: ${job.name} [${job.id}]`);
          } else {
            logger.warn(`⚠️ Archivo ${file} no exporta un plugin válido (falta id o run).`);
          }
        } catch (err) {
          logger.error(`❌ Error importando plugin ${file}:`, err);
        }
      }
    } catch (err) {
      logger.error('Error inicializando el JobRegistry:', err);
    }
  }

  get(jobId) {
    return this.jobs.get(jobId);
  }

  getAll() {
    return Array.from(this.jobs.values()).map(job => ({
      id: job.id,
      name: job.name,
      description: job.description || '',
      type: job.type || 'unknown'
    }));
  }
}

export default new JobRegistry();
