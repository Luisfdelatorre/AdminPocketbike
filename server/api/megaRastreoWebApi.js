import "./polyfills-file.js";
import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import * as cheerio from "cheerio";
import qs from "qs";

const DEFAULT_BASE_URL = process.env.YECI_BASE_URL || "https://yeci.online";

class MegaRastreoApiWeb {
    constructor(config = {}) {
        // Handle both flat config or Company model instance
        const finalConfig = config.gpsConfig || config;

        this.baseUrl = finalConfig.host || DEFAULT_BASE_URL;
        this.user = finalConfig.user || 'yairpacheco';
        this.pass = finalConfig.password || 'cartagena.25';
        this.jar = new CookieJar();
        this.http = wrapper(
            axios.create({
                baseURL: this.baseUrl,
                jar: this.jar,
                withCredentials: true,
                timeout: 15000,
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
                },
                validateStatus: (s) => s >= 200 && s < 400,
            })
        );
        this.loggedIn = false;
        this.csrfComandos = null;
    }

    async getCookie(name) {
        const cookies = await this.jar.getCookies(this.baseUrl);
        return cookies.find((c) => c.key === name)?.value || null;
    }

    async ensureLogin() {
        if (this.loggedIn && (await this.getCookie("megarastreo_satelital_session"))) return;

        if (!this.user || !this.pass) {
            throw new Error("Missing MegaRastreo credentials (User/Pass)");
        }

        // GET /login -> hidden _token
        const loginPage = await this.http.get("/login", { headers: { Accept: "text/html" } });
        const $login = cheerio.load(loginPage.data);
        const csrfLogin = $login('input[name="_token"]').attr("value");
        if (!csrfLogin) throw new Error("No _token found in /login");

        // POST /login
        const body = qs.stringify(
            { _token: csrfLogin, usuario: this.user, clave: this.pass, remember: "on" },
            { encode: true }
        );
        const xsrf = await this.getCookie("XSRF-TOKEN");

        await this.http.post("/login", body, {
            headers: {
                Accept: "application/json, text/javascript, */*; q=0.01",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
                Referer: `${this.baseUrl}/login`,
                Origin: this.baseUrl,
            },
        });

        if (!(await this.getCookie("megarastreo_satelital_session"))) {
            throw new Error("Login failed (no session cookie)");
        }

        // GET /comandos -> csrf meta
        const comandosPage = await this.http.get("/comandos", { headers: { Accept: "text/html" } });
        const $cmd = cheerio.load(comandosPage.data);
        this.csrfComandos = $cmd('meta[name="csrf-token"]').attr("content");
        if (!this.csrfComandos) throw new Error("No csrf-token found in /comandos");

        this.loggedIn = true;
    }

    async fetchDevices() {
        await this.ensureLogin();
        const res = await this.http.get("/rastreo/getmoviles", {
            headers: { Accept: "application/json, text/javascript, */*; q=0.01" },
        });
        return Array.isArray(res.data) ? res.data : [];
    }

    async resumeDevice(deviceId) {
        await this.ensureLogin();

        const payload = qs.stringify(
            { _token: this.csrfComandos, comando_id: "1", vehiculos_ids: [String(deviceId)] },
            { arrayFormat: "brackets" }
        );

        const xsrf = await this.getCookie("XSRF-TOKEN");
        const res = await this.http.post("/comandos/enviar", payload, {
            headers: {
                Accept: "application/json, text/javascript, */*; q=0.01",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
                Referer: `${this.baseUrl}/comandos`,
                Origin: this.baseUrl,
            },
        });

        const id = Number(res?.data?.[0]?.id);
        if (!id) throw new Error(`No command id returned: ${JSON.stringify(res.data)}`);
        return id;
    }

    async stopDevice(deviceId) {
        await this.ensureLogin();

        const payload = qs.stringify(
            { _token: this.csrfComandos, comando_id: "2", vehiculos_ids: [String(deviceId)] },
            { arrayFormat: "brackets" }
        );

        const xsrf = await this.getCookie("XSRF-TOKEN");
        const res = await this.http.post("/comandos/enviar", payload, {
            headers: {
                Accept: "application/json, text/javascript, */*; q=0.01",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
                Referer: `${this.baseUrl}/comandos`,
                Origin: this.baseUrl,
            },
        });

        const id = Number(res?.data?.[0]?.id);
        if (!id) throw new Error(`No command id returned: ${JSON.stringify(res.data)}`);
        return id;
    }

    async confirmCommand(commandId) {
        await this.ensureLogin();

        const params = new URLSearchParams();
        params.set("_token", this.csrfComandos);
        params.append("ids[]", String(commandId));

        const xsrf = await this.getCookie("XSRF-TOKEN");
        const res = await this.http.post("/comandos/update", params.toString(), {
            headers: {
                Accept: "application/json, text/javascript, */*; q=0.01",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
                Referer: `${this.baseUrl}/comandos`,
                Origin: this.baseUrl,
            },
        });

        const estado = res?.data?.[0]?.estado;
        return estado === "R";
    }

    async checkDeviceStatus(deviceId) {
        await this.ensureLogin();

        const page = await this.http.get("/comandos", { headers: { Accept: "text/html" } });
        const $ = cheerio.load(page.data);

        let estado = null;

        $("table tbody tr").each((_, tr) => {
            const rowText = $(tr).text();
            if (!rowText.includes(String(deviceId))) return;

            const m = rowText.match(/\b([RPEF])\b/);
            if (m) estado = m[1];
            return false; // break
        });

        return estado === "R";
    }
}

export default MegaRastreoApiWeb;
