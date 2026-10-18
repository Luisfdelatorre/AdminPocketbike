import mongoose from 'mongoose';
import { MongoDB } from '../config/components/core.js';
import { syncDailyKm } from '../cron-server/jobs/syncDailyKm.js';

async function testSync() {
    try {
        await mongoose.connect(MongoDB.URI);
        console.log('--- EJECUTANDO SINCRONIZACIÓN DIFERENCIAL DE KILOMETRAJE ---');
        const res = await syncDailyKm();
        console.log('\n=== RESULTADO DE LA EJECUCIÓN ===');
        console.log(JSON.stringify(res, null, 2));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await mongoose.disconnect();
    }
}

testSync();
