import mongoose from 'mongoose';
import 'dotenv/config'; 
import { connectDatabase } from '../database/connection.js';
import deviceServices from '../services/deviceServices.js';
import { Device } from '../models/Device.js';

async function run() {
    console.log('🔌 Conectando a MongoDB...');
    await connectDatabase();

    try {
        const deviceIdName = process.argv[2] || '85609098'; // Fallback to the device that threw NullPointerException
        const commandArg = process.argv[3] || '0'; 

        // 85609098 is passed as `_id` in the API, wait, is it `_id` or just a string `id`?
        // Let's search by string ID or numeric ID. The user's log says "device 85609098", which is likely the `deviceId` field numerically, or `_id`.
        // Let's try both. Also cast _id to Number since it's a Mixed type.
        const numericId = !isNaN(Number(deviceIdName)) ? Number(deviceIdName) : null;
        const query = [{ _id: deviceIdName }, { deviceId: deviceIdName }];
        if (numericId) {
            query.push({ _id: numericId });
            query.push({ deviceId: numericId });
        }
        const device = await Device.findOne({ $or: query }); 
        if (!device) {
            throw new Error(`Device ${deviceIdName} not found`);
        }
        let targetId = device._id.toString();
        let companyId = device.companyId.toString();

        console.log(`\n--- SIMULANDO LLAMADA AL CONTROLADOR ---`);
        console.log(`Device ID interno: ${targetId} (GPS ID: ${device.gpsId})`);
        console.log(`Company ID: ${companyId}`);
        console.log(`Comando: ${commandArg}`);

        const deviceController = await import('../controllers/deviceController.js');

        console.log('\n--- SIMULANDO PETICIÓN HTTP AL CONTROLADOR ---');
        console.log(`URL: POST /apinode/devices/${targetId}/engine`);
        
        const req = {
            params: { id: targetId },
            auth: { companyId: companyId },
            body: { command: Number(commandArg) }
        };

        const res = {
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                console.log(`\n=== RESPUESTA HTTP (Status: ${this.statusCode || 200}) ===`);
                console.log(JSON.stringify(data, null, 2));
            }
        };

        console.log('Llamando a deviceController.default.controlEngine(req, res)...');
        await deviceController.default.controlEngine(req, res);

    } catch (error) {
        console.error('Error en el test:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

run();
