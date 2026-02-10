
import mega from '../server/api/megaRastreoApi1.js';
import { io } from 'socket.io-client';
const BASE_URL = process.env.MEGARASTREO_BASE_URL || 'https://api.v2.megarastreo.co';
const JWT = "6810dc94-6117-443d-a47c-23e79ceabf54"; // <-- requerido

const MAX_EVENTS = Number(process.env.MEGARASTREO_WS_MAX_EVENTS || 20);
const HARD_TIMEOUT_MS = Number(process.env.MEGARASTREO_WS_TIMEOUT_MS || 90000);


async function testGetMobileList() {
    try {
        console.log('📡 Calling getMobileList...');

        const res = await getMobileList({
            $size: 12,
            $page: 1,
        });

        //console.log('✅ HTTP Status:', res.status);
        //console.log('📦 Raw data:', res.data);
        res.data.objects.forEach(element => {
            console.log(element.name, element.deviceId);
            if (element.name === 'YAG 19H') {
                console.log(element);
            }

        });


    } catch (err) {
        console.error('❌ getMobileList failed');

        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        } else {
            console.error(err.message);
        }
    }
}

async function testWebSocket() {
    if (!JWT) {
        console.error('❌ Falta MEGARASTREO_JWT_TOKEN en variables de entorno (token JWT para WS).');
        process.exit(1);
    }

    // (Opcional) Traer mobiles primero para mostrar IDs disponibles
    try {
        console.log('📡 Calling getMobileList (opcional)...');
        const res = await mega.getDeviceList({ $size: 20, $page: 1 });
        const arr = Array.isArray(res.data.objects) ? res.data.objects : [];
        console.log('🚗 Mobiles:', arr.map(m => ({ deviceId: m.deviceId, name: m.name })));
    } catch (e) {
        console.warn('⚠️ getMobileList falló (no impide probar WS).', e?.message);
    }

    console.log(`🔌 Conectando WS: ${BASE_URL}/positions`);
    const socket = io(`${BASE_URL}/positions`, {
        transports: ['websocket'],
        query: { token: JWT },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 15000,
        // path: '/api/socket' // Important for Traccar
    });

    let count = 0;

    const hardTimer = setTimeout(() => {
        console.error(`❌ Timeout: no se recibieron ${MAX_EVENTS} eventos en ${HARD_TIMEOUT_MS}ms`);
        cleanupAndExit(2);
    }, HARD_TIMEOUT_MS);

    function cleanupAndExit(code = 0) {
        clearTimeout(hardTimer);
        try { socket.disconnect(); } catch { }
        process.exit(code);
    }

    socket.on('connect', () => {
        console.log('✅ WS conectado. socket.id =', socket.id);
        console.log('➡️ Enviando setFilter {}');
        socket.emit('setFilter', {});
    });

    socket.on('disconnect', (reason) => {
        console.warn('⚠️ WS desconectado:', reason);
    });

    socket.on('connect_error', (err) => {
        console.error('❌ connect_error:', err?.message);
    });

    socket.on('error', (err) => {
        console.error('❌ socket error:', err);
    });

    socket.on('element', (pos) => {
        console.log(pos?.deviceId, pos.sensors.commandResult);
        count += 1;
        console.log('✅ Recibido evento:', pos.deviceId, pos.attributes.status, pos.attributes.blocked);
        /*if (pos.mobileId === '6982afdc97ecc874077eb57d') {
            console.log(pos);
            // 1) Command ACK
            const resultText = String(pos?.attributes?.result || '');
            const commandExecuted = (pos?.sensors?.commandResult === true) && (/success/i.test(resultText));
            let fuelCut = 'UNKNOWN';
            if (commandExecuted) {
                if (/cut off the fuel supply/i.test(resultText)) fuelCut = 'CUT';
                if (/restore fuel supply/i.test(resultText)) fuelCut = 'RESTORED';
            }
            console.log(fuelCut);
        }*/

        /* const coords = pos?.geometric?.coordinates;
         const lng = Array.isArray(coords) ? coords[0] : null;
         const lat = Array.isArray(coords) ? coords[1] : null;
 
         console.log(
             `📍 [${count}/${MAX_EVENTS}] mobileId=${pos?.mobileId} time=${pos?.deviceTime} ` +
             `ignition=${pos?.sensors?.ignition} speed(knots)=${pos?.speed} ` +
             `coords(lat,lng)=(${lat},${lng})`
         );*/

        if (count >= MAX_EVENTS) {
            console.log('✅ Recibidos los eventos requeridos. Cerrando...');
            cleanupAndExit(0);
        }
    });
}



//testGetMobileList();
testWebSocket();

//
