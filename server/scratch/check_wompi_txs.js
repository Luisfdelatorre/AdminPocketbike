import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';
import companyService from '../services/companyService.js';

async function checkWompiTransactions() {
    await mongoose.connect(MongoDB.URI, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;

    const companyId = '698c0c6c08d205baad1d206b';
    const wompiAdapter = await companyService.getWompiAdapter(companyId);

    const txs = [
        { plate: 'IFJ93I', invoiceId: 'IFJ93I-2026-11-11', txId: '1362970-1794496020-33257', reference: 'IFJ93I-2026-11-11-JS' },
        { plate: 'XZQ63H', invoiceId: 'XZQ63H-2026-11-12', txId: '1362970-1794525444-33423', reference: 'XZQ63H-2026-11-10-EI' }
    ];

    console.log('Consultando estado en Wompi API para las 2 transacciones...\n');

    for (const item of txs) {
        console.log(`--------------------------------------------------`);
        console.log(`Consultando ${item.plate} | Invoice: ${item.invoiceId} | Tx ID: ${item.txId} | Ref: ${item.reference}`);
        try {
            const wompiData = await wompiAdapter.getTransactionStatus(item.txId);
            console.log('Respuesta Wompi:', {
                id: wompiData._id,
                status: wompiData.status,
                reference: wompiData.reference,
                finalized_at: wompiData.finalized_at,
                payment_method_type: wompiData.payment_method_type
            });

            // Si está aprobada, actualizar en BD (payments e invoices)
            if (wompiData.status === 'APPROVED' && wompiData.finalized_at) {
                console.log(`-> Transacción está APPROVED en Wompi con fecha: ${wompiData.finalized_at}`);
                
                // Actualizar payment
                await db.collection('payments').updateOne(
                    { _id: item.txId },
                    {
                        $set: {
                            status: 'APPROVED',
                            finalized_at: wompiData.finalized_at,
                            updatedAt: new Date()
                        }
                    }
                );
                console.log(`-> Payment actualizado a APPROVED`);

                // Actualizar invoice
                await db.collection('invoices').updateOne(
                    { _id: item.invoiceId },
                    {
                        $set: {
                            paid: true,
                            'transaction.finalized_at': wompiData.finalized_at,
                            paymentDate: wompiData.finalized_at,
                            'transaction.id': item.txId,
                            'transaction.reference': item.reference
                        }
                    }
                );
                console.log(`-> Invoice actualizada con finalized_at`);
            } else {
                console.log(`-> Transacción en Wompi NO está APPROVED (Status: ${wompiData.status})`);
            }
        } catch (err) {
            console.error(`Error consultando transacción ${item.txId}:`, err.response?.data || err.message);
        }
    }

    await mongoose.disconnect();
}

checkWompiTransactions().catch(console.error);

