import "./polyfills-file.cjs";
import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import * as cheerio from "cheerio";
import qs from "qs";

const BASE_URL = process.env.YECI_BASE_URL || "https://yeci.online";
const USER = 'yairpacheco';
const PASS = 'cartagena.25';

if (!USER || !PASS) throw new Error("Missing env vars: YECI_USER / YECI_PASS");

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

let loggedIn = false;
let csrfComandos = null;

async function ensureLogin() {
    if (loggedIn && (await getCookie("megarastreo_satelital_session"))) return;

    // GET /login -> hidden _token
    const loginPage = await http.get("/login", { headers: { Accept: "text/html" } });
    const $login = cheerio.load(loginPage.data);
    const csrfLogin = $login('input[name="_token"]').attr("value");
    if (!csrfLogin) throw new Error("No _token found in /login");

    // POST /login
    const body = qs.stringify(
        { _token: csrfLogin, usuario: USER, clave: PASS, remember: "on" },
        { encode: true }
    );
    const xsrf = await getCookie("XSRF-TOKEN");

    await http.post("/login", body, {
        headers: {
            Accept: "application/json, text/javascript, */*; q=0.01",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
            Referer: `${BASE_URL}/login`,
            Origin: BASE_URL,
        },
    });

    if (!(await getCookie("megarastreo_satelital_session"))) {
        throw new Error("Login failed (no session cookie)");
    }

    // GET /comandos -> csrf meta
    const comandosPage = await http.get("/comandos", { headers: { Accept: "text/html" } });
    const $cmd = cheerio.load(comandosPage.data);
    csrfComandos = $cmd('meta[name="csrf-token"]').attr("content");
    if (!csrfComandos) throw new Error("No csrf-token found in /comandos");

    loggedIn = true;
}

class megaRastreoApiWeb {

    async fetchDevices() {
        await ensureLogin();
        const res = await http.get("/rastreo/getmoviles", {
            headers: { Accept: "application/json, text/javascript, */*; q=0.01" },
        });
        const list = Array.isArray(res.data) ? res.data : [];
        let webDevicesId = [];
        list.forEach(d => {
            webDevicesId[d.placa.replace(/\s+/g, '')] = d.id;
        });
        return webDevicesId;
    }
    // Sends ENGINE_RESUME (comando_id=1). Returns commandId (number).
    async resumeDevice(deviceId) {
        await ensureLogin();

        const payload = qs.stringify(
            { _token: csrfComandos, comando_id: "1", vehiculos_ids: [String(deviceId)] },
            { arrayFormat: "brackets" }
        );

        const xsrf = await getCookie("XSRF-TOKEN");
        const res = await http.post("/comandos/enviar", payload, {
            headers: {
                Accept: "application/json, text/javascript, */*; q=0.01",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
                Referer: `${BASE_URL}/comandos`,
                Origin: BASE_URL,
            },
        });

        // Usually array like: [{ id: "12345", estado: "P", ... }]
        const id = Number(res?.data?.[0]?.id);
        if (!id) throw new Error(`No command id returned: ${JSON.stringify(res.data)}`);
        return id;
    }

    async stopDevice(deviceId) {
        await ensureLogin();

        const payload = qs.stringify(
            { _token: csrfComandos, comando_id: "2", vehiculos_ids: [String(deviceId)] },
            { arrayFormat: "brackets" }
        );

        const xsrf = await getCookie("XSRF-TOKEN");
        const res = await http.post("/comandos/enviar", payload, {
            headers: {
                Accept: "application/json, text/javascript, */*; q=0.01",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
                Referer: `${BASE_URL}/comandos`,
                Origin: BASE_URL,
            },
        });

        // Usually array like: [{ id: "12345", estado: "P", ... }]
        const id = Number(res?.data?.[0]?.id);
        if (!id) throw new Error(`No command id returned: ${JSON.stringify(res.data)}`);
        return id;
    }

    async confirmCommand(commandId) {
        await ensureLogin();

        const params = new URLSearchParams();
        params.set("_token", csrfComandos);
        params.append("ids[]", String(commandId));

        const xsrf = await getCookie("XSRF-TOKEN");
        const res = await http.post("/comandos/update", params.toString(), {
            headers: {
                Accept: "application/json, text/javascript, */*; q=0.01",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
                Referer: `${BASE_URL}/comandos`,
                Origin: BASE_URL,
            },
        });

        const estado = res?.data?.[0]?.estado; // "R" confirmed
        return estado === "R";
    }








    // Minimal "status": returns true only if the latest command row for this vehicle shows estado "R" (confirmed).
    // NOTE: This checks command confirmation, not GPS "online".
    async checkDeviceStatus(deviceId) {
        await ensureLogin();

        const page = await http.get("/comandos", { headers: { Accept: "text/html" } });
        const $ = cheerio.load(page.data);

        let estado = null;

        $("table tbody tr").each((_, tr) => {
            const rowText = $(tr).text();
            if (!rowText.includes(String(deviceId))) return;

            // crude but usually works: find first single-letter state among known codes
            const m = rowText.match(/\b([RPEF])\b/);
            if (m) estado = m[1];
            return false; // break
        });

        return estado === "R"; // R = confirmed
    }
}

export default new megaRastreoApiWeb();
