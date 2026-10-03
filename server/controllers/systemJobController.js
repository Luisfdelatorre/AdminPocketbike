import { SystemJob } from '../models/SystemJob.js';
import { triggerCronReload } from '../utils/cronClient.js';

export const getAllSystemJobs = async (req, res) => {
    try {
        const jobs = await SystemJob.find({}).sort({ createdAt: -1 });
        res.json({ success: true, data: jobs });
    } catch (error) {
        console.error('Error fetching system jobs:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch system jobs' });
    }
};

export const createSystemJob = async (req, res) => {
    try {
        const { name, job, time, flag, log } = req.body;
        const newJob = await SystemJob.create({ name, job, time, flag, log });
        
        // Recargar cron inmediatamente
        await triggerCronReload();

        res.status(201).json({ success: true, data: newJob });
    } catch (error) {
        console.error('Error creating system job:', error);
        res.status(500).json({ success: false, error: 'Failed to create system job' });
    }
};

export const updateSystemJob = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedJob = await SystemJob.findByIdAndUpdate(id, req.body, { new: true });
        
        if (!updatedJob) {
            return res.status(404).json({ success: false, error: 'System job not found' });
        }

        // Recargar cron inmediatamente
        await triggerCronReload();

        res.json({ success: true, data: updatedJob });
    } catch (error) {
        console.error('Error updating system job:', error);
        res.status(500).json({ success: false, error: 'Failed to update system job' });
    }
};

export const deleteSystemJob = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedJob = await SystemJob.findByIdAndDelete(id);
        
        if (!deletedJob) {
            return res.status(404).json({ success: false, error: 'System job not found' });
        }

        // Recargar cron inmediatamente
        await triggerCronReload();

        res.json({ success: true, data: {} });
    } catch (error) {
        console.error('Error deleting system job:', error);
        res.status(500).json({ success: false, error: 'Failed to delete system job' });
    }
};
