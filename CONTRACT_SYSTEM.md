# 500-Day Contract Management System

## Overview

Each device has a **fixed 500-day rental contract** with daily payments of **~30,000 COP** (3,000,000 cents).

## Contract Structure

```javascript
{
  contractId: "CONTRACT-BIKE001-abc123",
  deviceId: "BIKE001",
  
  // Financial Details
  dailyRate: 3000000,           // 30,000 COP in cents
  contractDays: 500,             // 500 days total
  totalAmount: 1500000000,       // 15,000,000 COP total (500 × 30,000)
  
  // Progress Tracking
  paidDays: 25,                  // 25 days paid so far
  paidAmount: 75000000,          // 750,000 COP paid
  remainingDays: 475,            // 475 days left
  
  // Dates
  startDate: "2026-01-05",
  endDate: "2027-06-19",         // 500 days after start
  
  // Customer Info
  customerName: "Juan Pérez",
  customerEmail: "juan@example.com",
  customerPhone: "+57 300 123 4567",
  customerDocument: "1234567890",
  
  // Status
  status: "ACTIVE"               // ACTIVE, COMPLETED, CANCELLED, SUSPENDED
}
```

## Setup

### 1. Create Contracts

```bash
npm run create-contracts
```

This creates 500-day contracts for BIKE001 and BIKE002.

**Output:**
```
✅ Created contract: CONTRACT-BIKE001-xyz123
   Device: BIKE001
   Daily Rate: 30,000 COP
   Total Days: 500
   Total Amount: 15,000,000 COP
   Start Date: 2026-01-05
   End Date: 2027-06-19
```

### 2. Create Manual Contract

```bash
curl -X POST http://localhost:3000/api/contracts/create \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "BIKE003",
    "dailyRate": 3000000,
    "contractDays": 500,
    "startDate": "2026-01-05",
    "customerName": "María García",
    "customerEmail": "maria@example.com",
    "customerPhone": "+57 300 555 1234",
    "customerDocument": "987654321",
    "notes": "Premium 500-day contract"
  }'
```

## API Endpoints

### Get Active Contract

```bash
GET /api/contracts/BIKE001
```

**Response:**
```json
{
  "success": true,
  "data": {
    "contractId": "CONTRACT-BIKE001-abc123",
    "deviceId": "BIKE001",
    "dailyRate": 3000000,
    "contractDays": 500,
    "totalAmount": 1500000000,
    "paidDays": 0,
    "remainingDays": 500,
    "startDate": "2026-01-05",
    "endDate": "2027-06-19",
    "status": "ACTIVE"
  }
}
```

### Get Contract Statistics

```bash
GET /api/contracts/BIKE001/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "contractId": "CONTRACT-BIKE001-abc123",
    "deviceId": "BIKE001",
    "totalDays": 500,
    "paidDays": 25,
    "remainingDays": 475,
    "dailyRate": 3000000,
    "totalAmount": 1500000000,
    "paidAmount": 75000000,
    "remainingAmount": 1425000000,
    "completionPercentage": "5.00",
    "startDate": "2026-01-05",
    "endDate": "2027-06-19",
    "status": "ACTIVE"
  }
}
```

### Get All Contracts (History)

```bash
GET /api/contracts/BIKE001/all
```

Returns all contracts for a device (active, completed, cancelled).

### Update Contract Status

```bash
PUT /api/contracts/CONTRACT-BIKE001-abc123/status
Content-Type: application/json

{
  "status": "SUSPENDED"
}
```

**Valid Statuses:**
- `ACTIVE` - Contract is active and generating invoices
- `COMPLETED` - All 500 days paid
- `CANCELLED` - Contract cancelled early
- `SUSPENDED` - Temporarily suspended

### Get Expiring Contracts

```bash
GET /api/contracts/expiring/30
```

Returns contracts expiring within 30 days.

## How Payments Update Contracts

When a payment is approved, the contract automatically updates:

```javascript
// In webhookService.js or paymentService.js
await contractRepository.updateContractProgress(
    contractId,
    paidAmount: 3000000,  // 30,000 COP
    paidDays: 1           // 1 day paid
);
```

