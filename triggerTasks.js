import jobRegistry from './server/cron-server/jobRegistry.js';
import { connectDatabase } from './server/database/connection.js';

async function runTriggers() {
    console.log('--- CONNECTING TO DB ---');
    await connectDatabase();
    
    await jobRegistry.loadJobs();

    console.log('\n--- 1. GENERATING DAILY INVOICES ---');
    const invoiceJob = jobRegistry.get('generateDailyInvoices');
    if (invoiceJob) {
        await invoiceJob.run(new Date().toISOString(), []);
    } else {
        console.error('Job no encontrado en el registro.');
    }

    console.log('\n--- DONE ---');
    process.exit(0);
}

runTriggers().catch(console.error);
