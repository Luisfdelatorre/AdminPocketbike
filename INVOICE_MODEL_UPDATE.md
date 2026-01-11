# ✅ Invoice Model Update - contractId Field

## 🔧 **Issue Fixed:**

**Problem:** Added `contractId` as a **required** field to Invoice model, but existing invoices in the database don't have this field, causing 500 errors.

**Solution:** Changed `contractId` to be **optional** for backward compatibility.

---

## 📋 **Updated Invoice Model:**

```javascript
const invoiceSchema = new mongoose.Schema({
    invoiceId: { type: String, required: true, unique: true, index: true },
    contractId: { type: String, index: true }, // ← Optional (not required)
    deviceId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: Object.values(INVOICE_STATUS), default: INVOICE_STATUS.UNPAID, index: true },
    paymentReference: { type: String, unique: true, sparse: true, index: true },
}, {
    timestamps: true,
});
```

---

## 🎯 **Why Optional?**

### **Backward Compatibility:**
- ✅ Existing invoices without `contractId` still work
- ✅ No migration needed immediately
- ✅ New invoices can include `contractId`
- ✅ Old invoices can be updated later

### **Forward Path:**
1. **Phase 1 (Now):** `contractId` is optional
   - Existing invoices work
   - New invoices should include contractId

2. **Phase 2 (Migration):** Add contractId to old invoices
   - Run migration script to populate field
   - Match invoices to contracts by device + date

3. **Phase 3 (Future):** Make contractId required
   - Once all invoices have contractId
   - Change to `required: true`

---

## 🔄 **How to Use:**

### **Creating New Invoices (WITH contractId):**
```javascript
const invoice = await Invoice.create({
    invoiceId: "INV-BIKE001-2026-01-06",
    contractId: "CONTRACT-BIKE001-xyz123",  // ← Include this!
    deviceId: "BIKE001",
    date: "2026-01-06",
    amount: 3000000,
    status: "UNPAID"
});
```

### **Querying by Contract:**
```javascript
// Get all invoices for a contract
const invoices = await Invoice.find({ 
    contractId: "CONTRACT-BIKE001-xyz123" 
});

// Works even if some invoices don't have contractId
```

### **Finding Contract from Invoice:**
```javascript
const invoice = await Invoice.findOne({ invoiceId: "INV-xxx" });

if (invoice.contractId) {
    // New invoice with contractId
    const contract = await Contract.findOne({ contractId: invoice.contractId });
} else {
    // Old invoice without contractId - use fallback
    const contract = await Contract.findOne({
        deviceId: invoice.deviceId,
        startDate: { $lte: invoice.date },
        endDate: { $gte: invoice.date }
    });
}
```

---

## 🛠️ **Migration Script (For Later):**

When you're ready to populate `contractId` for all existing invoices:

```javascript
import { Invoice } from './server/models/Invoice.js';
import { Contract } from './server/models/Contract.js';
import { connectDatabase, disconnectDatabase } from './server/database/connection.js';

async function migrateInvoiceContractIds() {
    await connectDatabase();
    console.log('🔄 Migrating invoice contractIds...');
    
    // Find all invoices without contractId
    const invoicesWithoutContract = await Invoice.find({ 
        $or: [
            { contractId: { $exists: false } },
            { contractId: null }
        ]
    });
    
    console.log(`Found ${invoicesWithoutContract.length} invoices to migrate`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const invoice of invoicesWithoutContract) {
        // Find the contract that was active on this invoice date
        const contract = await Contract.findOne({
            deviceId: invoice.deviceId,
            startDate: { $lte: invoice.date },
            endDate: { $gte: invoice.date },
            status: { $in: ['ACTIVE', 'COMPLETED'] }
        }).sort({ createdAt: -1 }); // Get most recent if multiple
        
        if (contract) {
            invoice.contractId = contract.contractId;
            await invoice.save();
            updated++;
            console.log(`✅ ${invoice.invoiceId} → ${contract.contractId}`);
        } else {
            skipped++;
            console.log(`⚠️  ${invoice.invoiceId} - no matching contract found`);
        }
    }
    
    console.log(`\n✅ Migration complete:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    
    await disconnectDatabase();
}

// Run: node scripts/migrateContractIds.js
migrateInvoiceContractIds();
```

---

## 📊 **Current Status:**

✅ **Invoice Model:** Updated with optional `contractId`  
✅ **Server:** Running without errors  
✅ **API Endpoints:** All working  
✅ **Backward Compatible:** Old invoices still work  
✅ **Forward Compatible:** New invoices can include contractId  

---

## 🎯 **Next Steps:**

1. **Update Invoice Creation Logic:**
   - Modify `invoiceRepository.createInvoice()` to accept and save `contractId`
   - Pass `contractId` when creating invoices from contracts

2. **Run Migration (Optional):**
   - Use migration script to add `contractId` to existing invoices
   - Only needed if you want to query by contractId for old data

3. **Make Required (Future):**
   - Once all invoices have `contractId`, change to `required: true`
   - Enforce referential integrity

---

## 🔍 **Verification:**

**Test that it works:**
```bash
# Should return 200 OK
curl http://localhost:3000/api/payments/all?page=1&limit=20

# Should return contract data
curl http://localhost:3000/api/contracts/all

# Should return dashboard stats
curl http://localhost:3000/api/dashboard/stats
```

**All endpoints should work now!** ✅

---

## 📚 **Related Documentation:**

- `DATABASE_RELATIONSHIPS.md` - Full explanation of Contract → Invoice → Payment relationships
- `PAYMENT_REFERENCE.md` - How payment references work
- `IMPLEMENTATION_COMPLETE.md` - Payment reference implementation details

**The 500 error is fixed!** 🎉
