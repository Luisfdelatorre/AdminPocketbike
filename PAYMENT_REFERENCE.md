# Payment Reference Architecture

## 🎯 Overview

The payment system now uses **invoiceId** as the **paymentReference**, eliminating the need for random reference generation and creating a cleaner, more deterministic system.

---

## 📋 ID Structure

### **Before (Random References):**
```
Invoice:  INV-BIKE001-2026-01-05
Payment:  PAY-abc123xyz456
Reference: REF-randomchars  ❌ Extra random ID
```

### **After (Deterministic):**
```
Invoice:  INV-BIKE001-2026-01-05
Payment:  PAY-abc123xyz456  
Reference: INV-BIKE001-2026-01-05  ✅ Same as invoiceId
```

---

## 🔄 Payment Flow

### **1. Create Invoice**
```javascript
invoiceId = "INV-BIKE001-2026-01-05"
// Deterministic: deviceId + date
```

### **2. Create Payment**
```javascript
{
  paymentId: "PAY-abc123xyz456",        // Internal ID
  invoiceId: "INV-BIKE001-2026-01-05",  // Links to invoice
  paymentReference: "INV-BIKE001-2026-01-05", // ← Same as invoiceId!
  amount: 3000000,
  status: "PENDING"
}
```

### **3. Send to Wompi**
```javascript
await wompi.createPaymentSource({
  reference: "INV-BIKE001-2026-01-05",  // ← Our invoiceId
  amount_in_cents: 3000000,
  currency: "COP"
})

// Wompi responds:
{
  id: "1133374-1765414770-30952",      // Wompi's transaction ID
  reference: "INV-BIKE001-2026-01-05",  // Echoes our invoiceId
  ...
}
```

### **4. Store Wompi Response**
```javascript
payment.wompiTransactionId = "1133374-1765414770-30952"
payment.checkoutUrl = "https://checkout.wompi.co/..."
```

### **5. Webhook Arrives**
```javascript
POST /api/webhooks/wompi
{
  event: "transaction.updated",
  data: {
    reference: "INV-BIKE001-2026-01-05",  // ← Find payment by this
    transaction: {
      id: "1133374-1765414770-30952",
      status: "APPROVED"
    }
  }
}

// Easy lookup:
payment = getPaymentByReference("INV-BIKE001-2026-01-05")
invoice = getInvoiceById("INV-BIKE001-2026-01-05")
// Both found with same identifier!
```

---

## ✅ Benefits

### **1. Simpler Architecture**
- ❌ Before: 3 IDs (paymentId, invoiceId, paymentReference)
- ✅ After: paymentReference = invoiceId (2 unique IDs)

### **2. Direct Invoice Lookup**
```javascript
// Webhook comes in with reference
const reference = "INV-BIKE001-2026-01-05"

// One query gets both:
const invoice = await getInvoiceById(reference)
const payment = await getPaymentByReference(reference)
// Same ID finds both! ✨
```

### **3. Human Readable**
```
❌ Before: REF-a1b2c3d4e5f6 (meaningless)
✅ After:  INV-BIKE001-2026-01-05 (tells you device + date)
```

### **4. Deterministic**
- You know the reference BEFORE creating the payment
- Can construct URL callbacks easily
- Customer support can reference by date

### **5. No Duplicates**
- invoiceId is unique per device per day
- paymentReference inherits that uniqueness
- Can't accidentally create duplicate payments

---

## 🗂️ Database Schema

### **Payment Model:**
```javascript
{
  paymentId: String,        // PAY-xyz123 (internal tracking)
  invoiceId: String,        // INV-BIKE001-2026-01-05 (links to invoice)
  paymentReference: String, // INV-BIKE001-2026-01-05 (same as invoiceId!)
  wompiTransactionId: String, // 1133374-xxx (Wompi's ID)
  amount: Number,
  status: String,
  checkoutUrl: String,
  wompiResponse: Object
}
```

### **Why Keep Both invoiceId AND paymentReference?**

While they now have the **same value**, they serve different purposes:

- **`invoiceId`**: Database foreign key relationship
- **`paymentReference`**: What we send to/receive from Wompi

Keeping both fields allows:
1. Clear separation of concerns
2. Easy Wompi webhook matching
3. Flexibility if we ever need different references

---

## 📊 Comparison

| Aspect | Before (Random) | After (InvoiceId) |
|--------|----------------|-------------------|
| **IDs per payment** | 3 unique | 2 unique |
| **Reference format** | REF-randomchars | INV-DEVICE-DATE |
| **Human readable** | ❌ No | ✅ Yes |
| **Predictable** | ❌ No | ✅ Yes |
| **Webhook lookup** | By reference | By invoice OR reference (same!) |
| **Support** | Need to look up | Can identify from ID |

---

## 🚀 Example Complete Flow

```javascript
// Day 1: 2026-01-05
// System creates invoice
invoice = {
  invoiceId: "INV-BIKE001-2026-01-05",
  deviceId: "BIKE001",
  date: "2026-01-05",
  amount: 3000000,
  status: "UNPAID"
}

// User wants to pay
payment = createPayment({
  invoiceId: "INV-BIKE001-2026-01-05",
  amount: 3000000
})
// Result:
{
  paymentId: "PAY-abc123",
  invoiceId: "INV-BIKE001-2026-01-05",
  paymentReference: "INV-BIKE001-2026-01-05", // ← Reuses invoiceId
  status: "PENDING"
}

// Send to Wompi with reference = "INV-BIKE001-2026-01-05"
wompiResponse = await createPaymentSource(...)
// Wompi gives back:
{
  id: "1133374-xxx",
  reference: "INV-BIKE001-2026-01-05" // Our invoice ID
}

// User pays at Wompi checkout
// Webhook arrives:
{
  reference: "INV-BIKE001-2026-01-05",
  transaction: { id: "1133374-xxx", status: "APPROVED" }
}

// Process webhook - one lookup gets everything:
payment = getPaymentByReference("INV-BIKE001-2026-01-05")
invoice = getInvoiceById("INV-BIKE001-2026-01-05")
// Update both:
payment.status = "APPROVED"
invoice.status = "PAID"
invoice.paymentReference = "INV-BIKE001-2026-01-05"
```

---

## 🎯 Summary

**Payment Reference = Invoice ID**

This design:
- ✅ Eliminates unnecessary random IDs
- ✅ Makes webhooks easier to process
- ✅ Provides human-readable references
- ✅ Maintains 1-to-1 payment-invoice relationship
- ✅ Works perfectly with Wompi's API

**The reference is now meaningful, not random!** 🚀
