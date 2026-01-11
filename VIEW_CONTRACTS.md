# Where to See Contracts & Stats

## 🌐 **Option 1: Web Browser (React UI)**

**Open your app:** http://localhost:5173/

1. **Select a device** (e.g., Pocketbike #001)
2. **View the Contract Progress card** - Shows:
   - ✅ Progress bar (% completed)
   - ✅ Days paid / Total days
   - ✅ Financial summary (paid vs remaining)
   - ✅ Contract dates
   - ✅ Contract status

The contract stats appear **automatically** on each device's payment page!

---

## 🔌 **Option 2: Direct API Calls**

### Get Contract Info:
```bash
curl http://localhost:3000/api/contracts/BIKE001
```

**Response:**
```json
{
  "success": true,
  "data": {
    "contractId": "CONTRACT-BIKE001-8oebpveg",
    "deviceId": "BIKE001",
    "dailyRate": 3000000,
    "contractDays": 500,
    "totalAmount": 1500000000,
    "paidDays": 0,
    "paidAmount": 0,
    "remainingDays": 500,
    "startDate": "2026-01-05",
    "endDate": "2027-05-20",
    "status": "ACTIVE"
  }
}
```

### Get Detailed Statistics:
```bash
curl http://localhost:3000/api/contracts/BIKE001/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "contractId": "CONTRACT-BIKE001-8oebpveg",
    "deviceId": "BIKE001",
    "totalDays": 500,
    "paidDays": 0,
    "remainingDays": 500,
    "dailyRate": 3000000,
    "totalAmount": 1500000000,
    "paidAmount": 0,
    "remainingAmount": 1500000000,
    "completionPercentage": "0.00",
    "startDate": "2026-01-05",
    "endDate": "2027-05-20",
    "status": "ACTIVE"
  }
}
```

### Get All Contracts (History):
```bash
curl http://localhost:3000/api/contracts/BIKE001/all
```

Returns all contracts (active, completed, cancelled).

---

## 📊 **Contract Stats Visualization**

The React component displays:

### **📈 Progress Bar**
- Visual progress indicator
- Percentage completed
- Days paid / Total days

### **💰 Financial Summary**
- Daily Rate: 30,000 COP
- Total Contract: 15,000,000 COP
- Paid Amount: (updates as payments are made)
- Remaining: (decreases with each payment)

### **📅 Contract Dates**
- Start Date
- End Date

### **🏷️ Status Badge**
- ACTIVE (green)
- COMPLETED (blue)
- SUSPENDED (yellow)
- CANCELLED (red)

---

## 🧪 **Test the UI Now**

1. **Open**: http://localhost:5173/
2. **Click**: "Pocketbike #001"
3. **See**: Contract Progress card with all stats!

---

## 📱 **What It Looks Like**

```
┌─────────────────────────────────────────┐
│ 📋 Contract Progress          [ACTIVE] │
├─────────────────────────────────────────┤
│                                         │
│  Progress: [████████░░░░░░] 0.00%     │
│  0 / 500 days paid    500 remaining    │
│                                         │
│  Daily Rate:        30,000 COP          │
│  Total Contract:    15,000,000 COP      │
│  Paid Amount:       0 COP               │
│  Remaining:         15,000,000 COP      │
│                                         │
│  📅 Start: 2026-01-05                  │
│  🏁 End: 2027-05-20                    │
│                                         │
│  Contract ID: CONTRACT-BIKE001-8oebpveg │
└─────────────────────────────────────────┘
```

---

## 🔄 **Auto-Update**

The contract stats will automatically update when:
- ✅ Payments are completed
- ✅ Status changes
- ✅ Page refreshes

---

## 🚀 **Quick Access**

| View | URL |
|------|-----|
| **UI** | http://localhost:5173/#/Id/BIKE001 |
| **API Stats** | http://localhost:3000/api/contracts/BIKE001/stats |
| **API Contract** | http://localhost:3000/api/contracts/BIKE001 |
| **All Contracts** | http://localhost:3000/api/contracts/BIKE001/all |

**Go check it out now!** 🎉
