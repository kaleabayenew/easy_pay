# easy_pay

# SMS Monitor Backend API

## Overview
Node.js + Express + PostgreSQL backend for the EasyPay SMS Monitor application.

## Features
- RESTful API with TypeScript
- PostgreSQL database with Sequelize ORM
- JWT authentication
- HMAC signature verification
- Device management
- SMS logging
- Heartbeat monitoring

## Prerequisites
- Node.js 18+
- PostgreSQL 14+

## Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your database credentials:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sms_monitor
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
HMAC_SECRET=your_hmac_secret
```

### 3. Create PostgreSQL Database
```sql
CREATE DATABASE sms_monitor;
CREATE USER sms_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE sms_monitor TO sms_user;
```

### 4. Run Migrations
```bash
npm run migrate
```

### 5. Start Server
```bash
npm run dev  # Development
npm run build && npm start  # Production
```

## API Endpoints

Open `/` on the running service for a JSON API index with the available routes.
`GET /health` provides a health check.

All application endpoints are prefixed with `/api/v1`.

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/change-pin` - Change PIN (Bearer token required)
- `POST /api/v1/auth/request-otp` - Request a one-time password
- `POST /api/v1/auth/verify-otp` - Verify a one-time password

### SMS
- `POST /api/v1/sms` - Receive SMS (requires HMAC signature)
- `GET /api/v1/sms/logs/:deviceId` - Get SMS logs (Bearer token required)
- `POST /api/v1/sms/:id/retry` - Retry SMS (Bearer token required)
- `DELETE /api/v1/sms/:id` - Delete SMS (Bearer token required)

### Device
- `POST /api/v1/heartbeat` - Device heartbeat (requires HMAC signature)
- `GET /api/v1/devices` - List devices (Bearer token required)
- `GET /api/v1/devices/:deviceId` - Get device status (Bearer token required)
- `POST /api/v1/devices/:deviceId/deactivate` - Deactivate device (Bearer token and HMAC signature required)

## HMAC Signature Verification

All SMS and device endpoints require HMAC-SHA256 signature verification.

Headers required:
- `X-Signature`: HMAC-SHA256 signature
- `X-Device-ID`: Device identifier
- `X-Timestamp`: Request timestamp

The string to sign is: `timestamp + method + path + body`

## Database Schema

### Users Table
- id
- username (unique)
- password (hashed)
- isActive

### Devices Table
- deviceId (primary key)
- isActive
- lastHeartbeat
- simSerial
- phoneNumber
- isRooted
- registeredAt

### SMS Logs Table
- id
- sender
- body
- timestamp
- simSerial
- status (pending, sent, failed)
- retryCount
- serverResponse

## Security Features
- JWT authentication
- Password hashing with bcrypt
- HMAC signature verification
- Helmet.js security headers
- CORS enabled

## Development
```bash
npm run dev
```

Server runs on: http://localhost:3000

## Production
```bash
npm run build
npm start
```

## Health Check
GET http://localhost:3000/health
