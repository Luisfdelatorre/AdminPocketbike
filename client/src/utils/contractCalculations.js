/**
 * Utilidades de cálculo financiero para Contratos PocketBike
 */

/**
 * Calcula el desglose financiero del contrato y el precio base del vehículo
 * a partir de la tarifa diaria, días de contrato, gastos fijos y cuota inicial.
 *
 * @param {Object} params
 * @param {number} params.dailyRate Tarifa diaria en COP
 * @param {number} params.contractDays Días totales de contrato
 * @param {number} params.gastos Gastos fijos (GPS, SOAT post, traspaso, registro)
 * @param {number} params.initialFee Cuota inicial en COP
 * @param {number} [params.iva=0.19] Tasa de IVA (ej. 0.19)
 * @param {number} [params.objetivoEA=0.29] Tasa objetivo Efectiva Anual (29%)
 * @param {number} [params.pagosPorAnio=312] Pagos anuales considerados
 * @param {number} [params.proporcionUPAY=0.95] Proporción de capital UPAY (95%)
 * @returns {Object} Desglose financiero completo
 */
export function calcularPrecioMoto({
    dailyRate = 35000,
    contractDays = 400,
    gastos = 1360000,
    initialFee = 500000,
    iva = 0.19,
    objetivoEA = 0.29,
    pagosPorAnio = 312,
    proporcionUPAY = 0.95
} = {}) {
    const inputs = [
        dailyRate, contractDays, gastos, initialFee,
        iva, objetivoEA, pagosPorAnio, proporcionUPAY
    ];

    if (!inputs.every(Number.isFinite)) {
        throw new Error('Todos los parámetros deben ser números finitos.');
    }

    if (
        dailyRate <= 0 ||
        !Number.isInteger(contractDays) ||
        contractDays <= 0 ||
        gastos < 0 ||
        initialFee < 0 ||
        initialFee > gastos ||
        iva < 0 ||
        objetivoEA < 0 ||
        pagosPorAnio <= 0 ||
        proporcionUPAY <= 0 ||
        proporcionUPAY >= 1
    ) {
        throw new Error('Parámetros fuera de rango.');
    }

    const cuotaFinanciera = dailyRate / 2;
    const cuotaCloud = dailyRate / 2;
    const proporcionPocketBike = 1 - proporcionUPAY;

    // Tasa por período equivalente a la E.A. objetivo.
    const tasaPeriodo = Math.expm1(
        Math.log1p(objetivoEA) / pagosPorAnio
    );

    const descuentoFinal = Math.exp(
        -contractDays * Math.log1p(tasaPeriodo)
    );

    const valorPresenteCuotas = tasaPeriodo === 0
        ? cuotaFinanciera * contractDays
        : cuotaFinanciera * (1 - descuentoFinal) / tasaPeriodo;

    // Capital UPAY + valor presente de la transferencia PocketBike
    // = valor presente de las cuotas financieras.
    const saldoFinanciableObjetivo = valorPresenteCuotas / (
        proporcionUPAY + proporcionPocketBike * descuentoFinal
    );

    const precioExacto = (
        saldoFinanciableObjetivo - gastos + initialFee
    ) / (1 + iva);

    // Precio mínimo entero en COP.
    const precioAntesIVA = Math.max(0, Math.ceil(precioExacto));
    const valorIVA = precioAntesIVA * iva;
    const totalOperacion = precioAntesIVA + valorIVA + gastos;
    const saldoFinanciable = totalOperacion - initialFee;
    const capitalUPAY = saldoFinanciable * proporcionUPAY;
    const saldoPocketBike = saldoFinanciable * proporcionPocketBike;
    const totalFinanciero = cuotaFinanciera * contractDays;

    // Recalcula la TIR del precio redondeado:
    // -capitalUPAY, 400 cuotas, menos PocketBike en la última.
    const valorPresenteNeto = tasa => {
        const logTasa = Math.log1p(tasa);
        let total = 0;

        for (let i = 1; i <= contractDays; i++) {
            total += cuotaFinanciera * Math.exp(-i * logTasa);
        }

        return total -
            saldoPocketBike * Math.exp(-contractDays * logTasa);
    };

    let tirPeriodo = null;

    if (valorPresenteNeto(0) >= capitalUPAY) {
        let inferior = 0;
        let superior = Math.max(tasaPeriodo, 0.001);

        while (valorPresenteNeto(superior) > capitalUPAY) {
            superior *= 2;
            if (!Number.isFinite(superior)) {
                throw new Error('No se pudo calcular la TIR.');
            }
        }

        for (let i = 0; i < 100; i++) {
            const media = (inferior + superior) / 2;

            if (valorPresenteNeto(media) > capitalUPAY) {
                inferior = media;
            } else {
                superior = media;
            }
        }

        tirPeriodo = (inferior + superior) / 2;
    }

    const eaCalculada = tirPeriodo === null
        ? null
        : Math.expm1(pagosPorAnio * Math.log1p(tirPeriodo));

    return {
        precioAntesIVA,
        valorIVA,
        gastos,
        initialFee,
        gastosPendientes: gastos - initialFee,
        totalOperacion,
        saldoFinanciable,
        capitalUPAY,
        saldoPocketBike,
        contractDays,
        dailyRate,
        cuotaFinanciera,
        cuotaCloud,
        totalAmount: dailyRate * contractDays,
        totalFinanciero,
        totalCloud: cuotaCloud * contractDays,
        totalNetoUPAY: totalFinanciero - saldoPocketBike,
        tirPeriodo,
        eaCalculada,
        objetivoEA,
        cumpleObjetivo: eaCalculada === null
            ? null
            : eaCalculada <= objetivoEA + 1e-10
    };
}

/**
 * Wrapper seguro para calcular el desglose financiero sin lanzar excepciones
 * mientras el usuario está escribiendo en el formulario.
 */
export function safeCalcularPrecioMoto(params) {
    try {
        const dailyRate = Number(params?.dailyRate);
        const contractDays = parseInt(params?.contractDays, 10);
        const gastos = Number(params?.gastos) >= 0 ? Number(params?.gastos) : 1360000;
        let initialFee = Number(params?.initialFee) || 0;

        if (!dailyRate || dailyRate <= 0 || !contractDays || contractDays <= 0) {
            return {
                isValid: false,
                error: 'Ingresa tarifa diaria y días de contrato válidos.',
                data: null
            };
        }

        // Si la cuota inicial ingresada excede los gastos, la acotamos para el cálculo matemático
        // o permitimos el cálculo sin romper la interfaz
        const calcInitialFee = Math.min(initialFee, gastos);

        const data = calcularPrecioMoto({
            dailyRate,
            contractDays,
            gastos,
            initialFee: calcInitialFee,
            iva: params?.iva ?? 0.19,
            objetivoEA: params?.objetivoEA ?? 0.29,
            pagosPorAnio: params?.pagosPorAnio ?? 312,
            proporcionUPAY: params?.proporcionUPAY ?? 0.95
        });

        // Si initialFee original era mayor que gastos, reflejar los valores correspondientes
        if (initialFee !== calcInitialFee) {
            data.initialFee = initialFee;
            data.gastosPendientes = Math.max(0, gastos - initialFee);
            data.saldoFinanciable = Math.max(0, data.totalOperacion - initialFee);
        }

        return {
            isValid: true,
            error: null,
            data
        };
    } catch (err) {
        return {
            isValid: false,
            error: err.message,
            data: null
        };
    }
}
