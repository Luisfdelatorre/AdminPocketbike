import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';
import companyService from '../services/companyService.js';
import axios from 'axios';

async function testWompi() {
    await mongoose.connect(MongoDB.URI);
    const db = mongoose.connection.db;

    const company = await db.collection('companies').findOne({ _id: new mongoose.Types.ObjectId('698c0c6c08d205baad1d206b') });
    console.log('Company wompiConfig:', {
        publicKey: company?.wompiConfig?.publicKey ? company.wompiConfig.publicKey.slice(0, 15) + '...' : 'none',
        hasPrivateKey: !!company?.wompiConfig?.privateKey,
        privateKeyPrefix: company?.wompiConfig?.privateKey ? company.wompiConfig.privateKey.slice(0, 15) + '...' : 'none'
    });

    const pubKey = company.wompiConfig.publicKey;
    const prvKey = company.wompiConfig.privateKey;

    const txIds = [
        { id: '1362970-1794496020-33257', ref: 'IFJ93I-2026-11-11-JS' },
        { id: '1362970-1794525444-33423', ref: 'XZQ63H-2026-11-10-EI' },
        // Compare with one that was updated successfully:
        { id: '1362970-1794616193-57364', ref: 'IFX22I-2026-11-13-ZF' }
    ];

    for (const tx of txIds) {
        console.log(`\nProbando ${tx.ref} (ID: ${tx.id}):`);
        // Test 1: GET /transactions/:id con public key
        try {
            const res = await axios.get(`https://production.wompi.co/v1/transactions/${tx.id}`, {
                headers: { Authorization: `Bearer ${pubKey}` }
            });
            console.log(`  [Public Key] Status: ${res.data.data.status} | Finalized: ${res.data.data.finalized_at}`);
        } catch (e) {
            console.log(`  [Public Key] Error: ${e.response?.status} - ${e.response?.data?.error?.reason || e.message}`);
        }

        // Test 2: GET /transactions/:id con private key
        try {
            const res = await axios.get(`https://production.wompi.co/v1/transactions/${tx.id}`, {
                headers: { Authorization: `Bearer ${prvKey}` }
            });
            console.log(`  [Private Key] Status: ${res.data.data.status} | Finalized: ${res.data.data.finalized_at}`);
        } catch (e) {
            console.log(`  [Private Key] Error: ${e.response?.status} - ${e.response?.data?.error?.reason || e.message}`);
        }

        // Test 3: GET /transactions?reference=:ref con private key
        try {
            const res = await axios.get(`https://production.wompi.co/v1/transactions?reference=${tx.ref}`, {
                headers: { Authorization: `Bearer ${prvKey}` }
            });
            const list = res.data.data || [];
            console.log(`  [By Reference] Encontradas: ${list.length}`);
            list.forEach(item => {
                console.log(`    -> ID: ${item.id} | Status: ${item.status} | Finalized: ${item.finalized_at}`);
            });
        } catch (e) {
            console.log(`  [By Reference] Error: ${e.response?.status} - ${e.response?.data?.error?.reason || e.message}`);
        }
    }

    await mongoose.disconnect();
}

testWompi().catch(console.error);

