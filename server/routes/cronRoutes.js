import express from 'express';
import jobRegistry from '../cron-server/jobRegistry.js';

const router = express.Router();

/**
 * @route GET /api/cron/available-jobs
 * @desc Retrieves all loaded plugins/jobs from the JobRegistry
 * @access Private (Admin)
 */
router.get('/available-jobs', async (req, res) => {
  try {
    await jobRegistry.loadJobs();
    const jobs = jobRegistry.getAll();
    return res.status(200).json({ success: true, count: jobs.length, data: jobs });
  } catch (error) {
    console.error('Error fetching available cron jobs:', error);
    return res.status(500).json({ success: false, error: 'Server error fetching jobs' });
  }
});

export default router;
