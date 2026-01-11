# 🔐 Authentication System - Quick Start Guide

## ✅ Backend is Ready!

The authentication system has been integrated into your server. Here's how to use it:

---

## 🚀 **Step 1: Create Your First Admin**

Run this command to create an admin account:

```bash
npm run create-admin
```

**You'll be prompted for:**
- Email (e.g., admin@pocketbike.com)
- Name (e.g., John Doe)
- Password (minimum 8 characters)

**Example:**
```
═══════════════════════════════════
   Payments-Wompi Admin Setup
═══════════════════════════════════

📝 Create Admin User

Email: admin@pocketbike.com
Name: Admin User
Password: ********
Confirm Password: ********

🔐 Creating admin user...

✅ Admin user created successfully!
📧 Email: admin@pocketbike.com
👤 Name: Admin User
🎖️  Role: admin
🆔 User ID: user-xyz123

🔑 You can now login with these credentials.
```

---

## 🔑 **Step 2: Test Admin Login**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@pocketbike.com",
    "password": "your-password"
  }'
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "user-xyz123",
      "email": "admin@pocketbike.com",
      "name": "Admin User",
      "role": "admin",
      "permissions": ["all"]
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Save the token!** You'll need it for authenticated requests.

---

## 📌 **Step 3: Create Device PIN (for Customers)**

Use your admin token to create a PIN for a device:

```bash
curl -X POST http://localhost:3000/api/auth/create-device-pin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "deviceId": "BIKE001",
    "pin": "1234",
    "accessType": "temporary",
    "expiresIn": 30
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deviceId": "BIKE001",
    "accessType": "temporary",
    "expiresAt": "2026-02-04T18:47:00.000Z",
    "maxUses": null
  }
}
```

---

## 🏍️ **Step 4: Test Customer PIN Login**

Customer enters PIN to access their device:

```bash
curl -X POST http://localhost:3000/api/auth/device-pin \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "BIKE001",
    "pin": "1234"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deviceId": "BIKE001",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2026-02-04T18:47:00.000Z"
  }
}
```

---

## 🔒 **Step 5: Access Protected Resources**

### **As Admin (All Devices):**
```bash
curl http://localhost:3000/api/contracts/BIKE001/stats \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### **As Customer (Specific Device Only):**
```bash
curl http://localhost:3000/api/contracts/BIKE001/stats \
  -H "Authorization: Bearer DEVICE_TOKEN"
```

---

## 📋 **Authentication Endpoints**

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/login` | POST | None | Admin login |
| `/api/auth/device-pin` | POST | None | Customer PIN login |
| `/api/auth/register` | POST | Admin | Create new admin |
| `/api/auth/create-device-pin` | POST | Admin | Create device PIN |
| `/api/auth/me` | GET | Any | Get current user |
| `/api/auth/verify-token` | POST | None | Check token validity |

---

## 🎯 **Access Control Summary**

### **Admin Users Can:**
- ✅ View all devices
- ✅ Create/manage contracts
- ✅ Generate device PINs
- ✅ View all payments
- ✅ Create other admins
- ✅ Full system access

### **Device PIN Users Can:**
- ✅ View their specific device only
- ✅ See invoices for their device
- ✅ Make payments for their device
- ❌ Cannot access other devices
- ❌ Cannot modify contracts
- ❌ Cannot create PINs

---

## 🔐 **Security Best Practices**

1. **Strong Passwords:**
   - Minimum 8 characters
   - Mix of letters, numbers, symbols

2. **JWT Secret:**
   - Set `JWT_SECRET` in `.env`
   - Use a long, random string in production

3. **Device PINs:**
   - 4-6 digits recommended
   - Set expiration dates
   - Use `maxUses` for one-time access

4. **Token Storage:**
   - Store tokens in `localStorage` (frontend)
   - Include in `Authorization: Bearer TOKEN` header

---

## 🚨 **Important Notes**

### **Current Status:**
- ✅ Backend authentication: **COMPLETE**
- ⏳ Frontend UI: **In Progress** (next phase)
- ⏳ Route protection: **Optional** (currently open for testing)

### **For Production:**
1. Change `JWT_SECRET` to a strong random string
2. Enable HTTPS
3. Set proper CORS origins
4. Implement rate limiting
5. Add refresh tokens
6. Enable route protection

---

## ⚡ **Quick Test Commands**

```bash
# 1. Create admin
npm run create-admin

# 2. Login (save token)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pocketbike.com","password":"yourpassword"}'

# 3. Create PIN for BIKE001
curl -X POST http://localhost:3000/api/auth/create-device-pin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"deviceId":"BIKE001","pin":"1234","expiresIn":30}'

# 4. Test device PIN
curl -X POST http://localhost:3000/api/auth/device-pin \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"BIKE001","pin":"1234"}'
```

---

## 🎉 **You're Ready!**

The authentication system is live! Test it out and let me know if you want to:
1. Build the React frontend (login pages)
2. Enable route protection on all endpoints
3. Add more features (password reset, 2FA, etc.)

**Next:** Run `npm run create-admin` to get started! 🚀
