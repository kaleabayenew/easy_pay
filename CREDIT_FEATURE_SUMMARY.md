# EasyPay Credit Feature Implementation

## Files Created

1. **src/models/CreditTransaction.ts** - New model for credit transaction history
2. **src/services/creditService.ts** - Credit adjustment service with transaction safety
3. **src/services/creditEvents.ts** - SSE hub for real-time credit updates
4. **src/controllers/creditController.ts** - Credit API endpoints
5. **src/routes/creditRoutes.ts** - Credit route definitions
6. **test_credit.sh** - Test script for credit functionality

## Files Modified

1. **src/models/User.ts** - Changed credit column from DECIMAL(10,2) to DECIMAL(12,2)
2. **src/models/index.ts** - Added CreditTransaction model and associations
3. **src/middleware/auth.ts** - Added `requireAdmin` and `authenticateStream` middleware
4. **src/middleware/rateLimit.ts** - Added `creditRateLimit` (20 req/min)
5. **src/controllers/superadminController.ts** - Added credit to createOwner, getOwners, getOwnersWithApiKeys; exported logAudit
6. **src/controllers/authController.ts** - Added credit to login and createOwner; records initial credit transaction
7. **src/controllers/otpController.ts** - Added credit to verifyOtp response
8. **src/controllers/transactionController.ts** - Added TODO hook for automatic credit deduction
9. **src/routes/index.ts** - Added credit routes and requireAdmin protection on create-owner

## API Endpoints

### Superadmin (Admin Only)
- `POST /api/v1/superadmin/owners/:id/credit` - Add/subtract credit
- `GET /api/v1/superadmin/owners/:id/credit-history` - Get transaction history
- `GET /api/v1/superadmin/owners/:id/credit` - Get current balance
- `GET /api/v1/superadmin/credit/stream` - SSE stream for all credit updates

### Owner (Authenticated)
- `GET /api/v1/auth/me/credit` - Get own balance
- `GET /api/v1/auth/me/credit/history` - Get own transaction history
- `GET /api/v1/auth/me/credit/stream` - SSE stream for own credit updates

## Database Schema

### CreditTransaction Table
- `id` (autoincrement)
- `ownerId` (FK to users.id, CASCADE)
- `type` ('initial' | 'add' | 'subtract')
- `amount` DECIMAL(12,2)
- `balanceBefore` DECIMAL(12,2)
- `balanceAfter` DECIMAL(12,2)
- `reason` TEXT (nullable)
- `performedBy` STRING
- `createdAt`, `updatedAt`
- Index on (ownerId, createdAt)

### User Table
- `credit` DECIMAL(12,2) default 0 (widened from 10,2)

## Assumptions

1. Credit is in Ethiopian Birr (ETB) with 2 decimal places
2. Credit changes are manual (admin-only) - automatic deduction on transaction verification is a TODO hook
3. PINs remain plaintext for OTP compatibility
4. JWT tokens use {userId, phone, role} - device_user tokens have no userId
5. Owner IDs can be "12" or "own_12" format in URLs
6. Sequelize sync({ alter: true }) will create the new table automatically
7. SSE hub is in-memory - scaling would require Redis pub/sub

## Manual Steps Required

1. **No manual migrations needed** - Sequelize sync({ alter: true }) will create the CreditTransaction table automatically on server restart
2. **No new environment variables** - Uses existing JWT_SECRET
3. **Test the endpoints** - Run `test_credit.sh` (requires server running on localhost:3000)

## Testing

Run the test script:
```bash
cd backend
chmod +x test_credit.sh
./test_credit.sh
```

Or manually test with curl:
```bash
# 1. Login
curl -X POST http://localhost:3000/superadmin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"kaleab","password":"Kale@1513","two_factor_code":"1315"}'

# 2. Create owner with credit
curl -X POST http://localhost:3000/superadmin/owners \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Owner","contact_phone":"+251911223344","pin":"1234","password":"Test@123","credit":"5000"}'

# 3. Add credit
curl -X POST http://localhost:3000/api/v1/superadmin/owners/own_1/credit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"add","amount":1500,"reason":"Deposit"}'

# 4. SSE stream (in separate terminal)
curl -N http://localhost:3000/api/v1/superadmin/credit/stream \
  -H "Authorization: Bearer $TOKEN"
```

## Security Notes

- All credit adjustment endpoints require admin role
- Rate limited to 20 requests per minute per IP
- All changes logged to audit trail
- Transactions use Sequelize row locking to prevent race conditions
- Credit stored as cents internally to avoid float errors
- Balance cannot go negative
- Maximum single operation: 10,000,000 ETB
- Maximum balance: 9,999,999,999.99 ETB
