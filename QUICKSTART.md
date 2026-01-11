# Quick Start Guide - Payments Wompi

## Step 1: Start MongoDB

### Option A: Local MongoDB (Recommended for development)
```bash
# Windows
net start MongoDB

# If MongoDB service doesn't exist, download from:
# https://www.mongodb.com/try/download/community
```

### Option B: MongoDB Atlas (Cloud - Free tier available)
1. Go to https://cloud.mongodb.com/
2. Create free cluster
3. Get connection string
4. Update `.env` → `MONGODB_URI=your-connection-string`

## Step 2: Get Wompi API Keys

1. Go to https://comercios.wompi.co/
2. Register/Login to your account
3. Go to **Developers** section
4. Copy your keys:
   - Public Key
   - Private Key
   - Events Secret

### For Testing (Sandbox Keys)
Wompi provides test credentials. You can also use these test keys initially:
```
WOMPI_PUBLIC_KEY=pub_test_XXX
WOMPI_PRIVATE_KEY=prv_test_XXX
WOMPI_EVENTS_SECRET=test_XXX
```

## Step 3: Configure Environment

The `.env` file should already exist. Update it with your Wompi keys:

```bash
# Open .env file and update these lines:
WOMPI_PUBLIC_KEY=pub_test_your_actual_key_here
WOMPI_PRIVATE_KEY=prv_test_your_actual_key_here
WOMPI_EVENTS_SECRET=your_actual_secret_here
```

## Step 4: Initialize Database

```bash
npm run init-db
```

This will:
- ✅ Connect to MongoDB
- ✅ Create collections with indexes
- ✅ Insert sample devices (BIKE001, BIKE002)

## Step 5: Generate Sample Invoices

```bash
npm run generate-invoices
```

This creates invoices for the last 7 days for testing.

## Step 6: Start the Server

```bash
npm run dev
```

You should see:
```
🚀 Payments-Wompi Server Started
================================
📍 Server: http://localhost:3000
🌍 Environment: development
💳 Wompi API: https://sandbox.wompi.co/v1
================================
```

## Step 7: Open Application

Visit: **http://localhost:3000**

### What You'll See:
1. **Device Selector** - Click on "Pocketbike #001"
2. **Unpaid Invoices** - List of pending invoices
3. **Payment Button** - "Pay Now" button
4. **Connection Status** - Green "Connected" indicator (SSE)

## Step 8: Test a Payment

1. Click **"Pocketbike #001"**
2. See unpaid invoices load
3. Click **"Pay Now"** button
4. New window opens with Wompi checkout
5. Use test card: **4242 4242 4242 4242**
6. Complete payment
7. Watch the UI update in real-time! ✨

## Troubleshooting

### MongoDB Connection Error
```
❌ MongoDB connection failed: connect ECONNREFUSED
```
**Solution**: Start MongoDB service or use MongoDB Atlas

### Wompi API Error
```
❌ Wompi API error: Invalid authorization header
```
**Solution**: Check your API keys in `.env` file

### No Invoices Showing
```
Run: npm run generate-invoices
```

### SSE Not Connecting
```
Check browser console for errors
Ensure server is running on port 3000
```

## Testing Checklist

- [ ] MongoDB is running
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` configured with Wompi keys
- [ ] Database initialized (`npm run init-db`)
- [ ] Sample invoices created (`npm run generate-invoices`)
- [ ] Server started (`npm run dev`)
- [ ] Application opened (http://localhost:3000)
- [ ] Device selected
- [ ] Invoices loaded
- [ ] Payment tested

## Useful Commands

```bash
# View MongoDB data (if using local MongoDB)
mongosh
> use payments-wompi
> db.invoices.find().pretty()
> db.payments.find().pretty()

# Create a new invoice manually
curl -X POST http://localhost:3000/api/invoices/create \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"BIKE001","date":"2026-01-05","amount":7000000}'

# Check payment status
curl http://localhost:3000/api/payments/status/REF-xxxxxxxxxxxx

# Trigger pending recovery
curl -X POST http://localhost:3000/api/webhooks/recover-pending \
  -H "Content-Type: application/json" \
  -d '{"olderThanMinutes":30}'
```

## What to Test

1. **Device Selection** - Click different devices
2. **Invoice Display** - Check unpaid invoices list
3. **Payment Flow** - Complete a test payment
4. **Real-Time Updates** - Watch SSE update the UI
5. **Payment History** - View completed payments
6. **Refresh Button** - Reload data manually

## Expected Behavior

### Before Payment:
- Invoice status: **UNPAID**
- Payment count badge shows number
- "Pay Now" button is enabled

### During Payment:
- Status shows **"⏳ Payment Pending"**
- New tab opens with Wompi checkout

### After Payment:
- SSE receives update
- Toast notification: **"✅ Payment Approved"**
- Invoice status: **PAID**
- Invoice count decreases
- History updates automatically

## Next Steps

Once everything works:

1. **Get Real Wompi Keys** - Switch from test to production
2. **Configure Webhooks** - Add webhook URL in Wompi dashboard
3. **Deploy to Production** - Use MongoDB Atlas + hosting platform
4. **Add Your Devices** - Replace sample bikes with real data
5. **Customize Amounts** - Adjust pricing in invoice generation

---

**Need Help?**
- Check `README.md` for full documentation
- Review `PROJECT_SUMMARY.md` for architecture details
- Check server logs for errors
- Verify MongoDB connection
- Ensure Wompi keys are correct

**Happy Testing! 🚀**
