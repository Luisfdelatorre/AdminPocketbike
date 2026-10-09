/**
 * Utilidades de cálculo financiero para Contratos PocketBike (Backend)
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

    const saldoFinanciableObjetivo = valorPresenteCuotas / (
        proporcionUPAY + proporcionPocketBike * descuentoFinal
    );

    const precioExacto = (
        saldoFinanciableObjetivo - gastos + initialFee
    ) / (1 + iva);

    const precioAntesIVA = Math.max(0, Math.ceil(precioExacto));
    const valorIVA = precioAntesIVA * iva;
    const totalOperacion = precioAntesIVA + valorIVA + gastos;
    const saldoFinanciable = totalOperacion - initialFee;
    const capitalUPAY = saldoFinanciable * proporcionUPAY;
    const saldoPocketBike = saldoFinanciable * proporcionPocketBike;
    const totalFinanciero = cuotaFinanciera * contractDays;

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

export function safeCalcularPrecioMoto(params) {
    try {
        const dailyRate = Number(params?.dailyRate);
        const contractDays = parseInt(params?.contractDays, 10);
        const gastos = Number(params?.gastos) >= 0 ? Number(params?.gastos) : 1360000;
        let initialFee = Number(params?.initialFee) || 0;

        if (!dailyRate || dailyRate <= 0 || !contractDays || contractDays <= 0) {
            return null;
        }

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

        if (initialFee !== calcInitialFee) {
            data.initialFee = initialFee;
            data.gastosPendientes = Math.max(0, gastos - initialFee);
            data.saldoFinanciable = Math.max(0, data.totalOperacion - initialFee);
        }

        return data;
    } catch (err) {
        return null;
    }
}
