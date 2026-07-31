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
        time: '1 0 * * *', // cada día a las 00:01
        log: 'Call one time a day payment creation',
        flag: true,
        job: 'generateDailyInvoices',
    },
    {
        name: 'dailyPaymentValidation',
        time: '55 11 * * *', // todos los días a las 11:55
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
        name: 'contractCutOffCheck',
        time: '*/5 * * * *', // every 5 minutes
        log: 'Checking and performing custom contract cutoffs',
        flag: true,
        job: 'performPollingCutOff',
    },
    {
        name: 'syncCurrentDayKm',
        time: '0 8,11,14,17,20 * * *', // 5 veces al día (08:00, 11:00, 14:00, 17:00, 20:00)
        log: 'Syncing intraday current day kilometers from GPS',
        flag: true,
        job: 'syncCurrentDayKm',
    },
    {
        name: 'syncYesterdayKm',
        time: '15 0 * * *', // cada día a las 00:15 AM
        log: 'Final midnight closing sync for yesterday kilometers from GPS',
        flag: true,
        job: 'syncYesterdayKm',
    },
];
