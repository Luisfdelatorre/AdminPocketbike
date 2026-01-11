# Batch Payment - Sequential Processing

## How to Pay 3 Invoices Sequentially

### API Endpoint
```
POST /api/payments/create-batch-intent
```

### Request Body
```json
{
  "deviceId": "BIKE001",
  "count": 3,
  "customerEmail": "customer@example.com"
}
```

### Response
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "success": true,
        "invoice": { "invoiceId": "INV-BIKE001-20260104-xxx", "amount": 5000000 },
        "payment": { "paymentReference": "REF-xxx", "status": "PENDING" },
        "checkoutUrl": "https://checkout.wompi.co/l/xxx"
      },
      {
        "success": true,
        "invoice": { "invoiceId": "INV-BIKE001-20260103-xxx", "amount": 4500000 },
        "payment": { "paymentReference": "REF-yyy", "status": "PENDING" },
        "checkoutUrl": "https://checkout.wompi.co/l/yyy"
      },
      {
        "success": true,
        "invoice": { "invoiceId": "INV-BIKE001-20260102-xxx", "amount": 6000000 },
        "payment": { "paymentReference": "REF-zzz", "status": "PENDING" },
        "checkoutUrl": "https://checkout.wompi.co/l/zzz"
      }
    ],
    "errors": [],
    "totalProcessed": 3,
    "successCount": 3,
    "errorCount": 0
  }
}
```

## Test with cURL

```bash
curl -X POST http://localhost:3000/api/payments/create-batch-intent \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "BIKE001",
    "count": 3,
    "customerEmail": "test@example.com"
  }'
```

## How It Works (Sequentially)

```javascript
// Processing happens ONE BY ONE, not in parallel:

// Step 1: Process Invoice #1
console.log("1/3 Processing invoice: INV-BIKE001-20260104-xxx");
await createWompiTransaction(invoice1);  // Wait for this to finish
console.log("✅ Payment created for INV-BIKE001-20260104-xxx");

// Step 2: Process Invoice #2 (after #1 completes)
console.log("2/3 Processing invoice: INV-BIKE001-20260103-xxx");
await createWompiTransaction(invoice2);  // Wait for this to finish
console.log("✅ Payment created for INV-BIKE001-20260103-xxx");

// Step 3: Process Invoice #3 (after #2 completes)
console.log("3/3 Processing invoice: INV-BIKE001-20260102-xxx");
await createWompiTransaction(invoice3);  // Wait for this to finish
console.log("✅ Payment created for INV-BIKE001-20260102-xxx");

console.log("📦 Batch payment complete: 3 successful, 0 failed");
```

## Key Features

✅ **Sequential Processing** - Invoices processed one at a time (not in parallel)
✅ **Error Handling** - If one invoice fails, the others continue
✅ **Skip Paid Invoices** - Already paid invoices are automatically skipped
✅ **Oldest First** - Processes invoices from oldest to newest
✅ **Configurable Count** - Pay 1-10 invoices at once
✅ **Multiple Checkout URLs** - Returns array of checkout URLs for each payment

## Server Logs Example

```
📦 Creating batch payment for 3 invoices sequentially...
  1/3 Processing invoice: INV-BIKE001-20260104-abc123
  ✅ Payment created for INV-BIKE001-20260104-abc123: REF-xxx
  2/3 Processing invoice: INV-BIKE001-20260103-def456
  ✅ Payment created for INV-BIKE001-20260103-def456: REF-yyy
  3/3 Processing invoice: INV-BIKE001-20260102-ghi789
  ✅ Payment created for INV-BIKE001-20260102-ghi789: REF-zzz
📦 Batch payment complete: 3 successful, 0 failed
```

## Frontend Usage

You can open all checkout URLs in separate tabs:

```javascript
const response = await fetch('/api/payments/create-batch-intent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    deviceId: 'BIKE001',
    count: 3,
    customerEmail: 'customer@example.com'
  })
});

const { data } = await response.json();

// Open each checkout URL in a new tab
data.results.forEach((result, index) => {
  if (result.success) {
    setTimeout(() => {
      window.open(result.checkoutUrl, `_blank_${index}`);
    }, index * 1000); // Stagger by 1 second
  }
});
```

## Why Sequential?

**Sequential processing ensures:**
1. ✅ No race conditions
2. ✅ Wompi API not overwhelmed
3. ✅ Database constraints properly enforced
4. ✅ Clear audit trail
5. ✅ Easier debugging
6. ✅ Better error recovery

## Limitations

- **Max 10 invoices** per batch (safety limit)
- **Takes longer** than parallel (but more reliable)
- **Each payment is independent** (each has its own checkout URL)
