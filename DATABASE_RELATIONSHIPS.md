# 📊 Database Relationships: Contracts, Invoices, and Payments

## 🎯 How to Trace Payments Back to Contracts

### **Updated Data Structure (With `contractId` in Invoice)**

```
Contract
    ↓ (has many)
Invoice
    ↓ (has one)
Payment
```

---

## 📋 Complete Relationship Chain

### **1. Contract Model**
```javascript
{
    contractId: "CONTRACT-BIKE001-xyz123",  // Unique contract ID
    deviceId: "BIKE001",
    customerName: "John Doe",
    dailyRate: 3000000,  // 30,000 COP
    contractDays: 500,
    startDate: "2026-01-05",
    endDate: "2027-05-20",
    status: "ACTIVE"
}
```

### **2. Invoice Model (UPDATED)**
```javascript
{
    invoiceId: "INV-BIKE001-2026-01-05",    // Unique invoice ID
    contractId: "CONTRACT-BIKE001-xyz123",   // ← NEW! Direct link to contract
    deviceId: "BIKE001",                     // Still kept for quick lookups
    date: "2026-01-05",
    amount: 3000000,  // Daily rate
    status: "UNPAID",
    paymentReference: null  // Set when payment is created
}
```

### **3. Payment Model**
```javascript
{
    paymentId: "PAY-abc123",
    invoiceId: "INV-BIKE001-2026-01-05",     // ← Links to Invoice
    paymentReference: "INV-BIKE001-2026-01-05", // Same as invoiceId (deterministic)
    amount: 3000000,
    status: "PENDING",
    wompiTransactionId: "1133374-xxx",       // From Wompi
    checkoutUrl: "https://..."
}
```

---

## 🔍 How to Find Contract from Payment

### **Method 1: Direct Query (BEST)**
```javascript
// Given a payment ID
const payment = await Payment.findOne({ paymentId: "PAY-abc123" });

// Get the invoice
const invoice = await Invoice.findOne({ invoiceId: payment.invoiceId });

// Get the contract directly!
const contract = await Contract.findOne({ contractId: invoice.contractId });

console.log(contract.contractId);  // "CONTRACT-BIKE001-xyz123"
console.log(contract.customerName);  // "John Doe"
```

### **Method 2: Aggregation Pipeline (For Reporting)**
```javascript
const paymentWithContract = await Payment.aggregate([
    { $match: { paymentId: "PAY-abc123" } },
    
    // Join with Invoice
    {
        $lookup: {
            from: 'invoices',
            localField: 'invoiceId',
            foreignField: 'invoiceId',
            as: 'invoice'
        }
    },
    { $unwind: '$invoice' },
    
    // Join with Contract
    {
        $lookup: {
            from: 'contracts',
            localField: 'invoice.contractId',
            foreignField: 'contractId',
            as: 'contract'
        }
    },
    { $unwind: '$contract' },
    
    // Project desired fields
    {
        $project: {
            paymentId: 1,
            amount: 1,
            status: 1,
            'invoice.date': 1,
            'contract.contractId': 1,
            'contract.customerName': 1,
            'contract.deviceId': 1
        }
    }
]);

console.log(paymentWithContract[0]);
// {
//   paymentId: "PAY-abc123",
//   amount: 3000000,
//   status: "APPROVED",
//   invoice: { date: "2026-01-05" },
//   contract: {
//     contractId: "CONTRACT-BIKE001-xyz123",
//     customerName: "John Doe",
//     deviceId: "BIKE001"
//   }
// }
```

---

## 🗃️ Index Strategy

With the new `contractId` field, we have efficient lookups:

```javascript
// Invoice indexes
invoiceSchema.index({ contractId: 1, date: 1 });  // Get all invoices for a contract
invoiceSchema.index({ deviceId: 1, date: 1 }, { unique: true });  // One invoice per device per day
invoiceSchema.index({ invoiceId: 1 }, { unique: true });  // Fast payment lookup
```

---

## 🔗 Foreign Key Relationships

```
Contract (1) ─────────── (Many) Invoice
Invoice  (1) ─────────── (1)    Payment
```

### **Benefits of Adding `contractId`:**

