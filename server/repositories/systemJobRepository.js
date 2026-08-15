import { SystemJob } from '../models/SystemJob.js';

class SystemJobRepository {
    async getActiveSystemJobs() {
        return await SystemJob.find({ flag: true }).lean();
    }
}

export default new SystemJobRepository();
