const ServerApi = 'https://pocketbike.app/api';
const WompiBaseUrl = 'https://sandbox.wompi.co/v1' //'https://production.wompi.co/v1' //process.env.WOMPI_BASE_URL ||
const WOMPI_SECRET = 'prv_test_E2443SePLpRXhM2sZ3ckIlBLG0zryq0Y' //'prv_prod_LbjaEDeBegEqUXHEvKkHImhxatgraWBz' //Llave privada process.env.WOMPI_SECRET ||
const MEGARASTREO_AUTH_TOKEN = "6810dc94-6117-443d-a47c-23e79ceabf54"
export const Login = {
    Wompi: {
        secretIntegrity: 'test_integrity_fw9MVl5LVMfN7ghi4YKX6TCoJPwp6TBZ',//Integridad
        publicKey: 'pub_test_ynMRzdEmjsWyVcwgQ3YpG3v371joDs5x',//llave publica 'pub_test_ynMRzdEmjsWyVcwgQ3YpG3v371joDs5x',//
        privateKey: WOMPI_SECRET,
        privateKeyEvents: 'test_events_5iTO7kZHuLzAKn7p2YPZArEhoJ0S9Yj7', //'prod_events_TpPLiX3mc0PxEzquqhT5t2WaSZeaDzer',//Eventos
        AUTH: {
            Authorization: `Bearer pub_test_ynMRzdEmjsWyVcwgQ3YpG3v371joDs5x`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        pendingMinutes: 3,  // Configuración de minutos para la verificación de pagos pendientes    
    },
    Nequi: {
        selector: 'form',
        emailType: 'input[type="email"]',
        button: 'button.green-button',
        waitUntil: 'networkidle2',
        passwordType: 'input[type="password',
        acounts: [
            {
                email: 'poketbikepagos',
                password: 'Medalla6571',
            },
            {
                email: 'lutoqui',
                password: 'Medalla6571',
            },
        ],
    },
    Traccar: {
        email: 'admin',
        password: 'Medalla6571*',
    },
    MEGARASTREO: {
        jwtToken: MEGARASTREO_AUTH_TOKEN,
    },
    Itcloud: {
        user: 'luis.delatorre0277@gmail.com',
        password: '123EoKuvYy',
    },
    Hablame: {
        user: 'luis.delatorre0277@gmail.com',
        account_id: 10016115,
        api_key: 'W7H4gqhGG1Euca6CokXO12lM2I8y2k',
        token: '63d7a2c2ff294943cabc51d87bb93ac4',
    },
};

export const Url = {
    Base: ServerApi, // Remove trailing slash: 'https://pocketbike.app/api'
    NequiCobros: 'https://cobros.nequi.co',
    NequiHistory: 'https://cobros.nequi.co/historial',
    NequiLogin: 'https://negocios.nequi.co/login',
    Firebase: 'https://simplebikego-default-rtdb.firebaseio.com',
    ItclousSend: 'https://sistemasmasivos.com/itcloud/api/sendsms/send.php',
    HablameSend: 'https://api103.hablame.co/api/sms/v3/send/priority',
    WompiBaseUrlSandbox: 'https://production.wompi.co/v1',
    WompiBaseUrl: 'https://sandbox.wompi.co/v1',
    MegarastreoBase: 'https://api.v2.megarastreo.co',
    redirectUrl: 'https://pocketbike.app/apinode/',
    Transactions: WompiBaseUrl + '/transactions',
    Devices: ServerApi + 'devices/',
    Positions: ServerApi + 'positions/',
    Atrributes: ServerApi + 'attributes/computed',
    Kms: ServerApi + 'reports/summary',
    Command: ServerApi + 'commands/send',
    CommandList: ServerApi + 'commands',
    Session: ServerApi + 'session',
    Socket: 'ws://198.74.54.252/api/socket',
    Payments: 'getdaysales',
};

export const Header = {
    POST: {
        Authorization:
            'Basic ' + Buffer.from('admin:Medalla6571*').toString('base64'),
        Accept: 'application/json',
        'Content-Type': 'application/json',
    },
    GET: {
        Authorization:
            'Basic ' + Buffer.from('admin:Medalla6571*').toString('base64'),
    },
    AUTH: {
        Authorization:
            'Basic ' + Buffer.from('admin:Medalla6571*').toString('base64'),
    },
    FORM: {
        accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
    },
    MEGARASTREO: {
        auth_token: MEGARASTREO_AUTH_TOKEN,
    }

};
