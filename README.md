# Payments-Wompi System

A full-stack payment processing system integrated with Wompi (Colombia) for managing daily invoices, one-to-one payments, transaction verification, and real-time status updates.

## 🚀 Features

- ✅ **Wompi Integration** - Complete integration with Wompi API for Nequi and card payments
- ✅ **Daily Invoices** - Automatic generation of daily invoices per device
- ✅ **1-to-1 Payment Mapping** - Each invoice maps to exactly one payment
- ✅ **Idempotent Webhooks** - Duplicate-safe webhook processing
- ✅ **Transaction Verification** - Direct verification with Wompi API
- ✅ **Real-Time Updates** - Server-Sent Events (SSE) for instant payment status
- ✅ **MongoDB Storage** - Scalable document database with Mongoose ODM
- ✅ **Premium UI** - Beautiful glassmorphism design with smooth animations

## 📋 Requirements

- Node.js >= 18.x
- MongoDB >= 6.0 (local or MongoDB Atlas)
- Wompi account with API keys

## 🛠️ Installation

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Configure environment variables:**
```bash
cp .env.example .env
```

Edit `.env` and add your Wompi credentials:
```bash
WOMPI_PUBLIC_KEY=pub_test_your_public_key_here
WOMPI_PRIVATE_KEY=prv_test_your_private_key_here
WOMPI_EVENTS_SECRET=your_events_secret_here
MONGODB_URI=mongodb://localhost:27017/payments-wompi
```

3. **Initialize database:**
```bash
npm run init-db
```

4. **Start the server:**
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## 📁 Project Structure

```
webApp2026/
├── client/                 # Frontend application
│   ├── css/
│   │   └── styles.css     # Premium UI styles
│   ├── js/
│   │   └── main.js        # Frontend logic with SSE
│   └── index.html         # Main HTML
├── server/
│   ├── config/
│   │   └── config.js      # Configuration and constants
│   ├── database/
│   │   ├── connection.js  # MongoDB connection
│   │   └── init.js        # Database initialization
│   ├── models/            # Mongoose models
│   │   ├── Device.js
│   │   ├── Invoice.js
│   │   ├── Payment.js
│   │   └── WebhookEvent.js
│   ├── repositories/      # Data access layer
│   │   ├── invoiceRepository.js
│   │   ├── paymentRepository.js
│   │   └── webhookRepository.js
│   ├── services/          # Business logic
│   │   ├── wompiService.js
│   │   ├── paymentService.js
│   │   └── webhookService.js
│   ├── routes/            # API endpoints
│   │   ├── payments.js
│   │   ├── webhooks.js
│   │   ├── invoices.js
│   │   └── sse.js
│   ├── utils/
│   │   └── sseService.js  # Server-Sent Events
│   └── server.js          # Express server
├── package.json
└── .env.example
```

## 🔐 API Endpoints

### Payments
- `POST /api/payments/create-intent` - Create payment for oldest unpaid invoice
- `GET /api/payments/status/:reference` - Get payment status
- `GET /api/payments/unpaid/:deviceId` - Get unpaid invoices
- `GET /api/payments/history/:deviceId` - Get payment history
- `POST /api/payments/verify/:reference` - Manually verify transaction

### Webhooks
- `POST /api/webhooks/wompi` - Receive Wompi webhook events
- `POST /api/webhooks/recover-pending` - Recover stale pending payments

### Invoices
- `POST /api/invoices/create` - Create daily invoice
- `GET /api/invoices/:deviceId` - Get all invoices
- `GET /api/invoices/:deviceId/unpaid` - Get unpaid invoices

### Real-Time
- `GET /api/sse/subscribe` - Subscribe to real-time updates
- `GET /api/sse/status` - Get SSE connection status

## 💳 Payment Flow

1. **User selects device** → Loads unpaid invoices
2. **User clicks "Pay Now"** → Backend creates payment intent
3. **Backend calls Wompi** → Generates transaction and checkout URL
4. **User pays via Wompi** → Completes payment (Nequi, card, etc.)
5. **Wompi sends webhook** → Backend processes update (idempotent)
6. **SSE broadcasts update** → Frontend receives real-time notification
7. **Invoice marked as PAID** → UI updates automatically

## 🔄 Webhook Processing

Webhooks are processed idempotently to prevent duplicate updates:

1. Event arrives with unique `eventId`
2. Check if `eventId` already exists in database
3. If duplicate, return success without processing
4. If new, validate signature and process
5. Update payment and invoice status
6. Broadcast SSE event to connected clients
7. Mark event as processed

## 🛡️ Security Features

- ✅ Webhook signature validation
- ✅ Idempotent webhook processing
- ✅ Duplicate payment prevention (via unique constraints)
- ✅ Transaction verification with Wompi
- ✅ Status downgrade protection (APPROVED cannot be changed)
- ✅ Complete audit trail

## 🧪 Testing

### Create Sample Invoice
```bash
curl -X POST http://localhost:3000/api/invoices/create \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "BIKE001",
    "date": "2026-01-04",
    "amount": 5000000
  }'
```

### Manual Transaction Verification
```bash
curl -X POST http://localhost:3000/api/payments/verify/REF-xxxxxxxxxxxx
```

### Trigger Pending Recovery
```bash
curl -X POST http://localhost:3000/api/webhooks/recover-pending \
  -H "Content-Type: application/json" \
  -d '{"olderThanMinutes": 30}'
```

## 🎨 UI Features

- **Glassmorphism Design** - Modern frosted glass effect
- **Animated Gradients** - Dynamic background animations
- **Particle System** - Floating particles for depth
- **Real-Time Updates** - SSE-powered instant notifications
- **Toast Notifications** - Beautiful slide-in notifications
- **Responsive Design** - Works on all devices
- **Smooth Transitions** - Polished micro-interactions

## 🔧 Configuration

### MongoDB Atlas (Production)
Update `.env`:
```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/payments-wompi
```

### Wompi Production Keys
```bash
WOMPI_PUBLIC_KEY=pub_prod_xxxxx
WOMPI_PRIVATE_KEY=prv_prod_xxxxx
WOMPI_API_URL=https://production.wompi.co/v1
```

## 📊 Database Schema

### Devices
- `deviceId` (unique)
- `deviceName`
- `deviceType`
- `status`

### Invoices
- `invoiceId` (unique)
- `deviceId` + `date` (compound unique)
- `amount`
- `status` (UNPAID, PENDING, PAID, FAILED)
- `paymentReference`

### Payments (1-to-1 with Invoices)
- `paymentId` (unique)
- `invoiceId` (unique - enforces 1-to-1)
- `paymentReference` (unique)
- `wompiTransactionId`
- `status` (PENDING, APPROVED, DECLINED, ERROR)
- `wompiResponse`

### WebhookEvents (for idempotency)
- `eventId` (unique)
- `eventType`
- `payload`
- `processed`

## 🐛 Troubleshooting

**Issue**: Webhooks not processing
- Verify `WOMPI_EVENTS_SECRET` is correct
- Check webhook signature validation
- Review webhook logs in database

**Issue**: SSE not connecting
- Ensure server is running
- Check browser console for errors
- Verify CORS headers are set

**Issue**: Payments stuck in PENDING
- Run recovery: `POST /api/webhooks/recover-pending`
- Manually verify: `POST /api/payments/verify/:reference`

## 📝 License

ISC

## 👨‍💻 Author

Built with 💙 for Pocketbike rentals