**Result:**
- `paidAmount` increases by 30,000 COP
- `paidDays` increases by 1
- `remainingDays` decreases by 1
- Status→`COMPLETED` when `paidDays === 500`

## Contract Lifecycle

```
DAY 0: Contract Created
├──  Status: ACTIVE
├──  Paid Days: 0
└──  Remaining: 500 days

DAY 1-499: Daily Payments
├──  Generate daily invoice (30,000 COP)
├──  User pays
├──  Update contract progress
└──  Track completion percentage

DAY 500: Final Payment
├──  Last invoice paid
├──  Status → COMPLETED
└──  Contract ends
```

## Integration with Invoices

### Generate Invoices Based on Contract

```javascript
// Automatic: Generate daily invoices for active contracts
const contract = await contractRepository.getActiveContractByDevice('BIKE001');

if (contract && contract.status === 'ACTIVE') {
    const today = formatDate(new Date());
    
    // Create invoice with contract's daily rate
    await invoiceRepository.createInvoice({
        deviceId: contract.deviceId,
        date: today,
        amount: contract.dailyRate,  // 30,000 COP
        metadata: {
            contractId: contract.contractId,
            dayNumber: contract.paidDays + 1  // Which day of the contract
        }
    });
}
```

## Frontend Display

Display contract info on the payment page:

```javascript
// Fetch contract stats
const response = await fetch(`/api/contracts/${deviceId}/stats`);
const { data } = await response.json();

// Show progress
<div className="contract-info">
  <h3>Contract Progress</h3>
  <div className="progress-bar">
    <div style={{ width: `${data.completionPercentage}%` }}></div>
  </div>
  <p>{data.paidDays} / {data.totalDays} days paid</p>
  <p>{data.remainingDays} days remaining</p>
  <p>Ends: {data.endDate}</p>
</div>
```

## Financial Summary

**Per Device:**
- Daily Rate: **30,000 COP**
- Contract Days: **500**
- Total Contract Value: **15,000,000 COP**

**For 2 Devices (BIKE001 + BIKE002):**
- Total Revenue: **30,000,000 COP**
- Duration: **500 days (~16.5 months)**

## Automation Ideas

### 1. Auto-Generate Daily Invoices

Use a cron job to create daily invoices for all active contracts:

```javascript
// Every day at midnight
cron.schedule('0 0 * * *', async () => {
    const activeContracts = await Contract.find({ status: 'ACTIVE' });
    
    for (const contract of activeContracts) {
        await createDailyInvoice(contract);
    }
});
```

### 2. Contract Expiration Alerts

```javascript
// Check daily for contracts expiring soon
const expiringContracts = await contractRepository.getExpiringContracts(30);

for (const contract of expiringContracts) {
    await sendExpirationEmail(contract.customerEmail, contract);
}
```

### 3. Auto-Complete Contracts

```javascript
// Mark completed when all days are paid
if (contract.paidDays >= contract.contractDays) {
    await contractRepository.updateContractStatus(
        contract.contractId,
        'COMPLETED'
    );
}
```

## Example Workflow

```
1. Create Contract
   → POST /api/contracts/create
   → Contract saved with 500-day term

2. Daily Invoice Generation (Backend Cron)
   → For each active contract
   → Create invoice with dailyRate
   → Send payment reminder

3. User Makes Payment
   → Completes Wompi checkout
   → Webhook received
   → Invoice marked PAID
   → Contract.paidDays++ 
   → Contract.paidAmount += dailyRate

4. Track Progress
   → GET /api/contracts/{deviceId}/stats
   → Show completion percentage
   → Display remaining days

5. Contract Completion
   → paidDays reaches 500
   → Status → COMPLETED
   → Final notification sent
```

## Next Steps

1. **Run**: `npm run create-contracts` to initialize contracts
2. **Test**: GET `/api/contracts/BIKE001/stats`
3. **Integrate**: Update payment webhooks to update contract progress
4. **Display**: Show contract info in React payment page
5. **Automate**: Add cron job for daily invoice generation

---

**Your devices now have proper 500-day contracts! 📋🚀**
