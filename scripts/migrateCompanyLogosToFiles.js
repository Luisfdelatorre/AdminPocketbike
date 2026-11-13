import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase } from '../server/database/connection.js';
import { Company } from '../server/models/Company.js';
import { saveLogoToFile } from '../server/utils/logoStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await connectDatabase();

        const companies = await Company.find({}).lean();
        console.log(`📋 Found ${companies.length} total companies.`);

        let migratedCount = 0;

        for (const company of companies) {
            const rawLogo = company.logo;
            if (typeof rawLogo === 'string' && rawLogo.startsWith('data:image/')) {
                console.log(`\n📦 Migrating logo for company: "${company.displayName || company.name}" (${company._id})`);
                console.log(`   Original Base64 length: ${rawLogo.length} characters`);

                const staticPath = await saveLogoToFile(company._id.toString(), rawLogo);
                console.log(`   Saved static file to: ${staticPath}`);

                // Update company in database
                await Company.updateOne(
                    { _id: company._id },
                    { $set: { logo: staticPath } }
                );

                migratedCount++;
            } else {
                console.log(`   Company "${company.displayName || company.name}": logo is already static ("${rawLogo || 'default'}")`);
            }
        }

        console.log(`\n✅ Migration complete! Migrated ${migratedCount} company logos to static files.`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();

