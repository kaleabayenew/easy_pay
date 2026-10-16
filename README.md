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

### Authentication
- `POST /api/v1/login` - User login
- `POST /api/v1/register` - User registration

### SMS
- `POST /api/v1/sms` - Receive SMS (requires HMAC signature)
- `GET /api/v1/sms/logs/:deviceId` - Get SMS logs

### Device
- `POST /api/v1/heartbeat` - Device heartbeat (requires HMAC signature)
- `POST /api/v1/device/status` - Get device status (requires HMAC signature)
- `POST /api/v1/device/deactivate` - Deactivate device (requires HMAC signature)

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
