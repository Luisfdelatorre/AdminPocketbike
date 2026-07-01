import mongoose from 'mongoose';
import 'dotenv/config'; 
import { connectDatabase } from '../database/connection.js';
import MyTraccar from '../adapters/traccar/traccarAdapter.js';
import { ENGINE_COMMANDS, ENGINESTOP, ENGINERESUME } from '../config/config.js';

async function run() {
    console.log('🔌 Conectando a MongoDB...');
    await connectDatabase();

    try {
        const traccar = new MyTraccar({}); // Usa configuración por defecto (Url.Traccar y Login.Traccar)
        const deviceId = process.argv[2] || 50; 
        const commandArg = process.argv[3] || 'stop'; 

        console.log(`\n--- TEST DE COMANDO PARA TRACCAR ---`);
        console.log(`Dispositivo GPS ID: ${deviceId}`);
        console.log(`Comando: ${commandArg.toUpperCase()}`);

        console.log(`\n[1] Estado actual del dispositivo (getPositions)...`);
        const positions = await traccar._api.getPositions({ deviceId });
        if (positions.data && positions.data.length > 0) {
            const lastPos = positions.data[positions.data.length - 1];
            console.log('Última posición (attributes):', lastPos.attributes);
        } else {
            console.log('No hay posiciones para este dispositivo.');
        }

        console.log(`\n[2] Probando checkDeviceStatus interno...`);
        const statusBefore = await traccar.checkDeviceStatus(deviceId);
        console.log('checkDeviceStatus retornó:', statusBefore);

        // Añadimos un interceptor temporal para ver LA LLAMADA COMPLETA EXACTA
        traccar._api.axiosInstance.interceptors.request.use(request => {
            if (request.url.includes('commands/send')) {
                console.log('\n--- 🔍 DETALLE DE LA PETICIÓN HTTP EXACTA A TRACCAR ---');
                console.log(`METODO: ${request.method.toUpperCase()}`);
                console.log(`URL: ${request.baseURL}/${request.url}`);
                console.log('HEADERS:', JSON.stringify(request.headers, null, 2));
                console.log('BODY:', JSON.stringify(request.data, null, 2));
                console.log('------------------------------------------------------\n');
            }
            return request;
        });

        console.log(`\n[3] Enviando comando de ${commandArg}...`);
        const isStop = commandArg.toLowerCase() === 'stop';
        
        let sendResult;
        try {
            if (isStop) {
                sendResult = await traccar.stopDevice(deviceId);
            } else {
                sendResult = await traccar.resumeDevice(deviceId);
            }
            console.log('Resultado de _sendCommand:', sendResult);
        } catch (err) {
            console.error('Error al enviar comando:', err.message);
            if (err.response) {
                console.error('Data:', err.response.data);
            }
        }

        console.log(`\n[4] Esperando unos segundos para ver si el dispositivo actualiza su estado...`);
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log(`\n[5] Estado final del dispositivo...`);
        const statusAfter = await traccar.checkDeviceStatus(deviceId);
        console.log('checkDeviceStatus final:', statusAfter);
        
        const finalPositions = await traccar._api.getPositions({ deviceId });
        if (finalPositions.data && finalPositions.data.length > 0) {
            const finalPos = finalPositions.data[finalPositions.data.length - 1];
            console.log('Última posición final (attributes):', finalPos.attributes);
        }

    } catch (error) {
        console.error('Error en el test:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

run();
