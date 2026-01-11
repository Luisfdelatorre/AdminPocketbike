-- Devices/Vehicles Table
CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT UNIQUE NOT NULL,
    device_name TEXT NOT NULL,
    device_type TEXT DEFAULT 'pocketbike',
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Daily Invoices Table
-- One invoice per device per day (1-to-1 with payment)
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id TEXT UNIQUE NOT NULL,
    device_id TEXT NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD format
    amount INTEGER NOT NULL, -- Amount in cents (COP)
    status TEXT DEFAULT 'UNPAID', -- UNPAID, PENDING, PAID, FAILED, VOIDED
    payment_reference TEXT UNIQUE, -- Wompi transaction reference
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(device_id),
    UNIQUE(device_id, date) -- One invoice per device per day
);

-- Payments Table (1-to-1 with invoices)
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id TEXT UNIQUE NOT NULL,
    invoice_id TEXT NOT NULL,
    wompi_transaction_id TEXT UNIQUE, -- Wompi transaction ID
    payment_reference TEXT UNIQUE, -- Wompi reference for tracking
    amount INTEGER NOT NULL, -- Amount in cents
    currency TEXT DEFAULT 'COP',
    status TEXT DEFAULT 'PENDING', -- PENDING, APPROVED, DECLINED, ERROR, VOIDED
    payment_method TEXT, -- nequi, card, etc.
    payment_method_type TEXT,
    payer_email TEXT,
    payer_phone TEXT,
    wompi_response TEXT, -- JSON response from Wompi
    checkout_url TEXT, -- Wompi checkout URL
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id),
    UNIQUE(invoice_id) -- 1-to-1 relationship
);

-- Webhook Events Table (for idempotency and audit trail)
CREATE TABLE IF NOT EXISTS webhook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE NOT NULL, -- Wompi event ID
    event_type TEXT NOT NULL,
    transaction_id TEXT,
    payment_reference TEXT,
    status TEXT,
    signature TEXT,
    payload TEXT NOT NULL, -- Full JSON payload
    processed BOOLEAN DEFAULT 0,
    processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id) -- Prevent duplicate processing
);

-- Transaction Verifications Table (audit trail for manual verifications)
CREATE TABLE IF NOT EXISTS transaction_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_reference TEXT NOT NULL,
    verification_type TEXT DEFAULT 'manual', -- manual, scheduled, webhook
    wompi_status TEXT,
    local_status TEXT,
    match BOOLEAN,
    response TEXT, -- JSON response from Wompi API
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_reference) REFERENCES payments(payment_reference)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_device_date ON invoices(device_id, date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_ref ON invoices(payment_reference);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(payment_reference);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
