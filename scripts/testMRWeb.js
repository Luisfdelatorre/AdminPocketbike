import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import * as cheerio from "cheerio";
import qs from "qs";

// ----------------------------
// Config (env)
// ----------------------------
const BASE_URL = process.env.YECI_BASE_URL || "https://yeci.online";
const USER = 'yairpacheco';
const PASS = 'cartagena.25';

if (!USER || !PASS) {
    console.error("❌ Missing env vars: YECI_USER and YECI_PASS");
    process.exit(1);
}

// ----------------------------
// Maps (adjust as you learn codes)
// ----------------------------
const PLATFORM_STATE_MAP = {
    R: "CONFIRMED",
    P: "PENDING",
    F: "FAILED",
    E: "FAILED",
};

const COMMAND_TYPE_ID_MAP = {
    1: "ENGINE_RESUME",
    2: "ENGINE_STOP",
};

function inferFuelCutLogical(commandTypeId) {
    const t = COMMAND_TYPE_ID_MAP[commandTypeId] || "UNKNOWN";
    if (t === "ENGINE_STOP") return "CUT";
    if (t === "ENGINE_RESUME") return "RESTORED";
    return "UNKNOWN";
}

function parsePlatformResponse(data) {
    const item = Array.isArray(data) ? data[0] : null;
    if (!item) return { status: "UNKNOWN", ok: false, reason: "empty_response" };

    const mapped = PLATFORM_STATE_MAP[item.estado] || "UNKNOWN";
    const confirmed = mapped === "CONFIRMED" && !!item.comando_fecha_confirmacion;

    return {
        ok: confirmed,
        status: confirmed ? "CONFIRMED" : mapped,
        id: item.id,
        plate: item.placa,
        confirmedAt: item.comando_fecha_confirmacion || null,
        retries: item.reintento ?? null,
        commandTypeId: item.comandos_equipos_id ?? null,
        stateCode: item.estado ?? null,
        text: item.texto_respuesta ?? null,
        raw: item,
    };
}
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ----------------------------
// Helpers
// ----------------------------
async function main() {
    const jar = new CookieJar();

    const http = wrapper(
        axios.create({
            baseURL: BASE_URL,
            jar,
            withCredentials: true,
            timeout: 15000,
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
            },
            validateStatus: (s) => s >= 200 && s < 400,
        })
    );

    const getCookie = async (name) => {
        const cookies = await jar.getCookies(BASE_URL);
        return cookies.find((c) => c.key === name)?.value || null;
    };

    const loginPage = await http.get("/login", { headers: { Accept: "text/html" } });
    const $login = cheerio.load(loginPage.data);
    const csrfLogin = $login('input[name="_token"]').attr("value");

    if (!csrfLogin) {
        console.error("❌ Could not find hidden _token in /login HTML");
        process.exit(2);
    }

    const loginBody = qs.stringify(
        {
            _token: csrfLogin,
            usuario: USER,
            clave: PASS,
            remember: "on",
        },
        { encode: true }
    );
    const xsrfCookie = await getCookie("XSRF-TOKEN");
    await http.post("/login", loginBody, {
        headers: {
            Accept: "application/json, text/javascript, */*; q=0.01",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            ...(xsrfCookie ? { "X-XSRF-TOKEN": xsrfCookie } : {}),
            Referer: `${BASE_URL}/login`,
            Origin: BASE_URL,
        },
    });
    const session = await getCookie("megarastreo_satelital_session");
    if (!session) {
        console.error("❌ Login did not set megarastreo_satelital_session cookie (login failed?)");
        process.exit(3);
    }

    const comandosPage = await http.get('/comandos', { headers: { Accept: 'text/html' } });
    const html = comandosPage.data;
    const $cmd = cheerio.load(html);
    let csrfComandos = $cmd('meta[name="csrf-token"]').attr('content') || null;
    const COMMAND_PAYLOAD = {
        _token: csrfComandos,
        comando_id: "2",
        vehiculos_ids: ["12778"], // will become vehiculos_ids[]=12778 with arrayFormat: 'brackets'
    };

    const cmdBody = qs.stringify(COMMAND_PAYLOAD, { arrayFormat: "brackets" });
    const xsrf2 = await getCookie("XSRF-TOKEN");
    const cmdRes = await http.post("/comandos/enviar", cmdBody, {
        headers: {
            Accept: "application/json, text/javascript, */*; q=0.01",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            ...(xsrf2 ? { "X-XSRF-TOKEN": xsrf2 } : {}),
            Referer: `${BASE_URL}/comandos`,
            Origin: BASE_URL,
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
        },
    });
    console.log("✅ Command HTTP:", cmdRes.data);

    const intervalMs = 4000;
    await sleep(intervalMs);
    const id = parseInt(cmdRes.data[0].id);
    console.log("✅ Command ID:", id);
    //const parsed = parsePlatformResponse(cmdRes.data);

    let attempt = 0;
    let lastState = null;
    const maxAttempts = 3;


    while (attempt < maxAttempts) {
        attempt++;
        console.log(`🔄 Polling attempt ${attempt}`);
        const params = new URLSearchParams();
        params.set("_token", csrfComandos);
        params.append("ids[]", id);
        const res = await http.post("/comandos/update", params.toString(), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                Referer: `${BASE_URL}/comandos`,
                Origin: BASE_URL,
                Accept: "application/json, text/javascript, */*; q=0.01",
            },
        });

        const data = res.data;
        console.log("--Response:", JSON.stringify(data));
        //lastState = currentState;
        await sleep(intervalMs);
    }

}

main()