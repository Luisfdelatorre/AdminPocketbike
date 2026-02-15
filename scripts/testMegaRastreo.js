
import mega from '../server/api/megaRastreoApi1.js';
import { io } from 'socket.io-client';
import https from "https";
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




    socket.on('connect', () => {
        console.log('✅ WS conectado. socket.id =', socket.id);
        console.log('➡️ Enviando setFilter {}');
        socket.emit('setFilter', {});
    });

    socket.on('disconnect', (reason) => {
        console.warn('⚠️ WS desconectado:', reason);
    });

    socket.io.on("reconnect", (attempt) => {
        console.log("✅ reconnected after attempts:", attempt);
        socket.emit('setFilter', {});
        console.log("➡️ setFilter sent");
    });
    socket.on('connect_error', (err) => {
        console.error('❌ connect_error:', err?.message);
    });

    socket.on('error', (err) => {
        console.error('❌ socket error:', err);
    });
    /*socket.on('trama', (pos) => {
        console.log(pos?.deviceId, pos.sensors.commandResult);

        console.log(pos);



    });*/
    socket.on('element', (pos) => {
        console.log(pos);
        console.log(pos?.deviceId, pos.sensors.commandResult);
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


    });
}

async function testCommand() {

    const IMEIS = [
        "865468052313783",
        "865468052315432",
        "865468052316042",
        "865468052312744",
        "865468052315382",
        "865468052312942",
        "865468052321406",
        "865468052312223",
        "865468052309773",
        "865468052322925",
        "865468052307678",
        "865468052306902",
    ];
    // scripts/testMegaRastreo.js

    const HOST = "s1.megarastreo.co";
    const PORT = 8443;
    const NAMESPACE = "/position";
    const URL = `https://${HOST}:${PORT}${NAMESPACE}`;


    const agent = new https.Agent({
        //rejectUnauthorized: false, // dev/test only
        servername: HOST,          // helps SNI
    });

    const socket = io(URL, {
        agent,
        secure: true,
        rejectUnauthorized: false, // ✅ THIS is the one your debug showed as true before
        path: "/socket.io",        // try "/socket.io" (without trailing slash)
        upgrade: true,
        reconnection: true,
        reconnectionDelayMax: 10000,
    });

    socket.on("connect", () => {
        console.log("✅ connected:", socket.id);
        socket.emit("login_client", IMEIS);
        console.log("➡️ login_client sent");
    });

    socket.on("trama", (track) => {
        console.log("📩 trama:", track);
    });

    socket.on("connect_error", (err) => {
        console.log("⚠️ connect_error:", err?.message || err);
    });
    socket.io.on("reconnect", (attempt) => {
        console.log("✅ reconnected after attempts:", attempt);
        socket.emit("login_client", IMEIS);
        console.log("➡️ login_client sent");
    });

    socket.on("disconnect", (reason) => {
        console.log("❌ disconnected:", reason);
    });

}

//testCommand();
//
//testCommand()
testWebSocket()