export const SCHEDULE = {
    MORNING: '0 8 * * *', // 8:00 AM every day
    NIGHT: '0 20 * * *', // 8:00 PM every day
    DELAY: 30, // 30 minutes delay
};

export const CRON_JOBS = [
    {
        name: 'textMessage',
        time: '0 9 * * *', // cada día a las 9:00
        log: 'Call Message at 9',
        flag: false, // activar/desactivar
        job: 'sendTextMessage',
    },
    {
        name: 'dailyInvoicesCreation',
        time: '30 22 * * *', // cada día a las 22:30
        log: 'Call one time a day payment creation',
        flag: true,
        job: 'generateDailyInvoices',
    },
    {
        name: 'dailyPaymentValidation',
        time: '0 0 * * *', // todos los días a las 00:00
        log: 'Call one time a day payment validation',
        flag: true, // activado
        job: 'validatePayments',
    },
    {
        name: 'periodicDeviceStatusReview',
        time: '0,30 * * * *', // cada 30 minutos
        log: 'Call Device Status Review every 30 minutes',
        flag: false,
        job: 'DeviceStatusUpdate',
    },
    {
        name: 'dailyCutOff',
        time: '59 23 * * *', // cada día a las 23:59
        log: 'Automatic engine stop for unpaid invoices',
        flag: true,
        job: 'performDailyCutOff',
    },
];
