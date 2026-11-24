import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';
import companyRepository from '../repositories/companyRepository.js';
import axios from 'axios';

async function testWompiDecrypted() {
    await mongoose.connect(MongoDB.URI);

    const company = await companyRepository.findByIdLean('698c0c6c08d205baad1d206b');
    const pubKey = company.wompiConfig.publicKey;
    const prvKey = company.wompiConfig.privateKey;

    console.log('Decrypted keys:');
    console.log('Public key prefix:', pubKey?.slice(0, 15));
    console.log('Private key prefix:', prvKey?.slice(0, 15));

    const txIds = [
        { id: '1362970-1794496020-33257', ref: 'IFJ93I-2026-11-11-JS', plate: 'IFJ93I', inv: 'IFJ93I-2026-11-11' },
        { id: '1362970-1794525444-33423', ref: 'XZQ63H-2026-11-10-EI', plate: 'XZQ63H', inv: 'XZQ63H-2026-11-12' },
        { id: '1362970-1794616193-57364', ref: 'IFX22I-2026-11-13-ZF', plate: 'IFX22I', inv: 'IFX22I-2026-11-13' }
    ];

    for (const tx of txIds) {
        console.log(`\n======================================================`);
        console.log(`Probando ${tx.plate} | Ref: ${tx.ref} | ID: ${tx.id}`);

        // 1. Consulta por ID con Public Key
        try {
            const res = await axios.get(`https://production.wompi.co/v1/transactions/${tx.id}`, {
                headers: { Authorization: `Bearer ${pubKey}` }
            });
            console.log(`  [Por ID] Status: ${res.data.data.status} | Finalized: ${res.data.data.finalized_at} | Amount: ${res.data.data.amount_in_cents / 100}`);
        } catch (e) {
            console.log(`  [Por ID] Error: ${e.response?.status} - ${e.response?.data?.error?.reason || e.message}`);
        }

        // 2. Consulta por Reference con Private Key
        try {
            const res = await axios.get(`https://production.wompi.co/v1/transactions?reference=${tx.ref}`, {
                headers: { Authorization: `Bearer ${prvKey}` }
            });
            const list = res.data.data || [];
            console.log(`  [Por Referencia] Coincidencias: ${list.length}`);
            list.forEach(item => {
                console.log(`    -> ID: ${item.id} | Status: ${item.status} | Finalized: ${item.finalized_at} | Amount: ${item.amount_in_cents / 100}`);
            });
        } catch (e) {
            console.log(`  [Por Referencia] Error: ${e.response?.status} - ${e.response?.data?.error?.reason || e.message}`);
        }
    }

    await mongoose.disconnect();
}

testWompiDecrypted().catch(console.error);