1. **✅ Direct Lookup**: No complex date range queries
2. **✅ Single Query**: `Invoice.findOne({ contractId: "..." })`
3. **✅ Performance**: Indexed foreign key
4. **✅ Data Integrity**: Can enforce relationships
5. **✅ Reporting**: Easy aggregation for contract analytics
6. **✅ Clear Ownership**: Each invoice belongs to exactly one contract

### **Why Keep `deviceId` in Invoice?**

Even though we have `contractId`, we keep `deviceId` because:
- **Fast Device Lookups**: `Invoice.find({ deviceId: "BIKE001" })` without joining
- **Device History**: Can see all invoices for a device across multiple contracts
- **Unique Constraint**: Enforces one invoice per device per day
- **Denormalization**: Trading small storage for query performance

---

## 📊 Example Queries

### **Get All Invoices for a Contract**
```javascript
const invoices = await Invoice.find({ contractId: "CONTRACT-BIKE001-xyz123" });
// Returns all daily invoices for this 500-day contract
```

### **Get All Payments for a Contract**
```javascript
const invoices = await Invoice.find({ 
    contractId: "CONTRACT-BIKE001-xyz123" 
});

const invoiceIds = invoices.map(inv => inv.invoiceId);

const payments = await Payment.find({ 
    invoiceId: { $in: invoiceIds } 
});
```

### **Contract Payment Summary**
```javascript
const summary = await Invoice.aggregate([
    { $match: { contractId: "CONTRACT-BIKE001-xyz123" } },
    {
        $lookup: {
            from: 'payments',
            localField: 'invoiceId',
            foreignField: 'invoiceId',
            as: 'payment'
        }
    },
    { $unwind: { path: '$payment', preserveNullAndEmptyArrays: true } },
    {
        $group: {
            _id: '$contractId',
            totalInvoices: { $sum: 1 },
            paidInvoices: {
                $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, 1, 0] }
            },
            totalAmount: { $sum: '$amount' },
            paidAmount: {
                $sum: { $cond: [{ $eq: ['$payment.status', 'APPROVED'] }, '$amount', 0] }
            }
        }
    }
]);

console.log(summary);
// {
//   _id: "CONTRACT-BIKE001-xyz123",
//   totalInvoices: 10,
//   paidInvoices: 5,
//   totalAmount: 30000000,  // 10 days × 30,000 COP
//   paidAmount: 15000000    // 5 days paid
// }
```

---

## 🔄 Migration Note

**Important:** If you have existing invoices in the database, you'll need to add the `contractId` field to them.

### **Migration Script Example:**
```javascript
import { Invoice } from './models/Invoice.js';
import { Contract } from './models/Contract.js';

async function migrateInvoices() {
    const invoices = await Invoice.find({ contractId: { $exists: false } });
    
    for (const invoice of invoices) {
        // Find contract by device and date range
        const contract = await Contract.findOne({
            deviceId: invoice.deviceId,
            startDate: { $lte: invoice.date },
            endDate: { $gte: invoice.date },
            status: { $in: ['ACTIVE', 'COMPLETED'] }
        });
        
        if (contract) {
            invoice.contractId = contract.contractId;
            await invoice.save();
            console.log(`✅ Updated invoice ${invoice.invoiceId} → ${contract.contractId}`);
        } else {
            console.log(`⚠️  No contract found for invoice ${invoice.invoiceId}`);
        }
    }
}
```

---

## 📝 Summary

### **Before (Indirect Relationship)**
```
Payment → Invoice → Device ← Contract
                    (complex date range query needed)
```

### **After (Direct Relationship)**
```
Payment → Invoice → Contract
         ↓
       Device
```

**With `contractId` in Invoice:**
- ✅ **Simple**: One field links invoice to contract
- ✅ **Fast**: Indexed lookups
- ✅ **Clear**: Direct foreign key relationship
- ✅ **Scalable**: Works with millions of records

**The payment chain is now:** Payment ID → Invoice ID → Contract ID → All Contract Details

This makes it trivial to answer questions like:
- "Which contract does this payment belong to?"
- "Who is the customer for this payment?"
- "How many days are left on this contract?"
- "What's the total revenue for contract X?"

**All with simple, efficient queries!** 🚀
