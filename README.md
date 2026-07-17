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

- Node.js `20.18.1` or newer (the lockfile resolves Cheerio 1.2, which requires this version).
- SSH access to `root@198.74.54.252` with the assigned password or SSH key.
- Wompi sandbox credentials for testing payments.
- Optional: access to the configured Traccar or MegaRastreo GPS service for device synchronization.

## 🛠️ Installation

1. **Install dependencies:**
```bash
npm ci
```

2. **Create local environment variables:**
```bash
cp .env.example .env
```

At minimum, set your own secrets in `.env`:
```bash
NODE_ENV=development
JWT_SECRET=replace-with-a-long-random-secret
ENCRYPTION_KEY=replace-with-a-local-encryption-key
FRONTEND_URL=http://localhost:5173
```

The main server connects to `127.0.0.1:27018`. The SSH tunnel below forwards that local port to the team MongoDB server, so no local MongoDB or Docker container is needed. `MONGODB_URI` in `.env` is used by some utility scripts but does not override the main server connection. Wompi and some GPS credentials are also currently defined in `server/config/components/services.js`.

3. **Open the database tunnel in a dedicated terminal:**
```bash
npm run dev:db-tunnel
```

The command asks for the SSH password when no key is configured and remains running while the tunnel is open. Keep this terminal open.

Do not run `npm run init-db` against this tunnel: it creates sample records in the shared database. That command is only for an isolated local database.

4. **Start the backend in a second terminal:**
```bash
npm run dev:api
```

5. **Start the Vite frontend in a third terminal:**
```bash
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/apinode` and `/p` to the backend on port `8084`.

For a production-style local run, build first and then start the server:
```bash
npm run build
PORT=7083 npm start
```
The built application is then served at `http://localhost:7083`.

### Local database alternative

When a team database tunnel is not available, start an isolated MongoDB instance on the same port:
```bash
docker run --rm --name pocketbike-mongo -p 27018:27017 mongo:7
```

Only with this isolated database may you run:
```bash
npm run init-db
```

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

All backend routes use the `/apinode` prefix.

### Payments
- `POST /apinode/payments/create-intent` - Create payment for oldest unpaid invoice
- `GET /apinode/payments/status/:reference` - Get payment status
- `GET /apinode/payments/unpaid/:deviceId` - Get unpaid invoices
- `GET /apinode/payments/history/:deviceId` - Get payment history
- `POST /apinode/payments/verify/:reference` - Manually verify transaction

### Webhooks
- `POST /apinode/webhooks/wompi` - Receive Wompi webhook events
- `POST /apinode/webhooks/recover-pending` - Recover stale pending payments

### Invoices
- `POST /apinode/invoices/create` - Create daily invoice
- `GET /apinode/invoices/:deviceId` - Get all invoices
- `GET /apinode/invoices/:deviceId/unpaid` - Get unpaid invoices

### Real-Time
- `GET /apinode/sse/subscribe` - Subscribe to real-time updates
- `GET /apinode/sse/status` - Get SSE connection status

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
curl -X POST http://localhost:8084/apinode/invoices/create \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "BIKE001",
    "date": "2026-01-04",
    "amount": 5000000
  }'
```

### Manual Transaction Verification
```bash
curl -X POST http://localhost:8084/apinode/payments/verify/REF-xxxxxxxxxxxx
```

### Trigger Pending Recovery
```bash
curl -X POST http://localhost:8084/apinode/webhooks/recover-pending \
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

The main connection is currently hardcoded to the local URI in `server/config/components/core.js`. To use Atlas, update that configuration (or externalize it before deployment) and provide the Atlas connection string:
```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/payments-wompi
```

### Wompi Production Keys
```bash
WOMPI_PUBLIC_KEY=pub_prod_xxxxx
WOMPI_PRIVATE_KEY=prv_prod_xxxxx
WOMPI_API_URL=https://production.wompi.co/v1
```

These variables are documented for the intended deployment model, but the current Wompi service still uses values defined in `server/config/components/services.js`; move those values to environment variables before production use.

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
- Verify the Wompi events secret configured by the backend is correct
- Check webhook signature validation
- Review webhook logs in database

**Issue**: SSE not connecting
- Ensure server is running
- Check browser console for errors
- Verify CORS headers are set

**Issue**: Payments stuck in PENDING
- Run recovery: `POST /apinode/webhooks/recover-pending`
- Manually verify: `POST /apinode/payments/verify/:reference`

## 📝 License

ISC

## 👨‍💻 Author

Built with 💙 for Pocketbike rentals
