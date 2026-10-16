# EasyPay SMS Monitor — Backend Security & RESTful API Review

This backend is a Node/Express/TypeScript REST API that lets Android devices forward SMS messages (payment confirmations) to a central server. Authentication uses JWT for human users and HMAC-SHA256 for device-originated requests. The implementation is largely correct and well-structured, but two confirmed issues block shipping: a hardcoded fallback DB password in `database.ts` and a weak default PIN seed in `migrate.ts`. A third issue around the heartbeat response leaking a stale `isActive` value after an update is also confirmed.

**Watch for:** DB password hardcoded fallback (`'postgres'`) in `database.ts` (confirmed); default admin seeded with PIN `0000` in `migrate.ts` (confirmed); heartbeat returns stale `isActive` after update (confirmed); `crypto-js` dependency unused — production crypto done via Node built-in (confirmed).

**Verdict**: NEEDS_CHANGES

---

## High-level view

All 15 source files are present. Model associations (User→Device→SmsLog) are defined in `models/index.ts` and imported in `server.ts` via `import './models'`, so they register before any route handler runs. All six route groups specified in the task spec are present and wired correctly.

The `verifyHmac` middleware uses `crypto.createHmac('sha256', hmacSecret).update(stringToSign)` — message first, key as the `createHmac` argument — which is the correct Node.js calling convention. JWT never falls back to a hardcoded secret; both `authenticate` and `login` return HTTP 500 if `JWT_SECRET` is absent. `req.user` is typed through a proper module augmentation in `src/types/express.d.ts` with no `(req as any).user` casts anywhere. API responses never include the `pin` field.

The database config hard-codes `'postgres'` as the password fallback, so a missing `DB_PASSWORD` env var silently connects with a default credential instead of failing loudly. The migration utility seeds an admin account with PIN `0000` and no prompt or environment override, which is a credential hygiene issue in any environment where the migrate script runs. The heartbeat handler's JSON response reads `device.isActive` from the in-memory model instance before the `update()` call on the non-created path, so devices that get auto-deactivated (rooted flag) receive `isActive: true` and `shouldDeactivate: false` in the same response that stored `isActive: false` in the DB.

The `crypto-js` package is listed as a production dependency but no source file imports from it. All cryptographic work uses Node's built-in `crypto` module. The unused package adds supply-chain surface area for no benefit.

---

<details>
<summary>Issues (4)</summary>

1. **DB password hardcoded fallback** — `database.ts` falls back to `password: 'postgres'` when `DB_PASSWORD` is unset. Remove the fallback; throw or let Sequelize fail on an empty string so misconfiguration is surfaced immediately rather than silently connecting with a default credential.

2. **Default admin seeded with PIN `0000`** — `migrate.ts` creates an admin account with a well-known PIN. Change the seed to require `ADMIN_SEED_PIN` from the environment (and abort if absent), or remove the auto-seed entirely and document a first-run manual step.

3. **Heartbeat returns stale `isActive` after rooted-device deactivation** — On the non-created path, `device.isActive` is read before `device.update(updates)` completes, so a rooted device receives `{ isActive: true, shouldDeactivate: false }` in the same request that wrote `isActive: false` to the DB. Use the return value: `const updated = await device.update(updates)` and reference `updated.isActive` in the response.

4. **Unused `crypto-js` production dependency** — `crypto-js` is listed in `dependencies` and `@types/crypto-js` in `devDependencies`, but nothing imports it. Remove both entries to reduce supply-chain exposure.

</details>

---

<details>
<summary>Details</summary>

### DB password hardcoded fallback

`src/config/database.ts`:
```ts
password: process.env.DB_PASSWORD || 'postgres',
```
If `DB_PASSWORD` is absent from the environment, Sequelize connects with `'postgres'`. The server starts and appears healthy while connecting with a default credential. The fix is to omit the fallback string or explicitly `throw new Error('DB_PASSWORD is required')` before constructing the Sequelize instance.

### Default admin seeded with PIN `0000`

`src/utils/migrate.ts` seeds an admin user with `bcrypt.hash('0000', BCRYPT_ROUNDS)` and no mechanism to override the PIN via environment. Any environment where `npm run migrate` has been executed has a live admin account with a widely-known PIN until someone manually changes it. The seed should either read `ADMIN_SEED_PIN` from the environment (refusing to proceed if absent) or be removed in favour of documented first-run instructions.

### Heartbeat stale-read after deactivation

In `deviceController.ts`, the non-created branch:
```ts
if (isRooted === true) updates.isActive = false;
await device.update(updates);

res.json({
  success: true,
  isActive: device.isActive,          // reads pre-update value
  shouldDeactivate: !device.isActive, // same stale value
  ...
});
```
Sequelize's `instance.update()` returns the updated instance. Capturing it (`const updated = await device.update(updates)`) and referencing `updated.isActive` in the response fixes the stale read.

### Unused `crypto-js` dependency

`package.json` lists `"crypto-js": "^4.2.0"` in `dependencies` and `"@types/crypto-js": "^4.2.2"` in `devDependencies`. No file in `src/` imports from it. The actual HMAC work uses `import crypto from 'crypto'` (Node built-in). Remove both entries.

### Rate limiting scope

The in-memory rate limiter in `rateLimit.ts` will not enforce limits across multiple Node.js processes or instances. For the current single-server deployment this is acceptable, but horizontal scaling will require a Redis-backed limiter. The `x-forwarded-for` IP extraction takes only the first comma-separated value, which is correct behind a single trusted reverse proxy but can be spoofed if the proxy chain is not controlled.

</details>

---

<details>
<summary>File map</summary>

| File | Note |
|---|---|
| `src/server.ts` | Express bootstrap, helmet/cors, route mounting, graceful shutdown |
| `src/config/database.ts` | Sequelize instance — **hardcoded password fallback** |
| `src/models/User.ts` | User model (phone, hashed pin, role, isActive) |
| `src/models/Device.ts` | Device model (deviceId PK, userId FK, heartbeat metadata) |
| `src/models/SmsLog.ts` | SmsLog model (deviceId FK, sender, body, status, retryCount) |
| `src/models/index.ts` | Association definitions; re-exports all models |
| `src/controllers/authController.ts` | login, register, changePin |
| `src/controllers/deviceController.ts` | heartbeat, getDeviceStatus, listDevices, deactivateDevice — **stale isActive in heartbeat** |
| `src/controllers/smsController.ts` | receiveSms, getSmsLogs, retrySms, deleteSms |
| `src/routes/index.ts` | All route registrations with middleware chains |
| `src/middleware/auth.ts` | JWT authenticate + HMAC verifyHmac |
| `src/middleware/rateLimit.ts` | In-memory per-IP rate limiter |
| `src/middleware/validate.ts` | Generic required-field body validator |
| `src/types/express.d.ts` | Express Request augmentation for req.user |
| `src/utils/migrate.ts` | DB sync + admin seed — **seeds PIN `0000`** |

</details>
